const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let bot = null;

process.on('uncaughtException', (err) => {
    console.error('CRITICAL UNCAUGHT EXCEPTION:', err);
    if (io) io.emit('log', `Fatal System Error: ${err.message}`);
    // Reset bot state if it crashes
    bot = null;
    if (io) io.emit('botStatus', 'Disconnected');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION:', reason);
    if (io) io.emit('log', `Fatal System Promise Rejection: ${reason}`);
});

io.on('connection', (socket) => {
    console.log('A user connected to the dashboard');

    // Send current status immediately upon connection
    socket.emit('botStatus', bot ? 'Connected' : 'Disconnected');

    socket.on('startBot', (config) => {
        if (bot) {
            socket.emit('log', 'Bot is already running. Please stop it first.');
            return;
        }

        try {
            socket.emit('log', `Starting bot for ${config.host}...`);
            socket.emit('botStatus', 'Connecting');
            
            const botConfig = {
                host: config.host || 'localhost',
                port: parseInt(config.port) || 25565,
                username: config.username || 'AFK_Bot',
                auth: config.auth || 'offline',
                hideErrors: true,
                checkTimeoutInterval: 120000 // IMPORTANT: Wait 2 whole minutes for the server instead of default 30s!
            };
            if (config.version) {
                 botConfig.version = config.version;
            }

            bot = mineflayer.createBot(botConfig);

            bot.on('login', () => {
                socket.emit('log', `Bot successfully logged in as ${bot.username}`);
                socket.emit('botStatus', 'Connected');
            });

            bot.on('spawn', () => {
                if (config.onJoinCommand) {
                    // Start attempting login/register commands
                    setTimeout(() => {
                        if (!bot) return; // Fix crash if kicked before timeout
                        socket.emit('log', `Executing on-join command: ${config.onJoinCommand}`);
                        try { bot.chat(config.onJoinCommand); } catch(e) {}
                    }, 2500); // Wait 2.5s to ensure the server is ready to receive it
                }
            });

            bot.on('windowOpen', (window) => {
                socket.emit('log', `[Action Required] Server opened a GUI Window: ${window.title} (Type: ${window.type})`);
                
                // If it's an Anvil inventory, servers often use this for passwords!
                if (window.type === 'minecraft:anvil' || window.type === 'anvil') {
                    if (config.onJoinCommand) {
                        let pwd = config.onJoinCommand.replace('/login ', '').replace('/register ', '');
                        socket.emit('log', `Anvil detected! Typing password (${pwd}) into the text box and clicking Done...`);
                        
                        try {
                            // Send the rename packet to update the text box
                            bot._client.write('name_item', { name: pwd });
                            
                            // Wait a short moment then click the output slot (slot 2 usually in anvil) to submit
                            setTimeout(() => {
                                if (!bot) return;
                                try {
                                    bot.clickWindow(2, 0, 0); 
                                    socket.emit('log', `Submitted Anvil password!`);
                                } catch(e) { socket.emit('log', `Error clicking window: ${e.message}`); }
                            }, 500);
                        } catch(e) {
                            socket.emit('log', `Failed to interact with Anvil: ${e.message}`);
                        }
                    } else {
                        socket.emit('log', 'WARNING: Server is asking for a password in a GUI but your On-Join Command is empty!');
                    }
                }
            });

            try {
                if (bot._client) {
                    bot._client.on('open_sign_entity', (packet) => {
                         socket.emit('log', `[Action Required] Server opened a Sign for text input!`);
                         if (config.onJoinCommand) {
                             let pwd = config.onJoinCommand.replace('/login ', '').replace('/register ', '');
                             socket.emit('log', `Attempting to place password inside sign...`);
                             try {
                                 bot._client.write('update_sign', {
                                     location: packet.location,
                                     text1: pwd,
                                     text2: "",
                                     text3: "",
                                     text4: ""
                                 });
                             } catch(e) { socket.emit('log', `Error writing sign packet: ${e.message}`); }
                         }
                    });
                }
            } catch(e) {}

            bot.on('resourcePack', (url, hash) => {
                socket.emit('log', 'Server requested resource pack. Attempting to accept/bypass...');
                try {
                    bot.acceptResourcePack();
                } catch(e) {
                    // Ignore error if it fails
                }
            });

            bot.on('chat', (username, message) => {
                if (username === bot.username) return; // Prevent echoing own messages mostly
                socket.emit('chatMessage', `[${username}] ${message}`);
            });

            bot.on('message', (message) => {
                // Some server messages come here
                socket.emit('chatMessage', message.toString());
            });

            bot.on('end', () => {
                socket.emit('log', 'Bot disconnected from server.');
                socket.emit('botStatus', 'Disconnected');
                bot = null;
            });

            bot.on('error', (err) => {
                socket.emit('log', `Bot Error: ${err.message}`);
                socket.emit('botStatus', 'Disconnected');
                bot = null;
            });

            bot.on('kicked', (reason, loggedIn) => {
                let reasonStr = typeof reason === 'string' ? reason : JSON.stringify(reason);
                socket.emit('log', `Bot Kicked: ${reasonStr}`);
                socket.emit('botStatus', 'Disconnected');
                bot = null;
            });

        } catch (error) {
            socket.emit('log', `Exception starting bot: ${error.message}`);
            socket.emit('botStatus', 'Disconnected');
            if (bot) { try { bot.quit(); } catch(e){} }
            bot = null;
        }
    });

    socket.on('stopBot', () => {
        if (bot) {
            socket.emit('log', 'Stopping bot...');
            bot.quit();
            bot = null;
            socket.emit('botStatus', 'Disconnected');
        } else {
            socket.emit('log', 'Bot is not running.');
        }
    });

    socket.on('sendChat', (message) => {
        if (bot && bot.chat) {
            bot.chat(message);
            socket.emit('log', `You sent: ${message}`);
        } else {
            socket.emit('log', 'Cannot send chat: Bot is not connected.');
        }
    });

    socket.on('requestTabComplete', async (text) => {
        if (bot && bot.entity) {
            try {
                // Tab complete via mineflayer 
                const matches = await bot.tabComplete(text);
                socket.emit('tabCompleteResults', matches);
            } catch (e) {
                socket.emit('tabCompleteResults', []);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`=========================================`);
    console.log(` AFK Bot server is running!`);
    console.log(` Dashboard is accessible at:`);
    console.log(` Local: http://localhost:${PORT}`);
    console.log(` Mobile/Network: http://<YOUR_PC_IP>:${PORT}`);
    console.log(`=========================================`);
});
