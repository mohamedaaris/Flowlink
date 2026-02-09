import { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Session } from '@shared/types';
import InvitationService from '../services/InvitationService';
import './SessionManager.css';

interface SessionManagerProps {
  deviceId: string;
  deviceName: string;
  deviceType: 'phone' | 'laptop' | 'desktop' | 'tablet';
  username: string;
  invitationService: InvitationService | null;
  onSessionCreated: (session: Session) => void;
  onSessionJoined: (session: Session) => void;
}

export default function SessionManager({
  deviceId,
  deviceName,
  deviceType,
  username,
  onSessionCreated,
  onSessionJoined,
}: SessionManagerProps) {
  const [mode, setMode] = useState<'create' | 'join' | null>(null);
  const [sessionCode, setSessionCode] = useState('');
  const [createdSession, setCreatedSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const joinSessionWithCode = async (code: string) => {
    if (!code || code.length !== 6) {
      setError('Invalid session code');
      return;
    }

    try {
      setError(null);
      
      // Use the App-level WebSocket
      const ws = (window as any).appWebSocket;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        setError('Not connected to server');
        console.error('WebSocket not available for join:', {
          globalWs: (window as any).appWebSocket,
          readyState: ws?.readyState
        });
        return;
      }

      console.log('Joining session with App-level WebSocket');

      ws.send(JSON.stringify({
        type: 'session_join',
        payload: {
          code: code,
          deviceId,
          deviceName,
          deviceType,
          username,
        },
        timestamp: Date.now(),
      }));
    } catch (err) {
      setError('Failed to send session join request');
      console.error('Session join error:', err);
    }
  };

  useEffect(() => {
    // Listen for invitation acceptance events
    const handleJoinFromInvitation = (event: CustomEvent) => {
      const { sessionCode } = event.detail;
      console.log('SessionManager received join invitation event:', sessionCode);
      
      // Join the session directly
      joinSessionWithCode(sessionCode);
    };

    // Listen for session messages from App-level WebSocket
    const handleSessionMessage = (event: CustomEvent) => {
      const { message } = event.detail;
      console.log('SessionManager received session message:', message.type);
      handleWebSocketMessage(message);
    };

    // Add event listeners
    window.addEventListener('joinSessionFromInvitation', handleJoinFromInvitation as EventListener);
    window.addEventListener('sessionMessage', handleSessionMessage as EventListener);

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      window.removeEventListener('joinSessionFromInvitation', handleJoinFromInvitation as EventListener);
      window.removeEventListener('sessionMessage', handleSessionMessage as EventListener);
    };
  }, []);

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
            username: username,
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
        console.log('📥 SessionManager received session_joined');
        console.log('  Payload:', message.payload);
        console.log('  Devices in payload:', message.payload.devices);
        
        const joinedSession: Session = {
          id: message.payload.sessionId,
          code: sessionCode || '',  // Use the code we tried to join with
          createdBy: message.payload.devices[0]?.id || '',
          createdAt: Date.now(),
          expiresAt: Date.now() + 3600000, // 1 hour
          devices: new Map(
            message.payload.devices.map((d: any) => {
              console.log(`  Mapping device: ${d.id} = ${d.name} (${d.type})`);
              return [
                d.id,
                {
                  id: d.id,
                  name: d.name,
                  username: d.username,
                  type: d.type,
                  online: d.online,
                  permissions: d.permissions,
                  joinedAt: d.joinedAt,
                  lastSeen: Date.now(),
                },
              ];
            })
          ),
        };
        
        console.log('  Created session object:');
        console.log('    ID:', joinedSession.id);
        console.log('    Code:', joinedSession.code);
        console.log('    Devices size:', joinedSession.devices.size);
        joinedSession.devices.forEach((d, id) => {
          console.log(`      ${id.substring(0, 8)}...: ${d.name} (${d.type})`);
        });
        
        // Store session info for RemoteAccess component
        sessionStorage.setItem('sessionId', joinedSession.id);
        sessionStorage.setItem('sessionCode', joinedSession.code);
        sessionStorage.setItem('deviceId', deviceId);
        
        console.log('  Calling onSessionJoined...');
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
      
      // Use the App-level WebSocket
      const ws = (window as any).appWebSocket;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        setError('Not connected to server');
        console.error('WebSocket not available for session creation:', {
          globalWs: (window as any).appWebSocket,
          readyState: ws?.readyState
        });
        return;
      }

      console.log('Creating session with App-level WebSocket');

      ws.send(JSON.stringify({
        type: 'session_create',
        payload: {
          deviceId,
          deviceName,
          deviceType,
          username,
        },
        timestamp: Date.now(),
      }));
    } catch (err) {
      setError('Failed to send session create request');
      console.error('Session create error:', err);
    }
  };

  const handleJoinSession = async () => {
    if (!sessionCode || sessionCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    await joinSessionWithCode(sessionCode);
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

