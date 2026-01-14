/**
 * Centralized signaling configuration for FlowLink (Web).
 *
 * IMPORTANT:
 * - Never hardcode localhost in signaling URLs (breaks LAN + devices/emulators).
 * - Configure via Vite env: VITE_SIGNALING_URL (e.g. ws://192.168.0.109:8080)
 */
function getSignalingWsUrl(): string {
  const envUrl = (import.meta as any)?.env?.VITE_SIGNALING_URL as string | undefined;
  // Safe default for this project (LAN signaling server)
  return envUrl || 'ws://192.168.0.109:8080';
}

export const SIGNALING_WS_URL = getSignalingWsUrl();

export const SIGNALING_HTTP_URL = SIGNALING_WS_URL.replace(/^ws:\/\//, 'http://')
  .replace(/^wss:\/\//, 'https://');

