import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import SessionManager from './components/SessionManager';
import DeviceTiles from './components/DeviceTiles';
import RemoteAccess from './components/RemoteAccess';
import DownloadPage from './components/DownloadPage';
import UsernameModal from './components/UsernameModal';
import { Session } from '@shared/types';
import { generateDeviceId } from '@shared/utils';
import InvitationService from './services/InvitationService';
import { SIGNALING_WS_URL } from './config/signaling';
import './App.css';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [deviceId] = useState(() => generateDeviceId());
  const [deviceName] = useState(() => {
    // Try to get device name from browser
    return (navigator as any).userAgentData?.platform || 'Laptop';
  });
  const [username, setUsername] = useState<string | null>(() => {
    return localStorage.getItem('flowlink_username');
  });
  const [invitationService, setInvitationService] = useState<InvitationService | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Connect to WebSocket for persistent invitation listening
  const connectWebSocket = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return wsRef.current;
    }

    const ws = new WebSocket(SIGNALING_WS_URL);
    
    ws.onopen = () => {
      console.log('App-level WebSocket connected for invitations');
      
      // Register device for invitation listening
      ws.send(JSON.stringify({
        type: 'device_register',
        payload: {
          deviceId,
          deviceName,
          deviceType: 'laptop',
          username,
        },
        timestamp: Date.now(),
      }));
      
      // Store WebSocket reference for components to access
      wsRef.current = ws;
      
      // Make WebSocket globally accessible for components
      (window as any).appWebSocket = ws;
      
      // Set WebSocket for invitation service when it's ready
      if (invitationService) {
        invitationService.setWebSocket(ws);
        console.log('WebSocket set on InvitationService');
      }
    };
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleWebSocketMessage(message);
    };
    
    ws.onclose = () => {
      console.log('App-level WebSocket disconnected');
      wsRef.current = null;
      (window as any).appWebSocket = null;
      // Reconnect after a delay
      setTimeout(connectWebSocket, 2000);
    };
    
    ws.onerror = (error) => {
      console.error('App-level WebSocket error:', error);
    };
    
    wsRef.current = ws;
    return ws;
  };

  // Handle WebSocket messages at App level
  const handleWebSocketMessage = (message: any) => {
    switch (message.type) {
      case 'device_registered':
        console.log('Device registered for invitation listening:', message.payload);
        break;
        
      case 'session_created':
      case 'session_joined':
        // Forward session messages to SessionManager via custom event
        const sessionEvent = new CustomEvent('sessionMessage', {
          detail: { message }
        });
        window.dispatchEvent(sessionEvent);
        break;
        
      case 'session_invitation':
        // Handle incoming session invitation
        console.log('📨 App.tsx received session_invitation:', message);
        const invitation = message.payload.invitation;
        console.log('  Invitation data:', invitation);
        console.log('  InvitationService available:', !!invitationService);
        
        if (invitationService) {
          console.log('  Calling handleIncomingInvitation...');
          invitationService.handleIncomingInvitation(invitation);
          // Store invitation data for potential acceptance
          invitationService.storeInvitationData(invitation.sessionId, invitation.sessionCode);
          console.log('  Invitation handled successfully');
        } else {
          console.error('  InvitationService not available!');
        }
        break;

      case 'nearby_session_broadcast':
        // Handle nearby session notification
        console.log('📨 App.tsx received nearby_session_broadcast:', message);
        const nearbySession = message.payload.nearbySession;
        console.log('  Nearby session data:', nearbySession);
        console.log('  InvitationService available:', !!invitationService);
        
        if (invitationService) {
          console.log('  Calling handleNearbySession...');
          invitationService.handleNearbySession(nearbySession);
          // Store session data for potential joining
          invitationService.storeInvitationData(nearbySession.sessionId, nearbySession.sessionCode);
          console.log('  Nearby session handled successfully');
        } else {
          console.error('  InvitationService not available!');
        }
        break;

      case 'invitation_response':
        // Handle invitation response (accepted/rejected)
        const response = message.payload;
        if (invitationService) {
          if (response.accepted) {
            invitationService.notificationService.showToast({
              type: 'success',
              title: 'Invitation Accepted',
              message: `${response.inviteeUsername} accepted your invitation`,
              duration: 4000,
            });
          } else {
            invitationService.notificationService.showToast({
              type: 'info',
              title: 'Invitation Declined',
              message: `${response.inviteeUsername} declined your invitation`,
              duration: 3000,
            });
          }
        }
        break;

      case 'invitation_sent':
        // Handle invitation sent confirmation
        const sentResponse = message.payload;
        if (invitationService) {
          invitationService.notificationService.showToast({
            type: 'success',
            title: 'Invitation Sent',
            message: `Invitation sent to ${sentResponse.targetUsername || sentResponse.targetIdentifier}`,
            duration: 3000,
          });
        }
        break;
    }
  };

  // Join session programmatically
  const joinSessionWithCode = (sessionCode: string) => {
    console.log('App-level joining session:', sessionCode);
    
    // Clear current session first
    setSession(null);
    
    // Dispatch event to SessionManager to handle the join
    const joinEvent = new CustomEvent('joinSessionFromInvitation', {
      detail: { sessionCode }
    });
    window.dispatchEvent(joinEvent);
  };

  // Initialize invitation service when username is available
  useEffect(() => {
    if (username && !invitationService) {
      const service = new InvitationService(
        deviceId,
        username,
        deviceName,
        (sessionCode) => {
          // Handle invitation acceptance by programmatically joining the session
          console.log('Invitation accepted, joining session:', sessionCode);
          joinSessionWithCode(sessionCode);
        }
      );
      
      // Set WebSocket if already connected
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        service.setWebSocket(wsRef.current);
        console.log('WebSocket set on new InvitationService');
      }
      
      setInvitationService(service);
    }
  }, [username, deviceId, deviceName, invitationService]);

  // Update InvitationService WebSocket when it changes
  useEffect(() => {
    if (invitationService && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      invitationService.setWebSocket(wsRef.current);
      console.log('WebSocket updated on existing InvitationService');
    }
  }, [invitationService, wsRef.current]);

  // Connect WebSocket as soon as we have username
  useEffect(() => {
    if (username) {
      connectWebSocket();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [username]);

  const handleUsernameSubmit = (newUsername: string) => {
    setUsername(newUsername);
  };

  return (
    <BrowserRouter>
      <div className="app">
        <UsernameModal
          isOpen={!username}
          onSubmit={handleUsernameSubmit}
          deviceName={deviceName}
        />

        <header className="app-header">
          <h1>FlowLink</h1>
          <p>Cross-Device Continuity</p>
          {username && (
            <div className="user-info">
              <span>Welcome, {username}</span>
            </div>
          )}
        </header>

        <main className="app-main">
          <Routes>
            <Route
              path="/download"
              element={<DownloadPage />}
            />
            <Route
              path="/remote/:deviceId"
              element={<RemoteAccess />}
            />
            <Route
              path="/"
              element={
                !session ? (
                  <SessionManager
                    deviceId={deviceId}
                    deviceName={deviceName}
                    deviceType="laptop"
                    username={username || ''}
                    invitationService={invitationService}
                    onSessionCreated={setSession}
                    onSessionJoined={setSession}
                  />
                ) : (
                  <DeviceTiles
                    session={session}
                    deviceId={deviceId}
                    deviceName={deviceName}
                    deviceType="laptop"
                    username={username || ''}
                    invitationService={invitationService}
                    onLeaveSession={() => setSession(null)}
                  />
                )
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;

