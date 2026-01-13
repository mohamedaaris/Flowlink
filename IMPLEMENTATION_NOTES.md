# FlowLink Implementation Notes

## Architecture Decisions

### Backend (Node.js + WebSocket)
- **Why WebSocket?** Real-time bidirectional communication for signaling
- **Why NOT handle files?** Privacy and scalability - backend is stateless
- **Session Storage**: In-memory for MVP (use Redis in production)
- **Port**: 8080 (configurable via PORT env var)

### Frontend (React + Vite)
- **Why React?** Component-based UI, great for drag & drop
- **Why Vite?** Fast dev server, modern tooling
- **State Management**: React hooks (useState, useEffect)
- **WebRTC**: Native browser APIs for P2P communication

### Android (Kotlin)
- **Why Kotlin?** Modern, concise, Android-first
- **Intent System**: Leverages Android's native Intent system for auto-open
- **WebSocket**: OkHttp WebSocket client
- **QR Scanning**: ZXing library

## Key Implementation Details

### Intent Detection
The Intent Router uses heuristics to detect intent type:
- **File**: `e.dataTransfer.files` present
- **Media URL**: URL matches media extensions (`.mp4`, `.mp3`, etc.)
- **Link**: Valid URL (starts with `http://` or `https://`)
- **Prompt**: Text with newlines or code markers (` ``` `)
- **Clipboard**: Short text without URL pattern

### WebRTC Flow
1. Device A creates offer → sends via WebSocket
2. Backend forwards to Device B
3. Device B creates answer → sends via WebSocket
4. Backend forwards to Device A
5. ICE candidates exchanged
6. P2P connection established
7. Data channels opened for file/intent transfer

### Permission System
- **Default**: All permissions denied (read-only)
- **Request Flow**: User must explicitly grant per permission type
- **Visual**: Permission badges on device tiles
- **Auto-Revoke**: On session expiry or disconnect

### File Transfer
- **Chunked**: 64KB chunks for large files
- **Progress**: Callback-based progress updates
- **Cancellation**: User can cancel active transfers
- **WebRTC**: Uses data channels for P2P transfer

### Media Continuation
- **Timestamp**: Included in media URL (`#t=123`)
- **State**: Play/pause state synced
- **Auto-Open**: Opens in default media player/browser

## Security Considerations

1. **End-to-End Encryption**: WebRTC provides built-in encryption
2. **Session Expiry**: Prevents long-lived sessions
3. **Permission Model**: Explicit opt-in, no default access
4. **No Backend Storage**: Files never touch backend
5. **Visual Indicators**: Users always know when access is active

## Known Limitations (MVP)

1. **NAT Traversal**: Only STUN servers (no TURN) - may fail behind strict NATs
2. **File Size**: No explicit limit, but browser memory constraints apply
3. **Android WebSocket URL**: Hardcoded for emulator (needs IP config for physical devices)
4. **Remote Browse**: Stubbed (not implemented in MVP)
5. **Binary Transfer**: Uses JSON encoding (inefficient for large files)

## Production Enhancements Needed

1. **TURN Servers**: For NAT traversal
2. **Binary Data Channels**: Direct binary transfer (not JSON)
3. **Redis Session Storage**: For scalability
4. **Authentication**: User accounts and device pairing
5. **Rate Limiting**: Prevent abuse
6. **Error Recovery**: Retry logic for failed transfers
7. **Compression**: For file transfers
8. **Progress Persistence**: Resume interrupted transfers

## Testing Checklist

- [ ] Create session on laptop
- [ ] Join session from phone (QR code)
- [ ] Join session from phone (6-digit code)
- [ ] Drag file onto phone tile → verify transfer
- [ ] Drag media URL onto phone tile → verify opens with timestamp
- [ ] Drag link onto phone tile → verify opens in browser
- [ ] Drag text prompt onto phone tile → verify opens in search/editor
- [ ] Test clipboard sync
- [ ] Test permission denial
- [ ] Test session expiry
- [ ] Test device disconnect
- [ ] Test WebRTC fallback to WebSocket

## File Structure Summary

```
flowlink/
├── backend/
│   └── src/server.js          # WebSocket server (signaling only)
├── frontend/
│   ├── src/
│   │   ├── components/         # React UI components
│   │   │   ├── SessionManager.tsx
│   │   │   ├── DeviceTiles.tsx
│   │   │   └── DeviceTile.tsx
│   │   └── services/           # Core business logic
│   │       ├── IntentRouter.ts
│   │       ├── WebRTCManager.ts
│   │       ├── FileBridge.ts
│   │       ├── ContinuityEngine.ts
│   │       └── PermissionEngine.ts
│   └── package.json
├── mobile/android/
│   └── app/src/main/java/com/flowlink/app/
│       ├── service/
│       │   ├── SessionManager.kt
│       │   ├── WebSocketManager.kt
│       │   └── IntentHandler.kt
│       └── ui/
│           ├── SessionManagerFragment.kt
│           └── DeviceTilesFragment.kt
└── shared/
    ├── types.ts                 # TypeScript type definitions
    └── utils.ts                 # Shared utilities
```

## Next Steps for Production

1. Add TURN servers for WebRTC
2. Implement binary data channel transfer
3. Add Redis for session storage
4. Implement authentication system
5. Add comprehensive error handling
6. Add logging and monitoring
7. Add unit and integration tests
8. Optimize file transfer performance
9. Add compression for transfers
10. Implement transfer resume capability

