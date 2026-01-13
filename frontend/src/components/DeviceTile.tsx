import React, { useState } from 'react';
import { Device, Intent } from '@shared/types';
import MediaDetector from '../services/MediaDetector';
import './DeviceTile.css';

interface DeviceTileProps {
  device: Device;
  draggedItem: any;
  onDragStart: (e: React.DragEvent, item: any) => void;
  onDragEnd: () => void;
  onDrop: (intent: Intent) => void;
}

export default function DeviceTile({
  device,
  draggedItem,
  onDragStart,
  onDragEnd,
  onDrop,
}: DeviceTileProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [clipboardText, setClipboardText] = useState('');

  const extractFileFromEvent = (e: React.DragEvent): File | null => {
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      return e.dataTransfer.files[0];
    }

    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      for (const item of Array.from(e.dataTransfer.items)) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            return file;
          }
        }
      }
    }

    return null;
  };

  const normalizeUrl = (text: string): string | null => {
    if (!text) return null;
    const trimmed = text.trim();
    if (!trimmed) return null;

    // Already has a protocol
    if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed)) {
      return trimmed;
    }

    // Common domains without scheme (e.g., youtube.com/foo)
    if (/^(www\.)?[a-z0-9.-]+\.[a-z]{2,}([/?].*)?$/i.test(trimmed)) {
      return `https://${trimmed}`;
    }

    return null;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent parent from handling
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
    console.log('Drag over device tile:', device.name);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent parent from handling
    setIsDragOver(false);

    console.log('=== DROP EVENT ===');
    console.log('Drop event on device tile:', device.name);
    console.log('Files count:', e.dataTransfer.files.length);
    console.log('File types:', Array.from(e.dataTransfer.files).map(f => f.type));
    console.log('Text data:', e.dataTransfer.getData('text/plain'));
    console.log('HTML data:', e.dataTransfer.getData('text/html'));

    try {
      const intent = await createIntentFromDrop(e);
      if (intent) {
        console.log('✅ Intent created successfully:', intent.intent_type);
        console.log('Intent payload:', JSON.stringify(intent.payload, null, 2));
        
        // If it's a media continuation (URL-based), try to get current playback state
        // Note: File-based media is sent as file_handoff, not media_continuation
        if (intent.intent_type === 'media_continuation' && intent.payload.media && !intent.payload.file) {
          try {
            const mediaDetector = new MediaDetector();
            const currentMedia = await mediaDetector.detectMediaFromPage();
            
            // Check if the dropped URL matches what's currently playing
            const droppedUrl = intent.payload.media.url;
            
            // Extract YouTube video IDs for comparison
            const getYouTubeVideoId = (url: string): string | null => {
              const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
              return match ? match[1] : null;
            };
            
            const droppedVideoId = getYouTubeVideoId(droppedUrl);
            const currentVideoId = currentMedia ? getYouTubeVideoId(currentMedia.url) : null;
            
            const isMatch = currentMedia && (
              currentMedia.url === droppedUrl ||
              droppedUrl.includes(currentMedia.url) ||
              currentMedia.url.includes(droppedUrl) ||
              // For YouTube, check if video IDs match
              (droppedVideoId && currentVideoId && droppedVideoId === currentVideoId) ||
              // For Spotify, check domain match
              (droppedUrl.includes('spotify.com') && currentMedia.url.includes('spotify.com'))
            );
            
            if (isMatch && currentMedia.timestamp > 0) {
              // Update with current timestamp and state
              intent.payload.media.timestamp = Math.floor(currentMedia.timestamp); // Round to seconds
              intent.payload.media.state = currentMedia.state;
              console.log(`✅ Media continuation: Resuming at ${intent.payload.media.timestamp}s`);
            } else if (currentMedia && currentMedia.timestamp > 0 && 
                       (droppedUrl.includes('youtube.com') || droppedUrl.includes('spotify.com'))) {
              // For YouTube/Spotify URLs, always use current timestamp if media is playing
              // (user wants to continue from where they are)
              intent.payload.media.timestamp = Math.floor(currentMedia.timestamp);
              intent.payload.media.state = currentMedia.state;
              console.log(`✅ Using current playback position: ${intent.payload.media.timestamp}s`);
            }
            mediaDetector.cleanup();
          } catch (err) {
            console.log('Could not detect media state:', err);
          }
        }
        
        console.log('Calling onDrop callback...');
        onDrop(intent);
        console.log('✅ onDrop callback completed');
      } else {
        console.warn('❌ No intent created from drop event');
        alert('Could not create intent from dropped item. Try dragging a file, URL, or text.');
      }
    } catch (error) {
      console.error('❌ Error in handleDrop:', error);
      alert('Error processing drop: ' + error);
    }
  };

  const createIntentFromDrop = async (e: React.DragEvent): Promise<Intent | null> => {
    console.log('createIntentFromDrop called');
    
    // Check for files (OS file drags sometimes populate items but not files array)
    const droppedFile = extractFileFromEvent(e);
    if (droppedFile) {
      console.log('File detected:', droppedFile.name, droppedFile.type);
      const file = droppedFile;
      
      // For all files (including media), send as file_handoff with actual file data
      // Blob URLs don't work on Android - they're only valid in the browser that created them
      // So we need to send the actual file bytes for media files too
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      return {
        intent_type: 'file_handoff',
        payload: {
          file: {
            name: file.name,
            size: file.size,
            type: file.type,
            data: Array.from(uint8Array), // Convert to array for JSON serialization
          },
        },
        target_device: device.id,
        source_device: '', // Will be set by IntentRouter
        auto_open: true,
        timestamp: Date.now(),
      };
    }

    // Check for text/URL
    const text = e.dataTransfer.getData('text/plain');
    console.log('Text data:', text);
    if (text) {
      const normalized = normalizeUrl(text) || text;

      // Check if it's a URL
      try {
        const url = new URL(normalized);
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          // Check if it's YouTube, Spotify, or other media streaming service
          const isYouTube = normalized.includes('youtube.com') || normalized.includes('youtu.be');
          const isSpotify = normalized.includes('spotify.com');
          const isMediaStream = isYouTube || isSpotify || normalized.match(/\.(mp4|mp3|webm|ogg|avi|mov|m4a|flac|wav)(\?|$)/i);
          
          if (isMediaStream) {
            // Always treat streaming URLs as media_continuation so we can add timestamp
            return {
              intent_type: 'media_continuation',
              payload: {
                media: {
                  url: normalized,
                  type: isYouTube || normalized.match(/\.(mp4|webm|avi|mov|mkv)(\?|$)/i) ? 'video' : 'audio',
                  timestamp: 0, // Will be populated by MediaDetector if available
                  state: 'play',
                },
              },
              target_device: device.id,
              source_device: '',
              auto_open: true,
              timestamp: Date.now(),
            };
          }
          
          return {
            intent_type: 'link_open',
            payload: {
              link: {
                  url: normalized,
              },
            },
            target_device: device.id,
            source_device: '',
            auto_open: true,
            timestamp: Date.now(),
          };
        }
      } catch {
        // Not a URL, treat as prompt or clipboard
        // Check if it looks like a media URL
        if (normalized.match(/\.(mp4|mp3|webm|ogg|avi|mov)(\?|$)/i) || normalized.includes('youtube.com') || normalized.includes('spotify.com')) {
          return {
            intent_type: 'media_continuation',
            payload: {
              media: {
                url: normalized,
                type: normalized.match(/\.(mp4|webm|avi|mov)(\?|$)/i) || normalized.includes('youtube.com') ? 'video' : 'audio',
                timestamp: 0,
                state: 'play',
              },
            },
            target_device: device.id,
            source_device: '',
            auto_open: true,
            timestamp: Date.now(),
          };
        }
        
        // Default: prompt injection (for code generation, etc.)
        return {
          intent_type: 'prompt_injection',
          payload: {
            prompt: {
              text: text,
              target_app: 'editor', // Default to code editor
            },
          },
          target_device: device.id,
          source_device: '',
          auto_open: true,
          timestamp: Date.now(),
        };
      }
    }

    // Check for HTML (could be rich text)
    const html = e.dataTransfer.getData('text/html');
    if (html) {
      return {
        intent_type: 'clipboard_sync',
        payload: {
          clipboard: {
            text: text || '',
            html: html,
          },
        },
        target_device: device.id,
        source_device: '',
        auto_open: true,
        timestamp: Date.now(),
      };
    }

    return null;
  };

  const getDeviceIcon = () => {
    switch (device.type) {
      case 'phone':
        return '📱';
      case 'laptop':
        return '💻';
      case 'desktop':
        return '🖥️';
      case 'tablet':
        return '📱';
      default:
        return '📱';
    }
  };

  const getStatusColor = () => {
    return device.online ? '#4caf50' : '#999';
  };

  return (
    <div
      className={`device-tile ${isDragOver ? 'drag-over' : ''} ${!device.online ? 'offline' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ pointerEvents: 'auto' }}
    >
      <div className="device-tile-header">
        <div className="device-icon">{getDeviceIcon()}</div>
        <div className="device-info">
          <h3 className="device-name">{device.name}</h3>
          <div className="device-status">
            <span
              className="status-dot"
              style={{ backgroundColor: getStatusColor() }}
            />
            <span className="status-text">
              {device.online ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      <div className="device-permissions">
        <div className="permission-label">Permissions:</div>
        <div className="permission-badges">
          {device.permissions.files && (
            <span className="permission-badge">Files</span>
          )}
          {device.permissions.media && (
            <span className="permission-badge">Media</span>
          )}
          {device.permissions.prompts && (
            <span className="permission-badge">Prompts</span>
          )}
          {device.permissions.clipboard && (
            <span className="permission-badge">Clipboard</span>
          )}
          {device.permissions.remote_browse && (
            <span className="permission-badge">Remote Access</span>
          )}
          {!device.permissions.files &&
            !device.permissions.media &&
            !device.permissions.prompts &&
            !device.permissions.clipboard &&
            !device.permissions.remote_browse && (
              <span className="permission-badge inactive">None</span>
            )}
        </div>
      </div>

      <div className="device-remote-access">
        <label className="remote-access-toggle">
          <input
            type="checkbox"
            checked={device.permissions.remote_browse || false}
            onChange={(e) => {
              const intent: Intent = {
                intent_type: 'clipboard_sync', // Reuse clipboard_sync as a permission request
                payload: {
                  clipboard: {
                    text: e.target.checked ? 'ENABLE_REMOTE_ACCESS' : 'DISABLE_REMOTE_ACCESS',
                  },
                },
                target_device: device.id,
                source_device: '',
                auto_open: false,
                timestamp: Date.now(),
              };
              // This will trigger permission update
              onDrop(intent);
            }}
          />
          <span className="toggle-label">Enable Remote Access</span>
        </label>
        {device.permissions.remote_browse && (
          <button
            className="remote-access-button"
            onClick={() => {
              // Open remote access interface
              window.open(`/remote/${device.id}`, '_blank');
            }}
          >
            Open Remote View
          </button>
        )}
      </div>

      <div className="device-clipboard">
        <input
          type="text"
          className="device-clipboard-input"
          placeholder="Type or paste text to send to this device"
          value={clipboardText}
          onChange={(e) => setClipboardText(e.target.value)}
        />
        <button
          className="device-clipboard-button"
          onClick={() => {
            const text = clipboardText.trim();
            if (!text) return;

            const intent: Intent = {
              intent_type: 'clipboard_sync',
              payload: {
                clipboard: {
                  text,
                },
              },
              target_device: device.id,
              source_device: '',
              auto_open: true,
              timestamp: Date.now(),
            };

            onDrop(intent);
          }}
        >
          Send text
        </button>
      </div>

      {isDragOver && (
        <div className="drop-indicator">
          <div className="drop-message">Drop here to send</div>
        </div>
      )}
    </div>
  );
}

