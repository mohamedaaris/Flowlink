# FlowLink Architecture

## System Overview

FlowLink is a peer-to-peer, session-based system for cross-device continuity. The backend is minimal and only handles signaling. All data transfer happens via WebRTC (P2P).

## Component Architecture

```
┌─────────────┐         ┌─────────────┐
│   Phone     │◄───────►│   Laptop    │
│  (Android)  │  WebRTC │  (React)    │
└──────┬──────┘         └──────┬──────┘
       │                        │
       └──────────┬─────────────┘
                  │
            ┌─────▼─────┐
            │  Backend  │
            │ (Signaling│
            │  Only)    │
            └───────────┘
```

## Data Flow

### Session Creation
1. User creates session on Device A
2. Backend generates session ID + 6-digit code
3. Device A displays QR code
4. Device B scans QR or enters code
5. Backend validates and connects both devices
6. Devices establish WebRTC connection via signaling

### Intent Flow
1. User drags item onto Device B tile
2. Intent Router detects intent type
3. Intent object created with payload
4. Sent via WebRTC to Device B
5. Device B receives, requests permission if needed
6. If granted, auto-opens or displays action

### File Transfer Flow
1. Intent with file payload sent
2. If large, chunked transfer via WebRTC data channel
3. Progress updates sent back
4. File saved to device
5. Auto-opens if permission granted

## WebSocket Message Format

All messages follow this structure:
```typescript
{
  type: MessageType,
  sessionId: string,
  deviceId: string,
  payload: any,
  timestamp: number
}
```

### Key Message Types

**Session Management:**
- `session_create`: Create new session
- `session_join`: Join existing session
- `session_leave`: Leave session
- `device_connected`: Device joined session
- `device_disconnected`: Device left session

**Intent Routing:**
- `intent_send`: Send intent to target device
- `intent_received`: Acknowledge receipt
- `intent_accepted`: Permission granted
- `intent_rejected`: Permission denied

**WebRTC Signaling:**
- `webrtc_offer`: WebRTC offer
- `webrtc_answer`: WebRTC answer
- `webrtc_ice_candidate`: ICE candidate

## WebRTC Connection Flow

1. **Signaling Phase** (via WebSocket):
   - Device A creates offer
   - Sends offer to backend
   - Backend forwards to Device B
   - Device B creates answer
   - Sends answer back via backend
   - ICE candidates exchanged

2. **P2P Phase** (direct WebRTC):
   - Connection established
   - Data channels opened
   - File/intent transfer happens directly
   - Backend no longer involved

## Security Model

- **Session Expiry**: Auto-expires after 1 hour
- **Permissions**: Explicit opt-in, read-only defaults
- **End-to-End**: WebRTC encryption
- **No Storage**: Backend never stores files
- **Visual Indicators**: Always show active access
- **No Background**: Access only during active session

## Module Responsibilities

### Session Manager
- Create/join sessions
- Track devices
- Handle expiry
- Generate codes

### Device Agent
- Expose device capabilities
- Handle incoming intents
- Request permissions
- Auto-open files/apps

### Intent Router
- Detect drag intent type
- Create intent objects
- Route to target device
- Handle responses

### File Bridge
- Browse remote filesystem
- Transfer files (chunked)
- Show progress
- Handle cancellation

### Continuity Engine
- Sync media playback state
- Sync clipboard
- Track file positions
- Maintain context

### Permission Engine
- Manage fine-grained permissions
- Request/grant/deny flow
- Visual indicators
- Auto-revoke on expiry

