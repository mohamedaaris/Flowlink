import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import RemoteDesktopManager from '../services/RemoteDesktopManager';
import { generateDeviceId } from '@shared/utils';
import './RemoteAccess.css';

const WS_URL = 'ws://localhost:8080';

export default function RemoteAccess() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<string>('Connecting...');
  const [error, setError] = useState<string | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const remoteDesktopManagerRef = useRef<RemoteDesktopManager | null>(null);
  // Get device ID from session storage or generate new one
  const getOrCreateDeviceId = (): string => {
    const stored = sessionStorage.getItem('deviceId');
    if (stored) return stored;
    const newId = generateDeviceId();
    sessionStorage.setItem('deviceId', newId);
    return newId;
  };
  
  const deviceIdRef = useRef<string>(getOrCreateDeviceId());

  useEffect(() => {
    if (!deviceId) {
      setError('No device ID provided');
      return;
    }

    // Connect to WebSocket and set up remote desktop viewer
    const connect = async () => {
      try {
        setStatus('Connecting to session...');
        
        // Get session info from localStorage or URL params
        const sessionCode = sessionStorage.getItem('sessionCode');
        const sessionId = sessionStorage.getItem('sessionId');
        
        if (!sessionCode || !sessionId) {
          setError('Not in a session. Please join a session first.');
          return;
        }

        // Connect WebSocket
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          setStatus('Requesting screen share...');
          
          // Join session
          ws.send(JSON.stringify({
            type: 'session_join',
            payload: {
              code: sessionCode,
              deviceId: deviceIdRef.current,
              deviceName: 'Viewer',
              deviceType: 'laptop',
            },
            timestamp: Date.now(),
          }));

          // Set up RemoteDesktopManager as viewer
          const manager = new RemoteDesktopManager(
            ws,
            sessionId,
            deviceId, // source device (the one sharing screen)
            deviceIdRef.current, // viewer device (this device)
            false // isSource = false (we're the viewer)
          );
          
          remoteDesktopManagerRef.current = manager;

          // Set up remote stream handler
          manager.setOnRemoteStream((stream) => {
            setRemoteStream(stream);
            setStatus('Connected');
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
            }
          });

          manager.setOnConnectionStateChange((state) => {
            if (state === 'connected') {
              setStatus('Connected');
            } else if (state === 'disconnected' || state === 'failed') {
              setError('Connection lost');
            }
          });

          // Connect as viewer (will wait for offer from source)
          manager.connectAsViewer();
        };

        ws.onerror = (err) => {
          console.error('WebSocket error:', err);
          setError('Failed to connect to server');
        };

        ws.onclose = () => {
          setStatus('Disconnected');
        };

      } catch (err) {
        console.error('Failed to connect:', err);
        setError('Failed to start remote access: ' + (err instanceof Error ? err.message : 'Unknown error'));
      }
    };

    connect();

    return () => {
      // Cleanup
      if (remoteDesktopManagerRef.current) {
        remoteDesktopManagerRef.current.cleanup();
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [deviceId]);

  return (
    <div className="remote-access-container">
      <div className="remote-access-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <h2>Remote Access</h2>
      </div>

      <div className="remote-access-content">
        {error ? (
          <div className="remote-access-error">
            <h3>Remote Access Error</h3>
            <p>{error}</p>
            <button className="back-button" onClick={() => navigate(-1)}>
              Go Back
            </button>
          </div>
        ) : remoteStream ? (
          <div className="remote-access-viewer">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              style={{
                width: '100%',
                height: 'auto',
                maxHeight: '80vh',
                backgroundColor: '#000',
              }}
            />
            <div className="remote-access-controls">
              <p>{status}</p>
              <button onClick={() => navigate(-1)}>Close</button>
            </div>
          </div>
        ) : (
          <div className="remote-access-loading">
            <div className="spinner"></div>
            <p>{status}</p>
            <p className="hint">Waiting for source device to start screen sharing...</p>
          </div>
        )}
      </div>
    </div>
  );
}
