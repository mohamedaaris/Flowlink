# WebRTC Setup for Android

## ✅ Solution: Using Infobip's WebRTC Library

I've configured WebRTC using **Infobip's pre-compiled WebRTC library**, which is:
- ✅ Available on Maven Central
- ✅ Maintained and up-to-date
- ✅ Compatible with Google's WebRTC API
- ✅ No manual AAR file downloads needed

## What Was Changed

### 1. Updated `settings.gradle.kts`
Added JitPack repository (for future use if needed):
```kotlin
maven { url = uri("https://jitpack.io") }
```

### 2. Updated `app/build.gradle.kts`
Added WebRTC dependency:
```kotlin
implementation("com.infobip:google-webrtc:1.0.35530")
```

### 3. Created `WebRTCManager.kt`
New service class that handles:
- Peer connection creation
- Data channel management
- ICE candidate handling
- P2P data transfer

## How It Works

1. **Initialization**: WebRTC factory initializes on app start
2. **Peer Connection**: Created when connecting to another device
3. **Data Channels**: Used for sending files/intents directly (P2P)
4. **Fallback**: If WebRTC fails, app falls back to WebSocket

## Next Steps

1. **Sync Gradle**: File → Sync Project with Gradle Files
2. **Build**: Build → Rebuild Project
3. **Test**: Run the app and test WebRTC connections

## Integration with Existing Code

The `WebRTCManager` can be integrated with `WebSocketManager`:
- WebSocket handles signaling (offer/answer/ICE candidates)
- WebRTC handles actual data transfer (files, intents)
- If WebRTC unavailable, falls back to WebSocket

## Alternative WebRTC Libraries (if needed)

If Infobip's library doesn't work, you can try:

1. **WebRTC-SDK**: `io.github.webrtc-sdk:android:137.7151.05`
2. **GetStream**: `io.getstream:stream-webrtc-android:1.0.0`

Just replace the dependency in `build.gradle.kts`.

## Troubleshooting

### Build still fails?
- Check internet connection (needs to download from Maven Central)
- Try: Build → Clean Project → Rebuild
- Check Gradle sync completed successfully

### WebRTC not connecting?
- Check STUN server is accessible
- For production, add TURN servers
- Check Logcat for WebRTC errors

### Want to disable WebRTC?
- Comment out the dependency in `build.gradle.kts`
- App will use WebSocket-only (still works!)

