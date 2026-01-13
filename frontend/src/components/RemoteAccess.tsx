import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './RemoteAccess.css';

export default function RemoteAccess() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<string>('Connecting...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!deviceId) {
      setError('No device ID provided');
      return;
    }

    // Simulate remote access connection
    // In a real implementation, this would establish a WebRTC connection
    // or use another protocol to access the remote device
    const timer = setTimeout(() => {
      setStatus('Remote access feature is being implemented');
      setError('Remote desktop access requires additional setup. This feature allows you to view and control your laptop from your mobile device or another laptop.');
    }, 1000);

    return () => clearTimeout(timer);
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
            <h3>Remote Access Setup</h3>
            <p>{error}</p>
            <div className="remote-access-info">
              <h4>How Remote Access Works:</h4>
              <ul>
                <li>Enable "Remote Access" permission on the target device</li>
                <li>This allows you to view and control the device remotely</li>
                <li>Uses secure WebRTC connection for screen sharing</li>
                <li>Requires both devices to be in the same session</li>
              </ul>
              <p className="note">
                <strong>Note:</strong> Full remote desktop functionality requires additional implementation 
                including screen capture, input forwarding, and WebRTC data channels.
              </p>
            </div>
          </div>
        ) : (
          <div className="remote-access-loading">
            <div className="spinner"></div>
            <p>{status}</p>
          </div>
        )}
      </div>
    </div>
  );
}
