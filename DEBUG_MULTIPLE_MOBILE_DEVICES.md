# Debug Guide: Multiple Mobile Devices Disconnecting

## Problem
When connecting two mobile devices to the same session (created from laptop), the first mobile device gets disconnected when the second mobile device joins.

## Possible Causes

### 1. Same Device ID (Most Likely)
Both mobile devices are using the same device ID, so the backend thinks it's the same device reconnecting and replaces the WebSocket connection.

**How this happens:**
- Testing with Android emulator clones/snapshots
- Installing the same APK on devices that share storage
- SharedPreferences being synced across devices (rare)

### 2. Backend Bug
The backend has a bug that disconnects existing devices when a new device joins.

### 3. Network Issue
One device's connection is timing out or being closed by the network.

## Debugging Steps

### Step 1: Check Device IDs

1. **Connect First Mobile Device**:
   ```bash
   adb logcat | grep FlowLink
   ```
   
   Look for:
   ```
   SessionManager initialized
     Device ID: <device-1-id>
     Device Name: <device-1-name>
     Device Type: phone
   
   WebSocket connected
     Device ID: <device-1-id>
     Device Name: <device-1-name>
     Session Code: <6-digit-code>
   
   Sending session_join: {...}
   ```
   
   **Note down the Device ID!**

2. **Connect Second Mobile Device**:
   ```bash
   adb logcat | grep FlowLink
   ```
   
   Look for:
   ```
   SessionManager initialized
     Device ID: <device-2-id>
     Device Name: <device-2-name>
     Device Type: phone
   
   WebSocket connected
     Device ID: <device-2-id>
     Device Name: <device-2-name>
     Session Code: <6-digit-code>
   
   Sending session_join: {...}
   ```
   
   **Compare Device IDs:**
   - ✅ If `<device-1-id>` ≠ `<device-2-id>`: Device IDs are unique (good!)
   - ❌ If `<device-1-id>` = `<device-2-id>`: **PROBLEM FOUND!** Both devices have the same ID

3. **Check First Device Logs**:
   After second device joins, check first device logs:
   ```
   WebSocket closing
     Code: 1000
     Reason: Normal closure
     Device ID: <device-1-id>
   ```
   
   OR
   ```
   WebSocket failure
     Device ID: <device-1-id>
     Response: ...
   ```

### Step 2: Check Backend Logs

In the backend terminal, look for:
```
Device <device-1-id> joined session <session-id>
Session has 2 devices

Device <device-2-id> joined session <session-id>
Session has 3 devices
```

**Expected**: Session should have 3 devices (laptop + 2 mobiles)

**If you see**:
```
Device <same-id> reconnected to session <session-id>
```
Then both mobile devices are using the SAME device ID!

### Step 3: Check Laptop Browser Console

Open browser DevTools and look for:
```
device_connected: <device-1-name>
device_connected: <device-2-name>
```

**Expected**: Should see 2 separate `device_connected` events

**If you see**:
```
device_connected: <device-name>
device_disconnected: <device-id>
device_connected: <device-name>
```
Then the backend is treating it as the same device reconnecting.

## Solutions

### Solution 1: Clear Device ID on One Device

If both devices have the same device ID, clear it on one device:

**Option A: Via ADB**
```bash
# Connect to device
adb shell

# Clear SharedPreferences
run-as com.flowlink.app
cd shared_prefs
rm flowlink.xml
exit
exit

# Restart the app
```

**Option B: Uninstall and Reinstall**
```bash
adb uninstall com.flowlink.app
# Then reinstall the APK
adb install app-debug.apk
```

**Option C: Clear App Data**
- Go to Settings → Apps → FlowLink → Storage → Clear Data

### Solution 2: Use Different Device Names

The device name now includes the device model AND device identifier:
```kotlin
private val deviceName: String = "${android.os.Build.MODEL} (${android.os.Build.DEVICE})"
```

This helps distinguish devices even if they're the same model.

### Solution 3: Test with Physical Devices

If using emulators, make sure they're not clones:
1. Create separate AVDs (Android Virtual Devices)
2. Don't use snapshots from the same source
3. Each AVD should have its own storage

### Solution 4: Add Device ID to UI (For Debugging)

Temporarily show the device ID in the UI to verify they're different:

In `DeviceTilesFragment.kt`, add:
```kotlin
// In onViewCreated or similar
Toast.makeText(
    requireContext(),
    "Device ID: ${sessionManager?.getDeviceId()?.substring(0, 8)}...",
    Toast.LENGTH_LONG
).show()
```

## Expected Logs (Working Correctly)

### Device 1:
```
SessionManager initialized
  Device ID: 550e8400-e29b-41d4-a716-446655440000
  Device Name: Pixel 5 (redfin)
  Device Type: phone

WebSocket connected
  Device ID: 550e8400-e29b-41d4-a716-446655440000
  Device Name: Pixel 5 (redfin)
  Session Code: 123456

Sending session_join: {"type":"session_join",...}
WebSocket message: {"type":"session_joined",...}
```

### Device 2:
```
SessionManager initialized
  Device ID: 660f9511-f3ac-52e5-b827-557766551111
  Device Name: Pixel 5 (redfin)
  Device Type: phone

WebSocket connected
  Device ID: 660f9511-f3ac-52e5-b827-557766551111
  Device Name: Pixel 5 (redfin)
  Session Code: 123456

Sending session_join: {"type":"session_join",...}
WebSocket message: {"type":"session_joined",...}
```

### Backend:
```
Device 550e8400-e29b-41d4-a716-446655440000 joined session abc123
Session has 2 devices

Device 660f9511-f3ac-52e5-b827-557766551111 joined session abc123
Session has 3 devices
```

### Device 1 (Should NOT disconnect):
```
WebSocket message: {"type":"device_connected",...}
```

## Files Modified

### Mobile Android
- `mobile/android/app/src/main/java/com/flowlink/app/service/SessionManager.kt`
  - Added logging to show device ID on initialization
  - Changed device name to include device identifier: `"${android.os.Build.MODEL} (${android.os.Build.DEVICE})"`
  - Added logging in `getOrCreateDeviceId()` to show if using existing or generating new ID

- `mobile/android/app/src/main/java/com/flowlink/app/service/WebSocketManager.kt`
  - Added detailed logging in `onOpen` to show device info
  - Added detailed logging in `onClosing`, `onClosed`, and `onFailure` to track disconnections

## Next Steps

1. **Rebuild the Android app**:
   ```bash
   cd mobile/android
   ./gradlew assembleDebug
   ```

2. **Install on both devices**:
   ```bash
   adb -s <device-1-serial> install app/build/outputs/apk/debug/app-debug.apk
   adb -s <device-2-serial> install app/build/outputs/apk/debug/app-debug.apk
   ```

3. **Run the test** following Step 1-3 above

4. **Collect logs** from both devices and backend

5. **Share the logs** to identify the root cause

## Common Scenarios

### Scenario A: Same Device ID
**Logs show**: Both devices have the same device ID
**Solution**: Clear device ID on one device (Solution 1)

### Scenario B: Network Timeout
**Logs show**: First device shows "WebSocket failure" or "Connection timeout"
**Solution**: Check network stability, increase timeout, or use better WiFi

### Scenario C: Backend Bug
**Logs show**: Backend says "Session has 3 devices" but first device still disconnects
**Solution**: Check backend code for bugs in device management

### Scenario D: App Killed by System
**Logs show**: First device app is killed when second device joins
**Solution**: Disable battery optimization for FlowLink app
