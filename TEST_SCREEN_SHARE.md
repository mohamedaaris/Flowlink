# Testing Screen Share Fix

## Quick Test Procedure

### 1. Build and Install
```bash
cd mobile/android
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

### 2. Start Logcat Monitoring
Open a terminal and run:
```bash
adb logcat -c  # Clear logs
adb logcat | grep -E "FlowLink|MediaProjection|RemoteDesktop|ScreenCapture"
```

### 3. Test the Feature

#### On Laptop:
1. Start backend: `cd backend && npm start`
2. Start frontend: `cd frontend && npm run dev`
3. Open browser: `http://localhost:5173`
4. Create a session
5. Note the session code

#### On Mobile:
1. Open FlowLink app
2. Scan QR code or enter session code
3. Wait for connection

#### On Laptop:
1. Click "Open Remote View" button on the device tile
2. Watch for new browser tab to open

#### On Mobile:
1. Should see "Allow screen sharing?" dialog → Click **Allow**
2. Should see system permission dialog → Select **Entire Screen** → Click **Start now**

### 4. Check Results

#### ✅ SUCCESS - You should see:

**In Logcat:**
```
FlowLink: === START SCREEN SHARING REQUEST ===
FlowLink: Performing complete cleanup...
FlowLink: Cleanup complete, starting fresh session...
FlowLink: === INTERNAL START ===
FlowLink: Starting foreground service...
FlowLink: Requesting screen capture permission...
FlowLink: Launching permission dialog...
FlowLink: === Screen Capture Result Received ===
FlowLink: Result code: -1
FlowLink: Has data: true
FlowLink: Permission granted - starting screen share IMMEDIATELY
FlowLink: Creating RemoteDesktopManager...
FlowLink: Starting screen share NOW...
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
FlowLink: Sending remote_access_ready...
FlowLink: ✅ Screen sharing setup complete
```

**In Browser Console:**
```
RemoteAccess: Connecting with sessionCode: XXXX sessionId: YYYY
RemoteAccess: Source device (sharing): <device-id> Viewer device: viewer-<id>
RemoteAccess: Sent session_join with viewer deviceId: viewer-<id>
Successfully joined session for remote access
Connected to session. Setting up viewer...
Received WebRTC offer
Sent WebRTC answer
Connection state changed: connected
Received remote stream
Connected - Receiving video
```

**Visual:**
- Mobile screen appears in browser window
- Video is smooth and responsive
- Can see mobile UI in real-time

#### ❌ FAILURE - If you see:

**Error in Logcat:**
```
RemoteDesktopManager: IllegalStateException getting MediaProjection
RemoteDesktopManager: MediaProjection failed: ... don't reuse the resultData ...
```

**What to do:**
1. See **ALTERNATIVE_SCREEN_SHARE_SOLUTION.md**
2. Implement Solution 2 (Service-Based Architecture)
3. Or try Solution 3 (Alternative Technologies)

### 5. Test Multiple Sessions

To ensure it works reliably:

1. **Stop screen sharing** (close browser tab or click stop)
2. **Wait 2 seconds**
3. **Click "Open Remote View" again**
4. **Grant permissions again**
5. **Verify it works without errors**

Repeat 3-5 times to ensure consistency.

### 6. Test Edge Cases

#### Test A: Deny Permission
1. Click "Open Remote View"
2. Click **Deny** on mobile
3. Should see "Screen sharing permission denied" toast
4. No errors in logcat

#### Test B: Cancel System Dialog
1. Click "Open Remote View"
2. Click **Allow** on first dialog
3. Click **Cancel** on system dialog
4. Should handle gracefully

#### Test C: Rapid Clicks
1. Click "Open Remote View" multiple times quickly
2. Should see "Screen sharing request already in progress"
3. Only one permission dialog should appear

#### Test D: Network Disconnect
1. Start screen sharing successfully
2. Disconnect WiFi on mobile
3. Should see connection lost in browser
4. Reconnect WiFi
5. Click "Open Remote View" again
6. Should work without errors

## Common Issues & Solutions

### Issue: "No pending viewer device ID"
**Cause:** Permission dialog took too long, state was cleared
**Solution:** Try again immediately

### Issue: "No active session"
**Cause:** Session expired or disconnected
**Solution:** Rejoin the session

### Issue: "Failed to get MediaProjection"
**Cause:** Android system issue or timing problem
**Solution:** 
1. Restart the app
2. Clear app data
3. Reboot device if persistent

### Issue: Browser shows "Waiting for screen share..."
**Cause:** WebRTC connection not established
**Solution:**
1. Check backend is running (port 8080)
2. Check both devices are in same session
3. Check browser console for errors
4. Try refreshing browser page

### Issue: Video is black or frozen
**Cause:** Video track not properly initialized
**Solution:**
1. Stop and restart screen sharing
2. Check mobile isn't in power saving mode
3. Check mobile screen is on and unlocked

## Performance Metrics

### Expected Performance:
- **Latency:** 100-300ms
- **Frame Rate:** 25-30 fps
- **Resolution:** 1280x720 (scales to mobile screen)
- **Bitrate:** ~2-5 Mbps

### If Performance is Poor:
1. Check WiFi signal strength
2. Close other apps on mobile
3. Reduce browser window size
4. Check CPU usage on both devices

## Debugging Commands

### Check if service is running:
```bash
adb shell dumpsys activity services | grep ScreenShare
```

### Check MediaProjection state:
```bash
adb shell dumpsys media_projection
```

### Check WebRTC stats in browser:
```javascript
// In browser console
peerConnection.getStats().then(stats => {
  stats.forEach(report => {
    if (report.type === 'inbound-rtp' && report.kind === 'video') {
      console.log('Frames received:', report.framesReceived);
      console.log('Frames dropped:', report.framesDropped);
      console.log('Bytes received:', report.bytesReceived);
    }
  });
});
```

### Monitor network traffic:
```bash
adb shell dumpsys netstats | grep com.flowlink.app
```

## Success Checklist

- [ ] App builds without errors
- [ ] Can create/join session
- [ ] "Open Remote View" button appears
- [ ] Permission dialogs appear on mobile
- [ ] No "don't reuse resultData" error
- [ ] Mobile screen appears in browser
- [ ] Video is smooth and responsive
- [ ] Can stop and restart without errors
- [ ] Works consistently (3+ times)
- [ ] Edge cases handled gracefully

## Next Steps

### If All Tests Pass:
✅ Feature is working! You can now:
- Test with real users
- Optimize performance
- Add additional features (remote control, etc.)

### If Tests Fail:
❌ See **ALTERNATIVE_SCREEN_SHARE_SOLUTION.md** for:
- Service-based implementation
- Alternative technologies
- Advanced debugging

## Report Template

If you need to report an issue, use this template:

```
**Device Info:**
- Model: [e.g., Samsung Galaxy S21]
- Android Version: [e.g., Android 13]
- App Version: [e.g., 1.0.0]

**Test Results:**
- Build successful: [Yes/No]
- Permission dialog appears: [Yes/No]
- Error in logcat: [Yes/No - paste error]
- Video appears in browser: [Yes/No]

**Logcat Output:**
[Paste relevant logs here]

**Browser Console:**
[Paste relevant logs here]

**Steps to Reproduce:**
1. [Step 1]
2. [Step 2]
3. [Error occurs]

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens]
```

---

Good luck with testing! 🚀
