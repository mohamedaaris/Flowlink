/**
 * Shared utilities
 */

/**
 * Generate a 6-digit session code
 */
export function generateSessionCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Generate a unique device ID
 */
export function generateDeviceId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if session is expired
 */
export function isSessionExpired(expiresAt: number): boolean {
  return Date.now() > expiresAt;
}

/**
 * Default session expiry: 1 hour
 */
export const SESSION_EXPIRY_MS = 60 * 60 * 1000;

/**
 * Default permissions (read-only)
 */
export function getDefaultPermissions() {
  return {
    files: false,
    media: false,
    prompts: false,
    clipboard: false,
    remote_browse: false,
  };
}

