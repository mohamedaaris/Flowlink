import React, { useState } from 'react';
import { Group, Device, Intent } from '@shared/types';
import MediaDetector from '../services/MediaDetector';
import './GroupTile.css';

interface GroupTileProps {
  group: Group;
  devices: Device[];
  onDrop: (groupId: string, intent: Intent) => void;
}

const GroupTile: React.FC<GroupTileProps> = ({ group, devices, onDrop }) => {
  const [isDraggingOver, setIsDraggingOver] = useState(false);

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
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    console.log('=== GROUP DROP EVENT ===');
    console.log('Drop event on group:', group.name);

    try {
      const intent = await createIntentFromDrop(e);
      if (intent) {
        console.log('✅ Intent created for group broadcast:', intent.intent_type);
        onDrop(group.id, intent);
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
    console.log('createIntentFromDrop called for group');
    
    // Check for files
    const droppedFile = extractFileFromEvent(e);
    if (droppedFile) {
      console.log('File detected:', droppedFile.name, droppedFile.type);
      const file = droppedFile;
      
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      return {
        intent_type: 'file_handoff',
        payload: {
          file: {
            name: file.name,
            size: file.size,
            type: file.type,
            data: Array.from(uint8Array) as any, // Convert to array for JSON serialization
          },
        },
        target_device: '', // Will be set per device in broadcast
        source_device: '',
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
            // Media continuation
            let timestamp = 0;
            let state: 'play' | 'pause' = 'play';
            
            // Try to get current playback state
            try {
              const mediaDetector = new MediaDetector();
              const currentMedia = await mediaDetector.detectMediaFromPage();
              
              if (currentMedia && currentMedia.timestamp > 0) {
                timestamp = Math.floor(currentMedia.timestamp);
                state = currentMedia.state;
                console.log(`✅ Using current playback position: ${timestamp}s`);
              }
              mediaDetector.cleanup();
            } catch (err) {
              console.log('Could not detect media state:', err);
            }
            
            return {
              intent_type: 'media_continuation',
              payload: {
                media: {
                  url: normalized,
                  type: isYouTube || normalized.match(/\.(mp4|webm|avi|mov|mkv)(\?|$)/i) ? 'video' : 'audio',
                  timestamp,
                  state,
                },
              },
              target_device: '',
              source_device: '',
              auto_open: true,
              timestamp: Date.now(),
            };
          }
          
          // Regular link
          return {
            intent_type: 'link_open',
            payload: {
              link: {
                url: normalized,
              },
            },
            target_device: '',
            source_device: '',
            auto_open: true,
            timestamp: Date.now(),
          };
        }
      } catch {
        // Not a URL, treat as clipboard sync
      }

      // Plain text - clipboard sync
      return {
        intent_type: 'clipboard_sync',
        payload: {
          clipboard: {
            text: text,
          },
        },
        target_device: '',
        source_device: '',
        auto_open: true,
        timestamp: Date.now(),
      };
    }

    return null;
  };

  const getDeviceName = (deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);
    return device?.name || 'Unknown';
  };

  const onlineDevices = group.deviceIds.filter(deviceId => {
    const device = devices.find(d => d.id === deviceId);
    return device?.online;
  });

  return (
    <div
      className={`group-tile ${isDraggingOver ? 'dragging-over' : ''}`}
      style={{ borderColor: group.color }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="group-tile-header">
        <div className="group-icon" style={{ background: group.color }}>
          👥
        </div>
        <div className="group-tile-info">
          <div className="group-tile-name">{group.name}</div>
          <div className="group-tile-count">
            {onlineDevices.length}/{group.deviceIds.length} online
          </div>
        </div>
      </div>

      <div className="group-tile-devices">
        {group.deviceIds.slice(0, 3).map(deviceId => {
          const device = devices.find(d => d.id === deviceId);
          return (
            <div key={deviceId} className="mini-device">
              <span className="mini-device-icon">
                {device?.type === 'phone' ? '📱' : '💻'}
              </span>
              <span className="mini-device-name">{getDeviceName(deviceId)}</span>
              <span className={`mini-device-status ${device?.online ? 'online' : 'offline'}`} />
            </div>
          );
        })}
        {group.deviceIds.length > 3 && (
          <div className="more-devices">+{group.deviceIds.length - 3} more</div>
        )}
      </div>

      {isDraggingOver && (
        <div className="drop-overlay">
          <div className="drop-message">
            📤 Broadcast to all devices
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupTile;
