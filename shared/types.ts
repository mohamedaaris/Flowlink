/**
 * Shared TypeScript types for FlowLink
 * Used by frontend and backend
 */

export type DeviceType = 'phone' | 'laptop' | 'desktop' | 'tablet';

export type IntentType = 
  | 'file_handoff'
  | 'media_continuation'
  | 'link_open'
  | 'prompt_injection'
  | 'clipboard_sync'
  | 'remote_access_request';

export type PermissionType = 
  | 'files'
  | 'media'
  | 'prompts'
  | 'clipboard'
  | 'remote_browse';

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  online: boolean;
  permissions: PermissionSet;
  joinedAt: number;
  lastSeen: number;
}

export interface PermissionSet {
  files: boolean;
  media: boolean;
  prompts: boolean;
  clipboard: boolean;
  remote_browse: boolean;
}

export interface Session {
  id: string;
  code: string; // 6-digit code
  createdBy: string; // device ID
  createdAt: number;
  expiresAt: number;
  devices: Map<string, Device>;
  groups?: Map<string, Group>; // Device groups
}

export interface Group {
  id: string;
  name: string;
  deviceIds: string[]; // Array of device IDs in this group
  createdBy: string; // device ID of creator
  createdAt: number;
  color?: string; // Optional color for UI
}

export interface Intent {
  intent_type: IntentType;
  payload: IntentPayload;
  target_device: string;
  source_device: string;
  auto_open: boolean;
  timestamp: number;
}

export interface IntentPayload {
  // File handoff
  file?: {
    name: string;
    size: number;
    type: string;
    data?: ArrayBuffer | Blob | number[];
    path?: string; // For remote file access
  };
  
  // Media continuation
  media?: {
    url: string;
    type: 'video' | 'audio';
    timestamp?: number; // Playback position in seconds
    state?: 'play' | 'pause';
  };
  
  // Link open
  link?: {
    url: string;
    title?: string;
  };
  
  // Prompt injection
  prompt?: {
    text: string;
    context?: string; // Additional context
    target_app?: string; // e.g., 'editor', 'browser'
  };
  
  // Clipboard sync
  clipboard?: {
    text: string;
    html?: string;
  };
  
  // Remote access request
  request?: {
    action: 'start_screen_share' | 'stop_screen_share';
    viewerDeviceId?: string;
  };
}

export interface WebSocketMessage {
  type: MessageType;
  sessionId?: string;
  deviceId?: string;
  payload: any;
  timestamp: number;
}

export type MessageType =
  | 'session_create'
  | 'session_join'
  | 'session_leave'
  | 'session_expired'
  | 'device_connected'
  | 'device_disconnected'
  | 'device_status_update'
  | 'intent_send'
  | 'intent_received'
  | 'intent_accepted'
  | 'intent_rejected'
  | 'file_transfer_request'
  | 'file_transfer_chunk'
  | 'file_transfer_complete'
  | 'file_transfer_cancel'
  | 'webrtc_offer'
  | 'webrtc_answer'
  | 'webrtc_ice_candidate'
  | 'permission_request'
  | 'permission_granted'
  | 'permission_denied'
  | 'group_create'
  | 'group_update'
  | 'group_delete'
  | 'group_broadcast'
  | 'group_created'
  | 'group_updated'
  | 'group_deleted'
  | 'error';

export interface WebRTCSignal {
  type: 'offer' | 'answer' | 'ice-candidate';
  sessionId: string;
  fromDevice: string;
  toDevice: string;
  data: RTCSessionDescriptionInit | RTCIceCandidateInit;
}

