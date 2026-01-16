# Alternative Screen Share Solutions

## Current Issue
The "don't reuse resultData" error persists because Android's MediaProjection API is extremely strict about Intent reuse. Even with immediate usage, the error can occur due to timing issues or internal Android state management.

## Solution 1: Immediate Usage Pattern (IMPLEMENTED)

### What Changed
1. **Immediate Processing** - The Intent is used IMMEDIATELY in the result callback, no delays
2. **Background Thread** - Processing happens in a dedicated thread to avoid UI blocking
3. **Complete Cleanup** - Full 800ms cleanup cycle before requesting new permission
4. **No Cloning** - Pass the original Intent directly, no cloning attempts

### Key Code Changes

#### MainActivity.kt
```kotlin
private val screenCaptureResultLauncher = registerForActivityResult(
    ActivityResultContracts.StartActivityForResult()
) { result ->
    if (result.resultCode == RESULT_OK && result.data != null) {
        // CRITICAL: Use IMMEDIATELY in background thread
        Thread {
            // Create manager and call startScreenShare IMMEDIATELY
            manager.startScreenShare(result.resultCode, result.data!!)
        }.start()
    }
}
```

#### RemoteDesktopManager.kt
```kotlin
fun startScreenShare(resultCode: Int, data: Intent) {
    // Get MediaProjection IMMEDIATELY - no delays, no cloning
    val mediaProjection = mediaProjectionManager.getMediaProjection(resultCode, data)
    
    // Create ScreenCapturerAndroid with ORIGINAL Intent
    videoCapturer = ScreenCapturerAndroid(data, mediaProjectionCallback)
}
```

### Testing This Solution
1. Build and install the app
2. Join a session
3. Click "Open Remote View" on web
4. Grant permissions on mobile
5. Check logcat for "✅ MediaProjection obtained successfully"

If you still see the error, proceed to Solution 2.

---

## Solution 2: Service-Based Architecture (RECOMMENDED IF SOLUTION 1 FAILS)

This approach moves MediaProjection handling entirely into a foreground service, which has better lifecycle management.

### Architecture
```
User Grants Permission
    ↓
MainActivity passes Intent to Service
    ↓
Service creates MediaProjection IMMEDIATELY
    ↓
Service manages entire WebRTC lifecycle
    ↓
Service sends video stream to web viewer
```

### Implementation

#### Step 1: Create ScreenCaptureService.kt

```kotlin
package com.flowlink.app.service

import android.app.*
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.flowlink.app.R
import org.webrtc.*

class ScreenCaptureService : Service() {
    private var mediaProjection: MediaProjection? = null
    private var remoteDesktopManager: RemoteDesktopManager? = null
    private val binder = LocalBinder()
    
    inner class LocalBinder : Binder() {
        fun getService(): ScreenCaptureService = this@ScreenCaptureService
    }
    
    override fun onBind(intent: Intent?): IBinder = binder
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                startForeground(NOTIFICATION_ID, createNotification())
                Log.d(TAG, "Service started in foreground")
            }
            ACTION_STOP -> {
                stopScreenCapture()
                stopForeground(true)
                stopSelf()
            }
            ACTION_CAPTURE -> {
                // This is where we handle the MediaProjection Intent
                val resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, Activity.RESULT_CANCELED)
                val data = intent.getParcelableExtra<Intent>(EXTRA_DATA)
                val sessionId = intent.getStringExtra(EXTRA_SESSION_ID)
                val sourceDeviceId = intent.getStringExtra(EXTRA_SOURCE_DEVICE_ID)
                val viewerDeviceId = intent.getStringExtra(EXTRA_VIEWER_DEVICE_ID)
                val webSocketManager = intent.getSerializableExtra(EXTRA_WS_MANAGER) as? WebSocketManager
                
                if (data != null && sessionId != null && sourceDeviceId != null && 
                    viewerDeviceId != null && webSocketManager != null) {
                    startScreenCapture(resultCode, data, sessionId, sourceDeviceId, viewerDeviceId, webSocketManager)
                }
            }
        }
        return START_STICKY
    }
    
    private fun startScreenCapture(
        resultCode: Int,
        data: Intent,
        sessionId: String,
        sourceDeviceId: String,
        viewerDeviceId: String,
        webSocketManager: WebSocketManager
    ) {
        try {
            Log.d(TAG, "Starting screen capture in service")
            
            // Get MediaProjection IMMEDIATELY in service context
            val mediaProjectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
            mediaProjection = mediaProjectionManager.getMediaProjection(resultCode, data)
            
            if (mediaProjection == null) {
                Log.e(TAG, "Failed to get MediaProjection")
                return
            }
            
            Log.d(TAG, "✅ MediaProjection obtained in service")
            
            // Create RemoteDesktopManager
            remoteDesktopManager = RemoteDesktopManager(
                this,
                webSocketManager,
                sessionId,
                sourceDeviceId,
                viewerDeviceId,
                true
            )
            
            // Start screen share with the Intent
            remoteDesktopManager?.startScreenShare(resultCode, data)
            
            Log.d(TAG, "✅ Screen capture started successfully")
            
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start screen capture", e)
            stopSelf()
        }
    }
    
    private fun stopScreenCapture() {
        Log.d(TAG, "Stopping screen capture")
        remoteDesktopManager?.cleanup()
        remoteDesktopManager = null
        mediaProjection?.stop()
        mediaProjection = null
    }
    
    private fun createNotification(): Notification {
        val channelId = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            createNotificationChannel()
        } else {
            ""
        }
        
        return NotificationCompat.Builder(this, channelId)
            .setContentTitle("FlowLink Screen Sharing")
            .setContentText("Your screen is being shared")
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }
    
    private fun createNotificationChannel(): String {
        val channelId = "screen_capture_service"
        val channelName = "Screen Capture Service"
        val channel = NotificationChannel(
            channelId,
            channelName,
            NotificationManager.IMPORTANCE_LOW
        )
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.createNotificationChannel(channel)
        return channelId
    }
    
    override fun onDestroy() {
        super.onDestroy()
        stopScreenCapture()
    }
    
    companion object {
        private const val TAG = "ScreenCaptureService"
        private const val NOTIFICATION_ID = 1002
        const val ACTION_START = "com.flowlink.app.ACTION_START_CAPTURE"
        const val ACTION_STOP = "com.flowlink.app.ACTION_STOP_CAPTURE"
        const val ACTION_CAPTURE = "com.flowlink.app.ACTION_CAPTURE"
        const val EXTRA_RESULT_CODE = "result_code"
        const val EXTRA_DATA = "data"
        const val EXTRA_SESSION_ID = "session_id"
        const val EXTRA_SOURCE_DEVICE_ID = "source_device_id"
        const val EXTRA_VIEWER_DEVICE_ID = "viewer_device_id"
        const val EXTRA_WS_MANAGER = "ws_manager"
    }
}
```

#### Step 2: Update MainActivity.kt

```kotlin
private val screenCaptureResultLauncher = registerForActivityResult(
    ActivityResultContracts.StartActivityForResult()
) { result ->
    if (result.resultCode == RESULT_OK && result.data != null) {
        val viewerDeviceId = pendingViewerDeviceId ?: return@registerForActivityResult
        val sessionId = sessionManager.getCurrentSessionId() ?: return@registerForActivityResult
        
        // Pass Intent DIRECTLY to service
        val serviceIntent = Intent(this, ScreenCaptureService::class.java).apply {
            action = ScreenCaptureService.ACTION_CAPTURE
            putExtra(ScreenCaptureService.EXTRA_RESULT_CODE, result.resultCode)
            putExtra(ScreenCaptureService.EXTRA_DATA, result.data)
            putExtra(ScreenCaptureService.EXTRA_SESSION_ID, sessionId)
            putExtra(ScreenCaptureService.EXTRA_SOURCE_DEVICE_ID, sessionManager.getDeviceId())
            putExtra(ScreenCaptureService.EXTRA_VIEWER_DEVICE_ID, viewerDeviceId)
            putExtra(ScreenCaptureService.EXTRA_WS_MANAGER, webSocketManager)
        }
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent)
        } else {
            startService(serviceIntent)
        }
        
        pendingViewerDeviceId = null
    }
}
```

#### Step 3: Register Service in AndroidManifest.xml

```xml
<service
    android:name=".service.ScreenCaptureService"
    android:enabled="true"
    android:exported="false"
    android:foregroundServiceType="mediaProjection" />
```

### Benefits of Service-Based Approach
1. **Better Lifecycle** - Service has independent lifecycle from Activity
2. **Immediate Processing** - Intent is processed in service context immediately
3. **No Activity Dependencies** - Survives Activity recreation
4. **Cleaner Architecture** - Separation of concerns
5. **More Reliable** - Android handles service lifecycle better

---

## Solution 3: Alternative Technology Stack

If MediaProjection continues to be problematic, consider these alternatives:

### Option A: Use WebRTC Screen Capture API (Web-Only)
Instead of Android screen capture, use the web browser's screen capture:
- User opens web interface on mobile browser
- Uses `navigator.mediaDevices.getDisplayMedia()` in mobile browser
- Works on Chrome/Firefox mobile
- No native app needed

### Option B: Use RTMP Streaming
- Android app streams via RTMP to backend server
- Web viewer connects to RTMP stream
- More reliable but higher latency
- Libraries: `rtmp-rtsp-stream-client-java`

### Option C: Use VNC Protocol
- Implement VNC server on Android
- Web viewer uses VNC client (noVNC)
- More mature protocol
- Libraries: `droidVNC-NG`

### Option D: Use Scrcpy Protocol
- Based on Android's ADB screen mirroring
- Very reliable and low latency
- Requires USB debugging or wireless ADB
- Can be wrapped in your app

---

## Debugging Steps

### 1. Check Logcat
```bash
adb logcat | grep -E "FlowLink|MediaProjection|RemoteDesktop"
```

Look for:
- "✅ MediaProjection obtained successfully" - Good!
- "IllegalStateException" - MediaProjection reuse issue
- "permission expired" - Timing issue

### 2. Check WebRTC Connection
In browser console:
```javascript
// Check if offer is received
// Should see: "Received WebRTC offer"

// Check ICE connection state
// Should progress: new → checking → connected
```

### 3. Test Minimal Case
Create a minimal test activity that ONLY does:
1. Request MediaProjection permission
2. Create MediaProjection
3. Create ScreenCapturerAndroid
4. Start capture

If this fails, the issue is with Android system, not your code.

---

## Recommended Next Steps

1. **Try Solution 1 First** (already implemented)
   - Build and test
   - Check logs carefully
   - If error persists, proceed to step 2

2. **Implement Solution 2** (Service-Based)
   - Create ScreenCaptureService
   - Update MainActivity
   - Register in manifest
   - Test thoroughly

3. **If Still Failing, Consider Solution 3**
   - Evaluate alternative technologies
   - Choose based on your requirements
   - Implement proof of concept

4. **Report to Android Issue Tracker**
   - If none of the solutions work
   - This might be an Android bug
   - Provide minimal reproduction case

---

## Why This Error Is So Difficult

The MediaProjection API has several quirks:

1. **Single-Use Intent** - The Intent can only be used once, ever
2. **Timing Sensitive** - Must be used immediately after receiving
3. **No Cloning** - Intent cloning doesn't work for MediaProjection
4. **State Management** - Android tracks MediaProjection state internally
5. **Undocumented Behavior** - Official docs don't explain all edge cases

This is a known pain point in Android development, and many developers struggle with it.

---

## Success Indicators

You'll know it's working when you see:

### In Logcat:
```
FlowLink: Permission granted - starting screen share IMMEDIATELY
FlowLink: Creating RemoteDesktopManager...
FlowLink: Starting screen share NOW...
RemoteDesktopManager: === START SCREEN SHARE ===
RemoteDesktopManager: ✅ MediaProjection obtained successfully
RemoteDesktopManager: ✅ ScreenCapturerAndroid created
RemoteDesktopManager: ✅ Video track created
FlowLink: ✅ Screen sharing setup complete
```

### In Browser Console:
```
Received WebRTC offer
Sent WebRTC answer
Connection state changed: connected
Received remote stream
```

### Visual Confirmation:
- Mobile screen appears in browser window
- Video is smooth (30fps)
- No lag or freezing
- Can see mobile UI updates in real-time

---

## Contact & Support

If you continue to experience issues:

1. Share full logcat output
2. Share browser console output
3. Specify Android version and device model
4. Describe exact steps to reproduce

This will help diagnose the specific issue with your setup.
