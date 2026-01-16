# Debug WebRTC Connection

## Quick Debug Steps

### 1. Check if Remote View Opens

When you click "Open Remote View", does a new browser tab open?
- **YES** → Good, continue to step 2
- **NO** → Check browser console in DeviceTiles tab for errors

### 2. Check Browser Console in Remote View Tab

Open the remote view tab, press F12, go to Console tab.

**Look for these messages:**
```
RemoteAccess: Using main session deviceId: <some-id>
RemoteAccess: Connecting with sessionCode: <code>
RemoteAccess: Sent session_join with deviceId: <id>
Successfully joined session for remote access
```

**Do you see these?**
- **YES** → Remote view connected, continue to step 3
- **NO** → Backend might not be running or session expired

### 3. Check if WebRTC Offer is Received

In the same browser console, look for:
```
Received WebRTC offer
```

**Do you see this?**
- **YES** → Offer received, continue to step 4
- **NO** → Mobile might not be sending offer, check step 5

### 4. Check if Answer is Sent

Look for:
```
Sent WebRTC answer
```

**Do you see this?**
- **YES** → Answer sent, continue to step 6
- **NO** → There's an error creating the answer, check for error messages

### 5. Check Mobile Logs

Run this command:
```bash
adb logcat -c
adb logcat | findstr "RemoteDesktopManager ScreenCaptureService"
```

**Look for:**
```
ScreenCaptureService: === START SCREEN CAPTURE IN SERVICE ===
ScreenCaptureService: Creating RemoteDesktopManager in service...
ScreenCaptureService: Starting screen share IMMEDIATELY in service...
RemoteDesktopManager: === START SCREEN SHARE ===
RemoteDesktopManager: ✅ MediaProjection obtained successfully
RemoteDesktopManager: ✅ ScreenCapturerAndroid created
RemoteDesktopManager: Creating and sending WebRTC offer...
RemoteDesktopManager: Sent WebRTC offer
```

**Do you see "Sent WebRTC offer"?**
- **YES** → Mobile is sending offer, problem is in routing
- **NO** → Mobile isn't creating offer, check for errors

### 6. Check Connection State

In browser console, look for:
```
Connection state changed: connecting
Connection state changed: connected
```

**Do you see "connected"?**
- **YES** → Connection established, continue to step 7
- **NO** → ICE negotiation failing, check network

### 7. Check if Stream is Received

Look for:
```
Received remote stream
```

**Do you see this?**
- **YES** → Stream received, video should appear!
- **NO** → Stream not being sent, check mobile logs

## Common Issues

### Issue 1: "Waiting for screen share from source device..."

**Cause:** RemoteAccess not receiving WebRTC offer

**Debug:**
1. Check mobile logs - is "Sent WebRTC offer" there?
2. Check browser console - is "Received WebRTC offer" there?
3. If mobile sends but browser doesn't receive, it's a routing issue

**Fix:**
- Check that device IDs match
- Check backend is routing messages correctly
- Try refreshing both pages

### Issue 2: "Connection timeout"

**Cause:** Backend not running or not accessible

**Fix:**
- Restart backend: `cd backend && npm start`
- Check `http://localhost:8080` is accessible
- Check firewall isn't blocking port 8080

### Issue 3: Offer received but no answer

**Cause:** Error creating WebRTC answer

**Debug:**
- Check browser console for errors
- Look for "Failed to create answer" or similar

**Fix:**
- Refresh the page
- Try in different browser (Chrome recommended)

### Issue 4: Connected but no video

**Cause:** Video track not being sent

**Debug:**
- Check mobile logs for "Starting video capture"
- Check browser console for "Received remote stream"

**Fix:**
- Check mobile screen is on and unlocked
- Check mobile isn't in power saving mode
- Try stopping and restarting screen share

## Manual Test

### Test Backend Routing

1. **In DeviceTiles browser console:**
```javascript
// Get your device ID
const deviceId = sessionStorage.getItem('deviceId');
console.log('My device ID:', deviceId);
```

2. **In mobile logs, check:**
```
Sent WebRTC offer
```
Look at the log line and see what `toDevice` value is being sent.

3. **Compare:**
- Does the `toDevice` in mobile logs match your `deviceId` from step 1?
- **YES** → Routing should work
- **NO** → There's a mismatch, that's the problem

## Detailed Logging

### Add Logging to Backend

Edit `backend/src/server.js`, find the `handleWebRTCSignal` function and add:

```javascript
function handleWebRTCSignal(ws, message) {
  const { sessionId, deviceId } = message;
  const { toDevice } = message.payload;
  
  console.log('=== WEBRTC SIGNAL ===');
  console.log('Type:', message.type);
  console.log('From device:', deviceId);
  console.log('To device:', toDevice);
  console.log('Target connection exists:', deviceConnections.has(toDevice));
  
  // ... rest of function
}
```

Restart backend and check logs when mobile sends offer.

### Add Logging to Frontend

Edit `frontend/src/services/RemoteDesktopManager.ts`, find `handleSignaling` and add:

```typescript
private async handleSignaling(message: any): Promise<void> {
  console.log('=== HANDLE SIGNALING ===');
  console.log('Message type:', message.type);
  console.log('From device:', message.deviceId);
  console.log('Full message:', message);
  
  // ... rest of function
}
```

Rebuild frontend and check browser console.

## Expected Flow

```
1. Mobile: "Starting screen share"
2. Mobile: "✅ MediaProjection obtained"
3. Mobile: "Creating and sending WebRTC offer"
4. Mobile: "Sent WebRTC offer to device: <viewer-id>"
5. Backend: "Routing webrtc_offer from <mobile-id> to <viewer-id>"
6. Browser: "Received WebRTC offer"
7. Browser: "Creating answer"
8. Browser: "Sent WebRTC answer"
9. Mobile: "Received WebRTC answer"
10. Mobile: "Remote description set successfully"
11. Browser: "Connection state changed: connected"
12. Browser: "Received remote stream"
13. Browser: "Video element playing"
```

## Quick Fix Attempts

### Attempt 1: Restart Everything

1. Stop backend (Ctrl+C)
2. Stop frontend (Ctrl+C)
3. Close all browser tabs
4. Restart backend: `cd backend && npm start`
5. Restart frontend: `cd frontend && npm run dev`
6. Open fresh browser tab
7. Create new session
8. Join from mobile
9. Try again

### Attempt 2: Clear State

1. In browser: Clear sessionStorage
   ```javascript
   sessionStorage.clear();
   ```
2. Refresh page
3. Create new session
4. Try again

### Attempt 3: Check Device IDs

1. In DeviceTiles console:
   ```javascript
   console.log('Device ID:', sessionStorage.getItem('deviceId'));
   ```
2. When you click "Open Remote View", check mobile logs for:
   ```
   viewerDeviceId: <id>
   ```
3. These should match!

## Report Template

If still not working, provide:

**Browser Console (DeviceTiles tab):**
```
[paste console output]
```

**Browser Console (Remote View tab):**
```
[paste console output]
```

**Mobile Logs:**
```bash
adb logcat -c
adb logcat | findstr "RemoteDesktopManager ScreenCaptureService"
# [paste output]
```

**Backend Logs:**
```
[paste terminal output from backend]
```

This will help identify exactly where the flow is breaking!
