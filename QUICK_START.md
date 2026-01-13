# FlowLink Quick Start Guide

## 🚀 3-Step Setup

### Step 1: Start Backend
```bash
cd backend
npm install
npm run dev
```
✅ You should see: `FlowLink backend server running on ws://localhost:8080`

### Step 2: Start Frontend
```bash
cd frontend
npm install
npm run dev
```
✅ You should see: `Local: http://localhost:5173`
✅ Open browser to: `http://localhost:5173`

### Step 3: Setup Android App

#### In Android Studio:
1. **Open Project**: File → Open → Select `mobile/android` folder
2. **Wait**: Let Gradle sync complete (first time: 2-3 minutes)
3. **Configure IP** (if using physical device):
   - Open: `app/src/main/java/com/flowlink/app/service/WebSocketManager.kt`
   - Change `WS_URL` to your computer's IP (see ANDROID_SETUP.md)
4. **Run**: Click green ▶️ button (or Shift+F10)
5. **Select Device**: Choose emulator or connected phone

## ✅ How to Test It's Working

### Test 1: Create & Join Session
1. **Laptop**: Click "Create Session" → See QR code + 6-digit code
2. **Phone**: Open FlowLink app → Scan QR or enter code
3. **Check**: Device tile appears on laptop showing your phone

### Test 2: Send Something
1. **Laptop**: Drag a file onto phone's device tile
2. **Phone**: Should see permission prompt → Allow
3. **Phone**: File should open automatically ✅

### Test 3: Check Logs
- **Backend terminal**: Should show "Device connected" messages
- **Android Logcat**: Filter "FlowLink" → Should show "WebSocket connected"
- **Browser console** (F12): Should show "Device connected"

## 🐛 Common Issues

| Problem | Solution |
|---------|----------|
| WebSocket failed | Check IP address in `WebSocketManager.kt` |
| Can't scan QR | Grant camera permission or use manual code |
| Device tile missing | Check both devices joined same session |
| App crashes | Check Logcat for errors, ensure API 24+ |

## 📱 Android Studio Checklist

- [ ] Project opened in Android Studio
- [ ] Gradle sync completed
- [ ] Device/emulator selected
- [ ] App installed and running
- [ ] WebSocket URL configured correctly
- [ ] Camera permission granted (for QR)

## 🔍 Verification Steps

1. **Backend**: Terminal shows server running
2. **Frontend**: Browser shows FlowLink UI
3. **Android**: App shows "FlowLink" screen
4. **Connection**: Device tile appears after joining
5. **Transfer**: File/link opens on phone after drag

See `ANDROID_SETUP.md` for detailed troubleshooting!

