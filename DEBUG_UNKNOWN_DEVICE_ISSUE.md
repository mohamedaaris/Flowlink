# Debug Guide: "Unknown Device" Issue in Mobile-Created Sessions

## Problem Statement
When a session is created from mobile and the laptop joins, tapping the device tile on mobile to send clipboard content shows "Unknown Device" in the permission dialog on the laptop, instead of showing the mobile device name.

## What Works
- ✅ Session created from laptop → Mobile joins → Mobile sends clipboard → Works perfectly
- ✅ The intent IS being sent and received
- ✅ The permission dialog IS showing
- ❌ The mobile device name is NOT showing (shows "Unknown Device" instead)

## Root Cause Hypothesis
The mobile device is not in the laptop's `devices` map when the intent arrives. This could be because:
1. The `session_joined` message doesn't include the mobile device
2. The devices map isn't being initialized correctly from the session prop
3. There's a device ID mismatch between what mobile sends and what's in the map
4. There's a timing issue where the intent arrives before the devices map is populated

## Debugging Steps

### Step 1: Test Mobile-Created Session
1. **On Mobile**:
   - Open the FlowLink app
   - Tap "Create Session"
   - Note the 6-digit code

2. **On Laptop**:
   - Open browser DevTools (F12)
   - Go to Console tab
   - Clear console
   - Enter the 6-digit code to join session

3. **Check Console Logs**:
   Look for these logs in order:

   ```
   📥 SessionManager received session_joined
     Payload: {...}
     Devices in payload: [...]
     Mapping device: <mobile-device-id> = <mobile-device-name> (phone)
     Created session object:
       ID: <session-id>
       Code: <6-digit-code>
       Devices size: 2  <-- Should be 2 (mobile + laptop)
         <mobile-id>...: <mobile-name> (phone)
         <laptop-id>...: <laptop-name> (laptop)
     Calling onSessionJoined...
   
   🚀 DeviceTiles initializing
     Session ID: <session-id>
     Session code: <6-digit-code>
     Session createdBy: <mobile-device-id>
     Session devices size: 2  <-- Should be 2
     Current deviceId (self): <laptop-device-id>
     Device in session: <mobile-id> = <mobile-name> (phone)
       ✅ Adding to initial map
     Device in session: <laptop-id> = <laptop-name> (laptop)
       ⏭️ Skipping (self)
     Initial devices map size: 1  <-- Should be 1 (only mobile, laptop excluded)
     Initial devices: [<mobile-id>...: <mobile-name>]
   ```

### Step 2: Send Clipboard from Mobile
1. **On Mobile**:
   - Copy a URL (e.g., https://google.com)
   - Tap the laptop device tile

2. **Check Android Logs**:
   ```bash
   adb logcat | grep FlowLink
   ```
   
   Look for:
   ```
   Sending intent link_open to <laptop-device-id> with sessionId: <session-id>
   Intent message: {"type":"intent_send","sessionId":"<session-id>",...}
   ```

3. **Check Laptop Console**:
   Look for:
   ```
   📨 Incoming intent
     Intent type: link_open
     Source device ID: <mobile-device-id>
     Current devices map size: 1
     Devices in map: [<mobile-id>...: <mobile-name>]
   
   🔐 Requesting permission
     Source device ID: <mobile-device-id>
     Looking up in devices map...
     Device found: <mobile-name> (phone)  <-- Should show device name, NOT "NOT FOUND ❌"
   ```

### Step 3: Analyze Results

#### Scenario A: Device Found
If logs show `Device found: <mobile-name> (phone)`, but dialog still shows "Unknown Device":
- **Issue**: The `getPermissionMessage` function is not using the device name correctly
- **Fix**: Check the `getPermissionMessage` function implementation

#### Scenario B: Device Not Found
If logs show `Device found: NOT FOUND ❌`:
- **Issue**: Device ID mismatch
- **Action**: Compare the device IDs:
  1. Device ID in session: `<mobile-id>` (from Step 1)
  2. Source device ID in intent: `<mobile-device-id>` (from Step 2)
  3. If they don't match, there's a device ID generation/storage issue

#### Scenario C: Devices Map Empty
If logs show `Initial devices map size: 0`:
- **Issue**: Session doesn't include mobile device
- **Action**: Check SessionManager logs to see if mobile device was in the `session_joined` payload

#### Scenario D: Session Devices Size is 1
If logs show `Session devices size: 1` (only laptop):
- **Issue**: Backend didn't include mobile device in `session_joined` response
- **Action**: Check backend logs for the `session_join` handler

## Common Issues and Fixes

### Issue 1: Device ID Mismatch
**Symptom**: Source device ID doesn't match any device in the map

**Cause**: Mobile app generates a new device ID on each launch, or device ID is not being stored/retrieved correctly

**Fix**: Check `SessionManager.kt` to ensure device ID is persisted in SharedPreferences and retrieved consistently

### Issue 2: Session Code Not Set
**Symptom**: Session code is empty string in DeviceTiles

**Cause**: `SessionManager.tsx` uses `createdSession?.code` which is only set when creating, not joining

**Fix**: Already fixed - now uses `sessionCode` variable instead

### Issue 3: Timing Issue
**Symptom**: Intent arrives before `session_joined` message in DeviceTiles

**Cause**: DeviceTiles creates a new WebSocket connection and sends `session_join` again, but intent arrives during this time

**Fix**: Ensure devices map is initialized from the session prop (already done)

### Issue 4: Backend Not Including Creator Device
**Symptom**: `session_joined` payload only includes the joining device, not the creator

**Cause**: Backend bug in `handleSessionJoin`

**Fix**: Check backend code at line 315-323 to ensure it sends ALL devices:
```javascript
devices: Array.from(session.devices.values()).map(d => ({
  id: d.id,
  name: d.name,
  type: d.type,
  online: d.online,
  permissions: d.permissions,
  joinedAt: d.joinedAt
}))
```

## Files Modified

### Frontend
- `frontend/src/components/DeviceTiles.tsx`
  - Added comprehensive logging in devices map initialization
  - Added logging in `handleIncomingIntent`
  - Added logging in `requestPermission`

- `frontend/src/components/SessionManager.tsx`
  - Added logging in `session_joined` handler
  - Fixed session code to use `sessionCode` variable instead of `createdSession?.code`

### Mobile (No changes yet)
- Waiting for debug results before making changes

## Next Steps

1. **Run the test** following Step 1-3 above
2. **Collect all console logs** from both mobile and laptop
3. **Analyze the logs** using Scenario A-D above
4. **Identify the root cause** based on the analysis
5. **Apply the appropriate fix** from the Common Issues section

## Expected Behavior After Fix

When everything works correctly, the logs should show:
```
SessionManager: Devices size: 2
DeviceTiles: Initial devices map size: 1
Incoming intent: Source device ID matches device in map
Requesting permission: Device found: <mobile-name> (phone)
Permission dialog: "<mobile-name> wants to open a link: https://google.com. Allow?"
```

## Testing Commands

### Rebuild Frontend
```bash
cd frontend
npm run dev
```

### Check Android Logs
```bash
adb logcat | grep FlowLink
```

### Check Backend Logs
Backend logs are in the terminal where you ran `npm start` in the backend directory.
