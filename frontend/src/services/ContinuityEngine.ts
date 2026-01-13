import WebRTCManager from './WebRTCManager';
import { Intent } from '@shared/types';

/**
 * Continuity Engine
 * 
 * Syncs state across devices for seamless continuity:
 * - Media playback time and state
 * - File positions (PDF page, document scroll)
 * - Clipboard
 * - Application state
 */
export default class ContinuityEngine {
  private webrtcManager: WebRTCManager;
  private deviceId: string;
  private mediaState: Map<string, MediaState> = new Map();
  private clipboardSyncEnabled: boolean = false;

  constructor(webrtcManager: WebRTCManager, deviceId: string) {
    this.webrtcManager = webrtcManager;
    this.deviceId = deviceId;

    // Monitor clipboard changes
    this.setupClipboardMonitoring();
  }

  /**
   * Sync media playback state
   */
  async syncMediaState(
    url: string,
    timestamp: number,
    state: 'play' | 'pause',
    targetDeviceId: string
  ): Promise<void> {
    const mediaState: MediaState = {
      url,
      timestamp,
      state,
      lastUpdated: Date.now(),
    };

    this.mediaState.set(url, mediaState);

    const intent: Intent = {
      intent_type: 'media_continuation',
      payload: {
        media: {
          url,
          type: this.detectMediaType(url),
          timestamp,
          state,
        },
      },
      target_device: targetDeviceId,
      source_device: this.deviceId,
      auto_open: true,
      timestamp: Date.now(),
    };

    await this.webrtcManager.sendIntent(intent);
  }

  /**
   * Continue media on this device
   */
  async continueMedia(intent: Intent): Promise<void> {
    const { media } = intent.payload;
    if (!media) return;

    const { url, timestamp, state } = media;

    // Store state
    this.mediaState.set(url, {
      url,
      timestamp: timestamp || 0,
      state: state || 'play',
      lastUpdated: Date.now(),
    });

    // Open media with timestamp
    const mediaUrl = timestamp ? `${url}#t=${timestamp}` : url;
    
    // Try to open in default media player or browser
    if (media.type === 'video') {
      // For video, open in new tab with timestamp
      window.open(mediaUrl, '_blank');
    } else if (media.type === 'audio') {
      // For audio, could use HTML5 audio element
      this.playAudio(mediaUrl, timestamp || 0, state === 'play');
    }
  }

  /**
   * Play audio with timestamp
   */
  private playAudio(url: string, timestamp: number, autoplay: boolean): void {
    const audio = new Audio(url);
    audio.currentTime = timestamp;
    if (autoplay) {
      audio.play().catch(err => {
        console.error('Failed to autoplay audio:', err);
        // Fallback: open in new tab
        window.open(url, '_blank');
      });
    }
  }

  /**
   * Detect media type from URL
   */
  private detectMediaType(url: string): 'video' | 'audio' {
    const videoExtensions = ['.mp4', '.webm', '.avi', '.mov', '.mkv'];
    const audioExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.flac'];
    
    const lowerUrl = url.toLowerCase();
    
    if (videoExtensions.some(ext => lowerUrl.includes(ext))) {
      return 'video';
    }
    
    if (audioExtensions.some(ext => lowerUrl.includes(ext))) {
      return 'audio';
    }
    
    // Default to video for unknown types
    return 'video';
  }

  /**
   * Sync clipboard to target device
   */
  async syncClipboard(targetDeviceId: string): Promise<void> {
    try {
      const text = await navigator.clipboard.readText();
      
      const intent: Intent = {
        intent_type: 'clipboard_sync',
        payload: {
          clipboard: {
            text,
          },
        },
        target_device: targetDeviceId,
        source_device: this.deviceId,
        auto_open: true,
        timestamp: Date.now(),
      };

      await this.webrtcManager.sendIntent(intent);
    } catch (error) {
      console.error('Failed to read clipboard:', error);
    }
  }

  /**
   * Apply clipboard sync from another device
   */
  async applyClipboardSync(intent: Intent): Promise<void> {
    const { clipboard } = intent.payload;
    if (!clipboard) return;

    try {
      await navigator.clipboard.writeText(clipboard.text);
      console.log('Clipboard synced');
    } catch (error) {
      console.error('Failed to write to clipboard:', error);
    }
  }

  /**
   * Enable clipboard monitoring (sync on change)
   */
  enableClipboardSync(targetDeviceId: string): void {
    this.clipboardSyncEnabled = true;
    // Note: Browser security prevents monitoring clipboard changes
    // This would need to be triggered manually or via user action
  }

  /**
   * Setup clipboard monitoring (limited by browser security)
   */
  private setupClipboardMonitoring(): void {
    // Browser security prevents automatic clipboard monitoring
    // Users must manually trigger clipboard sync
    // Could use paste event listener as a workaround
    document.addEventListener('paste', async (e) => {
      if (this.clipboardSyncEnabled) {
        // Get clipboard data
        const items = e.clipboardData?.items;
        if (items) {
          for (const item of Array.from(items)) {
            if (item.type === 'text/plain') {
              item.getAsString(async (text) => {
                // Auto-sync clipboard (would need target device ID)
                console.log('Clipboard changed:', text);
              });
            }
          }
        }
      }
    });
  }

  /**
   * Sync file position (e.g., PDF page, scroll position)
   */
  async syncFilePosition(
    filePath: string,
    position: FilePosition,
    targetDeviceId: string
  ): Promise<void> {
    // This would be part of a file handoff intent
    // Position info included in file metadata
    console.log('Syncing file position:', filePath, position);
  }
}

interface MediaState {
  url: string;
  timestamp: number;
  state: 'play' | 'pause';
  lastUpdated: number;
}

interface FilePosition {
  page?: number;
  scrollY?: number;
  selection?: string;
}

