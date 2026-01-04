# Enhanced Chat Server

Express Server für das Enhanced Chat System in GTA V mit Cherax Lua API.

## 🚀 Installation

```bash
npm install
```

## 📦 Verwendung

### Development (mit Auto-Reload)
```bash
npm run dev
```

### Production
```bash
npm start
```

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
