# Test Screen Share with Detailed Logging

## Setup

### 1. Install Updated APK

The APK has been rebuilt with detailed logging.

**Location:** `mobile/android/app/build/outputs/apk/debug/app-debug.apk`

**Install:** Copy to phone and install (or use Android Studio)

### 2. Start Backend

```bash
cd backend
npm start
```

Keep this terminal open to see backend logs.

### 3. Start Frontend

```bash
cd frontend
npm run dev
```

Keep this terminal open.

### 4. Open Browser

Open `http://localhost:5173` in Chrome

## Test Procedure

### Step 1: Create Session

1. Click "Create Session" on laptop
2. Note the session code
3. Keep DevTools open (F12)

### Step 2: Join from Mobile

1. Open FlowLink app on phone
2. Join the session (scan QR or enter code)
3. Wait for "Connected" message

### Step 3: Start Mobile Logs

In a new terminal:
```bash
adb logcat -c
adb logcat | findstr "RemoteDesktopManager ScreenCaptureService FlowLink"
```

Keep this running to see mobile logs in real-time.

### Step 4: Request Screen Share

1. On laptop, click "Open Remote View" button
2. Watch for new browser tab to open
3. On mobile, grant permissions:
   - "Allow screen sharing?" → **Allow**
   - System dialog → **Entire Screen** → **Start now**

### Step 5: Check Logs

## Expected Logs

### Mobile Logs (adb logcat)

You should see this sequence:

```
FlowLink: === START SCREEN SHARING REQUEST ===
FlowLink: Performing complete cleanup...
FlowLink: Cleanup complete, starting fresh session...
FlowLink: === INTERNAL START ===
FlowLink: Starting ScreenCaptureService...
FlowLink: Requesting screen capture permission...
FlowLink: Launching permission dialog...
FlowLink: === Screen Capture Result Received ===
FlowLink: Result code: -1
FlowLink: Has data: true
FlowLink: Permission granted - passing to service IMMEDIATELY
FlowLink: Starting ScreenCaptureService with Intent...
ScreenCaptureService: onStartCommand: action=ACTION_START_CAPTURE
ScreenCaptureService: ACTION_START_CAPTURE received
ScreenCaptureService: === START SCREEN CAPTURE IN SERVICE ===
ScreenCaptureService: Creating RemoteDesktopManager in service...
ScreenCaptureService: Starting screen share IMMEDIATELY in service...
RemoteDesktopManager: === START SCREEN SHARE ===
RemoteDesktopManager: Result code: -1
RemoteDesktopManager: Getting MediaProjection IMMEDIATELY...
RemoteDesktopManager: ✅ MediaProjection obtained successfully
RemoteDesktopManager: Creating peer connection...
RemoteDesktopManager: Creating ScreenCapturerAndroid...
RemoteDesktopManager: ✅ ScreenCapturerAndroid created
RemoteDesktopManager: Creating video source...
RemoteDesktopManager: Initializing video capturer...
RemoteDesktopManager: Creating video track...
RemoteDesktopManager: ✅ Video track created
RemoteDesktopManager: Creating local stream...
RemoteDesktopManager: Adding stream to peer connection...
RemoteDesktopManager: Starting video capture at 1280x720@30fps...
RemoteDesktopManager: Creating and sending WebRTC offer...
RemoteDesktopManager: === SENDING WEBRTC OFFER ===
RemoteDesktopManager: Session ID: <session-id>
RemoteDesktopManager: Source Device ID (mobile): <mobile-device-id>
RemoteDesktopManager: Viewer Device ID (laptop): <laptop-device-id>
RemoteDesktopManager: SDP Type: offer
RemoteDesktopManager: WebSocket ready state: connected
RemoteDesktopManager: ✅ WebRTC offer sent successfully
ScreenCaptureService: ✅ Screen capture started successfully in service
```

**CRITICAL:** Note the "Viewer Device ID (laptop)" value!

### Browser Console (Remote View Tab)

Press F12 in the remote view tab. You should see:

```
RemoteAccess: Using main session deviceId: <laptop-device-id>
RemoteAccess: Connecting with sessionCode: <code>
RemoteAccess: Source device (sharing): <mobile-device-id> Viewer device: <laptop-device-id>
RemoteAccess: Sent session_join with deviceId: <laptop-device-id>
Successfully joined session for remote access
Connected to session. Setting up viewer...
=== HANDLE SIGNALING ===
Message type: webrtc_offer
From device: <mobile-device-id>
Full message: { ... }
Received WebRTC offer
Offer SDP: v=0...
Remote description set, creating answer...
Local description set, sending answer...
Sent WebRTC answer
Connection state changed: connecting
Connection state changed: connected
Received remote stream
Connected - Receiving video
```

**CRITICAL:** The "deviceId" in "Sent session_join" should MATCH the "Viewer Device ID" from mobile logs!

### Backend Logs (Terminal)

In the backend terminal, you should see:

```
WebRTC signal: webrtc_offer from <mobile-device-id> to <laptop-device-id>
WebRTC signal: webrtc_answer from <laptop-device-id> to <mobile-device-id>
WebRTC signal: webrtc_ice_candidate from <mobile-device-id> to <laptop-device-id>
WebRTC signal: webrtc_ice_candidate from <laptop-device-id> to <mobile-device-id>
```

## Diagnosis

### ✅ Success

If you see all the above logs AND the mobile screen appears in the browser:
- **Congratulations!** It's working!

### ❌ Problem: Device ID Mismatch

**Check:**
- Mobile log: "Viewer Device ID (laptop): XXXXX"
- Browser log: "Sent session_join with deviceId: YYYYY"

**If XXXXX ≠ YYYYY:**
- This is the problem!
- The mobile is sending to the wrong device ID
- The browser is listening with a different ID

**Fix:**
1. Clear browser cache and sessionStorage
2. Create a NEW session
3. Join from mobile again
4. Try again

### ❌ Problem: Offer Not Received

**Mobile shows:**
```
✅ WebRTC offer sent successfully
```

**But browser doesn't show:**
```
Received WebRTC offer
```

**Possible causes:**
1. Backend not routing messages
2. WebSocket connection dropped
3. Device ID mismatch (see above)

**Fix:**
1. Check backend logs for routing messages
2. Restart backend
3. Refresh browser
4. Try again

### ❌ Problem: Offer Received but No Answer

**Browser shows:**
```
Received WebRTC offer
```

**But doesn't show:**
```
Sent WebRTC answer
```

**Possible causes:**
1. Error creating answer (check for error messages)
2. Browser WebRTC not supported

**Fix:**
1. Check browser console for errors
2. Try in Chrome (best WebRTC support)
3. Check browser permissions

### ❌ Problem: Connected but No Video

**Browser shows:**
```
Connection state changed: connected
```

**But doesn't show:**
```
Received remote stream
```

**Possible causes:**
1. Video track not being sent
2. Mobile screen capture failed

**Fix:**
1. Check mobile logs for "Starting video capture"
2. Check mobile screen is on and unlocked
3. Try stopping and restarting

## Quick Checks

### Check 1: Device IDs Match

**In browser console (DeviceTiles tab):**
```javascript
console.log('My device ID:', sessionStorage.getItem('deviceId'));
```

**In mobile logs, find:**
```
Viewer Device ID (laptop): <id>
```

**These MUST match!**

### Check 2: WebSocket Connected

**In browser console (Remote View tab):**
```javascript
// Should show "1" (OPEN)
console.log('WebSocket state:', wsRef.current?.readyState);
```

### Check 3: Backend Routing

**In backend terminal, you should see:**
```
WebRTC signal: webrtc_offer from <mobile> to <laptop>
```

If you don't see this, backend isn't receiving the message.

## Manual Fix

If device IDs don't match, manually fix:

**In browser console (before opening remote view):**
```javascript
// Set the device ID that mobile will use
const correctDeviceId = '<the-id-from-mobile-logs>';
sessionStorage.setItem('deviceId', correctDeviceId);
console.log('Set device ID to:', correctDeviceId);
```

Then try opening remote view again.

## Report

If still not working, provide:

1. **Mobile logs** (the full output from adb logcat)
2. **Browser console** (Remote View tab)
3. **Backend logs** (terminal output)
4. **Device IDs:**
   - From mobile: "Viewer Device ID (laptop): ___"
   - From browser: "Sent session_join with deviceId: ___"

This will help identify the exact issue!
