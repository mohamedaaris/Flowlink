/**
 * Remote Desktop Manager
 * 
 * Handles screen sharing and remote control functionality
 */
export default class RemoteDesktopManager {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private ws: WebSocket;
  private sessionId: string;
  private sourceDeviceId: string;
  private viewerDeviceId: string;
  private isSource: boolean;
  private onRemoteStream: ((stream: MediaStream) => void) | null = null;
  private onConnectionStateChange: ((state: string) => void) | null = null;

  constructor(
    ws: WebSocket,
    sessionId: string,
    sourceDeviceId: string,
    viewerDeviceId: string,
    isSource: boolean
  ) {
    this.ws = ws;
    this.sessionId = sessionId;
    this.sourceDeviceId = sourceDeviceId;
    this.viewerDeviceId = viewerDeviceId;
    this.isSource = isSource;

    // Listen for WebRTC signaling
    const messageHandler = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        // Handle WebRTC signaling messages
        // For source: messages come from viewerDeviceId
        // For viewer: messages come from sourceDeviceId
        const expectedFromDevice = this.isSource ? this.viewerDeviceId : this.sourceDeviceId;
        
        if (message.type.startsWith('webrtc_')) {
          const fromDevice = message.deviceId || message.payload?.fromDevice;
          if (fromDevice === expectedFromDevice) {
            this.handleSignaling(message);
          }
        }
      } catch (error) {
        // Ignore non-JSON messages or parsing errors
      }
    };
    
    ws.addEventListener('message', messageHandler);
    
    // Store handler for cleanup
    (this as any)._messageHandler = messageHandler;
  }

  /**
   * Start screen sharing (call on source device)
   */
  async startScreenShare(): Promise<MediaStream> {
    try {
      console.log('Requesting screen share permission...');
      
      // Request screen capture - this will show browser permission dialog
      // The user must interact with the page for this to work (user gesture required)
      this.localStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor',
        } as MediaTrackConstraints,
        audio: false,
      });

      console.log('Screen share permission granted, stream received');

      // Handle stream end (user stops sharing)
      this.localStream.getVideoTracks()[0].addEventListener('ended', () => {
        console.log('Screen share ended by user');
        this.stopScreenShare();
      });

      // Create peer connection
      await this.createPeerConnection();

      // Add local stream tracks
      this.localStream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });

      // Create offer
      const offer = await this.peerConnection!.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
      });
      await this.peerConnection!.setLocalDescription(offer);

      console.log('Sending WebRTC offer for remote desktop');

      // Send offer via WebSocket
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'webrtc_offer',
          sessionId: this.sessionId,
          deviceId: this.sourceDeviceId,
          payload: {
            toDevice: this.viewerDeviceId,
            data: offer,
            purpose: 'remote_desktop',
          },
          timestamp: Date.now(),
        }));
      } else {
        throw new Error('WebSocket not open, cannot send offer');
      }

      return this.localStream;
    } catch (error) {
      console.error('Failed to start screen share:', error);
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.name === 'NotReadableError') {
          throw new Error('Screen share permission denied or not available');
        }
        throw error;
      }
      throw new Error('Unknown error starting screen share');
    }
  }

  /**
   * Connect as viewer (call on viewer device)
   */
  async connectAsViewer(): Promise<void> {
    await this.createPeerConnection();

    // Set up remote stream handler
    this.peerConnection!.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        if (this.onRemoteStream) {
          this.onRemoteStream(this.remoteStream);
        }
      }
    };

    // Create answer when offer is received (handled in handleSignaling)
  }

  /**
   * Create WebRTC peer connection
   */
  private async createPeerConnection(): Promise<void> {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.ws.send(JSON.stringify({
          type: 'webrtc_ice_candidate',
          sessionId: this.sessionId,
          deviceId: this.isSource ? this.sourceDeviceId : this.viewerDeviceId,
          payload: {
            toDevice: this.isSource ? this.viewerDeviceId : this.sourceDeviceId,
            data: event.candidate.toJSON(),
          },
          timestamp: Date.now(),
        }));
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState || 'disconnected';
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(state);
      }
    };

    // Create data channel for input events
    if (this.isSource) {
      // Source device creates data channel
      this.dataChannel = this.peerConnection.createDataChannel('input', {
        ordered: true,
      });
      this.setupDataChannel();
    } else {
      // Viewer device receives data channel
      this.peerConnection.ondatachannel = (event) => {
        this.dataChannel = event.channel;
        this.setupDataChannel();
      };
    }
  }

  /**
   * Setup data channel for input events
   */
  private setupDataChannel(): void {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      console.log('Data channel opened for remote desktop');
    };

    this.dataChannel.onerror = (error) => {
      console.error('Data channel error:', error);
    };

    if (this.isSource) {
      // Source device receives input events from viewer
      this.dataChannel.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'input_event') {
            this.handleInputEvent(message.event);
          }
        } catch (error) {
          console.error('Failed to parse input event:', error);
        }
      };
    } else {
      // Viewer device listens for messages (status updates, etc.)
      this.dataChannel.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('Data channel message:', message);
        } catch (error) {
          console.error('Failed to parse data channel message:', error);
        }
      };
    }
  }

  /**
   * Handle WebRTC signaling messages
   */
  private async handleSignaling(message: any): Promise<void> {
    if (!this.peerConnection) {
      console.log('Creating peer connection for signaling');
      await this.createPeerConnection();
    }

    const { data } = message.payload;

    try {
      if (message.type === 'webrtc_offer') {
        // Viewer receives offer from source
        console.log('Received WebRTC offer');
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data));
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);

        this.ws.send(JSON.stringify({
          type: 'webrtc_answer',
          sessionId: this.sessionId,
          deviceId: this.viewerDeviceId,
          payload: {
            toDevice: this.sourceDeviceId,
            data: answer,
          },
          timestamp: Date.now(),
        }));
        console.log('Sent WebRTC answer');
      } else if (message.type === 'webrtc_answer') {
        // Source receives answer from viewer
        console.log('Received WebRTC answer');
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data));
      } else if (message.type === 'webrtc_ice_candidate') {
        // Handle ICE candidate
        if (data) {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(data));
        }
      }
    } catch (error) {
      console.error('Error handling WebRTC signaling:', error);
    }
  }

  /**
   * Send input event to source device (call from viewer)
   */
  sendInputEvent(event: {
    type: 'mousedown' | 'mouseup' | 'mousemove' | 'click' | 'keydown' | 'keyup' | 'scroll';
    x?: number;
    y?: number;
    button?: number;
    key?: string;
    code?: string;
    deltaX?: number;
    deltaY?: number;
  }): void {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify({
        type: 'input_event',
        event,
        timestamp: Date.now(),
      }));
    }
  }

  /**
   * Set callback for remote stream
   */
  setOnRemoteStream(callback: (stream: MediaStream) => void): void {
    this.onRemoteStream = callback;
  }

  /**
   * Set callback for connection state changes
   */
  setOnConnectionStateChange(callback: (state: string) => void): void {
    this.onConnectionStateChange = callback;
  }

  /**
   * Stop screen sharing
   */
  stopScreenShare(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
  }

  /**
   * Handle input event on source device
   * 
   * Note: Browser security prevents direct input simulation.
   * For full functionality, use:
   * 1. Electron app with native input APIs
   * 2. Browser extension with native messaging
   * 3. Desktop application wrapper
   */
  private handleInputEvent(event: {
    type: string;
    x?: number;
    y?: number;
    button?: number;
    key?: string;
    code?: string;
    deltaX?: number;
    deltaY?: number;
  }): void {
    console.log('Received input event:', event);
    
    // Dispatch custom event for browser extension/Electron wrapper
    window.dispatchEvent(new CustomEvent('remote_input_event', {
      detail: event,
    }));

    // Try to simulate events using available browser APIs
    // Note: This has severe limitations due to browser security policies
    
    if (event.type === 'mousedown' || event.type === 'mouseup' || event.type === 'click') {
      if (event.x !== undefined && event.y !== undefined) {
        // Create mouse event
        const mouseEvent = new MouseEvent(event.type, {
          view: window,
          bubbles: true,
          cancelable: true,
          clientX: event.x,
          clientY: event.y,
          button: event.button || 0,
        });
        
        // Try to find element at coordinates and dispatch event
        const element = document.elementFromPoint(event.x, event.y);
        if (element) {
          element.dispatchEvent(mouseEvent);
        } else {
          // Fallback: dispatch on document
          document.dispatchEvent(mouseEvent);
        }
      }
    } else if (event.type === 'mousemove') {
      if (event.x !== undefined && event.y !== undefined) {
        const mouseEvent = new MouseEvent('mousemove', {
          view: window,
          bubbles: true,
          cancelable: true,
          clientX: event.x,
          clientY: event.y,
        });
        document.dispatchEvent(mouseEvent);
      }
    } else if (event.type === 'scroll') {
      if (event.deltaX !== undefined || event.deltaY !== undefined) {
        const wheelEvent = new WheelEvent('wheel', {
          view: window,
          bubbles: true,
          cancelable: true,
          clientX: event.x || 0,
          clientY: event.y || 0,
          deltaX: event.deltaX || 0,
          deltaY: event.deltaY || 0,
        });
        document.dispatchEvent(wheelEvent);
      }
    } else if (event.type === 'keydown' || event.type === 'keyup') {
      if (event.key) {
        const keyEvent = new KeyboardEvent(event.type, {
          view: window,
          bubbles: true,
          cancelable: true,
          key: event.key,
          code: event.code || '',
        });
        
        // Try to dispatch on active element first
        if (document.activeElement) {
          document.activeElement.dispatchEvent(keyEvent);
        } else {
          document.dispatchEvent(keyEvent);
        }
      }
    }
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    this.stopScreenShare();
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach(track => track.stop());
      this.remoteStream = null;
    }
    // Remove message handler
    if ((this as any)._messageHandler) {
      this.ws.removeEventListener('message', (this as any)._messageHandler);
    }
  }
}
