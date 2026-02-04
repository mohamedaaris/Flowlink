import { useState } from 'react';
import InvitationService from '../services/InvitationService';
import './InvitationPanel.css';

interface InvitationPanelProps {
  sessionId: string;
  sessionCode: string;
  invitationService: InvitationService | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function InvitationPanel({
  sessionId,
  sessionCode,
  invitationService,
  isOpen,
  onClose,
}: InvitationPanelProps) {
  const [targetUser, setTargetUser] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSendInvitation = async () => {
    if (!targetUser.trim()) {
      alert('Please enter a username or device ID');
      return;
    }

    if (!invitationService) {
      alert('Invitation service not ready');
      return;
    }

    setIsLoading(true);
    try {
      await invitationService.sendInvitation(
        targetUser.trim(),
        sessionId,
        sessionCode,
        message.trim() || undefined
      );
      
      // Clear form
      setTargetUser('');
      setMessage('');
      onClose();
    } catch (error) {
      console.error('Failed to send invitation:', error);
      alert('Failed to send invitation. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBroadcastNearby = async () => {
    if (!invitationService) {
      alert('Invitation service not ready');
      return;
    }

    setIsLoading(true);
    try {
      // Use the global WebSocket
      const ws = (window as any).appWebSocket;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket not connected');
      }

      ws.send(JSON.stringify({
        type: 'nearby_session_broadcast',
        sessionId,
        deviceId: (invitationService as any).deviceId,
        payload: {},
        timestamp: Date.now(),
      }));
      
      invitationService.notificationService.showToast({
        type: 'success',
        title: 'Nearby Broadcast Sent',
        message: 'Nearby devices will be notified about your session',
        duration: 3000,
      });
      
      onClose();
    } catch (error) {
      console.error('Failed to broadcast nearby session:', error);
      alert('Failed to broadcast to nearby devices. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="invitation-panel-overlay">
      <div className="invitation-panel">
        <div className="invitation-panel-header">
          <h2>Invite Others to Join</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="invitation-panel-content">
          <div className="invitation-section">
            <h3>Send Direct Invitation</h3>
            <p>Invite a specific user by their username or device ID</p>
            
            <div className="form-group">
              <label htmlFor="target-user">Username or Device ID</label>
              <input
                id="target-user"
                type="text"
                value={targetUser}
                onChange={(e) => setTargetUser(e.target.value)}
                placeholder="Enter username or device ID"
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="invitation-message">Message (Optional)</label>
              <textarea
                id="invitation-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Add a personal message..."
                rows={3}
                disabled={isLoading}
              />
            </div>

            <button
              className="send-invitation-button"
              onClick={handleSendInvitation}
              disabled={isLoading || !targetUser.trim()}
            >
              {isLoading ? 'Sending...' : 'Send Invitation'}
            </button>
          </div>

          <div className="invitation-divider">
            <span>OR</span>
          </div>

          <div className="invitation-section">
            <h3>Notify Nearby Devices</h3>
            <p>Let nearby FlowLink users know about your session</p>
            
            <button
              className="broadcast-button"
              onClick={handleBroadcastNearby}
              disabled={isLoading}
            >
              {isLoading ? 'Broadcasting...' : 'Notify Nearby Devices'}
            </button>
          </div>

          <div className="invitation-section">
            <h3>Session Code</h3>
            <p>Others can join using this 6-digit code</p>
            
            <div className="session-code-display">
              <span className="session-code">{sessionCode}</span>
              <button
                className="copy-code-button"
                onClick={() => {
                  navigator.clipboard.writeText(sessionCode);
                  if (invitationService) {
                    invitationService.notificationService.showToast({
                      type: 'success',
                      title: 'Code Copied',
                      message: 'Session code copied to clipboard',
                      duration: 2000,
                    });
                  }
                }}
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}