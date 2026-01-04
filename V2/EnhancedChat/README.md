# Enhanced Chat - Cherax Lua Script

Multi-Session Chat-System für GTA V mit Cherax Lua API. Ermöglicht Kommunikation zwischen Spielern in derselben Lobby über einen Node.js Backend-Server.

## Features

- 💬 **Session-basierter Chat** - Automatische Lobby-Erkennung
- 🎨 **ImGui Interface** - Moderne Benutzeroberfläche
- ⚙️ **Settings Panel** - Anpassbare Einstellungen
- 🔔 **Toast Notifications** - Optionale Benachrichtigungen
- 🔄 **Auto-Reconnect** - Automatische Verbindungswiederherstellung
- 🎯 **Hotkey Support** - Konfigurierbarer Toggle-Hotkey (F1-F12)
- 📜 **Auto-Scroll** - Optional ein/ausschaltbar
- 🚪 **Join/Leave Messages** - System-Nachrichten für User-Events

## Installation

1. Server starten (siehe ChatServer README)
2. Lua-Dateien in Cherax Lua-Ordner kopieren:
   ```
   Documents/Cherax/Lua/EnhancedChat/
   ```
3. Script in Cherax laden

## Dateistruktur

```
EnhancedChat/
├── GUI.lua           # ImGui Benutzeroberfläche
├── Service.lua       # API-Kommunikation & Session-Management
├── Settings.lua      # Einstellungs-System
└── data/
    └── settings.json # Gespeicherte Einstellungen
```

## Hauptdateien

### EnhancedChat.lua
Hauptscript - Orchestriert alle Module

**Funktionen:**
- `OnPresent()` - Render-Loop (GUI, Polling, Health Check)
- `OnScriptStop()` - Cleanup beim Beenden

### GUI.lua
Benutzeroberfläche mit ImGui

**Hauptfunktionen:**
- `GUI.Initialize()` - Initialisierung der GUI
- `GUI.Render()` - Haupt-Render-Funktion
- `GUI.AddMessage(sender, message)` - Nachricht zum Chat hinzufügen
- `GUI.RenderChatHistory()` - Chat-Verlauf anzeigen
- `GUI.RenderChatInput()` - Eingabefeld mit Send/Clear Buttons
- `GUI.ShowToast(sender, message, duration)` - Toast-Benachrichtigung
- `GUI.UpdateMessages(messages)` - Neue Nachrichten vom Server verarbeiten

**Properties:**
- `GUI.windowWidth` - 1000px
- `GUI.windowHeight` - 800px
- `GUI.maxMessages` - 50 Nachrichten
- `GUI.autoScroll` - Auto-Scroll aktiviert/deaktiviert

### Service.lua
Backend-Kommunikation und Session-Management

**Haupt funktionen:**
- `Service.GetSessionId()` - Generiert/ruft Session-ID ab (basierend auf Lobby)
- `Service.GetRockstarId()` - Holt Spieler-ID
- `Service.SendToServer(sessionId, rockstarId)` - Verbindung zum Server
- `Service.SendChatMessage(message)` - Nachricht senden
- `Service.PollMessages()` - Neue Nachrichten abrufen
- `Service.Disconnect()` - Verbindung trennen
- `Service.HealthCheck()` - Verbindungsstatus prüfen (alle 5s)
- `Service.Reconnect()` - Automatischer Reconnect (max 5 Versuche)
- `Service.SetReconnectCallback(callback)` - Callback für Reconnect-Events

**Session-ID Format:**
- `lobby_<hash>` - Multi-Player Lobby
- `solo_<timestamp>` - Solo Session
- `error_<timestamp>` - Fallback bei Fehlern

**Reconnect:**
- Intervall: 5 Sekunden
- Max Attempts: 5
- Delay: 2 Sekunden
- Status Messages im Chat

### Settings.lua
Einstellungs-Management mit JSON-Persistenz

**Funktionen:**
- `Settings.LoadSettings()` - Einstellungen aus JSON laden
- `Settings.SaveSettings()` - Einstellungen in JSON speichern
- `Settings.Render()` - Settings-Window rendern
- `Settings.ApplyHotkey()` - Hotkey-Änderungen anwenden
- `Settings.GetKeyName(keyCode)` - Key-Code → Name (F1-F12)
- `Settings.SetChatFeatureHash(hash)` - Feature-Hash für Hotkey setzen

**Verfügbare Settings:**
```lua
{
  notifyNewMessages = true,      -- Toast für neue Nachrichten
  notifyUserJoin = true,          -- Toast bei User Join
  notifyUserDisconnect = true,    -- Toast bei User Disconnect
  autoScroll = true,              -- Auto-Scroll im Chat
  toastDuration = 3000,           -- Toast-Dauer in ms (1000-10000)
  enableSound = true,             -- Benachrichtigungs-Sounds
  toggleHotkey = 0x78             -- F9 (F1=0x70 bis F12=0x7B)
}
```

## Hotkeys

Standard: **F9** (konfigurierbar in settings.json)

**Verfügbare Keys:**
- F1 (0x70) bis F12 (0x7B)

Format in settings.json:
```json
{
  "toggleHotkey": 120
}
```

Dezimal-Codes:
- F1=112, F2=113, F3=114, F4=115
- F5=116, F6=117, F7=118, F8=119
- F9=120, F10=121, F11=122, F12=123

## GUI Elemente

**Chat Window:**
- Title: "Enhanced Chat (<session_id>)"
- Größe: 1000x800
- Settings Button (oben links)
- Chat History (scrollbar, farbcodiert)
- Input Field + Send Button + Clear Button

**Settings Window:**
- Auto-Height
- Breite: 300px
- Checkboxes für Notifications
- Auto-Scroll Toggle
- Sound Enable/Disable
- Toast Duration Slider (1-10s)

**Farben:**
- System Messages: Gelb (100, 100, 0)
- User Names: Cyan (0, 150, 255)
- Regular Text: Weiß

## API Integration

Server-URL: `http://localhost:3000`

**Verwendete Endpoints:**
- POST `/api/chat/connect` - Verbindung herstellen
- POST `/api/chat/send` - Nachricht senden
- GET `/api/chat/poll` - Nachrichten abrufen
- POST `/api/chat/disconnect` - Trennen
- GET `/api/sessions` - Health Check

**Polling:**
- Intervall: 1000ms (1 Sekunde)
- Async via `Script.QueueJob()`

## Dependencies

**Cherax APIs:**
- ImGui - Benutzeroberfläche
- Curl - HTTP-Requests
- FileMgr - Datei-Operationen
- HotKeyMgr - Hotkey-Verwaltung
- Script - Async-Jobs
- PLAYER/NETWORK - GTA Natives

## Session-Wechsel

Bei Lobby-Wechsel:
1. Neue Session-ID wird erkannt
2. Chat wird geleert
3. Automatische Verbindung zur neuen Session
4. System-Message: "Switched to new lobby"

## Fehlerbehandlung

Alle Hauptfunktionen sind mit `pcall()` geschützt:
- GUI-Rendering
- Server-Kommunikation
- Settings-Laden/Speichern
- Message-Verarbeitung

Bei Fehlern:
- Console-Logs für Debugging
- GUI bleibt funktionsfähig
- Auto-Reconnect bei Verbindungsverlust

## Performance

- Message-Limit: 50 pro Session (Client)
- Poll-Interval: 1s
- Health-Check: 5s
- Cleanup: Alte Messages werden automatisch entfernt
- Async-Polling verhindert Freezes

## Beispiel-Usage

```lua
-- Script laden
local GUI = require("EnhancedChat.GUI")
local Service = require("EnhancedChat.Service")
local Settings = require("EnhancedChat.Settings")

-- Settings laden
Settings.LoadSettings()

-- Module verbinden
GUI.SetService(Service)
GUI.SetSettings(Settings)

-- Reconnect-Callback setzen
Service.SetReconnectCallback(function(sender, message)
    GUI.AddMessage(sender, message)
end)

-- In Render-Loop
function OnPresent()
    if GUI.isVisible then
        Service.HealthCheck()
        GUI.Render()
        
        local newMessages = Service.PollMessages()
        if newMessages then
            GUI.UpdateMessages(newMessages)
        end
    end
end
```

## Troubleshooting

**Chat öffnet sich nicht:**
- Server läuft? (http://localhost:3000/health)
- Hotkey korrekt? (settings.json)
- Console-Logs prüfen

**Nachrichten kommen nicht an:**
- Session-ID korrekt? (siehe Title-Bar)
- Server erreichbar?
- Polling läuft? (Health Check Console)

**Reconnect funktioniert nicht:**
- Max 5 Versuche überschritten?
- Server offline?
- Console-Logs prüfen

**Settings werden nicht gespeichert:**
- `data/settings.json` existiert?
- Schreibrechte vorhanden?
- JSON-Format korrekt?

## Server Integration

Der Chat benötigt den Enhanced Chat Server (ChatServer/).
Siehe ChatServer/README.md für Setup-Anleitung.
