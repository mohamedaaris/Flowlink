# FlowLink Setup Guide

## Prerequisites

- Node.js 18+ (for backend and frontend)
- Android Studio (for mobile app)
- Modern browser (Chrome, Firefox, Edge)

## Backend Setup

```bash
cd backend
npm install
npm run dev
```

Backend runs on `ws://localhost:8080` by default.

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173` (Vite default).

## Android App Setup

1. Open `mobile/android/` in Android Studio
2. Sync Gradle files
3. Update `WS_URL` in `WebSocketManager.kt`:
   - For emulator: `ws://10.0.2.2:8080`
   - For physical device: `ws://YOUR_COMPUTER_IP:8080`
4. Build and run on device/emulator

## Usage Flow

1. **Create Session** (on Laptop):
   - Open frontend in browser
   - Click "Create Session"
   - QR code and 6-digit code displayed

2. **Join Session** (on Phone):
   - Open Android app
   - Scan QR code or enter 6-digit code
   - Devices connect via WebSocket

3. **Send Intent**:
   - Drag file/link/text onto device tile
   - Intent routed to target device
   - Permission requested (if needed)
   - Auto-opens on target device

## Testing

### Test File Transfer
1. Create session on laptop
2. Join from phone
3. Drag a file onto phone tile
4. File should transfer and open on phone

### Test Media Continuation
1. Play video on laptop
2. Drag video URL onto phone tile
3. Video should open on phone at same timestamp

### Test Prompt Injection
1. Type a coding prompt on laptop
2. Drag text onto phone tile
3. Prompt should open in browser/editor on phone

## Troubleshooting

### WebSocket Connection Failed
- Check backend is running
- Verify firewall allows port 8080
- For Android: Use correct IP address (not localhost)

### WebRTC Not Connecting
- Check STUN server is accessible
- For production, add TURN servers
- Verify devices are on same network (for MVP)

### QR Code Not Scanning
- Ensure camera permission granted
- Check QR code is clearly visible
- Try manual code entry instead

## Architecture Notes

- **Backend**: Only handles signaling, never touches files
- **WebRTC**: P2P data transfer (encrypted)
- **WebSocket**: Session management and signaling
- **Intent Router**: Interprets drag & drop as intents
- **Permission Engine**: Fine-grained access control

## Security

- Sessions auto-expire after 1 hour
- Permissions are read-only by default
- All data transfer is end-to-end encrypted (WebRTC)
- No persistent device pairing
- Backend never stores files

