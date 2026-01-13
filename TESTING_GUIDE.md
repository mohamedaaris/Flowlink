# Testing Guide - Drag & Drop & Permissions

## 🔧 Fixes Applied

1. **Fixed drag & drop event propagation** - Added `stopPropagation()` to prevent parent from intercepting drops
2. **Added console logging** - Check browser console (F12) to see what's happening
3. **Fixed permission granting** - Permissions now update when sending AND receiving intents
4. **Fixed CSS z-index** - Device tiles now properly receive drop events

## 📋 Step-by-Step Testing Instructions

### Prerequisites
1. **Backend running**: `cd backend && npm run dev`
2. **Frontend running**: `cd frontend && npm run dev`
3. **Mobile app running** (or second browser window)

### Step 1: Create Session & Connect Devices

1. **Laptop**: Open `http://localhost:5173`
2. Click **"Create Session"**
3. You should see:
   - QR code at the top
   - Session code (e.g., "996215")
   - "Waiting for other devices..." message

4. **Phone/Mobile**: 
   - Scan QR code or enter session code
   - Should show "Connected to session: <id>"

5. **Laptop**: Should now show device tile for your phone

### Step 2: Test Drag & Drop (Files)

1. **Open Browser Console** (F12) on laptop
2. **Drag a file** (any file - image, PDF, text, etc.) from your computer
3. **Drag it over the phone device tile**
   - You should see:
     - Console log: "Drag over device tile: <phone name>"
     - Device tile should highlight (blue border)
     - "Drop here to send" message appears

4. **Drop the file on the device tile**
   - Console should show:
     - "Drop event on device tile: <phone name>"
     - "File detected: <filename>"
     - "Intent created: file_handoff"
     - "Intent routed to device: <device-id>"

5. **Check phone**:
   - Should show permission request dialog
   - Click "OK" to accept
   - File should download

6. **Check laptop**:
   - Device tile should now show **"Files"** badge (not "None")
   - Console should show: "Updated device permissions: {files: true, ...}"

### Step 3: Test Drag & Drop (Text/URL)

1. **Open a website** (e.g., YouTube, Google)
2. **Select the URL** from address bar
3. **Drag URL** to phone device tile
   - Console should show:
     - "Text data: <url>"
     - "Intent created: link_open"

4. **Check phone**: Should open the URL

### Step 4: Test Drag & Drop (Text Prompt)

1. **Type some text** in a text editor or browser
2. **Select and drag** the text to phone device tile
   - Console should show:
     - "Text data: <your text>"
     - "Intent created: prompt_injection"

3. **Check phone**: Should copy to clipboard or show prompt

### Step 5: Test Permissions

1. **Send different types of intents**:
   - File → Should grant "Files" permission
   - Media URL → Should grant "Media" permission
   - Text prompt → Should grant "Prompts" permission

2. **Check device tile**:
   - Permissions should update in real-time
   - Badges should appear: "Files", "Media", "Prompts", etc.
   - "None" should disappear once any permission is granted

## 🐛 Troubleshooting

### Issue: Drag & Drop Not Working

**Check Console (F12)**:
- Do you see "Drag over device tile" when dragging?
- Do you see "Drop event on device tile" when dropping?
- Any error messages?

**Common Fixes**:
1. **Refresh the page** (Ctrl+R or Cmd+R)
2. **Check if device tile is visible** (not hidden or offline)
3. **Try dragging from different sources**:
   - Files from File Explorer
   - Text from browser
   - URLs from address bar

### Issue: Permissions Still Show "None"

**Check Console**:
- Do you see "Granting permission for intent: <type>"?
- Do you see "Updated device permissions: {files: true, ...}"?

**Common Fixes**:
1. **Accept the permission request** on the receiving device
2. **Check backend logs** - should show "device_status_update"
3. **Refresh both devices** to sync state

### Issue: Intent Not Reaching Target Device

**Check Console**:
- Do you see "Intent routed to device: <id>"?
- Any WebSocket errors?

**Check Backend Terminal**:
- Should show "Intent received" or "intent_send" message
- Should show "Broadcasting intent_received"

**Common Fixes**:
1. **Check WebSocket connection** - should be "OPEN"
2. **Check device is online** (green dot on device tile)
3. **Restart backend** if needed

## 📊 Expected Console Output

When drag & drop works correctly, you should see:

```
Drag over device tile: moto g64 5G
Drop event on device tile: moto g64 5G
Files: 1
createIntentFromDrop called
File detected: test.jpg image/jpeg
Intent created: file_handoff
DeviceTile onDrop called with intent: {intent_type: "file_handoff", ...}
Granting permission for intent: file_handoff from device: <your-device-id>
Updated device permissions: {files: true, media: false, prompts: false, clipboard: false, remote_browse: false}
Intent routed to device: <target-device-id>
Intent sent: {intent_type: "file_handoff", ...}
```

## ✅ Success Indicators

1. **Drag & Drop Works**:
   - ✅ Device tile highlights when dragging over
   - ✅ Console shows drop events
   - ✅ Intent is created and routed

2. **Permissions Work**:
   - ✅ Permission badges appear on device tile
   - ✅ "None" disappears after first permission
   - ✅ Console shows permission updates

3. **Intents Work**:
   - ✅ Target device receives intent
   - ✅ Permission dialog appears
   - ✅ Action executes (file downloads, URL opens, etc.)

## 🚨 If Nothing Works

1. **Hard refresh**: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
2. **Clear browser cache**
3. **Restart backend**: Stop (Ctrl+C) and run `npm run dev` again
4. **Restart frontend**: Stop (Ctrl+C) and run `npm run dev` again
5. **Check browser console for errors** (red messages)
6. **Check backend terminal for errors**

## 📝 Notes

- **First drag might be slow** - Browser needs to process the file
- **Large files** might take time to transfer
- **Permissions are per-session** - They reset when you leave/join session
- **Console logs are your friend** - Always check F12 console for debugging
