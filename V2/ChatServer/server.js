const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

const sessions = new Map();
const messages = new Map();
const globalMessages = [];
const sessionClients = new Map();

function clearSessionMessages(sessionId) {
    messages.delete(sessionId);
    for (let i = globalMessages.length - 1; i >= 0; i--) {
        if (globalMessages[i].sessionId === sessionId) {
            globalMessages.splice(i, 1);
        }
    }
}

function scheduleSessionCleanup(sessionId) {
    sessions.delete(sessionId);
    clearSessionMessages(sessionId);
}
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        activeSessions: sessions.size,
        totalMessages: globalMessages.length
    });
});

app.post('/api/chat/connect', (req, res) => {
    const { sessionId, rockstarId, action } = req.body;

    if (!sessionId || !rockstarId) {
        return res.status(400).json({
            error: 'sessionId and rockstarId are required'
        });
    }

    sessions.set(sessionId, {
        rockstarId: rockstarId,
        connectedAt: sessions.has(sessionId) 
            ? sessions.get(sessionId).connectedAt 
            : new Date().toISOString(),
        lastActivity: new Date().toISOString()
    });


    if (!sessionClients.has(sessionId)) {
        sessionClients.set(sessionId, new Set());
    }
    sessionClients.get(sessionId).add(rockstarId);

    if (!messages.has(sessionId)) {
        messages.set(sessionId, []);
    }

    const existingJoinMsg = messages.get(sessionId).find(
        msg => msg.type === 'join' && msg.rockstarId === rockstarId
    );

    if (!existingJoinMsg) {
        const joinMessage = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            sessionId,
            rockstarId,
            sender: 'System',
            message: `${rockstarId} joined the chat`,
            timestamp: new Date().toISOString(),
            isSystemMessage: true,
            type: 'join'
        };
        messages.get(sessionId).push(joinMessage);
        globalMessages.push(joinMessage);
        if (messages.get(sessionId).length > 100) {
            messages.get(sessionId).shift();
        }

        io.to(sessionId).emit('player-joined', {
            rockstarId,
            message: joinMessage.message
        });
    }

    console.log(`✅ Session verbunden: ${sessionId} (Rockstar ID: ${rockstarId})`);

    res.json({
        success: true,
        message: 'Session verbunden',
        sessionId: sessionId,
        rockstarId: rockstarId,
        timestamp: new Date().toISOString()
    });
});

app.post('/api/chat/send', (req, res) => {
    const { sessionId, rockstarId, message, action } = req.body;

    if (!sessionId || !rockstarId || !message) {
        return res.status(400).json({
            error: 'sessionId, rockstarId and message are required'
        });
    }

    // Session validieren
    if (!sessions.has(sessionId)) {
        return res.status(404).json({
            error: 'Session not found. Please connect first.'
        });
    }

    const chatMessage = {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        sessionId: sessionId,
        rockstarId: rockstarId,
        sender: `${rockstarId}`,
        message: message,
        timestamp: new Date().toISOString()
    };

    if (!messages.has(sessionId)) {
        messages.set(sessionId, []);
    }
    messages.get(sessionId).push(chatMessage);
    globalMessages.push(chatMessage);

    if (messages.get(sessionId).length > 100) {
        messages.get(sessionId).shift();
    }

    // Session-Aktivität aktualisieren
    const session = sessions.get(sessionId);
    session.lastActivity = new Date().toISOString();
    sessions.set(sessionId, session);

    console.log(`💬 Nachricht von ${rockstarId}: ${message}`);

    res.json({
        success: true,
        message: 'Message received',
        messageId: chatMessage.id,
        timestamp: chatMessage.timestamp
    });
});

app.get('/api/chat/poll', (req, res) => {
    const { sessionId, rockstarId, since } = req.query;

    if (!sessionId || !rockstarId) {
        return res.status(400).json({
            error: 'sessionId and rockstarId are required'
        });
    }

    // Session validieren
    if (!sessions.has(sessionId)) {
        return res.status(404).json({
            error: 'Session not found. Please connect first.'
        });
    }

    const session = sessions.get(sessionId);
    session.lastActivity = new Date().toISOString();
    sessions.set(sessionId, session);

    let sessionMessages = messages.get(sessionId) || [];

    if (since) {
        const sinceNum = Number(since);
        if (Number.isNaN(sinceNum)) {
            return res.status(400).json({ error: 'since must be a numeric timestamp' });
        }
        sessionMessages = sessionMessages.filter(msg => 
            new Date(msg.timestamp) > new Date(sinceNum)
        );
    }

    const recentMessages = sessionMessages.slice(-50);

    res.json({
        success: true,
        sessionId: sessionId,
        messages: recentMessages,
        count: recentMessages.length,
        timestamp: new Date().toISOString()
    });
});

app.get('/api/chat/messages', (req, res) => {
    const { limit = 100 } = req.query;
    
    const recentMessages = globalMessages.slice(-parseInt(limit));
    
    res.json({
        success: true,
        messages: recentMessages,
        total: globalMessages.length,
        count: recentMessages.length
    });
});

app.get('/api/sessions', (req, res) => {
    const allSessions = new Map();
    
    sessions.forEach((data, id) => {
        const clients = sessionClients.has(id) ? Array.from(sessionClients.get(id)) : [data.rockstarId];
        allSessions.set(id, {
            sessionId: id,
            rockstarIds: clients,
            connectedAt: data.connectedAt,
            lastActivity: data.lastActivity,
            messageCount: (messages.get(id) || []).length,
            restClients: sessionClients.has(id) ? sessionClients.get(id).size : 0,
            socketClients: sessionSockets.has(id) ? sessionSockets.get(id).size : 0
        });
    });
    
    sessionSockets.forEach((sockets, id) => {
        if (!allSessions.has(id)) {
            const clients = sessionClients.has(id) ? Array.from(sessionClients.get(id)) : [];
            allSessions.set(id, {
                sessionId: id,
                rockstarIds: clients,
                connectedAt: new Date().toISOString(),
                lastActivity: new Date().toISOString(),
                messageCount: (messages.get(id) || []).length,
                restClients: 0,
                socketClients: sockets.size
            });
        }
    });

    const activeSessions = Array.from(allSessions.values());

    res.json({
        success: true,
        sessions: activeSessions,
        count: activeSessions.length
    });
});

app.post('/api/chat/disconnect', (req, res) => {
    const { sessionId, rockstarId } = req.body;

    if (!sessionId) {
        return res.status(400).json({
            error: 'sessionId is required'
        });
    }

    if (sessions.has(sessionId)) {
        const session = sessions.get(sessionId);
        const playerName = rockstarId || "Unknown Player";
        
        if (sessionClients.has(sessionId)) {
            sessionClients.get(sessionId).delete(rockstarId);
            
            const restClientsLeft = sessionClients.get(sessionId).size;
            if (restClientsLeft === 0) {
                sessionClients.delete(sessionId);
            }
            
            const socketClientsLeft = sessionSockets.has(sessionId) ? sessionSockets.get(sessionId).size : 0;
            
            if (restClientsLeft === 0 && socketClientsLeft === 0) {
                scheduleSessionCleanup(sessionId);
                console.log(`❌ Client getrennt: ${sessionId} (Player: ${playerName}). Letzte Verbindung - Session wird bereinigt.`);
            } else {
                console.log(`❌ Client getrennt: ${sessionId} (Player: ${playerName}). ${restClientsLeft} REST + ${socketClientsLeft} Socket clients verbleiben.`);
            }
        }
        
        const leaveMessage = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            sessionId,
            rockstarId,
            sender: 'System',
            message: `${playerName} left the chat`,
            timestamp: new Date().toISOString(),
            isSystemMessage: true,
            type: 'leave'
        };
        
        if (messages.has(sessionId)) {
            messages.get(sessionId).push(leaveMessage);
            globalMessages.push(leaveMessage);
            if (messages.get(sessionId).length > 100) {
                messages.get(sessionId).shift();
            }
        }
        
        io.to(sessionId).emit('player-disconnected', {
            rockstarId: playerName,
            message: leaveMessage.message
        });
        
        res.json({
            success: true,
            message: 'Client disconnected',
            playerName: playerName
        });
    } else {
        res.status(404).json({
            error: 'Session not found'
        });
    }
});

app.delete('/api/chat/clear', (req, res) => {
    const { sessionId } = req.query;

    if (sessionId) {
        messages.set(sessionId, []);
        res.json({
            success: true,
            message: `Messages cleared for session ${sessionId}`
        });
    } else {
        messages.clear();
        globalMessages.length = 0;
        res.json({
            success: true,
            message: 'All messages cleared'
        });
    }
});

app.post('/api/chat/broadcast', (req, res) => {
    const { message, sender = 'System' } = req.body;

    if (!message) {
        return res.status(400).json({
            error: 'message is required'
        });
    }

    const broadcastMessage = {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        sender: 'Admin',
        message: message,
        timestamp: new Date().toISOString(),
        isBroadcast: true
    };

    const activeSessions = new Set();
    sessions.forEach((_, sessionId) => activeSessions.add(sessionId));
    sessionSockets.forEach((_, sessionId) => activeSessions.add(sessionId));

    let recipientCount = 0;
    activeSessions.forEach((sessionId) => {
        if (!messages.has(sessionId)) {
            messages.set(sessionId, []);
        }
        
        const sessionMessage = {
            ...broadcastMessage,
            sessionId: sessionId
        };
        
        messages.get(sessionId).push(sessionMessage);
        
        if (messages.get(sessionId).length > 100) {
            messages.get(sessionId).shift();
        }
        
        recipientCount++;
    });

    globalMessages.push(broadcastMessage);

    console.log(`📢 BROADCAST: "${message}" → ${recipientCount} session(s)`);

    res.json({
        success: true,
        message: 'Broadcast sent',
        recipientCount: recipientCount,
        timestamp: broadcastMessage.timestamp
    });
});

app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message
    });
});

app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        path: req.path
    });
});

const sessionSockets = new Map();

io.on('connection', (socket) => {
    console.log(`[SOCKET] Neuer Socket verbunden: ${socket.id}`);
    
    socket.on('join-session', (data) => {
        const { sessionId, rockstarId } = data;
        
        if (!sessionId || !rockstarId) {
            socket.emit('error', { message: 'sessionId and rockstarId are required' });
            return;
        }
        
        if (!sessionSockets.has(sessionId)) {
            sessionSockets.set(sessionId, new Set());
        }
        sessionSockets.get(sessionId).add(socket.id);
        
        socket.join(sessionId);
        socket.sessionId = sessionId;
        socket.rockstarId = rockstarId;
        
        console.log(`[SOCKET] ${socket.id} joined session: ${sessionId} (Player: ${rockstarId})`);
        
        io.to(sessionId).emit('player-joined', {
            rockstarId: rockstarId,
            playersInSession: sessionSockets.get(sessionId).size
        });
        
        socket.emit('session-joined', {
            sessionId: sessionId,
            playersInSession: sessionSockets.get(sessionId).size
        });
    });
    
    socket.on('chat-message', (data) => {
        const { message, sessionId, rockstarId } = data;
        
        if (!sessionId) {
            socket.emit('error', { message: 'sessionId is required' });
            return;
        }
        
        const chatMessage = {
            rockstarId: rockstarId || socket.rockstarId,
            message: message,
            timestamp: new Date().toISOString(),
            socketId: socket.id
        };
        
        if (!messages.has(sessionId)) {
            messages.set(sessionId, []);
        }
        messages.get(sessionId).push(chatMessage);
        globalMessages.push(chatMessage);
        
        if (messages.get(sessionId).length > 100) {
            messages.get(sessionId).shift();
        }
        
        console.log(`[CHAT] ${rockstarId}: ${message} (Session: ${sessionId})`);
        
        io.to(sessionId).emit('message', chatMessage);
    });
    
    socket.on('disconnect', () => {
        const sessionId = socket.sessionId;
        
        if (sessionId && sessionSockets.has(sessionId)) {
            sessionSockets.get(sessionId).delete(socket.id);
            
            console.log(`[SOCKET] ${socket.id} disconnected from session: ${sessionId}`);
            
            const playersLeft = sessionSockets.get(sessionId).size;
            io.to(sessionId).emit('player-left', {
                rockstarId: socket.rockstarId,
                playersInSession: playersLeft,
                message: `${socket.rockstarId} left the chat`
            });
            
            if (playersLeft === 0) {
                sessionSockets.delete(sessionId);
                console.log(`[SOCKET] Session ${sessionId} wurde gelöscht (keine Socket-Spieler mehr)`);
                
                const restClientsLeft = sessionClients.has(sessionId) ? sessionClients.get(sessionId).size : 0;
                if (restClientsLeft === 0) {
                    scheduleSessionCleanup(sessionId);
                    console.log(`[SOCKET] Session ${sessionId} wird bereinigt - keine Clients mehr.`);
                } else {
                    console.log(`[SOCKET] Session ${sessionId} hat noch ${restClientsLeft} REST client(s).`);
                }
            }
        }
    });
    
    socket.on('error', (error) => {
        console.error(`[SOCKET ERROR] ${socket.id}: ${error}`);
    });
});

server.listen(PORT, () => {
    console.log('═══════════════════════════════════════════════');
    console.log('   Enhanced Chat Server für GTA V Cherax');
    console.log('═══════════════════════════════════════════════');
    console.log(`🚀 Server läuft auf: http://localhost:${PORT}`);
    console.log(`📅 Gestartet am: ${new Date().toISOString()}`);
    console.log('═══════════════════════════════════════════════');
    console.log('\nVerfügbare Endpoints:');
    console.log('  GET  /health                  - Server Status');
    console.log('  POST /api/chat/connect        - Session verbinden');
    console.log('  POST /api/chat/send           - Nachricht senden');
    console.log('  GET  /api/chat/poll           - Nachrichten abrufen');
    console.log('  GET  /api/chat/messages       - Alle Nachrichten');
    console.log('  GET  /api/sessions            - Aktive Sessions');
    console.log('  POST /api/chat/broadcast      - Broadcast an alle Sessions');
    console.log('  POST /api/chat/disconnect     - Session trennen');
    console.log('  DELETE /api/chat/clear        - Nachrichten löschen');
    console.log('\nWebSocket Events:');
    console.log('  join-session                  - Bei Session beitreten');
    console.log('  chat-message                  - Chat Nachricht senden');
    console.log('═══════════════════════════════════════════════\n');
});

process.on('SIGINT', () => {
    console.log('\n\nServer wird heruntergefahren...');
    console.log(`Statistiken:`);
    console.log(`   - Aktive Sessions: ${sessions.size}`);
    console.log(`   - Gesamt Nachrichten: ${globalMessages.length}`);
    process.exit(0);
});
