# FlowLink

Cross-device, session-based continuity and remote-access system.

## Architecture

```
flowlink/
├── backend/          # Node.js WebSocket server (signaling only)
├── frontend/         # React + Vite (desktop/laptop)
├── mobile/           # Android app (Kotlin)
└── shared/           # Shared types and utilities
```

## Quick Start

### Backend
```bash
cd backend
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Mobile (Android Studio)
1. **Open Project**: File → Open → Select `mobile/android` folder
2. **Wait**: Let Gradle sync complete
3. **Configure**: Update `WS_URL` in `WebSocketManager.kt` if using physical device
4. **Run**: Click ▶️ button to build and install

📖 **Detailed Setup**: See [ANDROID_SETUP.md](ANDROID_SETUP.md) for step-by-step instructions  
🚀 **Quick Guide**: See [QUICK_START.md](QUICK_START.md) for condensed version

## Testing

1. **Create Session**: Open frontend → Click "Create Session" → See QR code
2. **Join Session**: Open Android app → Scan QR or enter 6-digit code
3. **Verify**: Device tile appears on laptop showing your phone
4. **Test**: Drag file/link onto phone tile → Should open on phone

See [ANDROID_SETUP.md](ANDROID_SETUP.md) for complete testing checklist.

## Core Concepts

- **Session-Based**: Temporary connections via QR code or 6-digit key
- **Device Tiles**: Visual representation of connected devices
- **Intent Router**: Drag & drop interprets intent (file, media, prompt, link)
- **Continuity**: Sync state (media timestamp, clipboard, file position)
- **Privacy First**: Explicit permissions, read-only defaults, auto-expiry

## MVP Scope

Phone ↔ Laptop only. Includes session management, drag & drop, file transfer, media continuation, and prompt handoff.

