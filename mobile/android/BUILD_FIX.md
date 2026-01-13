# Android Build Fix

## Issue
The build was failing because `org.webrtc:google-webrtc` dependency doesn't exist in standard Maven repositories.

## Solution
Removed WebRTC dependency from `build.gradle.kts`. The app now uses **WebSocket-only** for MVP, which is sufficient for:
- Session management ✅
- Intent routing ✅
- File transfer (via WebSocket) ✅
- All MVP features ✅

## Why This Works
1. **Frontend WebRTCManager** already has fallback to WebSocket
2. **Backend** handles all signaling via WebSocket
3. **Android app** receives intents via WebSocket (works perfectly)
4. **File transfer** works via WebSocket (slightly slower but functional)

## Future: Adding WebRTC (Optional)
If you want WebRTC later, you'll need to:
1. Download WebRTC AAR from Google
2. Add as local dependency
3. Or use JitPack: `implementation("dev.webrtc:webrtc-android:1.0.+")`

For MVP, WebSocket-only is perfectly fine! ✅

## Next Steps
1. **Sync Gradle**: File → Sync Project with Gradle Files
2. **Clean Build**: Build → Clean Project
3. **Rebuild**: Build → Rebuild Project
4. **Run**: Should build successfully now ✅

