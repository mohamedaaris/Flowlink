# FlowLink Invitation System - Testing Guide

## ✅ All Fixes Applied

### Frontend Fixes
- ✅ Fixed WebSocket access in SessionManager (uses global `window.appWebSocket`)
- ✅ Fixed WebSocket access in DeviceTiles (uses global `window.appWebSocket`)
- ✅ Fixed InvitationService to fallback to global WebSocket
- ✅ Fixed InvitationPanel to use global WebSocket for broadcasts
- ✅ Added proper WebSocket state logging throughout
- ✅ Created `.env` file with correct WebSocket URL

### Backend Fixes
- ✅ Changed `broadcastNearbySession()` to use `globalDevices` instead of `deviceConnections`
- ✅ Changed `handleNearbySessionBroadcast()` to use `globalDevices`
- ✅ Reduced auto-broadcast delay from 2s to 1s
- ✅ Added detailed logging for each notification sent
- ✅ Improved device registration tracking

### Mobile Fixes
- ✅ Updated WebSocket URL to use `ws://10.0.2.2:8080` for emulator
- ✅ Verified NotificationService is properly configured
- ✅ Verified MainActivity handles invitation actions correctly
- ✅ Mobile app builds successfully

---

## 🧪 Testing Steps

### Test 1: WebSocket Connection (Web)
1. Open browser to `http://localhost:5173`
2. Enter username (e.g., "Alice")
3. **Check browser console** - Should see:
   ```
   App-level WebSocket connected for invitations
   WebSocket set on InvitationService
   ```
4. **Should NOT see**: "WebSocket not connected" errors

### Test 2: Session Creation & Auto-Notifications (Web to Web)
1. **Device A (Browser Tab 1)**:
   - Enter username "Alice"
   - Click "Create Session"
   - Note the 6-digit session code

2. **Device B (Browser Tab 2 / Incognito)**:
   - Enter username "Bob"
   - Wait on home page (don't create or join yet)
   - **Expected**: Within 1-2 seconds, notification appears:
     ```
     "Nearby Session Found"
     "Alice created a session with 1 device(s)"
     [Join Session] [Dismiss]
     ```

3. **Check backend console** - Should see:
   ```
   Device [deviceId] (Alice) registered globally
   Session created: [sessionId] (code: XXXXXX) by device [deviceId]
   Auto-broadcast nearby session [sessionId] to 1 devices
   Sent nearby session notification to Bob ([deviceId])
   ```

### Test 3: Direct Invitations (Web to Web)
1. **Device A (Alice's session)**:
   - Click "Invite Others"
   - Enter "Bob" in username field
   - Click "Send Invitation"
   - **Expected**: Success toast "Invitation sent to Bob"

2. **Device B (Bob's home page)**:
   - **Expected**: Notification appears:
     ```
     "Session Invitation"
     "Alice (Laptop) invited you to join their session"
     [Accept] [Reject]
     ```

3. **Device B - Click "Accept"**:
   - **Expected**: Automatically joins Alice's session
   - **Expected**: Device tiles appear showing Alice's device

4. **Check backend console** - Should see:
   ```
   handleSessionInvitation: Device [Alice's ID] inviting Bob to session [sessionId]
   Looking for target: Bob
   ✅ Found target device in global registry: Bob ([Bob's ID])
   📨 Sending invitation to Bob ([Bob's ID])
   ✅ Session invitation sent to Bob
   ```

### Test 4: Manual Nearby Broadcast (Web)
1. **Device A (Alice's session)**:
   - Click "Invite Others"
   - Click "Notify Nearby Devices"
   - **Expected**: Success toast "Nearby devices will be notified"

2. **All other connected devices**:
   - **Expected**: Receive nearby session notification

3. **Check backend console** - Should see:
   ```
   handleNearbySessionBroadcast: Device [Alice's ID] broadcasting session [sessionId]
   Manual broadcast sent to Bob ([Bob's ID])
   Manual broadcast sent to Charlie ([Charlie's ID])
   Nearby session broadcast sent to 2 devices
   ```

### Test 5: Mobile App Integration
1. **Install APK**:
   ```bash
   cd mobile/android
   ./gradlew assembleDebug
   adb install app/build/outputs/apk/debug/app-debug.apk
   ```

2. **Launch app on emulator/device**:
   - Enter username "Charlie"
   - Wait on home screen

3. **Create session on web (Alice)**:
   - **Expected**: Mobile app receives notification within 1-2 seconds
   - **Expected**: Notification shows "Nearby Session Found"

4. **Send invitation from web to mobile**:
   - Web: Click "Invite Others" → Enter "Charlie" → Send
   - **Expected**: Mobile receives "Session Invitation" notification
   - **Expected**: Tap "Accept" joins the session

---

## 🔍 Debugging

### Frontend Console Logs to Check
```javascript
// Good logs:
"App-level WebSocket connected for invitations"
"WebSocket set on InvitationService"
"DeviceTiles using App-level WebSocket, rejoining session: XXXXXX"
"InvitationService: WebSocket set, readyState: 1"
"InvitationService: Invitation sent successfully"

// Bad logs (should NOT appear):
"WebSocket not connected"
"InvitationService: WebSocket not connected, trying global WebSocket"
"Failed to send invitation: Error: WebSocket not connected"
```

### Backend Console Logs to Check
```
// Device registration:
Device [deviceId] (Alice) registered globally for invitation listening
Global devices now: 2 total
  - [deviceId1]: Alice (Laptop) - Session: [sessionId]
  - [deviceId2]: Bob (Laptop) - Session: none

// Auto-broadcast:
Auto-broadcast nearby session [sessionId] to 1 devices
Sent nearby session notification to Bob ([deviceId])

// Manual invitation:
handleSessionInvitation: Device [Alice's ID] inviting Bob to session [sessionId]
✅ Found target device in global registry: Bob ([deviceId])
📨 Sending invitation to Bob ([deviceId])
✅ Session invitation sent to Bob
```

### Mobile Logs (adb logcat)
```bash
adb logcat | grep FlowLink
```

Look for:
```
D/FlowLink: WebSocket connected
D/FlowLink: Sending device_register
D/FlowLink: 📝 Device registered for invitation listening
D/FlowLink: 📨 Received session invitation
D/FlowLink: 📨 Received nearby session broadcast
```

---

## 🎯 Expected Behavior Summary

### ✅ What Should Work Now

1. **WebSocket Connections**: All components use the same global WebSocket
2. **Device Registration**: All devices register in `globalDevices` for invitation listening
3. **Auto-Notifications**: Creating a session automatically notifies all other connected devices within 1 second
4. **Direct Invitations**: Sending invitations by username works reliably
5. **Manual Broadcasts**: "Notify Nearby Devices" button sends notifications to all devices
6. **Mobile Notifications**: Mobile app receives all invitation types
7. **Accept/Reject**: Invitation actions work correctly and auto-join sessions

### ❌ What Should NOT Happen

1. ❌ "Failed to send invitation" errors
2. ❌ "WebSocket not connected" errors
3. ❌ Notifications appearing only 1 out of 20 times
4. ❌ Notifications only working on QR page
5. ❌ Lagging or delayed notifications (should be < 2 seconds)

---

## 🚀 Quick Start Commands

### Terminal 1 - Backend
```bash
cd backend
npm start
```

### Terminal 2 - Frontend
```bash
cd frontend
npm run dev
```

### Terminal 3 - Mobile (optional)
```bash
cd mobile/android
./gradlew assembleDebug
adb install app/build/outputs/apk/debug/app-debug.apk
```

### Open in Browser
- Device A: `http://localhost:5173`
- Device B: `http://localhost:5173` (incognito/different browser)

---

## 📊 Success Criteria

✅ **All tests pass without errors**
✅ **Notifications appear within 1-2 seconds**
✅ **No "WebSocket not connected" errors**
✅ **Invitations work 100% of the time (not 1/20)**
✅ **Mobile app receives notifications**
✅ **Accept/Reject buttons work correctly**
✅ **Auto-join works when accepting invitations**

---

## 🐛 If Something Doesn't Work

1. **Check backend is running**: `curl http://localhost:8080/health`
2. **Check frontend is running**: Open `http://localhost:5173`
3. **Check browser console**: Look for WebSocket errors
4. **Check backend console**: Look for device registration logs
5. **Restart everything**: Kill all node processes and restart
6. **Clear browser cache**: Hard refresh (Ctrl+Shift+R)
7. **Check .env file**: Ensure `VITE_SIGNALING_URL=ws://localhost:8080`

---

## 📝 Notes

- The system now uses `globalDevices` for better notification coverage
- WebSocket is shared globally via `window.appWebSocket`
- All components have fallback mechanisms for WebSocket access
- Notifications are sent to ALL registered devices, not just those in sessions
- Auto-broadcast delay reduced to 1 second for faster notifications
