import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import SessionManager from './components/SessionManager';
import DeviceTiles from './components/DeviceTiles';
import RemoteAccess from './components/RemoteAccess';
import { Session } from '@shared/types';
import { generateDeviceId } from '@shared/utils';
import './App.css';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [deviceId] = useState(() => generateDeviceId());
  const [deviceName] = useState(() => {
    // Try to get device name from browser
    return (navigator as any).userAgentData?.platform || 'Laptop';
  });

  return (
    <BrowserRouter>
      <div className="app">
        <header className="app-header">
          <h1>FlowLink</h1>
          <p>Cross-Device Continuity</p>
        </header>

        <main className="app-main">
          <Routes>
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
                    onSessionCreated={setSession}
                    onSessionJoined={setSession}
                  />
                ) : (
                  <DeviceTiles
                    session={session}
                    deviceId={deviceId}
                    deviceName={deviceName}
                    deviceType="laptop"
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

