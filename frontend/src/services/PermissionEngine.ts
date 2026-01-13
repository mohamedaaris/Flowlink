import { PermissionType, PermissionSet, Device } from '@shared/types';

/**
 * Permission Engine
 * 
 * Manages fine-grained permissions for device access:
 * - Request/grant/deny flow
 * - Visual indicators
 * - Auto-revoke on session expiry
 * - Read-only defaults
 */
export default class PermissionEngine {
  private devicePermissions: Map<string, PermissionSet> = new Map();
  private permissionCallbacks: Map<string, (granted: boolean) => void> = new Map();

  /**
   * Request permission from a device
   */
  async requestPermission(
    deviceId: string,
    permissionType: PermissionType,
    reason?: string
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const requestId = `${deviceId}-${permissionType}-${Date.now()}`;
      
      // Store callback
      this.permissionCallbacks.set(requestId, resolve);

      // Show permission request UI
      this.showPermissionRequest(deviceId, permissionType, reason, requestId);
    });
  }

  /**
   * Show permission request UI
   */
  private showPermissionRequest(
    deviceId: string,
    permissionType: PermissionType,
    reason: string | undefined,
    requestId: string
  ): void {
    const permissionLabels: Record<PermissionType, string> = {
      files: 'File Access',
      media: 'Media Access',
      prompts: 'Prompt Injection',
      clipboard: 'Clipboard Sync',
      remote_browse: 'Remote File Browse',
    };

    const message = reason
      ? `${reason}\n\nAllow ${permissionLabels[permissionType]}?`
      : `Allow ${permissionLabels[permissionType]}?`;

    const granted = window.confirm(message);

    // Resolve callback
    const callback = this.permissionCallbacks.get(requestId);
    if (callback) {
      callback(granted);
      this.permissionCallbacks.delete(requestId);
    }

    // Update permissions if granted
    if (granted) {
      this.grantPermission(deviceId, permissionType);
    }
  }

  /**
   * Grant permission
   */
  grantPermission(deviceId: string, permissionType: PermissionType): void {
    const permissions = this.devicePermissions.get(deviceId) || {
      files: false,
      media: false,
      prompts: false,
      clipboard: false,
      remote_browse: false,
    };

    permissions[permissionType] = true;
    this.devicePermissions.set(deviceId, permissions);

    // Dispatch event for UI updates
    window.dispatchEvent(new CustomEvent('permission_changed', {
      detail: {
        deviceId,
        permissionType,
        granted: true,
      },
    }));
  }

  /**
   * Revoke permission
   */
  revokePermission(deviceId: string, permissionType: PermissionType): void {
    const permissions = this.devicePermissions.get(deviceId);
    if (permissions) {
      permissions[permissionType] = false;
      this.devicePermissions.set(deviceId, permissions);

      // Dispatch event for UI updates
      window.dispatchEvent(new CustomEvent('permission_changed', {
        detail: {
          deviceId,
          permissionType,
          granted: false,
        },
      }));
    }
  }

  /**
   * Check if permission is granted
   */
  hasPermission(deviceId: string, permissionType: PermissionType): boolean {
    const permissions = this.devicePermissions.get(deviceId);
    return permissions?.[permissionType] || false;
  }

  /**
   * Get all permissions for a device
   */
  getPermissions(deviceId: string): PermissionSet {
    return this.devicePermissions.get(deviceId) || {
      files: false,
      media: false,
      prompts: false,
      clipboard: false,
      remote_browse: false,
    };
  }

  /**
   * Set permissions for a device
   */
  setPermissions(deviceId: string, permissions: PermissionSet): void {
    this.devicePermissions.set(deviceId, permissions);

    // Dispatch event for UI updates
    window.dispatchEvent(new CustomEvent('permissions_updated', {
      detail: {
        deviceId,
        permissions,
      },
    }));
  }

  /**
   * Revoke all permissions for a device
   */
  revokeAllPermissions(deviceId: string): void {
    this.devicePermissions.delete(deviceId);

    window.dispatchEvent(new CustomEvent('permissions_revoked', {
      detail: { deviceId },
    }));
  }

  /**
   * Revoke all permissions (e.g., on session expiry)
   */
  revokeAll(): void {
    this.devicePermissions.clear();
    this.permissionCallbacks.clear();

    window.dispatchEvent(new CustomEvent('all_permissions_revoked'));
  }

  /**
   * Get permission label
   */
  getPermissionLabel(permissionType: PermissionType): string {
    const labels: Record<PermissionType, string> = {
      files: 'Files',
      media: 'Media',
      prompts: 'Prompts',
      clipboard: 'Clipboard',
      remote_browse: 'Browse',
    };
    return labels[permissionType];
  }

  /**
   * Get permission description
   */
  getPermissionDescription(permissionType: PermissionType): string {
    const descriptions: Record<PermissionType, string> = {
      files: 'Send and receive files',
      media: 'Continue media playback',
      prompts: 'Send prompts and commands',
      clipboard: 'Sync clipboard content',
      remote_browse: 'Browse remote filesystem',
    };
    return descriptions[permissionType];
  }
}

