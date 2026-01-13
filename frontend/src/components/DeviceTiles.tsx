import React, { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Session, Device, Intent, IntentType } from '@shared/types';
import DeviceTile from './DeviceTile';
import IntentRouter from '../services/IntentRouter';
import WebRTCManager from '../services/WebRTCManager';
import FileBridge from '../services/FileBridge';
import ContinuityEngine from '../services/ContinuityEngine';
import PermissionEngine from '../services/PermissionEngine';
import MediaDetector from '../services/MediaDetector';
import './DeviceTiles.css';

interface DeviceTilesProps {
  session: Session;
  deviceId: string;
  deviceName: string;
  deviceType: 'phone' | 'laptop' | 'desktop' | 'tablet';
  onLeaveSession: () => void;
}

const WS_URL = 'ws://localhost:8080';

export default function DeviceTiles({
  session,
  deviceId,
  deviceName,
  deviceType,
  onLeaveSession,
}: DeviceTilesProps) {
  const [devices, setDevices] = useState<Map<string, Device>>(() => {
    // Initialize with devices from session, excluding self
    const initialDevices = new Map<string, Device>();
    session.devices.forEach((device, id) => {
      if (id !== deviceId) {
        initialDevices.set(id, device);
      }
    });
    console.log('Initial devices map:', Array.from(initialDevices.keys()));
    return initialDevices;
  });
  const [draggedItem, setDraggedItem] = useState<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const webrtcManagerRef = useRef<WebRTCManager | null>(null);
  const intentRouterRef = useRef<IntentRouter | null>(null);
  const fileBridgeRef = useRef<FileBridge | null>(null);
  const continuityEngineRef = useRef<ContinuityEngine | null>(null);
  const permissionEngineRef = useRef<PermissionEngine | null>(null);
  const mediaDetectorRef = useRef<MediaDetector | null>(null);

  useEffect(() => {
    // Initialize WebSocket connection
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('DeviceTiles WebSocket connected, rejoining session:', session.code);
      // Re-join session to get updates
      ws.send(JSON.stringify({
        type: 'session_join',
        payload: {
          code: session.code,
          deviceId,
          deviceName,
          deviceType,
        },
        timestamp: Date.now(),
      }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleWebSocketMessage(message);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    // Initialize WebRTC Manager
    webrtcManagerRef.current = new WebRTCManager(ws, deviceId, session.id);

    // Initialize services
    fileBridgeRef.current = new FileBridge(webrtcManagerRef.current);
    continuityEngineRef.current = new ContinuityEngine(webrtcManagerRef.current, deviceId);
    permissionEngineRef.current = new PermissionEngine();
    mediaDetectorRef.current = new MediaDetector();

    // Initialize Intent Router (WebRTC manager may fall back to WebSocket)
    intentRouterRef.current = new IntentRouter(
      deviceId,
      webrtcManagerRef.current,
      handleIntentSent
    );

    return () => {
      ws.close();
      webrtcManagerRef.current?.cleanup();
      permissionEngineRef.current?.revokeAll();
      mediaDetectorRef.current?.cleanup();
    };
  }, [session.code, deviceId, deviceName, deviceType]);

  const handleWebSocketMessage = (message: any) => {
    console.log('DeviceTiles received message:', message.type, message);
    switch (message.type) {
      case 'device_connected':
        const newDevice: Device = message.payload.device;
        console.log('Device connected:', newDevice);
        setDevices((prev) => {
          const updated = new Map(prev);
          updated.set(newDevice.id, newDevice);
          console.log('Updated devices map:', Array.from(updated.keys()));
          return updated;
        });
        break;

      case 'device_disconnected':
        setDevices((prev) => {
          const updated = new Map(prev);
          const deviceId = message.payload.deviceId;
          // Remove the device tile entirely when it disconnects
          updated.delete(deviceId);
          console.log('Device disconnected and removed:', deviceId);
          return updated;
        });
        break;

      case 'device_status_update':
        setDevices((prev) => {
          const updated = new Map(prev);
          const device = message.payload.device;
          updated.set(device.id, device);
          return updated;
        });
        break;

      case 'intent_received':
        handleIncomingIntent(message.payload.intent, message.payload.sourceDevice);
        break;

      case 'session_expired':
        alert('Session has expired. Returning to session manager.');
        // Clear all devices immediately
        setDevices(new Map());
        handleLeaveSession();
        break;
      
      case 'session_joined':
        // Update devices list from backend response
        if (message.payload && message.payload.devices) {
          const deviceMap = new Map<string, Device>();
          message.payload.devices.forEach((d: any) => {
            // Include all devices except self
            if (d.id !== deviceId) {
              deviceMap.set(d.id, {
                id: d.id,
                name: d.name,
                type: d.type,
                online: d.online,
                permissions: d.permissions || {
                  files: false,
                  media: false,
                  prompts: false,
                  clipboard: false,
                  remote_browse: false,
                },
                joinedAt: d.joinedAt || Date.now(),
                lastSeen: d.lastSeen || Date.now(),
              });
            }
          });
          setDevices(deviceMap);
          console.log('Updated devices from session_joined:', Array.from(deviceMap.keys()));
        }
        break;
    }
  };

  const handleIncomingIntent = async (intent: Intent, sourceDevice: string) => {
    // Show permission request UI
    const granted = await requestPermission(intent, sourceDevice);
    
    if (granted) {
      // Grant permission based on intent type
      grantPermissionForIntent(intent, sourceDevice);
      
      // Process intent
      await processIntent(intent);
      
      // Send acknowledgment
      if (wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'intent_accepted',
          sessionId: session.id,
          deviceId,
          payload: {
            intentId: intent.timestamp.toString(),
            sourceDevice,
          },
          timestamp: Date.now(),
        }));
      }
    } else {
      // Send rejection
      if (wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'intent_rejected',
          sessionId: session.id,
          deviceId,
          payload: {
            intentId: intent.timestamp.toString(),
            sourceDevice,
          },
          timestamp: Date.now(),
        }));
      }
    }
  };

  const grantPermissionForIntent = (intent: Intent, targetDeviceId: string) => {
    console.log('🔐 grantPermissionForIntent called');
    console.log('Intent type:', intent.intent_type);
    console.log('Target device ID:', targetDeviceId);
    console.log('Current devices:', Array.from(devices.keys()));
    
    setDevices((prev) => {
      const updated = new Map(prev);
      const device = updated.get(targetDeviceId);
      
      if (!device) {
        console.error('❌ Device not found in map:', targetDeviceId);
        console.log('Available devices:', Array.from(prev.keys()));
        return prev; // Return unchanged if device not found
      }
      
      console.log('✅ Device found:', device.name);
      const newDevice = { ...device };
      const currentPerms = { ...device.permissions };
      
      switch (intent.intent_type) {
        case 'file_handoff':
          currentPerms.files = true;
          console.log('Granting FILES permission');
          break;
        case 'media_continuation':
          currentPerms.media = true;
          console.log('Granting MEDIA permission');
          break;
        case 'prompt_injection':
          currentPerms.prompts = true;
          console.log('Granting PROMPTS permission');
          break;
        case 'clipboard_sync':
          // Check if this is a remote access toggle request
          const clipboardText = intent.payload.clipboard?.text;
          if (clipboardText === 'ENABLE_REMOTE_ACCESS') {
            currentPerms.remote_browse = true;
            console.log('Granting REMOTE_BROWSE permission');
          } else if (clipboardText === 'DISABLE_REMOTE_ACCESS') {
            currentPerms.remote_browse = false;
            console.log('Revoking REMOTE_BROWSE permission');
          } else {
            currentPerms.clipboard = true;
            console.log('Granting CLIPBOARD permission');
          }
          break;
        case 'link_open':
          // Links don't need special permission
          break;
      }
      
      newDevice.permissions = currentPerms;
      updated.set(targetDeviceId, newDevice);
      
      console.log('✅ Updated device permissions:', newDevice.permissions);
      console.log('✅ Device map after update:', Array.from(updated.keys()));
      
      // Notify backend of permission update
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'device_status_update',
          sessionId: session.id,
          deviceId,
          payload: {
            device: newDevice,
          },
          timestamp: Date.now(),
        }));
        console.log('✅ Sent device_status_update to backend');
      } else {
        console.warn('⚠️ WebSocket not ready, cannot send device_status_update');
      }
      
      return updated;
    });
  };

  const requestPermission = (intent: Intent, sourceDevice: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const device = devices.get(sourceDevice);
      const deviceName = device?.name || 'Unknown Device';
      
      const message = getPermissionMessage(intent, deviceName);
      const granted = window.confirm(message);
      resolve(granted);
    });
  };

  const getPermissionMessage = (intent: Intent, deviceName: string): string => {
    switch (intent.intent_type) {
      case 'file_handoff':
        return `${deviceName} wants to send you a file: ${intent.payload.file?.name}. Allow?`;
      case 'media_continuation':
        return `${deviceName} wants to continue playing media: ${intent.payload.media?.url}. Allow?`;
      case 'link_open':
        return `${deviceName} wants to open a link: ${intent.payload.link?.url}. Allow?`;
      case 'prompt_injection':
        return `${deviceName} wants to send you a prompt: "${intent.payload.prompt?.text.substring(0, 50)}...". Allow?`;
      case 'clipboard_sync':
        return `${deviceName} wants to sync clipboard. Allow?`;
      default:
        return `${deviceName} wants to perform an action. Allow?`;
    }
  };

  const processIntent = async (intent: Intent) => {
    switch (intent.intent_type) {
      case 'file_handoff':
        await handleFileHandoff(intent);
        break;
      case 'media_continuation':
        await handleMediaContinuation(intent);
        break;
      case 'link_open':
        await handleLinkOpen(intent);
        break;
      case 'prompt_injection':
        await handlePromptInjection(intent);
        break;
      case 'clipboard_sync':
        await handleClipboardSync(intent);
        break;
    }
  };

  const handleFileHandoff = async (intent: Intent) => {
    if (!intent.payload.file) return;
    
    // If file data is included, download it
    if (intent.payload.file.data) {
      // Convert array to Uint8Array
      const uint8Array = new Uint8Array(intent.payload.file.data);
      const blob = new Blob([uint8Array], { type: intent.payload.file.type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = intent.payload.file.name;
      a.click();
      URL.revokeObjectURL(url);
      
      // Auto-open if permission granted
      if (intent.auto_open) {
        // Try to open file based on type
        if (intent.payload.file.type.startsWith('image/')) {
          window.open(url, '_blank');
        } else if (intent.payload.file.type.startsWith('text/')) {
          // For text files, open in new tab
          const reader = new FileReader();
          reader.onload = (e) => {
            const newWindow = window.open('', '_blank');
            if (newWindow) {
              newWindow.document.write(`
                <html>
                  <head><title>${intent.payload.file.name}</title></head>
                  <body style="font-family:monospace;padding:20px;white-space:pre-wrap;">${e.target?.result}</body>
                </html>
              `);
            }
          };
          reader.readAsText(blob);
        }
      }
    }
  };

  const handleMediaContinuation = async (intent: Intent) => {
    if (!intent.payload.media) return;
    
    const { url, timestamp, state } = intent.payload.media;
    
    // If file data is included, create blob URL
    if (intent.payload.file && intent.payload.file.data) {
      const uint8Array = new Uint8Array(intent.payload.file.data);
      const blob = new Blob([uint8Array], { type: intent.payload.file.type });
      const blobUrl = URL.createObjectURL(blob);
      
      // Create video/audio element to play with timestamp
      if (intent.payload.media.type === 'video') {
        const video = document.createElement('video');
        video.src = blobUrl;
        video.controls = true;
        video.currentTime = timestamp || 0;
        if (state === 'play') {
          video.play().catch(console.error);
        }
        // Open in new window
        const newWindow = window.open('', '_blank');
        if (newWindow) {
          newWindow.document.write(`
            <html>
              <head><title>${intent.payload.file.name}</title></head>
              <body style="margin:0;padding:0;background:#000;display:flex;justify-content:center;align-items:center;height:100vh;">
                <video controls autoplay style="max-width:100%;max-height:100%;" src="${blobUrl}"></video>
                <script>
                  document.querySelector('video').currentTime = ${timestamp || 0};
                  ${state === 'play' ? "document.querySelector('video').play();" : ''}
                </script>
              </body>
            </html>
          `);
        }
      } else {
        // Audio
        const audio = new Audio(blobUrl);
        audio.currentTime = timestamp || 0;
        if (state === 'play') {
          audio.play().catch(console.error);
        }
        // For audio, we can play in background or show a simple player
        window.open(blobUrl, '_blank');
      }
      return;
    }
    
    // For URLs, open with timestamp
    let mediaUrl = url;
    if (timestamp && timestamp > 0) {
      // Add timestamp to URL
      const separator = url.includes('?') ? '&' : '#';
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        mediaUrl = `${url}${url.includes('?') ? '&' : '?'}t=${Math.floor(timestamp)}`;
      } else if (url.includes('spotify.com')) {
        // Spotify doesn't support timestamp in URL, but we can try
        mediaUrl = url;
      } else {
        mediaUrl = `${url}${separator}t=${timestamp}`;
      }
    }
    
    window.open(mediaUrl, '_blank');
  };

  const handleLinkOpen = async (intent: Intent) => {
    if (!intent.payload.link) return;
    window.open(intent.payload.link.url, '_blank');
  };

  const handlePromptInjection = async (intent: Intent) => {
    if (!intent.payload.prompt) return;
    
    const { text, target_app } = intent.payload.prompt;
    
    // Try to open in code editor (Cursor/VS Code)
    if (target_app === 'editor') {
      // Copy to clipboard first (most reliable)
      try {
        await navigator.clipboard.writeText(text);
        console.log('✅ Prompt copied to clipboard');
      } catch (err) {
        console.error('Failed to copy to clipboard:', err);
      }
      
      // Try multiple protocols to open Cursor/VS Code
      const protocols = [
        'cursor://',  // Cursor protocol
        'vscode://',  // VS Code protocol
      ];
      
      let opened = false;
      for (const protocol of protocols) {
        try {
          // Try to open with protocol handler
          const url = `${protocol}file/${encodeURIComponent(text)}`;
          window.location.href = url;
          
          // Give it a moment to see if it opens
          await new Promise(resolve => setTimeout(resolve, 500));
          opened = true;
          break;
        } catch (err) {
          console.log(`Failed to open with ${protocol}:`, err);
        }
      }
      
      // Show notification that prompt is ready
      if (opened) {
        alert(`Prompt sent to Cursor!\n\n"${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"\n\nIt's also copied to your clipboard.`);
      } else {
        alert(`Prompt copied to clipboard!\n\n"${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"\n\nPaste it into Cursor/VS Code (Cmd/Ctrl+V).`);
      }
    } else {
      // Default: open in browser search or new tab
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(text)}`;
      window.open(searchUrl, '_blank');
    }
  };

  const handleClipboardSync = async (intent: Intent) => {
    if (!intent.payload.clipboard) return;
    
    const text = intent.payload.clipboard.text;
    
    // Copy to clipboard
    try {
      await navigator.clipboard.writeText(text);
      console.log('Clipboard synced');
    } catch (err) {
      console.error('Failed to sync clipboard:', err);
    }
  };

  const handleIntentSent = (intent: Intent) => {
    console.log('Intent sent:', intent);
    // Could show toast notification
  };

  const handleDragStart = (e: React.DragEvent, item: any) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleLeaveSession = () => {
    // Disconnect WebSocket
    if (wsRef.current) {
      wsRef.current.close();
    }
    // Cleanup
    webrtcManagerRef.current?.cleanup();
    // Clear session
    onLeaveSession();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Stop event from bubbling to device tiles
    const deviceArray = Array.from(devices.values()).filter(d => d.id !== deviceId);
    // If dropped on empty area, show message
    if (deviceArray.length === 0) {
      alert('No devices connected. Wait for a device to join first.');
      return;
    }
    // Otherwise, let DeviceTile handle it (don't prevent default here)
  };

  const deviceArray = Array.from(devices.values()).filter(d => d.id !== deviceId);

  return (
    <div className="device-tiles-container">
      <div className="device-tiles-header">
        <h2>Connected Devices</h2>
        <div className="session-info">
          <span>Session: {session.code}</span>
          <button className="btn-leave" onClick={handleLeaveSession}>
            Leave Session
          </button>
        </div>
      </div>

      {/* Show QR code for session creator */}
      {session.createdBy === deviceId && (
        <div className="qr-code-section">
          <p className="qr-label">Share this QR code to connect devices:</p>
          <div className="qr-container-small">
            <QRCodeSVG value={session.code} size={150} />
          </div>
          <p className="session-code-display-small">
            Code: <strong>{session.code}</strong>
          </p>
        </div>
      )}

      <div className="drag-drop-zone">
        <p className="drag-instructions">
          Drag files, links, or text here, then drop onto a device tile
        </p>
        <div 
          className="drop-area"
          onDragOver={(e) => {
            // Only prevent default if not over a device tile
            const target = e.target as HTMLElement;
            if (!target.closest('.device-tile')) {
              e.preventDefault();
            }
          }}
          onDrop={(e) => {
            // Only handle drop if not on a device tile
            const target = e.target as HTMLElement;
            if (!target.closest('.device-tile')) {
              handleDrop(e);
            }
          }}
        >
          {deviceArray.length === 0 ? (
            <div className="no-devices">
              <p>Waiting for other devices to join...</p>
              <p className="session-code-hint">Share code: <strong>{session.code}</strong></p>
            </div>
          ) : (
            <div className="device-tiles-grid">
              {deviceArray.map((device) => (
                <DeviceTile
                  key={device.id}
                  device={device}
                  draggedItem={draggedItem}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDrop={async (intent) => {
                    console.log('=== DeviceTiles onDrop Handler ===');
                    console.log('Intent received:', intent.intent_type);
                    console.log('Target device:', device.id, device.name);
                    
                    if (!intentRouterRef.current) {
                      console.error('❌ IntentRouter not initialized');
                      alert('Intent router not ready. Please refresh the page.');
                      return;
                    }
                    
                    try {
                      // Grant permission on TARGET device when sending intent
                      // This shows that we're sending this type of content to them
                      console.log('Granting permission for intent type:', intent.intent_type, 'on target device:', device.id);
                      grantPermissionForIntent(intent, device.id); // Grant permission on TARGET device
                      
                      console.log('Routing intent to device:', device.id);
                      await intentRouterRef.current.routeIntent(intent, device.id);
                      console.log('✅ Intent routed successfully');
                      
                      // Show success feedback
                      const intentTypeNames: Record<string, string> = {
                        'file_handoff': 'File',
                        'media_continuation': 'Media',
                        'link_open': 'Link',
                        'prompt_injection': 'Prompt',
                        'clipboard_sync': 'Clipboard'
                      };
                      const typeName = intentTypeNames[intent.intent_type] || 'Item';
                      console.log(`✅ ${typeName} sent to ${device.name}`);
                    } catch (error) {
                      console.error('❌ Error routing intent:', error);
                      alert('Failed to send: ' + error);
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

