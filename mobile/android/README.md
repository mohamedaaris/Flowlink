# FlowLink Android App

Android app for FlowLink cross-device continuity.

## Features

- Join sessions via QR code or 6-digit code
- Receive and auto-open intents (files, media, links, prompts)
- Handle clipboard sync
- WebSocket + WebRTC connectivity

## Setup

1. Open `mobile/android/` in Android Studio
2. Sync Gradle files
3. Build and run on Android device or emulator

## Configuration

Update `WS_URL` in `WebSocketManager.kt`:
- Emulator: `ws://10.0.2.2:8080`
- Physical device: `ws://YOUR_COMPUTER_IP:8080`

## Permissions

The app requires:
- Internet (for WebSocket/WebRTC)
- Camera (for QR scanning)
- Storage (for file access)

