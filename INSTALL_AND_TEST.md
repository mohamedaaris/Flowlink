# Install and Test - Service-Based Screen Share

## ✅ Build Complete!

The APK has been successfully built with the service-based architecture.

**APK Location:**
```
mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

## Installation Options

### Option 1: Transfer to Phone (Easiest)

1. **Copy APK to your phone:**
   - Connect phone via USB
   - Copy `app-debug.apk` to phone's Downloads folder
   - Or email it to yourself
   - Or use cloud storage (Google Drive, Dropbox)

2. **Install on phone:**
   - Open Files app on phone
   - Navigate to Downloads
   - Tap `app-debug.apk`
   - If prompted, allow "Install from unknown sources"
   - Tap "Install"

### Option 2: Using Android Studio

1. Open Android Studio
2. Open the project: `mobile/android`
3. Click Run (green play button)
4. Select your connected device
5. App will install and launch

### Option 3: Using ADB (if installed)

```bash
# Find your Android SDK path, then:
adb install -r mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

## Testing the Feature

### 1. Start Backend Server

```bash
cd backend
npm install  # if not already done
npm start
```

**Expected output:**
```
Server running on port 8080
WebSocket server ready
```

### 2. Start Frontend

```bash
cd frontend
npm install  # if not already done
npm run dev
```

**Expected output:**
```
VITE ready in XXX ms
Local: http://localhost:5173
```

### 3. Create Session on Laptop

1. Open browser: `http://localhost:5173`
2. Click "Create Session"
3. You'll see a QR code and session code
4. Keep this window open

### 4. Join Session on Mobile

1. Open FlowLink app on your phone
2. Tap "Scan QR Code" or "Enter Code"
3. Scan the QR code or enter the session code
4. Wait for "Connected" message

### 5. Test Screen Sharing

1. **On laptop:** Click the "Open Remote View" button on your device tile
2. **On mobile:** You should see two dialogs:
   - First: "Allow screen sharing?" → Tap **Allow**
   - Second: System permission dialog → Select **Entire Screen** → Tap **Start now**
3. **Expected result:** A new browser tab opens showing your mobile screen!

## What to Look For

### ✅ Success Indicators

**On Mobile:**
- Notification appears: "FlowLink Screen Sharing - Your screen is being shared"
- No error toasts
- App stays responsive

**On Laptop:**
- New browser tab opens automatically
- Mobile screen appears within 2-3 seconds
- Video is smooth (25-30 fps)
- Low latency (~100-300ms)

**In Browser Console (F12):**
```
RemoteAccess: Connecting with sessionCode: XXXX
Successfully joined session for remote access
Received WebRTC offer
Sent WebRTC answer
Connection state changed: connected
Received remote stream
Connected - Receiving video
```

### ❌ If You See Errors

**"Failed to start screen sharing: don't reuse resultData"**
- This means the service-based approach also failed
- Try rebooting your phone
- Try on a different Android device
- See "Alternative Solutions" below

**"Not in a session"**
- Make sure you joined the session first
- Check that backend is running
- Rejoin the session

**"WebSocket not open"**
- Backend server not running
- Check `http://localhost:8080` is accessible
- Restart backend server

**Video not showing**
- Check browser console for errors
- Refresh the browser page
- Try clicking "Open Remote View" again

## Monitor Logs (Optional)

If you have ADB set up, you can monitor logs in real-time:

```bash
adb logcat -c  # Clear logs
adb logcat | findstr "FlowLink ScreenCaptureService MediaProjection RemoteDesktop"
```

**Look for these success messages:**
```
FlowLink: Permission granted - passing to service IMMEDIATELY
ScreenCaptureService: === START SCREEN CAPTURE IN SERVICE ===
ScreenCaptureService: Creating RemoteDesktopManager in service...
RemoteDesktopManager: ✅ MediaProjection obtained successfully
RemoteDesktopManager: ✅ ScreenCapturerAndroid created
ScreenCaptureService: ✅ Screen capture started successfully in service
```

## Stop Screen Sharing

**Option 1:** Tap "Stop" in the notification on mobile

**Option 2:** Close the browser tab on laptop

**Option 3:** Leave the session

## Test Multiple Times

To ensure reliability:

1. Stop screen sharing
2. Wait 2 seconds
3. Click "Open Remote View" again
4. Grant permissions again
5. Verify it works

Repeat 3-5 times to confirm consistency.

## Alternative Solutions

If the service-based approach still shows the error, see:

**ALTERNATIVE_SCREEN_SHARE_SOLUTION.md** for:
- Solution 3: Alternative Technologies
  - RTMP Streaming
  - VNC Protocol
  - Scrcpy
  - WebRTC in mobile browser

These are completely different approaches that don't use Android's MediaProjection API.

## Performance Tips

### For Best Performance:

**On Mobile:**
- Connect to strong WiFi (not mobile data)
- Close background apps
- Keep screen on and unlocked
- Disable battery saver mode

**On Laptop:**
- Use Chrome or Edge browser (best WebRTC support)
- Close unnecessary tabs
- Connect to same WiFi network as mobile

### Expected Performance:
- **Latency:** 100-300ms
- **Frame Rate:** 25-30 fps
- **Resolution:** 1280x720 (scales to mobile screen)
- **Bitrate:** 2-5 Mbps

## Troubleshooting

### App Won't Install
- Enable "Install from unknown sources" in phone settings
- Uninstall old version first
- Check phone has enough storage

### Can't Join Session
- Check backend is running on port 8080
- Check phone and laptop on same network
- Try entering code manually instead of QR

### Permission Dialog Doesn't Appear
- Check notification permissions (Android 13+)
- Restart the app
- Clear app data and try again

### Video is Laggy
- Check WiFi signal strength
- Close other apps on mobile
- Reduce browser window size
- Check CPU usage on both devices

## Need Help?

If you encounter issues:

1. **Check logs** (see "Monitor Logs" section above)
2. **Try device reboot**
3. **Test on different device** (if available)
4. **Report issue** with:
   - Device model and Android version
   - Full logcat output
   - Browser console output
   - Steps to reproduce

## Summary

1. ✅ APK built successfully
2. 📱 Install APK on phone
3. 🖥️ Start backend and frontend
4. 🔗 Create and join session
5. 📺 Click "Open Remote View"
6. ✅ Grant permissions
7. 🎉 Mobile screen appears in browser!

---

**Good luck! The service-based architecture should resolve the MediaProjection error.** 🚀
