# Android Studio Setup & Testing Guide

## Prerequisites
- ✅ Backend running on `ws://localhost:8080`
- ✅ Frontend running (for testing on laptop)
- ✅ Android Studio installed
- ✅ Android device or emulator

## Step 1: Open Project in Android Studio

1. **Open Android Studio**
2. **File → Open**
3. Navigate to: `C:\Users\ASUS\Documents\Flowlink\mobile\android`
4. Click **OK**
5. Wait for Gradle sync to complete (may take a few minutes on first open)

## Step 2: Configure WebSocket URL

**IMPORTANT**: The Android app needs to know where your backend is running.

### Option A: Using Android Emulator
1. Open: `mobile/android/app/src/main/java/com/flowlink/app/service/WebSocketManager.kt`
2. Find line with: `private val WS_URL = "ws://10.0.2.2:8080"`
3. This is already correct for emulator (10.0.2.2 = localhost on emulator)
4. **No changes needed** if using emulator

### Option B: Using Physical Android Device
1. Find your computer's IP address:
   - Windows: Open PowerShell, run: `ipconfig`
   - Look for "IPv4 Address" (e.g., `192.168.1.100`)
2. Open: `mobile/android/app/src/main/java/com/flowlink/app/service/WebSocketManager.kt`
3. Change line 20 from:
   ```kotlin
   private val WS_URL = "ws://10.0.2.2:8080"
   ```
   To:
   ```kotlin
   private val WS_URL = "ws://YOUR_IP_ADDRESS:8080"  // e.g., "ws://192.168.1.100:8080"
   ```
4. Make sure your phone and computer are on the **same WiFi network**

## Step 3: Build and Run

1. **Connect Device**:
   - **Emulator**: Tools → Device Manager → Create/Start emulator
   - **Physical Device**: Enable USB debugging, connect via USB

2. **Select Device**: Click device dropdown at top (shows connected devices)

3. **Run App**: Click green ▶️ button or press `Shift+F10`

4. **Wait**: App will build and install (first time may take 2-3 minutes)

## Step 4: Testing Flow

### Test 1: Create Session on Laptop
1. Open frontend in browser: `http://localhost:5173`
2. Click **"Create Session"**
3. You'll see:
   - QR code
   - 6-digit code (e.g., `123456`)

### Test 2: Join Session on Phone
**Method A: QR Code**
1. Open FlowLink app on phone
2. Tap **"Scan QR Code"**
3. Grant camera permission if asked
4. Point camera at QR code on laptop screen
5. App should join session

**Method B: Manual Code Entry**
1. Open FlowLink app on phone
2. Enter the 6-digit code from laptop
3. Tap **"Join Session"**
4. App should join session

### Test 3: Verify Connection
**On Laptop (Frontend)**:
- You should see a device tile appear showing your phone
- Device name: Your phone model (e.g., "Pixel 7")
- Status: "Online" (green dot)

**On Phone (Android App)**:
- Screen should show "Connected Devices"
- Status text should show session ID

### Test 4: Send File from Laptop to Phone
1. **On Laptop**: Drag a file (image, PDF, etc.) onto the phone's device tile
2. **On Phone**: You should see a permission prompt
3. **On Phone**: Tap "Allow"
4. **On Phone**: File should open automatically (if supported)

### Test 5: Send Link from Laptop to Phone
1. **On Laptop**: Copy a URL (e.g., `https://www.google.com`)
2. **On Laptop**: Drag the URL text onto phone tile
3. **On Phone**: Browser should open automatically with the URL

### Test 6: Send Media Link
1. **On Laptop**: Drag a YouTube or media URL onto phone tile
2. **On Phone**: Media player should open with the video/audio

### Test 7: Clipboard Sync
1. **On Laptop**: Copy some text
2. **On Laptop**: Drag text onto phone tile (or use clipboard sync feature)
3. **On Phone**: Text should be copied to clipboard

## Troubleshooting

### "WebSocket connection failed"
- ✅ Check backend is running: `ws://localhost:8080`
- ✅ Check IP address is correct in `WebSocketManager.kt`
- ✅ Check phone and computer are on same WiFi
- ✅ Check Windows Firewall allows port 8080

### "Session not found" or "Invalid code"
- ✅ Make sure you're using the code from the laptop session
- ✅ Check session hasn't expired (1 hour limit)
- ✅ Try creating a new session

### QR Code not scanning
- ✅ Grant camera permission
- ✅ Ensure QR code is clearly visible
- ✅ Try manual code entry instead

### App crashes on launch
- ✅ Check Android Studio Logcat for errors
- ✅ Ensure minimum Android version: API 24 (Android 7.0)
- ✅ Try cleaning project: Build → Clean Project

### Device tile doesn't appear
- ✅ Check WebSocket connection in Logcat
- ✅ Verify both devices are in same session
- ✅ Check backend logs for connection messages

## Checking Logs

### Android Studio Logcat
1. **View → Tool Windows → Logcat**
2. Filter by: `FlowLink`
3. Look for:
   - `"WebSocket connected"` ✅
   - `"Session joined"` ✅
   - `"Intent received"` ✅
   - Any error messages ❌

### Backend Console
Check your backend terminal for:
- `"Session created: ..."`
- `"Device ... joined session ..."`
- `"WebSocket message: ..."`

### Browser Console (Frontend)
1. Press `F12` in browser
2. Go to Console tab
3. Look for:
   - `"WebSocket connected"`
   - `"Device connected"`
   - Any errors

## Success Indicators

✅ **Backend**: Shows "Session created" and "Device connected" messages  
✅ **Frontend**: Shows device tile with phone name and "Online" status  
✅ **Android**: Shows "Connected to session: [session-id]"  
✅ **File Transfer**: File opens on phone after drag & drop  
✅ **Link Transfer**: Browser opens on phone automatically  

## Quick Test Checklist

- [ ] Backend running (`npm run dev` in backend folder)
- [ ] Frontend running (`npm run dev` in frontend folder)
- [ ] Android app built and installed
- [ ] Session created on laptop
- [ ] Session joined on phone
- [ ] Device tile appears on laptop
- [ ] File drag & drop works
- [ ] Link opens on phone
- [ ] No errors in Logcat

## Next Steps After Setup

Once everything is working:
1. Test all intent types (file, media, link, prompt, clipboard)
2. Test permission denial flow
3. Test session expiry (wait 1 hour or modify code)
4. Test device disconnect/reconnect
5. Test multiple devices (if available)

