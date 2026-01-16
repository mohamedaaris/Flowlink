import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';

// Session utilities (inline for Node.js compatibility)
function generateSessionCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function isSessionExpired(expiresAt) {
  return Date.now() > expiresAt;
}

const SESSION_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

/**
 * FlowLink Backend Server
 * 
 * Responsibilities:
 * - Session creation and management
 * - Device connection tracking
 * - WebRTC signaling (offer/answer/ICE candidates)
 * - Session expiry
 * 
 * Does NOT:
 * - Store or transfer files
 * - Access device data
 * - Maintain persistent connections
 */

const PORT = process.env.PORT || 8080;

// In-memory session store (for MVP)
// In production, use Redis or similar
const sessions = new Map();

// WebSocket connections by device ID
const deviceConnections = new Map();

const wss = new WebSocketServer({ port: PORT });

console.log(`FlowLink backend server running on ws://localhost:${PORT}`);

wss.on('connection', (ws, req) => {
  let deviceId = null;
  let sessionId = null;

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'session_create':
          handleSessionCreate(ws, message);
          break;
          
        case 'session_join':
          handleSessionJoin(ws, message);
          break;
          
        case 'session_leave':
          handleSessionLeave(ws, message);
          break;
          
        case 'webrtc_offer':
        case 'webrtc_answer':
        case 'webrtc_ice_candidate':
          handleWebRTCSignal(ws, message);
          break;
          
        case 'device_status_update':
          handleDeviceStatusUpdate(ws, message);
          break;
          
        case 'intent_send':
          handleIntentSend(ws, message);
          break;
          
        case 'clipboard_broadcast':
          handleClipboardBroadcast(ws, message);
          break;
          
        case 'group_create':
          handleGroupCreate(ws, message);
          break;
          
        case 'group_update':
          handleGroupUpdate(ws, message);
          break;
          
        case 'group_delete':
          handleGroupDelete(ws, message);
          break;
          
        case 'group_broadcast':
          handleGroupBroadcast(ws, message);
          break;
          
        default:
          sendError(ws, `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      sendError(ws, 'Invalid message format');
    }
  });

  ws.on('close', () => {
    if (deviceId && sessionId) {
      handleDeviceDisconnect(deviceId, sessionId);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  // Helper to send message
  function sendMessage(type, payload) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({
        type,
        sessionId,
        deviceId,
        payload,
        timestamp: Date.now()
      }));
    }
  }

  function sendError(ws, errorMessage) {
    sendMessage('error', { message: errorMessage });
  }
});

/**
 * Handle session creation
 */
function handleSessionCreate(ws, message) {
  const { deviceId, deviceName, deviceType } = message.payload;
  
  if (!deviceId || !deviceName || !deviceType) {
    sendError(ws, 'Missing required fields: deviceId, deviceName, deviceType');
    return;
  }

  // Generate session
  const sessionId = uuidv4();
  const code = generateSessionCode();
  const now = Date.now();
  
  const session = {
    id: sessionId,
    code,
    createdBy: deviceId,
    createdAt: now,
    expiresAt: now + SESSION_EXPIRY_MS,
    devices: new Map(),
    groups: new Map() // Initialize groups
  };

  // Add creator device
  const device = {
    id: deviceId,
    name: deviceName,
    type: deviceType,
    online: true,
    permissions: {
      files: false,
      media: false,
      prompts: false,
      clipboard: false,
      remote_browse: false
    },
    joinedAt: now,
    lastSeen: now
  };

  session.devices.set(deviceId, device);
  sessions.set(sessionId, session);
  deviceConnections.set(deviceId, ws);

  // Store device info on WebSocket
  ws.deviceId = deviceId;
  ws.sessionId = sessionId;

  // Send confirmation
  ws.send(JSON.stringify({
    type: 'session_created',
    sessionId,
    deviceId,
    payload: {
      sessionId,
      code,
      expiresAt: session.expiresAt
    },
    timestamp: Date.now()
  }));

  console.log(`Session created: ${sessionId} (code: ${code}) by device ${deviceId}`);
}

/**
 * Handle session join
 */
function handleSessionJoin(ws, message) {
  const { code, deviceId, deviceName, deviceType } = message.payload;
  
  if (!code || !deviceId || !deviceName || !deviceType) {
    sendError(ws, 'Missing required fields: code, deviceId, deviceName, deviceType');
    return;
  }

  // Find session by code
  let session = null;
  for (const [sid, s] of sessions.entries()) {
    if (s.code === code) {
      session = s;
      break;
    }
  }

  if (!session) {
    sendError(ws, 'Invalid session code');
    return;
  }

  // Check expiry
  if (isSessionExpired(session.expiresAt)) {
    sessions.delete(session.id);
    // For clients, an expired session should behave the same as an
    // unknown/non-existent session. Always report it as an invalid
    // code so users don’t get confused by old/unused codes.
    sendError(ws, 'Invalid session code');
    return;
  }

  // If device already in session, just update connection and send current state
  if (session.devices.has(deviceId)) {
    const existingDevice = session.devices.get(deviceId);
    existingDevice.online = true;
    existingDevice.lastSeen = Date.now();
    deviceConnections.set(deviceId, ws);
    ws.deviceId = deviceId;
    ws.sessionId = session.id;
    
    // Send current session state
    ws.send(JSON.stringify({
      type: 'session_joined',
      sessionId: session.id,
      deviceId,
      payload: {
        sessionId: session.id,
        devices: Array.from(session.devices.values()).map(d => ({
          id: d.id,
          name: d.name,
          type: d.type,
          online: d.online,
          permissions: d.permissions,
          joinedAt: d.joinedAt
        })),
        groups: Array.from(session.groups.values())
      },
      timestamp: Date.now()
    }));

    // Also notify all OTHER devices that this device is (back) online so
    // their UIs (e.g. laptop DeviceTiles) can recreate the tile.
    broadcastToSession(session.id, {
      type: 'device_connected',
      sessionId: session.id,
      payload: {
        device: {
          id: existingDevice.id,
          name: existingDevice.name,
          type: existingDevice.type,
          online: true,
          permissions: existingDevice.permissions,
          joinedAt: existingDevice.joinedAt
        }
      },
      timestamp: Date.now()
    }, deviceId);

    console.log(`Device ${deviceId} reconnected to session ${session.id}`);
    return;
  }

  // Add device to session
  const device = {
    id: deviceId,
    name: deviceName,
    type: deviceType,
    online: true,
    permissions: {
      files: false,
      media: false,
      prompts: false,
      clipboard: false,
      remote_browse: false
    },
    joinedAt: Date.now(),
    lastSeen: Date.now()
  };

  session.devices.set(deviceId, device);
  deviceConnections.set(deviceId, ws);

  // Store device info on WebSocket
  ws.deviceId = deviceId;
  ws.sessionId = session.id;

  // Notify all devices in session
  console.log(`Broadcasting device_connected for device ${deviceId} to session ${session.id}`);
  console.log(`Session has ${session.devices.size} devices`);
  broadcastToSession(session.id, {
    type: 'device_connected',
    sessionId: session.id,
    payload: {
      device: {
        id: device.id,
        name: device.name,
        type: device.type,
        online: true,
        permissions: device.permissions,
        joinedAt: device.joinedAt
      }
    },
    timestamp: Date.now()
  });

  // Send join confirmation to new device
  ws.send(JSON.stringify({
    type: 'session_joined',
    sessionId: session.id,
    deviceId,
    payload: {
      sessionId: session.id,
      devices: Array.from(session.devices.values()).map(d => ({
        id: d.id,
        name: d.name,
        type: d.type,
        online: d.online,
        permissions: d.permissions,
        joinedAt: d.joinedAt
      })),
      groups: Array.from(session.groups.values())
    },
    timestamp: Date.now()
  }));

  console.log(`Device ${deviceId} joined session ${session.id}`);
}

/**
 * Handle session leave
 */
function handleSessionLeave(ws, message) {
  const { deviceId, sessionId } = message;
  
  if (!deviceId || !sessionId) {
    return;
  }

  handleDeviceDisconnect(deviceId, sessionId);
}

/**
 * Handle device disconnect
 */
function handleDeviceDisconnect(deviceId, sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return;

  const device = session.devices.get(deviceId);
  if (device) {
    device.online = false;
    device.lastSeen = Date.now();

    // If the session creator leaves, expire the entire session for everyone
    if (deviceId === session.createdBy) {
      console.log(`Session owner ${deviceId} left session ${sessionId}, expiring session for all devices`);

      // Notify all devices that the session has ended
      broadcastToSession(sessionId, {
        type: 'session_expired',
        sessionId,
        payload: {},
        timestamp: Date.now()
      });

      // Close all device connections in this session
      for (const [otherDeviceId] of session.devices.entries()) {
        const ws = deviceConnections.get(otherDeviceId);
        if (ws && ws.readyState === ws.OPEN) {
          try {
            ws.close(1000, 'Session owner left');
          } catch {
            // Ignore close errors
          }
        }
        deviceConnections.delete(otherDeviceId);
      }

      sessions.delete(sessionId);
      console.log(`Session ${sessionId} fully cleaned up after owner left`);
      return;
    }

    // Normal device disconnect: notify other devices
    broadcastToSession(sessionId, {
      type: 'device_disconnected',
      sessionId,
      payload: { deviceId },
      timestamp: Date.now()
    }, deviceId);

    deviceConnections.delete(deviceId);
    console.log(`Device ${deviceId} disconnected from session ${sessionId}`);
  }

  // Clean up empty sessions
  const onlineDevices = Array.from(session.devices.values()).filter(d => d.online);
  if (onlineDevices.length === 0) {
    sessions.delete(sessionId);
    console.log(`Session ${sessionId} cleaned up (no devices)`);
  }
}

/**
 * Handle WebRTC signaling (offer/answer/ICE candidates)
 */
function handleWebRTCSignal(ws, message) {
  const { sessionId, deviceId } = message;
  const { toDevice } = message.payload;

  if (!sessionId || !deviceId || !toDevice) {
    sendError(ws, 'Missing required fields for WebRTC signal');
    return;
  }

  const session = sessions.get(sessionId);
  if (!session) {
    sendError(ws, 'Session not found');
    return;
  }

  const targetWs = deviceConnections.get(toDevice);
  if (!targetWs || targetWs.readyState !== targetWs.OPEN) {
    sendError(ws, 'Target device not connected');
    return;
  }

  // Forward signal to target device
  targetWs.send(JSON.stringify({
    type: message.type,
    sessionId,
    deviceId,
    payload: {
      fromDevice: deviceId,
      toDevice,
      data: message.payload.data
    },
    timestamp: Date.now()
  }));
}

/**
 * Handle device status update
 */
function handleDeviceStatusUpdate(ws, message) {
  const { sessionId, deviceId } = message;
  const { online, permissions } = message.payload;

  const session = sessions.get(sessionId);
  if (!session) return;

  const device = session.devices.get(deviceId);
  if (device) {
    if (online !== undefined) device.online = online;
    if (permissions) device.permissions = { ...device.permissions, ...permissions };
    device.lastSeen = Date.now();

    // Broadcast update to other devices
    broadcastToSession(sessionId, {
      type: 'device_status_update',
      sessionId,
      payload: {
        deviceId,
        device: {
          id: device.id,
          name: device.name,
          type: device.type,
          online: device.online,
          permissions: device.permissions,
          lastSeen: device.lastSeen
        }
      },
      timestamp: Date.now()
    }, deviceId);
  }
}

/**
 * Handle intent send (routing)
 */
function handleIntentSend(ws, message) {
  const { sessionId, deviceId } = message;
  const { targetDevice, intent } = message.payload;

  console.log(`handleIntentSend: Device ${deviceId} sending intent ${intent?.intent_type} to ${targetDevice}`);

  if (!targetDevice) {
    console.error('Missing targetDevice in intent_send');
    sendError(ws, 'Missing targetDevice');
    return;
  }

  if (!intent) {
    console.error('Missing intent in intent_send');
    sendError(ws, 'Missing intent');
    return;
  }

  const session = sessions.get(sessionId);
  if (!session) {
    console.error(`Session ${sessionId} not found`);
    sendError(ws, 'Session not found');
    return;
  }

  const targetWs = deviceConnections.get(targetDevice);
  if (!targetWs || targetWs.readyState !== targetWs.OPEN) {
    console.error(`Target device ${targetDevice} not connected or WebSocket not open`);
    sendError(ws, 'Target device not connected');
    return;
  }

  console.log(`Forwarding intent to device ${targetDevice}`);

  // Forward intent to target device
  targetWs.send(JSON.stringify({
    type: 'intent_received',
    sessionId,
    deviceId: targetDevice,
    payload: {
      intent: intent,
      sourceDevice: deviceId
    },
    timestamp: Date.now()
  }));

  // Acknowledge to sender
  ws.send(JSON.stringify({
    type: 'intent_sent',
    sessionId,
    deviceId,
    payload: { targetDevice },
    timestamp: Date.now()
  }));
}

/**
 * Handle clipboard broadcast (universal clipboard sync)
 */
function handleClipboardBroadcast(ws, message) {
  const { sessionId, deviceId } = message;
  const { clipboard } = message.payload;

  console.log(`handleClipboardBroadcast: Device ${deviceId} broadcasting clipboard`);

  const session = sessions.get(sessionId);
  if (!session) {
    console.error(`Session ${sessionId} not found`);
    sendError(ws, 'Session not found');
    return;
  }

  // Broadcast clipboard to all OTHER devices in session
  broadcastToSession(sessionId, {
    type: 'clipboard_sync',
    sessionId,
    payload: {
      clipboard: clipboard
    },
    timestamp: Date.now()
  }, deviceId); // Exclude sender

  console.log(`Clipboard broadcast to all devices in session ${sessionId}`);
}

/**
 * Broadcast message to all devices in session (except sender)
 */
function broadcastToSession(sessionId, message, excludeDeviceId = null) {
  const session = sessions.get(sessionId);
  if (!session) {
    console.log(`broadcastToSession: Session ${sessionId} not found`);
    return;
  }

  console.log(`broadcastToSession: Broadcasting to ${session.devices.size} devices, excluding: ${excludeDeviceId}`);
  for (const [deviceId, device] of session.devices.entries()) {
    if (deviceId === excludeDeviceId || !device.online) {
      console.log(`broadcastToSession: Skipping device ${deviceId} (excluded: ${deviceId === excludeDeviceId}, online: ${device.online})`);
      continue;
    }
    
    const ws = deviceConnections.get(deviceId);
    if (ws && ws.readyState === ws.OPEN) {
      console.log(`broadcastToSession: Sending to device ${deviceId}`);
      ws.send(JSON.stringify(message));
    } else {
      console.log(`broadcastToSession: Device ${deviceId} has no WebSocket or connection not open (state: ${ws?.readyState})`);
    }
  }
}

/**
 * Cleanup expired sessions periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (isSessionExpired(session.expiresAt)) {
      console.log(`Session ${sessionId} expired, cleaning up`);
      
      // Notify all devices
      broadcastToSession(sessionId, {
        type: 'session_expired',
        sessionId,
        payload: {},
        timestamp: now
      });
      
      // Remove all device connections
      for (const deviceId of session.devices.keys()) {
        deviceConnections.delete(deviceId);
      }
      
      sessions.delete(sessionId);
    }
  }
}, 60000); // Check every minute

/**
 * Handle group creation
 */
function handleGroupCreate(ws, message) {
  const { sessionId, deviceId } = message;
  const { name, deviceIds, color } = message.payload;

  console.log(`handleGroupCreate: Device ${deviceId} creating group "${name}" with devices:`, deviceIds);

  if (!name || !deviceIds || !Array.isArray(deviceIds)) {
    sendError(ws, 'Missing required fields: name, deviceIds');
    return;
  }

  const session = sessions.get(sessionId);
  if (!session) {
    sendError(ws, 'Session not found');
    return;
  }

  // Validate all device IDs exist in session
  for (const devId of deviceIds) {
    if (!session.devices.has(devId)) {
      sendError(ws, `Device ${devId} not found in session`);
      return;
    }
  }

  // Create group
  const groupId = uuidv4();
  const group = {
    id: groupId,
    name,
    deviceIds,
    createdBy: deviceId,
    createdAt: Date.now(),
    color: color || generateRandomColor()
  };

  session.groups.set(groupId, group);

  // Broadcast to all devices in session
  broadcastToSession(sessionId, {
    type: 'group_created',
    sessionId,
    payload: { group },
    timestamp: Date.now()
  });

  console.log(`Group ${groupId} created: "${name}" with ${deviceIds.length} devices`);
}

/**
 * Handle group update
 */
function handleGroupUpdate(ws, message) {
  const { sessionId, deviceId } = message;
  const { groupId, name, deviceIds, color } = message.payload;

  console.log(`handleGroupUpdate: Device ${deviceId} updating group ${groupId}`);

  if (!groupId) {
    sendError(ws, 'Missing required field: groupId');
    return;
  }

  const session = sessions.get(sessionId);
  if (!session) {
    sendError(ws, 'Session not found');
    return;
  }

  const group = session.groups.get(groupId);
  if (!group) {
    sendError(ws, 'Group not found');
    return;
  }

  // Update group properties
  if (name) group.name = name;
  if (color) group.color = color;
  if (deviceIds && Array.isArray(deviceIds)) {
    // Validate all device IDs
    for (const devId of deviceIds) {
      if (!session.devices.has(devId)) {
        sendError(ws, `Device ${devId} not found in session`);
        return;
      }
    }
    group.deviceIds = deviceIds;
  }

  // Broadcast update to all devices
  broadcastToSession(sessionId, {
    type: 'group_updated',
    sessionId,
    payload: { group },
    timestamp: Date.now()
  });

  console.log(`Group ${groupId} updated`);
}

/**
 * Handle group deletion
 */
function handleGroupDelete(ws, message) {
  const { sessionId, deviceId } = message;
  const { groupId } = message.payload;

  console.log(`handleGroupDelete: Device ${deviceId} deleting group ${groupId}`);

  if (!groupId) {
    sendError(ws, 'Missing required field: groupId');
    return;
  }

  const session = sessions.get(sessionId);
  if (!session) {
    sendError(ws, 'Session not found');
    return;
  }

  if (!session.groups.has(groupId)) {
    sendError(ws, 'Group not found');
    return;
  }

  session.groups.delete(groupId);

  // Broadcast deletion to all devices
  broadcastToSession(sessionId, {
    type: 'group_deleted',
    sessionId,
    payload: { groupId },
    timestamp: Date.now()
  });

  console.log(`Group ${groupId} deleted`);
}

/**
 * Handle group broadcast (send intent to all devices in group)
 */
function handleGroupBroadcast(ws, message) {
  const { sessionId, deviceId } = message;
  const { groupId, intent } = message.payload;

  console.log(`handleGroupBroadcast: Device ${deviceId} broadcasting to group ${groupId}`);

  if (!groupId || !intent) {
    sendError(ws, 'Missing required fields: groupId, intent');
    return;
  }

  const session = sessions.get(sessionId);
  if (!session) {
    sendError(ws, 'Session not found');
    return;
  }

  const group = session.groups.get(groupId);
  if (!group) {
    sendError(ws, 'Group not found');
    return;
  }

  // Send intent to all devices in group
  let successCount = 0;
  for (const targetDeviceId of group.deviceIds) {
    const targetWs = deviceConnections.get(targetDeviceId);
    if (targetWs && targetWs.readyState === targetWs.OPEN) {
      targetWs.send(JSON.stringify({
        type: 'intent_received',
        sessionId,
        deviceId: targetDeviceId,
        payload: {
          intent: {
            ...intent,
            target_device: targetDeviceId,
            source_device: deviceId
          },
          sourceDevice: deviceId,
          fromGroup: groupId
        },
        timestamp: Date.now()
      }));
      successCount++;
    }
  }

  // Acknowledge to sender
  ws.send(JSON.stringify({
    type: 'group_broadcast_sent',
    sessionId,
    deviceId,
    payload: { 
      groupId,
      devicesReached: successCount,
      totalDevices: group.deviceIds.length
    },
    timestamp: Date.now()
  }));

  console.log(`Group broadcast sent to ${successCount}/${group.deviceIds.length} devices in group ${groupId}`);
}

/**
 * Generate random color for group
 */
function generateRandomColor() {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', 
    '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
    '#F8B739', '#52B788', '#E76F51', '#2A9D8F'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

