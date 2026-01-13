/**
 * Media Detector
 * 
 * Detects currently playing media in browser tabs and captures playback state.
 * This enables seamless media continuation across devices.
 */

export interface MediaState {
  url: string;
  timestamp: number; // Current playback position in seconds
  state: 'play' | 'pause';
  type: 'video' | 'audio';
  title?: string;
}

export default class MediaDetector {
  private mediaElements: Map<HTMLMediaElement, MediaState> = new Map();
  private observers: MutationObserver[] = [];
  private intervalId: number | null = null;

  constructor() {
    this.startDetection();
  }

  /**
   * Start detecting media elements in the page
   */
  private startDetection(): void {
    // Scan existing media elements
    this.scanForMedia();

    // Watch for new media elements
    const observer = new MutationObserver(() => {
      this.scanForMedia();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    this.observers.push(observer);

    // Poll for media state changes
    this.intervalId = window.setInterval(() => {
      this.updateMediaStates();
    }, 1000); // Check every second
  }

  /**
   * Scan document for media elements
   */
  private scanForMedia(): void {
    const videos = document.querySelectorAll('video');
    const audios = document.querySelectorAll('audio');

    videos.forEach((video) => {
      if (!this.mediaElements.has(video)) {
        this.trackMediaElement(video, 'video');
      }
    });

    audios.forEach((audio) => {
      if (!this.mediaElements.has(audio)) {
        this.trackMediaElement(audio, 'audio');
      }
    });
  }

  /**
   * Track a media element
   */
  private trackMediaElement(element: HTMLMediaElement, type: 'video' | 'audio'): void {
    const updateState = () => {
      const state: MediaState = {
        url: this.getMediaUrl(element),
        timestamp: element.currentTime,
        state: element.paused ? 'pause' : 'play',
        type,
        title: this.getMediaTitle(element),
      };
      this.mediaElements.set(element, state);
    };

    element.addEventListener('play', updateState);
    element.addEventListener('pause', updateState);
    element.addEventListener('timeupdate', updateState);
    element.addEventListener('loadedmetadata', updateState);

    updateState();
  }

  /**
   * Get media URL from element
   */
  private getMediaUrl(element: HTMLMediaElement): string {
    // Try src attribute first
    if (element.src) {
      return element.src;
    }

    // Try source elements
    const source = element.querySelector('source');
    if (source && source.src) {
      return source.src;
    }

    // Try currentSrc
    if (element.currentSrc) {
      return element.currentSrc;
    }

    // Fallback: try to get from parent (e.g., YouTube iframe)
    const parent = element.closest('iframe');
    if (parent && parent.src) {
      return parent.src;
    }

    return '';
  }

  /**
   * Get media title
   */
  private getMediaTitle(element: HTMLMediaElement): string | undefined {
    // Try title attribute
    if (element.title) {
      return element.title;
    }

    // Try aria-label
    if (element.getAttribute('aria-label')) {
      return element.getAttribute('aria-label') || undefined;
    }

    // Try parent title
    const parent = element.closest('[title]');
    if (parent) {
      return parent.getAttribute('title') || undefined;
    }

    return undefined;
  }

  /**
   * Update media states
   */
  private updateMediaStates(): void {
    this.mediaElements.forEach((state, element) => {
      if (element && !element.paused) {
        // Only update if playing
        state.timestamp = element.currentTime;
        state.state = 'play';
      }
    });
  }

  /**
   * Get currently playing media
   */
  getCurrentMedia(): MediaState | null {
    // Find the first playing media element
    for (const [element, state] of this.mediaElements.entries()) {
      if (element && !element.paused && !element.ended) {
        return {
          ...state,
          timestamp: element.currentTime, // Get latest timestamp
        };
      }
    }

    return null;
  }

  /**
   * Get all media states (including paused)
   */
  getAllMedia(): MediaState[] {
    return Array.from(this.mediaElements.values()).map((state) => {
      const element = Array.from(this.mediaElements.keys()).find(
        (el) => this.mediaElements.get(el) === state
      );
      if (element) {
        return {
          ...state,
          timestamp: element.currentTime,
          state: element.paused ? 'pause' : 'play',
        };
      }
      return state;
    });
  }

  /**
   * Detect media from page context (for Spotify, YouTube, etc.)
   */
  async detectMediaFromPage(): Promise<MediaState | null> {
    // Check for Spotify Web Player
    const spotifyPlayer = document.querySelector('[data-testid="now-playing-widget"]');
    if (spotifyPlayer) {
      // Try to extract track info
      const trackName = spotifyPlayer.querySelector('[data-testid="context-item-info-title"]')?.textContent;
      const artistName = spotifyPlayer.querySelector('[data-testid="context-item-info-artist"]')?.textContent;
      
      // Spotify doesn't expose direct URL, but we can create a search link
      if (trackName) {
        return {
          url: `https://open.spotify.com/search/${encodeURIComponent(trackName + ' ' + artistName)}`,
          timestamp: 0,
          state: 'play',
          type: 'audio',
          title: `${trackName} - ${artistName}`,
        };
      }
    }

    // Check for YouTube player
    const youtubePlayer = document.querySelector('video.html5-main-video');
    if (youtubePlayer) {
      const video = youtubePlayer as HTMLVideoElement;
      const url = window.location.href;
      return {
        url,
        timestamp: video.currentTime,
        state: video.paused ? 'pause' : 'play',
        type: 'video',
        title: document.title.replace(' - YouTube', ''),
      };
    }

    // Check for Netflix, etc. (would need specific selectors)
    // For now, fall back to standard media detection
    return this.getCurrentMedia();
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.observers.forEach((observer) => observer.disconnect());
    this.observers = [];
    this.mediaElements.clear();
  }
}
