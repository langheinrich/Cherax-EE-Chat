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

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static('public'));

// Logging Middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// In-Memory Storage (für Produktion: Datenbank verwenden)
const sessions = new Map(); // sessionId -> { rockstarId, connectedAt, lastActivity }
const messages = new Map(); // sessionId -> Array of messages
const globalMessages = []; // Alle Nachrichten über alle Sessions
const sessionClients = new Map(); // sessionId -> Set of rockstarIds (REST clients)

// Hilfsfunktion: Nachrichten einer Session entfernen
function clearSessionMessages(sessionId) {
    messages.delete(sessionId);
    // Globalen Verlauf bereinigen, damit alte Nachrichten nicht erneut ausgeliefert werden
    for (let i = globalMessages.length - 1; i >= 0; i--) {
        if (globalMessages[i].sessionId === sessionId) {
            globalMessages.splice(i, 1);
        }
    }
}

// Session und Verlauf zeitverzögert entfernen, damit letzte Messages (z.B. Disconnect) noch abrufbar sind
function scheduleSessionCleanup(sessionId, delayMs = 5000) {
    setTimeout(() => {
        sessions.delete(sessionId);
        clearSessionMessages(sessionId);
    }, delayMs);
}


// ============================================
// API Routes
// ============================================

// Health Check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        activeSessions: sessions.size,
        totalMessages: globalMessages.length
    });
});

// Connect - Verbindet einen Client mit Session ID und Rockstar ID
app.post('/api/chat/connect', (req, res) => {
    const { sessionId, rockstarId, action } = req.body;

    if (!sessionId || !rockstarId) {
        return res.status(400).json({
            error: 'sessionId and rockstarId are required'
        });
    }

    // Session registrieren oder aktualisieren
    sessions.set(sessionId, {
        rockstarId: rockstarId,
        connectedAt: sessions.has(sessionId) 
            ? sessions.get(sessionId).connectedAt 
            : new Date().toISOString(),
        lastActivity: new Date().toISOString()
    });

    // Client zur Session hinzufügen
    if (!sessionClients.has(sessionId)) {
        sessionClients.set(sessionId, new Set());
    }
    sessionClients.get(sessionId).add(rockstarId);

    // Nachrichten-Array für Session erstellen falls nicht vorhanden
    if (!messages.has(sessionId)) {
        messages.set(sessionId, []);
    }

    // System-Welcome-Nachricht erzeugen und speichern
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

    // Live an alle Clients in der Session senden (Socket)
    io.to(sessionId).emit('player-joined', {
        rockstarId,
        message: joinMessage.message
    });

    console.log(`✅ Session verbunden: ${sessionId} (Rockstar ID: ${rockstarId})`);

    res.json({
        success: true,
        message: 'Session verbunden',
        sessionId: sessionId,
        rockstarId: rockstarId,
        timestamp: new Date().toISOString()
    });
});

// Send Message - Empfängt eine Chat-Nachricht
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

    // Nachricht erstellen
    const chatMessage = {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        sessionId: sessionId,
        rockstarId: rockstarId,
        sender: `${rockstarId}`,
        message: message,
        timestamp: new Date().toISOString()
    };

    // Nachricht speichern
    if (!messages.has(sessionId)) {
        messages.set(sessionId, []);
    }
    messages.get(sessionId).push(chatMessage);
    globalMessages.push(chatMessage);

    // Limit auf 100 Nachrichten pro Session (REST-Pfad)
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

// Poll Messages - Holt neue Nachrichten für eine Session
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

    // Session-Aktivität aktualisieren
    const session = sessions.get(sessionId);
    session.lastActivity = new Date().toISOString();
    sessions.set(sessionId, session);

    // Alle Nachrichten für diese Session
    let sessionMessages = messages.get(sessionId) || [];

    // Optional: Nur Nachrichten nach einem bestimmten Zeitstempel
    if (since) {
        const sinceNum = Number(since);
        if (Number.isNaN(sinceNum)) {
            return res.status(400).json({ error: 'since must be a numeric timestamp' });
        }
        sessionMessages = sessionMessages.filter(msg => 
            new Date(msg.timestamp) > new Date(sinceNum)
        );
    }

    // Letzte 50 Nachrichten zurückgeben
    const recentMessages = sessionMessages.slice(-50);

    res.json({
        success: true,
        sessionId: sessionId,
        messages: recentMessages,
        count: recentMessages.length,
        timestamp: new Date().toISOString()
    });
});

// Get All Messages - Holt alle Nachrichten (für Debugging)
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

// Get Active Sessions
app.get('/api/sessions', (req, res) => {
    // Sammle alle aktiven Sessions (REST + Socket)
    const allSessions = new Map();
    
    // Sessions aus REST API
    sessions.forEach((data, id) => {
        allSessions.set(id, {
            sessionId: id,
            rockstarId: data.rockstarId,
            connectedAt: data.connectedAt,
            lastActivity: data.lastActivity,
            messageCount: (messages.get(id) || []).length,
            restClients: sessionClients.has(id) ? sessionClients.get(id).size : 0,
            socketClients: sessionSockets.has(id) ? sessionSockets.get(id).size : 0
        });
    });
    
    // Sessions nur aus Sockets (falls keine REST-Verbindung besteht)
    sessionSockets.forEach((sockets, id) => {
        if (!allSessions.has(id)) {
            allSessions.set(id, {
                sessionId: id,
                rockstarId: 'Socket Only',
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

// Disconnect Session
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
        
        // Client aus der Session entfernen
        if (sessionClients.has(sessionId)) {
            sessionClients.get(sessionId).delete(rockstarId);
            
            // Wenn keine REST-Clients und keine Socket-Clients mehr da sind, Session aufräumen
            const restClientsLeft = sessionClients.get(sessionId).size;
            const socketClientsLeft = sessionSockets.has(sessionId) ? sessionSockets.get(sessionId).size : 0;
            
            if (restClientsLeft === 0 && socketClientsLeft === 0) {
                sessionClients.delete(sessionId);
                scheduleSessionCleanup(sessionId);
                console.log(`❌ Client getrennt: ${sessionId} (Player: ${playerName}). Letzte Verbindung - Session wird bereinigt.`);
            } else {
                console.log(`❌ Client getrennt: ${sessionId} (Player: ${playerName}). ${restClientsLeft} REST + ${socketClientsLeft} Socket clients verbleiben.`);
            }
        }
        
        // Sende nur das Event (ohne Chat-Systemnachricht) an Socket-Clients
        io.to(sessionId).emit('player-disconnected', {
            rockstarId: playerName
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

// Clear Messages (für Testing)
app.delete('/api/chat/clear', (req, res) => {
    const { sessionId } = req.query;

    if (sessionId) {
        messages.set(sessionId, []);
        res.json({
            success: true,
            message: `Messages cleared for session ${sessionId}`
        });
    } else {
        // Alle Nachrichten löschen
        messages.clear();
        globalMessages.length = 0;
        res.json({
            success: true,
            message: 'All messages cleared'
        });
    }
});

// ============================================
// Broadcast Message (optional - an alle Sessions)
// ============================================
app.post('/api/chat/broadcast', (req, res) => {
    const { message, sender = 'Server' } = req.body;

    if (!message) {
        return res.status(400).json({
            error: 'message is required'
        });
    }

    const broadcastMessage = {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        sessionId: 'broadcast',
        rockstarId: 0,
        sender: sender,
        message: message,
        timestamp: new Date().toISOString(),
        isBroadcast: true
    };

    // Sammle alle aktiven Sessions (REST + Socket)
    const activeSessions = new Set();
    sessions.forEach((_, sessionId) => activeSessions.add(sessionId));
    sessionSockets.forEach((_, sessionId) => activeSessions.add(sessionId));

    // An alle aktiven Sessions verteilen
    let recipientCount = 0;
    activeSessions.forEach((sessionId) => {
        if (!messages.has(sessionId)) {
            messages.set(sessionId, []);
        }
        messages.get(sessionId).push(broadcastMessage);
        
        // Cap auf 100 Messages
        if (messages.get(sessionId).length > 100) {
            messages.get(sessionId).shift();
        }
        
        recipientCount++;
    });

    globalMessages.push(broadcastMessage);

    console.log(`📢 Broadcast: ${message} → ${recipientCount} session(s)`);

    res.json({
        success: true,
        message: 'Broadcast sent',
        recipientCount: recipientCount,
        timestamp: broadcastMessage.timestamp
    });
});

// ============================================
// Error Handler
// ============================================
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message
    });
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        path: req.path
    });
});

// ============================================
// Socket.io Events (Echtzeit-Kommunikation)
// ============================================

const sessionSockets = new Map(); // sessionId -> Set of socket IDs

io.on('connection', (socket) => {
    console.log(`[SOCKET] Neuer Socket verbunden: ${socket.id}`);
    
    // Client verbindet sich mit einer Session
    socket.on('join-session', (data) => {
        const { sessionId, rockstarId } = data;
        
        if (!sessionId || !rockstarId) {
            socket.emit('error', { message: 'sessionId and rockstarId are required' });
            return;
        }
        
        // Socket zu Session hinzufügen
        if (!sessionSockets.has(sessionId)) {
            sessionSockets.set(sessionId, new Set());
        }
        sessionSockets.get(sessionId).add(socket.id);
        
        // Socket zu Room hinzufügen (Socket.io Feature)
        socket.join(sessionId);
        socket.sessionId = sessionId;
        socket.rockstarId = rockstarId;
        
        console.log(`[SOCKET] ${socket.id} joined session: ${sessionId} (Player: ${rockstarId})`);
        
        // Alle anderen in der Session benachrichtigen
        io.to(sessionId).emit('player-joined', {
            rockstarId: rockstarId,
            playersInSession: sessionSockets.get(sessionId).size
        });
        
        // Bestätigung an den Client
        socket.emit('session-joined', {
            sessionId: sessionId,
            playersInSession: sessionSockets.get(sessionId).size
        });
    });
    
    // Chat Message empfangen
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
        
        // Nachricht speichern
        if (!messages.has(sessionId)) {
            messages.set(sessionId, []);
        }
        messages.get(sessionId).push(chatMessage);
        globalMessages.push(chatMessage);
        
        // Limit auf 100 Nachrichten pro Session
        if (messages.get(sessionId).length > 100) {
            messages.get(sessionId).shift();
        }
        
        console.log(`[CHAT] ${rockstarId}: ${message} (Session: ${sessionId})`);
        
        // Nachricht an alle in dieser Session senden
        io.to(sessionId).emit('message', chatMessage);
    });
    
    // Disconnect
    socket.on('disconnect', () => {
        const sessionId = socket.sessionId;
        
        if (sessionId && sessionSockets.has(sessionId)) {
            sessionSockets.get(sessionId).delete(socket.id);
            
            console.log(`[SOCKET] ${socket.id} disconnected from session: ${sessionId}`);
            
            // Benachrichtige andere
            const playersLeft = sessionSockets.get(sessionId).size;
            io.to(sessionId).emit('player-left', {
                rockstarId: socket.rockstarId,
                playersInSession: playersLeft,
                message: `${socket.rockstarId} hat die Session verlassen`
            });
            
            // Entferne Session wenn leer
            if (playersLeft === 0) {
                sessionSockets.delete(sessionId);
                console.log(`[SOCKET] Session ${sessionId} wurde gelöscht (keine Spieler mehr)`);
                // Session/Verlauf nach kurzer Zeit entfernen
                scheduleSessionCleanup(sessionId);
            }
        }
    });
    
    // Error Handling
    socket.on('error', (error) => {
        console.error(`[SOCKET ERROR] ${socket.id}: ${error}`);
    });
});

// ============================================
// Server starten
// ============================================

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
    console.log('  POST /api/chat/broadcast      - Broadcast Nachricht');
    console.log('  POST /api/chat/disconnect     - Session trennen');
    console.log('  DELETE /api/chat/clear        - Nachrichten löschen');
    console.log('\nWebSocket Events:');
    console.log('  join-session                  - Bei Session beitreten');
    console.log('  chat-message                  - Chat Nachricht senden');
    console.log('═══════════════════════════════════════════════\n');
});

// Cleanup bei Server-Shutdown
process.on('SIGINT', () => {
    console.log('\n\nServer wird heruntergefahren...');
    console.log(`Statistiken:`);
    console.log(`   - Aktive Sessions: ${sessions.size}`);
    console.log(`   - Gesamt Nachrichten: ${globalMessages.length}`);
    process.exit(0);
});
