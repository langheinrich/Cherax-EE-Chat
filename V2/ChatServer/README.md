# Enhanced Chat Server

Node.js/Express Backend-Server für das GTA V Cherax Enhanced Chat System mit REST API und WebSocket-Unterstützung.

## Features

- 🔄 **Session-Management** - Automatische Lobby-basierte Sessions
- 💬 **Real-time Chat** - WebSocket (Socket.io) + REST API
- 📢 **Broadcast System** - Nachrichten an alle oder spezifische Sessions
- 🔌 **Auto-Reconnect** - Automatische Verbindungswiederherstellung
- 📊 **In-Memory Storage** - Schnelle Nachrichtenspeicherung (100 Nachrichten/Session)
- 🚪 **Join/Leave Events** - System-Nachrichten für User-Aktivitäten

## Installation

```bash
npm install
```

## Start

```bash
npm run dev
```

Server läuft auf `http://localhost:3000`

## API Endpoints

### REST API

| Method | Endpoint | Beschreibung |
|--------|----------|--------------|
| GET | `/health` | Server-Status und Statistiken |
| POST | `/api/chat/connect` | Session verbinden |
| POST | `/api/chat/send` | Nachricht senden |
| GET | `/api/chat/poll` | Nachrichten abrufen |
| GET | `/api/chat/messages` | Alle Nachrichten (Debug) |
| GET | `/api/sessions` | Aktive Sessions anzeigen |
| POST | `/api/chat/disconnect` | Session trennen |
| DELETE | `/api/chat/clear` | Nachrichten löschen |
| POST | `/api/chat/broadcast` | Broadcast an alle Sessions |

### WebSocket Events

**Client → Server:**
- `join-session` - Session beitreten
- `chat-message` - Nachricht senden
- `disconnect` - Verbindung trennen

**Server → Client:**
- `player-joined` - Spieler beigetreten
- `player-left` - Spieler verlassen
- `message` - Chat-Nachricht
- `session-joined` - Session-Bestätigung
- `error` - Fehler

## Request Examples

### Connect
```bash
POST /api/chat/connect
{
  "sessionId": "lobby_123456",
  "rockstarId": "PlayerName"
}
```

### Send Message
```bash
POST /api/chat/send
{
  "sessionId": "lobby_123456",
  "rockstarId": "PlayerName",
  "message": "Hello!"
}
```

### Broadcast
```bash
POST /api/chat/broadcast
{
  "message": "Server maintenance in 5 minutes",
  "sender": "Admin"
}
```

Oder mit dem CLI-Tool:
```bash
node broadcast.js
```

## Data Storage

### Sessions
```javascript
Map<sessionId, {
  rockstarId: string,
  connectedAt: ISO string,
  lastActivity: ISO string
}>
```

### Messages
```javascript
Map<sessionId, Message[]>

Message {
  id: string,
  sessionId: string,
  rockstarId: string,
  sender: string,
  message: string,
  timestamp: ISO string,
  isSystemMessage?: boolean,
  type?: 'join' | 'leave'
}
```

## Configuration

Umgebungsvariablen (optional):
- `PORT` - Server-Port (default: 3000)

## Cleanup

- Sessions werden 5 Sekunden nach dem letzten Client automatisch bereinigt
- Nachrichten-Limit: 100 pro Session (älteste werden entfernt)
- Globaler Nachrichtenspeicher ohne Limit

## Dependencies

- express
- socket.io
- cors
- body-parser

## Tools

- `broadcast.js` - CLI-Tool für Broadcast-Nachrichten
- `broadcast.cmd` - Batch-Wrapper für Windows


Der Server läuft standardmäßig auf `http://localhost:3000`

## 📡 API Endpoints

### Health Check
```http
GET /health
```

Gibt Server-Status und Statistiken zurück.

### Session verbinden
```http
POST /api/chat/connect
Content-Type: application/json

{
  "sessionId": "123456789_0",
  "rockstarId": 987654321,
  "action": "connect"
}
```

### Nachricht senden
```http
POST /api/chat/send
Content-Type: application/json

{
  "sessionId": "123456789_0",
  "rockstarId": 987654321,
  "message": "Hallo Welt!",
  "action": "message"
}
```

### Nachrichten abrufen (Polling)
```http
GET /api/chat/poll?sessionId=123456789_0&rockstarId=987654321
```

Optional mit `since` Parameter (Unix Timestamp):
```http
GET /api/chat/poll?sessionId=123456789_0&rockstarId=987654321&since=1704398400000
```

### Alle Nachrichten
```http
GET /api/chat/messages?limit=100
```

### Aktive Sessions
```http
GET /api/sessions
```

### Broadcast Nachricht
```http
POST /api/chat/broadcast
Content-Type: application/json

{
  "sender": "Admin",
  "message": "Server Neustart in 5 Minuten!"
}
```

### Session trennen
```http
POST /api/chat/disconnect
Content-Type: application/json

{
  "sessionId": "123456789_0",
  "rockstarId": 987654321
}
```

### Nachrichten löschen
```http
DELETE /api/chat/clear?sessionId=123456789_0
```

Oder alle Nachrichten:
```http
DELETE /api/chat/clear
```

## 🔧 Konfiguration

Port ändern:
```bash
PORT=4000 npm start
```

Oder `.env` Datei erstellen:
```env
PORT=4000
```

## 📊 Features

- ✅ Session Management (In-Memory)
- ✅ Chat-Nachrichten speichern
- ✅ Polling-Endpoint für neue Nachrichten
- ✅ Broadcast-Nachrichten an alle Sessions
- ✅ CORS aktiviert
- ✅ Request-Logging
- ✅ Error Handling

## 🔮 Zukünftige Erweiterungen

- [ ] WebSocket-Support für Echtzeit-Updates
- [ ] Datenbank-Integration (MongoDB/PostgreSQL)
- [ ] Authentifizierung
- [ ] Rate Limiting
- [ ] Chat-Räume/Channels
- [ ] Nachricht-Persistierung
- [ ] Admin-Dashboard

## 📝 Hinweise

**Wichtig:** Dies ist ein In-Memory Server. Alle Daten gehen verloren beim Neustart!

Für Produktion:
- Datenbank hinzufügen (MongoDB, Redis, PostgreSQL)
- Authentifizierung implementieren
- Rate Limiting aktivieren
- HTTPS verwenden
