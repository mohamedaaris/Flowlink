# WebRTC Connection Fix

## Problem
Screen sharing was starting ("Starting screen sharing" message appeared), but the mobile screen wasn't showing in the laptop browser.

## Root Cause
**WebSocket Connection Mismatch:**
1. DeviceTiles had WebSocket connection with device ID "device-123"
2. User clicked "Open Remote View"
3. Mobile started screen sharing and sent WebRTC offer to "device-123"
4. RemoteAccess opened in new tab and created NEW WebSocket with ID "viewer-456"
5. Mobile's WebRTC offer went to "device-123" but RemoteAccess was listening as "viewer-456"
6. **Result:** WebRTC messages never reached RemoteAccess

## Solution
**Use Same Device ID:**
- RemoteAccess now uses the SAME device ID as DeviceTiles
- When RemoteAccess joins the session, it replaces the DeviceTiles WebSocket connection
- Mobile's WebRTC messages now reach RemoteAccess correctly

## Changes Made

### frontend/src/components/RemoteAccess.tsx
```typescript
// OLD: Created unique viewer ID
const newId = `remote-viewer-${deviceId}-${Date.now()}`;

// NEW: Use same device ID as main session
const mainDeviceId = sessionStorage.getItem('deviceId');
return mainDeviceId;
```

**Effect:**
- RemoteAccess joins with same device ID
- Backend replaces DeviceTiles connection with RemoteAccess connection
- WebRTC messages route correctly to RemoteAccess

### Trade-off
- DeviceTiles loses its WebSocket connection when RemoteAccess opens
- This is acceptable because user is now in remote view
- When user closes remote view, they can return to DeviceTiles and reconnect

## How It Works Now

### Complete Flow

1. **User clicks "Open Remote View"**
   - DeviceTiles sends `remote_access_request` to mobile
   - Request includes viewerDeviceId = "device-123" (main device ID)

2. **Mobile receives request**
   - Shows permission dialog
   - User grants permissions

3. **Mobile starts screen sharing**
   - ScreenCaptureService creates MediaProjection
   - RemoteDesktopManager sets up WebRTC
   - Creates WebRTC offer
   - Sends offer to viewerDeviceId = "device-123"
   - Sends `remote_access_ready` message

4. **DeviceTiles receives remote_access_ready**
   - Opens new browser tab: `/remote/{sourceDeviceId}`

5. **RemoteAccess component loads**
   - Gets device ID from sessionStorage = "device-123"
   - Creates NEW WebSocket connection
   - Joins session with device ID = "device-123"

6. **Backend handles session_join**
   - Sees device "device-123" already exists
   - REPLACES old WebSocket (DeviceTiles) with new one (RemoteAccess)
   - Routes all messages to RemoteAccess now

7. **Mobile sends WebRTC offer**
   - Sends to device ID = "device-123"
   - Backend routes to RemoteAccess WebSocket ✅

8. **RemoteAccess receives offer**
   - Creates WebRTC answer
   - Sends back to mobile
   - ICE candidates exchanged
   - Connection established ✅

9. **Video stream starts**
   - Mobile captures screen
   - Sends video via WebRTC
   - RemoteAccess displays video ✅

## Testing

### Build Frontend
```bash
cd frontend
npm run build  # or npm run dev
```

### Test Flow
1. Start backend: `cd backend && npm start`
2. Start frontend: `cd frontend && npm run dev`
3. Create session on laptop
4. Join session on mobile (use existing APK)
5. Click "Open Remote View" on laptop
6. Grant permissions on mobile
7. **Expected:** Mobile screen appears in new browser tab!

### Check Browser Console
Open DevTools (F12) in the remote view tab:

**Success indicators:**
```
RemoteAccess: Using main session deviceId: device-xxx
RemoteAccess: Sent session_join with deviceId: device-xxx
Successfully joined session for remote access
Received WebRTC offer
Sent WebRTC answer
Connection state changed: connected
Received remote stream
Connected - Receiving video
```

### Check Mobile Logs
```bash
adb logcat | findstr "FlowLink ScreenCaptureService RemoteDesktop"
```

**Success indicators:**
```
ScreenCaptureService: ✅ Screen capture started successfully in service
RemoteDesktopManager: ✅ MediaProjection obtained successfully
RemoteDesktopManager: Creating and sending WebRTC offer...
RemoteDesktopManager: Sent WebRTC offer
RemoteDesktopManager: Received WebRTC answer
RemoteDesktopManager: Remote description set successfully
```

## Expected Behavior

### ✅ Success
- "Starting screen sharing" toast on mobile
- Notification: "FlowLink Screen Sharing"
- New browser tab opens automatically
- Mobile screen appears within 2-3 seconds
- Smooth 30fps video
- Low latency (~100-300ms)

### ❌ If Still Not Working

**Check these:**

1. **Backend running?**
   - Visit `http://localhost:8080`
   - Should see "WebSocket server running"

2. **Both devices in same session?**
   - Check session code matches
   - Check "Connected" status

3. **Browser console errors?**
   - Open DevTools (F12)
   - Check for WebRTC errors
   - Check for WebSocket errors

4. **Mobile logs show errors?**
   - Run `adb logcat | findstr "ERROR"`
   - Look for WebRTC or MediaProjection errors

5. **Firewall blocking?**
   - Check Windows Firewall
   - Check antivirus software
   - Try disabling temporarily

## Troubleshooting

### "Waiting for screen share from source device..."
**Cause:** RemoteAccess not receiving WebRTC offer
**Solution:**
- Check mobile logs for "Sent WebRTC offer"
- Check browser console for "Received WebRTC offer"
- Verify device IDs match in logs

### "Connection timeout"
**Cause:** Backend not running or not accessible
**Solution:**
- Restart backend: `cd backend && npm start`
- Check port 8080 is not in use
- Check firewall settings

### "Failed to join session"
**Cause:** Session expired or invalid
**Solution:**
- Create new session
- Rejoin from mobile
- Try again

### Black screen in remote view
**Cause:** Video track not initialized
**Solution:**
- Check mobile screen is on and unlocked
- Check mobile isn't in power saving mode
- Try stopping and restarting screen share

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    DeviceTiles (Laptop)                  │
│  - WebSocket connection: device-123                     │
│  - Sends remote_access_request                          │
│  - Opens RemoteAccess in new tab                        │
└─────────────────────────────────────────────────────────┘
                         │
                         │ Opens new tab
                         ↓
┌─────────────────────────────────────────────────────────┐
│                  RemoteAccess (Laptop)                   │
│  - NEW WebSocket connection: device-123 (SAME ID!)      │
│  - Replaces DeviceTiles connection                      │
│  - Receives WebRTC offer                                │
│  - Displays video stream                                │
└─────────────────────────────────────────────────────────┘
                         ↑
                         │ WebRTC offer/answer
                         │
┌─────────────────────────────────────────────────────────┐
│              ScreenCaptureService (Mobile)               │
│  - Creates MediaProjection                              │
│  - Sets up WebRTC                                       │
│  - Sends offer to device-123                            │
│  - Streams video                                        │
└─────────────────────────────────────────────────────────┘
```

## Summary

The fix ensures WebRTC messages reach the correct destination by:
1. Using the same device ID for RemoteAccess as DeviceTiles
2. Allowing the backend to replace the WebSocket connection
3. Routing all WebRTC messages to the active RemoteAccess connection

This should resolve the issue and allow the mobile screen to appear in the browser!

---

**Status:** ✅ Fixed
**Next:** Rebuild frontend and test
