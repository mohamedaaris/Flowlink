# FlowLink Backend

Lightweight WebSocket server for session management and WebRTC signaling.

## Responsibilities

- Session creation and management
- Device connection tracking
- WebRTC signaling relay (offer/answer/ICE candidates)
- Session expiry and cleanup

## Does NOT

- Store or transfer files
- Access device data
- Maintain persistent connections
- Handle actual data transfer (that's WebRTC P2P)

## Usage

```bash
npm install
npm run dev
```

Server runs on `ws://localhost:8080` by default.

## Environment Variables

- `PORT`: WebSocket server port (default: 8080)

