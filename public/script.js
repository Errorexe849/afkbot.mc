const socket = io();

// Authentication Logic
const authOverlay = document.getElementById('authOverlay');
const accessKeyInput = document.getElementById('accessKeyInput');
const loginBtn = document.getElementById('loginBtn');
const authError = document.getElementById('authError');

loginBtn.addEventListener('click', () => {
    if (accessKeyInput.value === 'error') {
        authOverlay.classList.add('hidden');
        setTimeout(() => authOverlay.style.display = 'none', 500); // Remove from DOM flow after fade
    } else {
        authError.style.display = 'block';
        accessKeyInput.style.borderColor = 'var(--danger)';
        setTimeout(() => {
            authError.style.display = 'none';
            accessKeyInput.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        }, 2000);
    }
});

accessKeyInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loginBtn.click();
});

// UI Elements
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');

const hostInput = document.getElementById('hostInput');
const portInput = document.getElementById('portInput');
const usernameInput = document.getElementById('usernameInput');
const versionInput = document.getElementById('versionInput');
const authInput = document.getElementById('authInput');
const onJoinCommandInput = document.getElementById('onJoinCommandInput');

const logsContainer = document.getElementById('logsContainer');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');

// Helper to add logs
function addLog(message, isChat = false) {
    const entry = document.createElement('div');
    entry.className = 'log-entry ' + (isChat ? 'chat' : 'system');
    
    // Add timestamp
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    entry.innerHTML = `<span class="time">[${timeStr}]</span> ${escapeHtml(message)}`;
    
    logsContainer.appendChild(entry);
    logsContainer.scrollTop = logsContainer.scrollHeight;
}

function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

// Socket Listeners
socket.on('connect', () => {
    addLog('Connected to Dashboard Server');
});

socket.on('disconnect', () => {
    addLog('Disconnected from Dashboard Server');
    updateStatus('Disconnected');
});

socket.on('botStatus', (status) => {
    updateStatus(status);
});

socket.on('log', (message) => {
    addLog(message, false);
});

socket.on('chatMessage', (message) => {
    addLog(message, true);
});

function updateStatus(status) {
    statusText.textContent = status;
    statusDot.className = 'dot'; // Reset

    if (status === 'Connected') {
        statusDot.classList.add('connected');
        startBtn.disabled = true;
        stopBtn.disabled = false;
        hostInput.disabled = true;
        portInput.disabled = true;
        usernameInput.disabled = true;
        authInput.disabled = true;
        if(onJoinCommandInput) onJoinCommandInput.disabled = true;
    } else if (status === 'Connecting' || status === 'Connecting...') {
        statusDot.classList.add('connecting');
        startBtn.disabled = true;
        stopBtn.disabled = false;
        hostInput.disabled = true;
        portInput.disabled = true;
        usernameInput.disabled = true;
        authInput.disabled = true;
        if(onJoinCommandInput) onJoinCommandInput.disabled = true;
    } else { // Disconnected
        startBtn.disabled = false;
        stopBtn.disabled = true;
        hostInput.disabled = false;
        portInput.disabled = false;
        usernameInput.disabled = false;
        if(versionInput) versionInput.disabled = false;
        authInput.disabled = false;
        if(onJoinCommandInput) onJoinCommandInput.disabled = false;
    }
}

// Actions
startBtn.addEventListener('click', () => {
    const config = {
        host: hostInput.value.trim() || 'localhost',
        port: portInput.value.trim() || '25565',
        username: usernameInput.value.trim() || 'AFK_Farmer',
        version: versionInput ? versionInput.value.trim() : '',
        auth: authInput.value,
        onJoinCommand: onJoinCommandInput ? onJoinCommandInput.value.trim() : ''
    };
    socket.emit('startBot', config);
    // Save to local storage for convenience
    localStorage.setItem('afkBotConfig', JSON.stringify(config));
});

stopBtn.addEventListener('click', () => {
    socket.emit('stopBot');
});

sendChatBtn.addEventListener('click', () => {
    const msg = chatInput.value.trim();
    if (msg) {
        socket.emit('sendChat', msg);
        chatInput.value = '';
    }
});

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendChatBtn.click();
    }
});

// Quick action
function sendQuickCommand(cmd) {
    socket.emit('sendChat', cmd);
    addLog('Sent quick command: ' + cmd);
}

// Load saved config
window.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem('afkBotConfig');
    if (saved) {
        try {
            const config = JSON.parse(saved);
            if(config.host) hostInput.value = config.host;
            if(config.port) portInput.value = config.port;
            if(config.username) usernameInput.value = config.username;
            if(config.version && versionInput) versionInput.value = config.version;
            if(config.auth) authInput.value = config.auth;
            if(config.onJoinCommand && onJoinCommandInput) onJoinCommandInput.value = config.onJoinCommand;
        } catch(e) {}
    }
});
