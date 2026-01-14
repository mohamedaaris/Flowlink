# Mobile Remote Access Deep Link Implementation

## Overview
This document describes how to implement deep-link handling for remote access sessions in the Flutter mobile app.

## Deep Link Format
```
flowlink://remote/{device_id}?token={session_token}&session={session_id}
```

## Implementation Steps

### 1. Configure Deep Link Scheme (Android)
In `android/app/src/main/AndroidManifest.xml`:
```xml
<activity
    android:name=".MainActivity"
    android:exported="true"
    android:launchMode="singleTop">
    <!-- Existing intent filters -->
    
    <!-- Add deep link intent filter -->
    <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data
            android:scheme="flowlink"
            android:host="remote" />
    </intent-filter>
</activity>
```

### 2. Configure Deep Link Scheme (iOS)
In `ios/Runner/Info.plist`:
```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleTypeRole</key>
        <string>Editor</string>
        <key>CFBundleURLName</key>
        <string>com.flowlink.app</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>flowlink</string>
        </array>
    </dict>
</array>
```

### 3. Flutter Deep Link Handler
Create `lib/services/remote_access_deep_link.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:uni_links/uni_links.dart';
import 'dart:async';

class RemoteAccessDeepLink {
  static StreamSubscription? _linkSubscription;
  
  /// Initialize deep link listener
  static Future<void> initialize() async {
    // Handle initial link if app was opened via deep link
    try {
      final initialLink = await getInitialLink();
      if (initialLink != null) {
        handleDeepLink(initialLink);
      }
    } catch (e) {
      print('Error getting initial link: $e');
    }
    
    // Listen for deep links while app is running
    _linkSubscription = linkStream.listen(
      (String link) => handleDeepLink(link),
      onError: (err) => print('Deep link error: $err'),
    );
  }
  
  /// Handle incoming deep link
  static void handleDeepLink(String link) {
    final uri = Uri.parse(link);
    
    if (uri.scheme == 'flowlink' && uri.host == 'remote') {
      final deviceId = uri.pathSegments.isNotEmpty 
          ? uri.pathSegments[0] 
          : null;
      final sessionToken = uri.queryParameters['token'];
      final sessionId = uri.queryParameters['session'];
      
      if (deviceId != null && sessionToken != null && sessionId != null) {
        // Navigate to remote access screen
        _navigateToRemoteAccess(
          deviceId: deviceId,
          sessionToken: sessionToken,
          sessionId: sessionId,
        );
      } else {
        print('Invalid deep link parameters');
      }
    }
  }
  
  /// Navigate to remote access screen
  static void _navigateToRemoteAccess({
    required String deviceId,
    required String sessionToken,
    required String sessionId,
  }) {
    // TODO: Implement navigation to remote access screen
    // Example:
    // Navigator.pushNamed(
    //   context,
    //   '/remote-access',
    //   arguments: {
    //     'deviceId': deviceId,
    //     'sessionToken': sessionToken,
    //     'sessionId': sessionId,
    //   },
    // );
  }
  
  /// Cleanup listener
  static void dispose() {
    _linkSubscription?.cancel();
  }
}
```

### 4. Screen Capture (Android)
In `android/app/src/main/kotlin/com/flowlink/app/MainActivity.kt`:

```kotlin
import android.media.projection.MediaProjectionManager
import android.content.Intent
import android.media.projection.MediaProjection

// Request screen capture permission
private fun requestScreenCapture() {
    val mediaProjectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
    val captureIntent = mediaProjectionManager.createScreenCaptureIntent()
    startActivityForResult(captureIntent, SCREEN_CAPTURE_REQUEST_CODE)
}

override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    if (requestCode == SCREEN_CAPTURE_REQUEST_CODE) {
        if (resultCode == RESULT_OK && data != null) {
            // User approved screen capture
            // Start MediaProjection and send stream via WebRTC
            val mediaProjection = mediaProjectionManager.getMediaProjection(resultCode, data)
            // TODO: Implement screen capture and WebRTC streaming
        } else {
            // User rejected screen capture
            // Notify backend that session was rejected
        }
    }
}
```

### 5. Screen Capture (iOS)
iOS requires a native extension or App Extension for screen capture.

Use `ReplayKit` framework:
```swift
import ReplayKit

// Request screen capture
let recorder = RPScreenRecorder.shared()
recorder.startCapture { (sampleBuffer, bufferType, error) in
    if error == nil {
        // Send sample buffer via WebRTC
        // TODO: Implement WebRTC streaming
    }
}
```

### 6. WebRTC Integration
Use `flutter_webrtc` package:

```dart
import 'package:flutter_webrtc/flutter_webrtc.dart';

class RemoteAccessManager {
  RTCPeerConnection? _peerConnection;
  MediaStream? _localStream;
  
  Future<void> startScreenShare({
    required String sessionToken,
    required String sessionId,
    required String deviceId,
  }) async {
    // 1. Connect to WebSocket signaling server
    // 2. Create RTCPeerConnection with STUN/TURN servers
    // 3. Capture screen using platform-specific APIs
    // 4. Add screen stream tracks to peer connection
    // 5. Create offer and send via WebSocket
    // 6. Handle answer and ICE candidates
    // 7. Send screen stream via WebRTC
    // 8. Receive control events via DataChannel
  }
  
  void handleControlEvent(Map<String, dynamic> event) {
    // Handle touch, gesture, keyboard events from viewer
    // TODO: Implement OS-level input simulation
  }
}
```

### 7. Security Requirements
- ✅ Manual user approval before starting capture
- ✅ Short-lived session tokens (15 minutes)
- ✅ End-to-end encrypted WebRTC (DTLS-SRTP)
- ✅ Visible session indicator on controlled device
- ✅ Ability to terminate session from either side
- ✅ No silent or background access without permission

### 8. Required Dependencies
Add to `pubspec.yaml`:
```yaml
dependencies:
  uni_links: ^0.5.1  # Deep link handling
  flutter_webrtc: ^0.9.0  # WebRTC support
  web_socket_channel: ^2.4.0  # WebSocket signaling
```

## Testing
1. Generate deep link: `flowlink://remote/device123?token=abc123&session=session456`
2. Open link from browser or another app
3. Verify app opens and navigates to remote access screen
4. Test screen capture permission flow
5. Verify WebRTC connection establishment
6. Test control event transmission

## Notes
- Screen capture requires user interaction (cannot be triggered silently)
- Android MediaProjection requires user approval each session
- iOS ReplayKit requires app to be in foreground
- WebRTC DataChannel used for control events (touch, gestures, keyboard)
- Session tokens expire after 15 minutes for security
