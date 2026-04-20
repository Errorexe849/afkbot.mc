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
function addLog(message, isChat = false, username = null) {
    const entry = document.createElement('div');
    entry.className = 'log-entry ' + (isChat ? 'chat' : 'system');
    if (username) entry.classList.add('player-chat');
    
    // Add timestamp
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    if (username) {
        // Player chat: show colored username separately
        entry.innerHTML = `<span class="time">[${timeStr}]</span> <span class="chat-username">${escapeHtml(username)}</span> <span class="chat-separator">»</span> ${escapeHtml(message)}`;
    } else {
        entry.innerHTML = `<span class="time">[${timeStr}]</span> ${escapeHtml(message)}`;
    }
    
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

socket.on('chatMessage', (data) => {
    if (typeof data === 'object' && data.text) {
        if (data.type === 'player' && data.username) {
            // Player chat — extract just the message part (after the » separator)
            const msgPart = data.text.includes('»') ? data.text.split('»').slice(1).join('»').trim() : data.text;
            addLog(msgPart, true, data.username);
        } else {
            // System/server message
            addLog(data.text, true);
        }
    } else {
        // Fallback for plain string (backwards compat)
        addLog(String(data), true);
    }
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

let selectedSuggestionIndex = -1;
const autocompleteBox = document.getElementById('autocompleteBox');

function sendChat() {
    const msg = chatInput.value.trim();
    if (msg) {
        socket.emit('sendChat', msg);
        chatInput.value = '';
        autocompleteBox.classList.add('hidden');
    }
}

sendChatBtn.addEventListener('click', sendChat);

chatInput.addEventListener('keydown', (e) => {
    const suggestions = autocompleteBox.querySelectorAll('.suggestion-item');
    if (e.key === 'Enter') {
        if (!autocompleteBox.classList.contains('hidden') && selectedSuggestionIndex >= 0) {
            e.preventDefault();
            suggestions[selectedSuggestionIndex].click();
        } else {
            sendChat();
        }
    } else if (e.key === 'Tab') {
        e.preventDefault();
        if (suggestions.length > 0) {
            suggestions[Math.max(0, selectedSuggestionIndex)].click();
        }
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (selectedSuggestionIndex < suggestions.length - 1) {
            selectedSuggestionIndex++;
            updateSuggestionHighlight(suggestions);
        }
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (selectedSuggestionIndex > 0) {
            selectedSuggestionIndex--;
            updateSuggestionHighlight(suggestions);
        }
    }
});

chatInput.addEventListener('input', () => {
    const val = chatInput.value;
    if (val.startsWith('/')) {
        socket.emit('requestTabComplete', val);
    } else {
        autocompleteBox.classList.add('hidden');
    }
});

function updateSuggestionHighlight(suggestions) {
    suggestions.forEach((el, index) => {
        if (index === selectedSuggestionIndex) {
            el.classList.add('selected');
            el.scrollIntoView({ block: 'nearest' });
        } else {
            el.classList.remove('selected');
        }
    });
}

socket.on('tabCompleteResults', (results) => {
    if (!results || results.length === 0 || !chatInput.value.startsWith('/')) {
        autocompleteBox.classList.add('hidden');
        return;
    }
    
    autocompleteBox.innerHTML = '';
    selectedSuggestionIndex = -1;
    
    results.forEach((match, index) => {
        const text = typeof match === 'string' ? match : match.match;
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.textContent = text;
        
        div.addEventListener('click', () => {
            const words = chatInput.value.split(' ');
            words[words.length - 1] = text;
            chatInput.value = words.join(' ') + ' ';
            chatInput.focus();
            autocompleteBox.classList.add('hidden');
        });
        
        autocompleteBox.appendChild(div);
    });
    
    autocompleteBox.classList.remove('hidden');
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

    // Request scoreboard data on load (in case bot is already connected)
    socket.emit('requestScoreboard');
});

// ========== SCOREBOARD ==========
const scoreboardStatus = document.getElementById('scoreboardStatus');
const scoreboardContent = document.getElementById('scoreboardContent');
const sidebarBoard = document.getElementById('sidebarBoard');
const objectivesGrid = document.getElementById('objectivesGrid');
const refreshScoreboardBtn = document.getElementById('refreshScoreboard');
const tabSidebar = document.getElementById('tabSidebar');
const tabObjectives = document.getElementById('tabObjectives');
const tabContentSidebar = document.getElementById('tabContentSidebar');
const tabContentObjectives = document.getElementById('tabContentObjectives');

// Strip Minecraft color codes (§x) for clean display
function stripColorCodes(str) {
    if (!str) return '';
    return str.replace(/§[0-9a-fk-or]/gi, '').replace(/\\u00a7[0-9a-fk-or]/gi, '');
}

// Clean up JSON-style display names
function cleanDisplayName(name) {
    if (!name) return '';
    let cleaned = name;
    // Try to parse JSON chat component
    try {
        const parsed = JSON.parse(cleaned);
        if (parsed.text !== undefined) {
            cleaned = parsed.text;
            if (parsed.extra && Array.isArray(parsed.extra)) {
                parsed.extra.forEach(e => {
                    if (e.text) cleaned += e.text;
                });
            }
        }
    } catch(e) {
        // Not JSON, use as-is
    }
    return stripColorCodes(cleaned);
}

// Tab switching
function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.scoreboard-tab-content').forEach(tc => tc.classList.remove('active'));

    if (tabName === 'sidebar') {
        tabSidebar.classList.add('active');
        tabContentSidebar.classList.add('active');
    } else {
        tabObjectives.classList.add('active');
        tabContentObjectives.classList.add('active');
    }
}

tabSidebar.addEventListener('click', () => switchTab('sidebar'));
tabObjectives.addEventListener('click', () => switchTab('objectives'));

// Refresh button
refreshScoreboardBtn.addEventListener('click', () => {
    socket.emit('requestScoreboard');
    refreshScoreboardBtn.style.transform = 'rotate(360deg)';
    setTimeout(() => { refreshScoreboardBtn.style.transform = ''; }, 400);
});

// Render scoreboard data
function renderScoreboard(data) {
    if (!data) {
        scoreboardStatus.style.display = 'flex';
        scoreboardContent.classList.add('hidden');
        scoreboardStatus.innerHTML = `
            <div class="scoreboard-empty">
                <span class="empty-icon">🔌</span>
                <p>Connect the bot to view scoreboard data</p>
            </div>`;
        return;
    }

    const hasSidebar = data.sidebar && data.sidebar.length > 0;
    const hasObjectives = data.rawObjectives && Object.keys(data.rawObjectives).length > 0;

    if (!hasSidebar && !hasObjectives) {
        scoreboardStatus.style.display = 'flex';
        scoreboardContent.classList.add('hidden');
        scoreboardStatus.innerHTML = `
            <div class="scoreboard-empty">
                <span class="empty-icon">📭</span>
                <p>No scoreboard data available from this server yet</p>
            </div>`;
        return;
    }

    // We have data — show content
    scoreboardStatus.style.display = 'none';
    scoreboardContent.classList.remove('hidden');

    // Render Sidebar
    if (hasSidebar) {
        const title = cleanDisplayName(data.sidebarTitle) || 'Scoreboard';
        let html = `<div class="sidebar-board-title">${escapeHtml(title)}</div>`;
        data.sidebar.forEach((item, i) => {
            const name = cleanDisplayName(item.displayName || item.name);
            html += `<div class="sidebar-row" style="animation-delay: ${i * 0.05}s">
                <span class="sidebar-row-name">${escapeHtml(name)}</span>
                <span class="sidebar-row-value">${item.value}</span>
            </div>`;
        });
        sidebarBoard.innerHTML = html;
    } else {
        sidebarBoard.innerHTML = `<div class="sidebar-no-data">No sidebar scoreboard active on this server</div>`;
    }

    // Render All Objectives
    if (hasObjectives) {
        let html = '';
        Object.entries(data.rawObjectives).forEach(([key, obj]) => {
            const objTitle = cleanDisplayName(obj.displayName) || key;
            html += `<div class="objective-card">
                <div class="objective-card-title">${escapeHtml(objTitle)}</div>`;
            if (obj.entries && obj.entries.length > 0) {
                obj.entries.forEach(entry => {
                    const entryName = cleanDisplayName(entry.displayName || entry.name);
                    html += `<div class="objective-entry">
                        <span class="objective-entry-name">${escapeHtml(entryName)}</span>
                        <span class="objective-entry-value">${entry.value}</span>
                    </div>`;
                });
            } else {
                html += `<div class="objective-empty">No entries</div>`;
            }
            html += `</div>`;
        });
        objectivesGrid.innerHTML = html;
    } else {
        objectivesGrid.innerHTML = `<div class="objective-empty">No objectives registered on the server</div>`;
    }
}

// Listen for scoreboard data from server
socket.on('scoreboardData', (data) => {
    renderScoreboard(data);
});
