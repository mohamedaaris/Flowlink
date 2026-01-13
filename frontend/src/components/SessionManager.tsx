import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Session } from '@shared/types';
import './SessionManager.css';

interface SessionManagerProps {
  deviceId: string;
  deviceName: string;
  deviceType: 'phone' | 'laptop' | 'desktop' | 'tablet';
  onSessionCreated: (session: Session) => void;
  onSessionJoined: (session: Session) => void;
}

const WS_URL = 'ws://localhost:8080';

export default function SessionManager({
  deviceId,
  deviceName,
  deviceType,
  onSessionCreated,
  onSessionJoined,
}: SessionManagerProps) {
  const [mode, setMode] = useState<'create' | 'join' | null>(null);
  const [sessionCode, setSessionCode] = useState('');
  const [createdSession, setCreatedSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const connectWebSocket = (): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(WS_URL);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        resolve(ws);
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };
      
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
      };
    });
  };

  const handleWebSocketMessage = (message: any) => {
    switch (message.type) {
      case 'session_created':
        const session: Session = {
          id: message.payload.sessionId,
          code: message.payload.code,
          createdBy: deviceId,
          createdAt: Date.now(),
          expiresAt: message.payload.expiresAt,
          devices: new Map([[deviceId, {
            id: deviceId,
            name: deviceName,
            type: deviceType,
            online: true,
            permissions: {
              files: false,
              media: false,
              prompts: false,
              clipboard: false,
              remote_browse: false,
            },
            joinedAt: Date.now(),
            lastSeen: Date.now(),
          }]]),
        };
        // Store session info for RemoteAccess component
        sessionStorage.setItem('sessionId', session.id);
        sessionStorage.setItem('sessionCode', session.code);
        sessionStorage.setItem('deviceId', deviceId);
        setCreatedSession(session);
        // Switch to DeviceTiles view immediately so we can receive device_connected messages
        onSessionCreated(session);
        break;

      case 'session_joined':
        const joinedSession: Session = {
          id: message.payload.sessionId,
          code: createdSession?.code || '',
          createdBy: message.payload.devices[0]?.id || '',
          createdAt: Date.now(),
          expiresAt: Date.now() + 3600000, // 1 hour
          devices: new Map(
            message.payload.devices.map((d: any) => [
              d.id,
              {
                id: d.id,
                name: d.name,
                type: d.type,
                online: d.online,
                permissions: d.permissions,
                joinedAt: d.joinedAt,
                lastSeen: Date.now(),
              },
            ])
          ),
        };
        // Store session info for RemoteAccess component
        sessionStorage.setItem('sessionId', joinedSession.id);
        sessionStorage.setItem('sessionCode', joinedSession.code);
        sessionStorage.setItem('deviceId', deviceId);
        onSessionJoined(joinedSession);
        break;

      case 'error':
        setError(message.payload.message);
        break;
    }
  };

  const handleCreateSession = async () => {
    try {
      setError(null);
      const ws = await connectWebSocket();
      wsRef.current = ws;

      ws.send(JSON.stringify({
        type: 'session_create',
        payload: {
          deviceId,
          deviceName,
          deviceType,
        },
        timestamp: Date.now(),
      }));
    } catch (err) {
      setError('Failed to connect to server');
      console.error(err);
    }
  };

  const handleJoinSession = async () => {
    if (!sessionCode || sessionCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    try {
      setError(null);
      const ws = await connectWebSocket();
      wsRef.current = ws;

      ws.send(JSON.stringify({
        type: 'session_join',
        payload: {
          code: sessionCode,
          deviceId,
          deviceName,
          deviceType,
        },
        timestamp: Date.now(),
      }));
    } catch (err) {
      setError('Failed to connect to server');
      console.error(err);
    }
  };

  if (createdSession) {
    return (
      <div className="session-created">
        <h2>Session Created</h2>
        <p>Share this QR code or code with another device:</p>
        <div className="qr-container">
          <QRCodeSVG value={createdSession.code} size={256} />
        </div>
        <div className="session-code-display">
          <span className="code-label">Session Code:</span>
          <span className="code-value">{createdSession.code}</span>
        </div>
        <p className="expiry-info">
          Expires in 1 hour
        </p>
        <button
          className="btn btn-secondary"
          onClick={() => {
            setCreatedSession(null);
            setMode(null);
            if (wsRef.current) {
              wsRef.current.close();
            }
          }}
        >
          Cancel
        </button>
      </div>
    );
  }

  if (mode === null) {
    return (
      <div className="session-manager">
        <div className="session-options">
          <button className="btn btn-primary" onClick={() => setMode('create')}>
            Create Session
          </button>
          <button className="btn btn-primary" onClick={() => setMode('join')}>
            Join Session
          </button>
        </div>
        {error && <div className="error-message">{error}</div>}
      </div>
    );
  }

  if (mode === 'create') {
    return (
      <div className="session-manager">
        <h2>Create New Session</h2>
        <p>Click below to create a session and generate a QR code.</p>
        <button className="btn btn-primary" onClick={handleCreateSession}>
          Create Session
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => {
            setMode(null);
            setError(null);
          }}
        >
          Back
        </button>
        {error && <div className="error-message">{error}</div>}
      </div>
    );
  }

  if (mode === 'join') {
    return (
      <div className="session-manager">
        <h2>Join Session</h2>
        <p>Enter the 6-digit session code:</p>
        <input
          type="text"
          className="code-input"
          value={sessionCode}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, '').slice(0, 6);
            setSessionCode(value);
          }}
          placeholder="000000"
          maxLength={6}
        />
        <div className="button-group">
          <button className="btn btn-primary" onClick={handleJoinSession}>
            Join
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setMode(null);
              setSessionCode('');
              setError(null);
            }}
          >
            Back
          </button>
        </div>
        {error && <div className="error-message">{error}</div>}
      </div>
    );
  }

  return null;
}

