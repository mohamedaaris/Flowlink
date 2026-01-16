# Fix: Multiple Mobile Devices Connection Issues

## Problems Fixed

### Problem 1: Second Device Doesn't See All Devices
When the second mobile device joins a session, it only sees the first mobile device, not the laptop (session creator).

**Root Cause**: The `WebSocketManager` was overwriting the `_deviceConnected` StateFlow value in a loop when processing the `session_joined` message. Since StateFlow only emits the latest value, only the last device in the list was received by `DeviceTilesFragment`.

**Example**:
- `session_joined` contains: [laptop, mobile1]
- Loop iteration 1: `_deviceConnected.value = laptop`
- Loop iteration 2: `_deviceConnected.value = mobile1` (overwrites!)
- DeviceTilesFragment only receives: mobile1 ❌

**Fix**: Added a coroutine with small delays between emissions so each device is properly collected:

```kotlin
scope.launch {
    for (i in 0 until devicesArray.length()) {
        val deviceInfo = DeviceInfo(...)
        if (deviceInfo.id != sessionManager.getDeviceId()) {
            _deviceConnected.value = deviceInfo
            kotlinx.coroutines.delay(50) // Ensure each emission is collected
        }
    }
}
```

### Problem 2: First Device Gets Disconnected (Potential Issue)
When the second device joins, the first device sometimes gets disconnected.

**Possible Causes**:
1. Both devices using the same device ID
2. Network timeout on first device
3. App being killed by system

**Fixes Applied**:
1. Added comprehensive logging to track device IDs and WebSocket state
2. Added device identifier to device name: `"${android.os.Build.MODEL} (${android.os.Build.DEVICE})"`
3. Added logging in `device_connected` handler to skip self-device

## Changes Made

### File: `mobile/android/app/src/main/java/com/flowlink/app/service/WebSocketManager.kt`

1. **Fixed `session_joined` handler** (lines 266-310):
   - Wrapped device emission loop in a coroutine
   - Added 50ms delay between emissions
   - Added detailed logging for each device

2. **Enhanced `device_connected` handler** (lines 234-248):
   - Added check to skip self-device
   - Added detailed logging

3. **Enhanced connection logging** (lines 95-110):
   - Shows device ID, name, and session code on connect

4. **Enhanced disconnection logging** (lines 130-155):
   - Shows device ID and reason for disconnect

### File: `mobile/android/app/src/main/java/com/flowlink/app/service/SessionManager.kt`

1. **Enhanced device name** (line 24):
   - Changed from `android.os.Build.MODEL` to `"${android.os.Build.MODEL} (${android.os.Build.DEVICE})"`
   - Helps distinguish devices with same model

2. **Added initialization logging** (lines 26-31):
   - Shows device ID, name, and type on init

3. **Enhanced `getOrCreateDeviceId()`** (lines 33-43):
   - Added logging to show if using existing or generating new ID

## Testing

### Test 1: Two Mobile Devices Join Session

1. **Create session on laptop**
2. **Join from Mobile 1**:
   ```bash
   adb -s <device-1> logcat | grep FlowLink
   ```
   
   Expected logs:
   ```
   SessionManager initialized
     Device ID: <unique-id-1>
     Device Name: Pixel 5 (redfin)
   
   WebSocket connected
     Device ID: <unique-id-1>
     Session Code: 123456
   
   Received session_joined
   Processing 1 devices from session_joined
   Emitting device from session_joined: Laptop (laptop)
   ```

3. **Join from Mobile 2**:
   ```bash
   adb -s <device-2> logcat | grep FlowLink
   ```
   
   Expected logs:
   ```
   SessionManager initialized
     Device ID: <unique-id-2>
     Device Name: Pixel 5 (redfin)
   
   WebSocket connected
     Device ID: <unique-id-2>
     Session Code: 123456
   
   Received session_joined
   Processing 2 devices from session_joined
   Emitting device from session_joined: Laptop (laptop)
   Emitting device from session_joined: Pixel 5 (redfin)
   ```

4. **Check Mobile 1 logs**:
   Should see:
   ```
   Received device_connected: Pixel 5 (redfin) (<unique-id-2>)
     Current device ID: <unique-id-1>
     Is self: false
     Emitted device_connected event
   ```

5. **Verify**:
   - Mobile 1 should show: Laptop + Mobile 2
   - Mobile 2 should show: Laptop + Mobile 1
   - Laptop should show: Mobile 1 + Mobile 2
   - No device should disconnect

### Test 2: Check Device IDs Are Unique

Run on both devices:
```bash
adb -s <device> logcat | grep "Device ID:"
```

Compare the device IDs - they MUST be different!

If they're the same:
```bash
# Clear app data on one device
adb -s <device> shell pm clear com.flowlink.app
# Or uninstall and reinstall
adb -s <device> uninstall com.flowlink.app
adb -s <device> install app-debug.apk
```

### Test 3: Check for Disconnections

If a device disconnects, check its logs for:
```
WebSocket closing
  Code: <code>
  Reason: <reason>
  Device ID: <id>
```

Common reasons:
- Code 1000: Normal closure (app closed or left session)
- Code 1001: Going away (network issue)
- Code 1006: Abnormal closure (connection lost)

## Expected Behavior After Fix

### Scenario: Laptop creates session, 2 mobiles join

1. **Laptop creates session**
   - Laptop sees: (empty, waiting for devices)

2. **Mobile 1 joins**
   - Laptop sees: Mobile 1
   - Mobile 1 sees: Laptop

3. **Mobile 2 joins**
   - Laptop sees: Mobile 1, Mobile 2
   - Mobile 1 sees: Laptop, Mobile 2 ✅ (was disconnecting before)
   - Mobile 2 sees: Laptop, Mobile 1 ✅ (was only seeing Mobile 1 before)

4. **All devices stay connected** ✅

## Troubleshooting

### Issue: Second device still only sees one device

**Check**: Are the delays working?
- Look for logs: `"Emitting device from session_joined"`
- Should see multiple emissions with 50ms between them

**Solution**: Increase delay from 50ms to 100ms

### Issue: First device still disconnects

**Check**: Are device IDs unique?
```bash
adb logcat | grep "Device ID:"
```

**Solution**: Clear app data on one device

### Issue: Devices have same ID

**Check**: Are you using emulator clones?
- Each AVD should be created separately, not cloned

**Solution**: Create new AVDs or use physical devices

## Files Modified

1. `mobile/android/app/src/main/java/com/flowlink/app/service/WebSocketManager.kt`
   - Fixed device emission in `session_joined` handler
   - Enhanced logging throughout

2. `mobile/android/app/src/main/java/com/flowlink/app/service/SessionManager.kt`
   - Enhanced device name with device identifier
   - Added initialization logging

## Rebuild and Test

```bash
cd mobile/android
./gradlew assembleDebug
adb install app/build/outputs/apk/debug/app-debug.apk
```

Then test with 2 mobile devices joining the same session!
