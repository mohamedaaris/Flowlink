import { Intent, IntentType, IntentPayload } from '@shared/types';
import WebRTCManager from './WebRTCManager';

/**
 * Intent Router
 * 
 * Detects intent type from dragged items and routes them to target devices.
 * This is the core intelligence that interprets user actions as intents.
 */
export default class IntentRouter {
  private deviceId: string;
  private webrtcManager: WebRTCManager;
  private onIntentSent?: (intent: Intent) => void;

  constructor(
    deviceId: string,
    webrtcManager: WebRTCManager,
    onIntentSent?: (intent: Intent) => void
  ) {
    this.deviceId = deviceId;
    this.webrtcManager = webrtcManager;
    this.onIntentSent = onIntentSent;
  }

  /**
   * Route an intent to a target device
   */
  async routeIntent(intent: Intent, targetDeviceId: string): Promise<void> {
    // Set source device
    intent.source_device = this.deviceId;
    intent.target_device = targetDeviceId;

    // Send via WebRTC if available, otherwise fallback to WebSocket
    try {
      await this.webrtcManager.sendIntent(intent);
      this.onIntentSent?.(intent);
    } catch (error) {
      console.error('Failed to send intent via WebRTC, falling back to WebSocket:', error);
      // Fallback handled by WebRTCManager
    }
  }

  /**
   * Detect intent type from a file
   */
  detectFileIntent(file: File): Intent {
    // Check if it's a media file
    if (file.type.startsWith('video/')) {
      return {
        intent_type: 'media_continuation',
        payload: {
          media: {
            url: '', // Will be set when file is transferred
            type: 'video',
          },
        },
        target_device: '',
        source_device: this.deviceId,
        auto_open: true,
        timestamp: Date.now(),
      };
    }

    if (file.type.startsWith('audio/')) {
      return {
        intent_type: 'media_continuation',
        payload: {
          media: {
            url: '', // Will be set when file is transferred
            type: 'audio',
          },
        },
        target_device: '',
        source_device: this.deviceId,
        auto_open: true,
        timestamp: Date.now(),
      };
    }

    // Default: file handoff
    return {
      intent_type: 'file_handoff',
      payload: {
        file: {
          name: file.name,
          size: file.size,
          type: file.type,
        },
      },
      target_device: '',
      source_device: this.deviceId,
      auto_open: true,
      timestamp: Date.now(),
    };
  }

  /**
   * Detect intent type from text/URL
   */
  detectTextIntent(text: string): Intent | null {
    // Try to parse as URL
    try {
      const url = new URL(text);
      
      // Check if it's a media URL
      if (url.pathname.match(/\.(mp4|mp3|webm|ogg|avi|mov)(\?|$)/i)) {
        return {
          intent_type: 'media_continuation',
          payload: {
            media: {
              url: text,
              type: url.pathname.match(/\.(mp4|webm|avi|mov)(\?|$)/i) ? 'video' : 'audio',
            },
          },
          target_device: '',
          source_device: this.deviceId,
          auto_open: true,
          timestamp: Date.now(),
        };
      }

      // Regular link
      return {
        intent_type: 'link_open',
        payload: {
          link: {
            url: text,
          },
        },
        target_device: '',
        source_device: this.deviceId,
        auto_open: true,
        timestamp: Date.now(),
      };
    } catch {
      // Not a URL, treat as prompt or clipboard
      // Check if it looks like code or a command
      if (text.length > 100 || text.includes('\n') || text.includes('```')) {
        return {
          intent_type: 'prompt_injection',
          payload: {
            prompt: {
              text: text,
              target_app: 'editor',
            },
          },
          target_device: '',
          source_device: this.deviceId,
          auto_open: true,
          timestamp: Date.now(),
        };
      }

      // Short text: clipboard sync
      return {
        intent_type: 'clipboard_sync',
        payload: {
          clipboard: {
            text: text,
          },
        },
        target_device: '',
        source_device: this.deviceId,
        auto_open: true,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Create intent from clipboard data
   */
  async detectClipboardIntent(): Promise<Intent | null> {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        return {
          intent_type: 'clipboard_sync',
          payload: {
            clipboard: {
              text: text,
            },
          },
          target_device: '',
          source_device: this.deviceId,
          auto_open: true,
          timestamp: Date.now(),
        };
      }
    } catch (error) {
      console.error('Failed to read clipboard:', error);
    }
    return null;
  }
}

