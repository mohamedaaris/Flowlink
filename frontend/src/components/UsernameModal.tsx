import { useState, useEffect } from 'react';
import './UsernameModal.css';

interface UsernameModalProps {
  isOpen: boolean;
  onSubmit: (username: string) => void;
  deviceName: string;
}

export default function UsernameModal({ isOpen, onSubmit, deviceName }: UsernameModalProps) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Check if username is already stored
    const storedUsername = localStorage.getItem('flowlink_username');
    if (storedUsername) {
      onSubmit(storedUsername);
    }
  }, [onSubmit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim()) {
      setError('Username is required');
      return;
    }

    if (username.trim().length < 2) {
      setError('Username must be at least 2 characters');
      return;
    }

    if (username.trim().length > 20) {
      setError('Username must be less than 20 characters');
      return;
    }

    // Store username persistently
    localStorage.setItem('flowlink_username', username.trim());
    onSubmit(username.trim());
  };

  if (!isOpen) return null;

  return (
    <div className="username-modal-overlay">
      <div className="username-modal">
        <div className="username-modal-header">
          <h2>Welcome to FlowLink!</h2>
          <p>Please enter your username to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="username-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError('');
              }}
              placeholder="Enter your username"
              autoFocus
              maxLength={20}
            />
            {error && <span className="error-message">{error}</span>}
          </div>

          <div className="device-info">
            <p>Device: <strong>{deviceName}</strong></p>
          </div>

          <button type="submit" className="submit-button">
            Continue
          </button>
        </form>

        <div className="username-modal-footer">
          <p>Your username will be visible to other devices in your session</p>
        </div>
      </div>
    </div>
  );
}