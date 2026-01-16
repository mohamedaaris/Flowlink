/**
 * Clipboard Monitor
 * 
 * Monitors clipboard changes and syncs with other devices
 */
export default class ClipboardMonitor {
  private lastClipboardText: string = '';
  private isEnabled: boolean = false;
  private intervalId: number | null = null;
  private onClipboardChange: (text: string) => void;

  constructor(onClipboardChange: (text: string) => void) {
    this.onClipboardChange = onClipboardChange;
  }

  /**
   * Start monitoring clipboard
   */
  start() {
    if (this.isEnabled) return;
    
    this.isEnabled = true;
    console.log('📋 Clipboard monitor started');
    
    // Poll clipboard every 1 second
    this.intervalId = window.setInterval(() => {
      this.checkClipboard();
    }, 1000);
  }

  /**
   * Stop monitoring clipboard
   */
  stop() {
    if (!this.isEnabled) return;
    
    this.isEnabled = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('📋 Clipboard monitor stopped');
  }

  /**
   * Check clipboard for changes
   */
  private async checkClipboard() {
    if (!this.isEnabled) return;

    try {
      // Check if we have clipboard permission
      const permission = await navigator.permissions.query({ name: 'clipboard-read' as PermissionName });
      if (permission.state === 'denied') {
        console.warn('Clipboard permission denied');
        return;
      }

      // Read clipboard
      const text = await navigator.clipboard.readText();
      
      // Check if changed
      if (text && text !== this.lastClipboardText && text.trim().length > 0) {
        // Ignore sensitive data
        if (this.isSensitiveData(text)) {
          console.log('📋 Skipping sensitive data');
          return;
        }

        this.lastClipboardText = text;
        console.log('📋 Clipboard changed:', text.substring(0, 50) + '...');
        
        // Notify callback
        this.onClipboardChange(text);
      }
    } catch (error) {
      // Clipboard API might fail if tab is not focused
      // This is expected, just ignore
      if (error instanceof Error && !error.message.includes('Document is not focused')) {
        console.error('Clipboard read error:', error);
      }
    }
  }

  /**
   * Update clipboard without triggering change event
   */
  async updateClipboard(text: string) {
    try {
      this.lastClipboardText = text;
      await navigator.clipboard.writeText(text);
      console.log('📋 Clipboard updated from remote:', text.substring(0, 50) + '...');
    } catch (error) {
      console.error('Failed to update clipboard:', error);
    }
  }

  /**
   * Check if text contains sensitive data
   */
  private isSensitiveData(text: string): boolean {
    const sensitivePatterns = [
      /\b\d{13,19}\b/, // Credit card numbers
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /password/i,
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b.*password/i,
      /\bpin\b.*\d{4,6}/i,
    ];

    return sensitivePatterns.some(pattern => pattern.test(text));
  }

  /**
   * Check if clipboard monitoring is supported
   */
  static isSupported(): boolean {
    return 'clipboard' in navigator && 'readText' in navigator.clipboard;
  }
}
