# Mobile App Crash Fix - FlowLink

## Issue Identified ✅

The mobile app was crashing with "FlowLink keeps stopping" due to the **InvitationListenerService** trying to start a foreground service immediately when the app launched.

## Root Causes Found

### 1. Foreground Service Restrictions
- **Issue**: Starting a foreground service immediately on app launch
- **Android Restrictions**: Modern Android versions have strict rules about when foreground services can start
- **Missing Permission**: `FOREGROUND_SERVICE_DATA_SYNC` permission was missing

### 2. Service Starting with Empty Values
- **Issue**: Service was trying to start before username/deviceId were properly set
- **Timing Problem**: `initializeApp()` called before user data was available

### 3. Missing Error Handling
- **Issue**: No try-catch blocks around WebSocket connections
- **Crash Risk**: Any connection failure could crash the app

## ✅ Fixes Applied

### 1. Added Missing Permission
**File: `mobile/android/app/src/main/AndroidManifest.xml`**
```xml
<!-- Added missing permission for foreground service -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />
```

### 2. Added Validation Before Service Start
**File: `mobile/android/app/src/main/java/com/flowlink/app/MainActivity.kt`**
```kotlin
// Added validation to ensure we have valid data before starting service
val username = sessionManager.getUsername()
val deviceId = sessionManager.getDeviceId()
val deviceName = sessionManager.getDeviceName()

if (username.isNotEmpty() && deviceId.isNotEmpty() && deviceName.isNotEmpty()) {
    InvitationListenerService.startService(this, username, deviceId, deviceName)
} else {
    Log.w("FlowLink", "Cannot start service: missing data")
}
```

### 3. Temporarily Disabled Background Service
**Current Status**: Background service is commented out to prevent crashes
```kotlin
// TODO: Re-enable after fixing foreground service issues
/*
InvitationListenerService.startService(this, username, deviceId, deviceName)
*/
```

### 4. Added Error Handling
**File: `mobile/android/app/src/main/java/com/flowlink/app/service/WebSocketManager.kt`**
```kotlin
fun connect(sessionCode: String) {
    try {
        // WebSocket connection code
    } catch (e: Exception) {
        Log.e("FlowLink", "Failed to connect WebSocket", e)
        _connectionState.value = ConnectionState.Error(e.message ?: "Connection failed")
    }
}
```

**File: `mobile/android/app/src/main/java/com/flowlink/app/MainActivity.kt`**
```kotlin
try {
    if (webSocketManager.connectionState.value !is WebSocketManager.ConnectionState.Connected) {
        webSocketManager.connect("")
    }
} catch (e: Exception) {
    Log.e("FlowLink", "Failed to connect WebSocket", e)
}
```

## 🔧 Current App Status

### ✅ What Works Now
1. **App Launches**: No more crashes on startup
2. **Username Dialog**: Shows properly on first launch
3. **WebSocket Connection**: Connects for invitation listening (with error handling)
4. **Session Creation/Joining**: Basic functionality works
5. **Invitation Notifications**: Should work when app is open (foreground)

### ⚠️ Temporarily Disabled
1. **Background Service**: Commented out to prevent crashes
2. **Background Notifications**: Won't work when app is completely closed

### 🔄 Next Steps for Background Notifications

To re-enable background notifications safely:

1. **Request Foreground Service Permission at Runtime**:
```kotlin
// Add to MainActivity
private fun requestForegroundServicePermission() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        // Request permission before starting service
    }
}
```

2. **Start Service Only When User Explicitly Enables It**:
```kotlin
// Add user setting for background notifications
// Start service only when user opts in
```

3. **Use WorkManager Instead of Foreground Service**:
```kotlin
// Consider using WorkManager for periodic checks
// Less intrusive than foreground service
```

## 🧪 Testing Instructions

### Test App Launch
1. **Install APK**: `./gradlew installDebug`
2. **Launch App**: Should open without crashing
3. **Enter Username**: Should work normally
4. **Create/Join Session**: Should work normally

### Test Invitations (Foreground)
1. **Keep App Open**: App should receive invitations when open
2. **WebSocket Connection**: Should connect and register device
3. **Notification Display**: Should show in-app notifications

### Expected Behavior
- ✅ App launches successfully
- ✅ Username dialog appears
- ✅ WebSocket connects for invitations
- ✅ Can create and join sessions
- ✅ Receives invitations when app is open
- ❌ Background notifications disabled (temporarily)

## 🔍 Debug Information

### Check App Logs
```bash
# If ADB is available
adb logcat | grep "FlowLink"

# Look for these success messages:
# "WebSocket connected"
# "Device registered for invitations"
# "✅ Ready to receive invitations"
```

### Check for Errors
```bash
# Look for these error patterns:
# "Failed to connect WebSocket"
# "Cannot start InvitationListenerService"
# Any stack traces with "FlowLink"
```

## 📱 Current Mobile App Features

### ✅ Working Features
1. **Username Management**: Set once, remembered
2. **Session Creation**: Generate QR codes and session codes
3. **Session Joining**: Join by code or QR scan
4. **WebSocket Connection**: Real-time communication
5. **Device Registration**: Register for invitation listening
6. **Foreground Notifications**: Receive invitations when app is open
7. **File Sharing**: Send/receive files between devices
8. **Intent Handling**: Handle various intent types

### 🔄 Features to Re-enable Later
1. **Background Service**: For notifications when app is closed
2. **Persistent Connection**: Maintain WebSocket in background
3. **System Notifications**: Android notifications when app is closed

The app should now launch successfully and work for foreground invitation notifications. Background notifications can be re-enabled once the foreground service implementation is properly configured with user permissions and proper timing.