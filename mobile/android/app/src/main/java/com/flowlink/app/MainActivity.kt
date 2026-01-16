package com.flowlink.app

import android.Manifest
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.lifecycle.lifecycleScope
import com.flowlink.app.BuildConfig
import com.flowlink.app.databinding.ActivityMainBinding
import com.flowlink.app.model.Intent as FlowIntent
import com.flowlink.app.service.SessionManager
import com.flowlink.app.service.WebSocketManager
import com.flowlink.app.ui.DeviceTilesFragment
import com.flowlink.app.ui.SessionCreatedFragment
import com.flowlink.app.ui.SessionManagerFragment
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.io.File

class MainActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding
    lateinit var sessionManager: SessionManager
    lateinit var webSocketManager: WebSocketManager

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted: Boolean ->
        if (isGranted) {
            // Permission granted
        } else {
            Toast.makeText(this, "Camera permission required for QR scanning", Toast.LENGTH_LONG).show()
        }
    }

    private val qrCodeLauncher = registerForActivityResult(ScanContract()) { result ->
        if (result.contents != null) {
            val sessionCode = result.contents
            joinSession(sessionCode)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Initialize managers
        sessionManager = SessionManager(this)
        webSocketManager = WebSocketManager(sessionManager)

        // React to intents received from backend (e.g., links, media, clipboard, files)
        lifecycleScope.launch {
            webSocketManager.receivedIntents.collectLatest { remoteIntent: FlowIntent? ->
                if (remoteIntent != null) {
                    handleRemoteIntent(remoteIntent)
                }
            }
        }

        // React to device connections to update UI
        lifecycleScope.launch {
            webSocketManager.deviceConnected.collectLatest { deviceInfo ->
                deviceInfo?.let {
                    // Update device tiles fragment if it's showing
                    val fragment = supportFragmentManager.findFragmentById(R.id.fragment_container)
                    if (fragment is DeviceTilesFragment) {
                        // Fragment will handle updating its UI
                        android.util.Log.d("FlowLink", "Device connected: ${it.name}")
                    }
                }
            }
        }

        // React to session creation
        lifecycleScope.launch {
            webSocketManager.sessionCreated.collectLatest { event ->
                event?.let {
                    showSessionCreated(it.code, it.sessionId)
                }
            }
        }

        // Check camera permission
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
            != PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissionLauncher.launch(Manifest.permission.CAMERA)
        }

        // Show session manager fragment
        if (savedInstanceState == null) {
            supportFragmentManager.beginTransaction()
                .replace(R.id.fragment_container, SessionManagerFragment())
                .commit()
        }

        // Handle incoming intents (file shares, etc.)
        handleIntent(intent)
    }

    override fun onResume() {
        super.onResume()
        // Check if we have an active session and should show DeviceTiles
        val currentCode = sessionManager.getCurrentSessionCode()
        val currentSessionId = sessionManager.getCurrentSessionId()
        val connectionState = webSocketManager.connectionState.value
        
        android.util.Log.d("FlowLink", "onResume: code=$currentCode, sessionId=$currentSessionId, connectionState=$connectionState")
        
        // If we have a session but are showing SessionManagerFragment, navigate to DeviceTiles
        val currentFragment = supportFragmentManager.findFragmentById(R.id.fragment_container)
        if (currentCode != null && currentSessionId != null && currentFragment is SessionManagerFragment) {
            android.util.Log.d("FlowLink", "Restoring DeviceTiles view for existing session")
            showDeviceTiles(currentSessionId)
        }
        
        // If we have a session but WebSocket is disconnected, reconnect
        if (currentCode != null && 
            (connectionState is WebSocketManager.ConnectionState.Disconnected || 
             connectionState is WebSocketManager.ConnectionState.Error)) {
            android.util.Log.d("FlowLink", "Reconnecting WebSocket on resume with code: $currentCode")
            webSocketManager.connect(currentCode)
        }
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        intent?.let { handleIntent(it) }
    }

    private fun handleIntent(intent: Intent) {
        when (intent.action) {
            Intent.ACTION_VIEW -> {
                // Handle file/view intents from FlowLink
                val uri = intent.data
                if (uri != null) {
                    // Process file intent
                    lifecycleScope.launch {
                        sessionManager.handleIncomingFile(uri)
                    }
                }
            }
        }
    }

    fun createSession() {
        lifecycleScope.launch {
            try {
                // Connect to WebSocket first (with empty code, will send session_create after connection)
                if (webSocketManager.connectionState.value !is WebSocketManager.ConnectionState.Connected) {
                    webSocketManager.connect("") // Empty code for now
                    
                    // Wait a bit for connection to establish
                    kotlinx.coroutines.delay(500)
                }
                
                // Send session_create message to backend
                webSocketManager.sendMessage(org.json.JSONObject().apply {
                    put("type", "session_create")
                    put("payload", org.json.JSONObject().apply {
                        put("deviceId", sessionManager.getDeviceId())
                        put("deviceName", sessionManager.getDeviceName())
                        put("deviceType", sessionManager.getDeviceType())
                    })
                    put("timestamp", System.currentTimeMillis())
                }.toString())
                
                android.util.Log.d("FlowLink", "Sent session_create request")
                // Wait for session_created response (handled in WebSocketManager)
                // The response will trigger showing the QR code fragment
            } catch (e: Exception) {
                android.util.Log.e("FlowLink", "Failed to create session", e)
                Toast.makeText(this@MainActivity, "Failed to create session: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    fun joinSession(code: String) {
        lifecycleScope.launch {
            try {
                // Persist the attempted code locally so intents (if join succeeds)
                // can be routed correctly once we know the real backend sessionId.
                val session = sessionManager.joinSession(code)

                // Connect to backend signaling using the scanned/entered code.
                // WebSocketManager will send session_join on open.
                webSocketManager.connect(code)

                // Wait for backend confirmation or error before navigating.
                webSocketManager.sessionJoinState.collectLatest { state ->
                    when (state) {
                        is WebSocketManager.SessionJoinState.Success -> {
                            // Ensure we have the real sessionId from backend. The
                            // WebSocketManager already updates SessionManager with the
                            // canonical id; we use the id from the event to show tiles.
                            val backendSessionId = state.sessionId.ifEmpty {
                                sessionManager.getCurrentSessionId() ?: session.sessionId
                            }
                            showDeviceTiles(backendSessionId)
                            // Once we navigate, stop collecting to avoid duplicate navigation
                            return@collectLatest
                        }
                        is WebSocketManager.SessionJoinState.Error -> {
                            // Show backend error (e.g., "Invalid session code") and
                            // clear the temporary local session so user can retry.
                            Toast.makeText(
                                this@MainActivity,
                                state.message,
                                Toast.LENGTH_LONG
                            ).show()
                            sessionManager.leaveSession()
                            webSocketManager.disconnect()
                            // Stop collecting after handling error
                            return@collectLatest
                        }
                        else -> {
                            // Idle / InProgress: just keep waiting
                        }
                    }
                }
            } catch (e: Exception) {
                Toast.makeText(this@MainActivity, "Failed to join session: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    fun scanQRCode() {
        val options = ScanOptions()
        options.setDesiredBarcodeFormats(ScanOptions.QR_CODE)
        options.setPrompt("Scan FlowLink QR Code")
        options.setCameraId(0)
        options.setBeepEnabled(false)
        options.setBarcodeImageEnabled(true)
        qrCodeLauncher.launch(options)
    }

    fun showDeviceTiles(sessionId: String) {
        supportFragmentManager.beginTransaction()
            .replace(R.id.fragment_container, DeviceTilesFragment.newInstance(sessionId))
            .addToBackStack(null)
            .commit()
    }

    fun showSessionCreated(code: String, sessionId: String) {
        supportFragmentManager.beginTransaction()
            .replace(R.id.fragment_container, SessionCreatedFragment.newInstance(code, sessionId))
            .addToBackStack(null)
            .commit()
    }

    fun leaveSession() {
        lifecycleScope.launch {
            // Send session_leave message to backend before disconnecting
            val sessionId = sessionManager.getCurrentSessionId()
            if (sessionId != null) {
                webSocketManager.sendMessage(org.json.JSONObject().apply {
                    put("type", "session_leave")
                    put("sessionId", sessionId)
                    put("deviceId", sessionManager.getDeviceId())
                    put("timestamp", System.currentTimeMillis())
                }.toString())
            }
            
            // Disconnect WebSocket
            webSocketManager.disconnect()
            // Clear session
            sessionManager.leaveSession()
            // Always go back to session manager (clear back stack)
            supportFragmentManager.popBackStack(null, androidx.fragment.app.FragmentManager.POP_BACK_STACK_INCLUSIVE)
            supportFragmentManager.beginTransaction()
                .replace(R.id.fragment_container, SessionManagerFragment())
                .commit()
        }
    }

    /**
     * Handle intents coming from other devices via the backend.
     * This is where links/media are opened and clipboard/text or files are applied on the phone.
     */
    private fun handleRemoteIntent(intent: FlowIntent) {
        when (intent.intentType) {
            "link_open" -> {
                val payload = intent.payload ?: return
                val linkJson = payload["link"] ?: return
                try {
                    val url = JSONObject(linkJson).getString("url")
                    val browserIntent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    startActivity(browserIntent)
                } catch (e: Exception) {
                    Toast.makeText(this, "Failed to open link", Toast.LENGTH_SHORT).show()
                }
            }
            "media_continuation" -> {
                val payload = intent.payload ?: return
                val mediaJsonStr = payload["media"] ?: return
                try {
                    // Parse media JSON string
                    val media = JSONObject(mediaJsonStr)
                    val baseUrl = media.optString("url", "")
                    val timestamp = media.optInt("timestamp", 0)
                    val mediaType = media.optString("type", "video")
                    val fileJsonStr = payload["file"]

                    if (fileJsonStr != null) {
                        // Media sent with an attached file (binary data)
                        try {
                            val fileJson = JSONObject(fileJsonStr)
                            // Determine MIME type from media type or file extension
                            val mimeType = when (mediaType) {
                                "video" -> "video/*"
                                "audio" -> "audio/*"
                                else -> media.optString("type", "video/*")
                            }
                            openReceivedFile(fileJson, mimeType)
                        } catch (e: Exception) {
                            android.util.Log.e("FlowLink", "Failed to parse file JSON", e)
                            Toast.makeText(this, "Failed to open media file: ${e.message}", Toast.LENGTH_SHORT).show()
                        }
                        return
                    }
                    
                    // Check if URL is a blob URL (won't work on Android)
                    if (baseUrl.startsWith("blob:")) {
                        android.util.Log.e("FlowLink", "Blob URLs are not supported on Android")
                        Toast.makeText(this, "Media file must be sent as a file, not a URL. Please drag the file directly.", Toast.LENGTH_LONG).show()
                        return
                    }

                    if (baseUrl.isNotEmpty()) {
                        // Build URL with timestamp for media continuation
                        var finalUrl = baseUrl
                        
                        // Add timestamp parameter based on service type
                        when {
                            baseUrl.contains("youtube.com") || baseUrl.contains("youtu.be") -> {
                                // YouTube: use t= parameter (in seconds)
                                // Format: &t=120 or ?t=120 (YouTube accepts both with and without 's')
                                if (timestamp > 0) {
                                    val separator = if (baseUrl.contains("?")) "&" else "?"
                                    // Remove any existing t= parameter first
                                    val urlWithoutTimestamp = baseUrl.replace(Regex("[?&]t=\\d+[s]?"), "")
                                    finalUrl = "$urlWithoutTimestamp${separator}t=$timestamp"
                                    android.util.Log.d("FlowLink", "YouTube URL with timestamp: $finalUrl")
                                } else {
                                    finalUrl = baseUrl
                                }
                            }
                            baseUrl.contains("spotify.com") -> {
                                // Spotify: use #t= parameter (format: mm:ss)
                                if (timestamp > 0) {
                                    val minutes = timestamp / 60
                                    val seconds = timestamp % 60
                                    finalUrl = "$baseUrl#t=$minutes:$seconds"
                                }
                            }
                            else -> {
                                // Generic media URL: try t= or #t=
                                if (timestamp > 0) {
                                    val separator = if (baseUrl.contains("?")) "&" else if (baseUrl.contains("#")) "" else "?"
                                    finalUrl = "$baseUrl${separator}t=$timestamp"
                                }
                            }
                        }
                        
                        android.util.Log.d("FlowLink", "Opening media: $finalUrl (timestamp: ${timestamp}s)")
                        val mediaIntent = Intent(Intent.ACTION_VIEW, Uri.parse(finalUrl)).apply {
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        }
                        startActivity(mediaIntent)
                    }
                } catch (e: Exception) {
                    android.util.Log.e("FlowLink", "Failed to open media", e)
                    Toast.makeText(this, "Failed to open media: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
            "clipboard_sync" -> {
                val payload = intent.payload ?: return
                val clipboardJson = payload["clipboard"] ?: return
                try {
                    val clipboardObj = JSONObject(clipboardJson)
                    val text = clipboardObj.optString("text", "")
                    
                    // Check if this is a remote access permission request
                    if (text == "ENABLE_REMOTE_ACCESS" || text == "DISABLE_REMOTE_ACCESS") {
                        // This is handled by the frontend permission system
                        // Android doesn't need to do anything special, just acknowledge
                        android.util.Log.d("FlowLink", "Remote access permission: $text")
                        // The permission update is handled by the backend/frontend
                        return
                    }
                    
                    if (text.isNotEmpty()) {
                        val clipboard = getSystemService(CLIPBOARD_SERVICE) as ClipboardManager
                        val clip = ClipData.newPlainText("FlowLink", text)
                        clipboard.setPrimaryClip(clip)
                        Toast.makeText(this, "Text copied to clipboard", Toast.LENGTH_SHORT).show()
                    }
                } catch (e: Exception) {
                    Toast.makeText(this, "Failed to copy text", Toast.LENGTH_SHORT).show()
                }
            }
            "remote_access_request" -> {
                val payload = intent.payload ?: return
                val requestJson = payload["request"] ?: return
                try {
                    val requestObj = JSONObject(requestJson)
                    val action = requestObj.optString("action", "")
                    
                    if (action == "start_screen_share") {
                        // Show permission dialog for screen sharing
                        val sourceDeviceName = intent.sourceDevice ?: "Unknown Device"
                        android.app.AlertDialog.Builder(this)
                            .setTitle("Remote Access Request")
                            .setMessage("$sourceDeviceName wants to view your screen. Allow screen sharing?")
                            .setPositiveButton("Allow") { _, _ ->
                                // Start screen sharing
                                startScreenSharing(intent.sourceDevice ?: "")
                            }
                            .setNegativeButton("Deny") { _, _ ->
                                Toast.makeText(this, "Screen sharing denied", Toast.LENGTH_SHORT).show()
                            }
                            .show()
                    }
                } catch (e: Exception) {
                    android.util.Log.e("FlowLink", "Failed to handle remote access request", e)
                    Toast.makeText(this, "Failed to handle remote access request", Toast.LENGTH_SHORT).show()
                }
            }
            "prompt_injection" -> {
                val payload = intent.payload ?: return
                val promptJson = payload["prompt"] ?: return
                try {
                    val prompt = JSONObject(promptJson)
                    val text = prompt.optString("text", "")
                    if (text.isNotEmpty()) {
                        val clipboard = getSystemService(CLIPBOARD_SERVICE) as ClipboardManager
                        clipboard.setPrimaryClip(ClipData.newPlainText("FlowLink Prompt", text))
                        Toast.makeText(this, "Prompt copied to clipboard", Toast.LENGTH_SHORT).show()
                    }
                } catch (e: Exception) {
                    Toast.makeText(this, "Failed to handle prompt", Toast.LENGTH_SHORT).show()
                }
            }
            "file_handoff" -> {
                val payload = intent.payload ?: return
                val fileJson = payload["file"] ?: return
                try {
                    openReceivedFile(JSONObject(fileJson), null)
                } catch (e: Exception) {
                    Toast.makeText(this, "Failed to handle received file", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun openReceivedFile(fileObj: JSONObject, fallbackMimeType: String?) {
        if (!fileObj.has("data")) {
            return
        }

        val name = fileObj.optString("name", "flowlink-file")
        var type = fileObj.optString("type", fallbackMimeType ?: "*/*")
        
        // If type is generic or missing, try to detect from file extension
        if (type == "*/*" || type.isEmpty()) {
            type = when {
                name.endsWith(".mp4", ignoreCase = true) -> "video/mp4"
                name.endsWith(".mp3", ignoreCase = true) -> "audio/mpeg"
                name.endsWith(".avi", ignoreCase = true) -> "video/x-msvideo"
                name.endsWith(".mov", ignoreCase = true) -> "video/quicktime"
                name.endsWith(".wav", ignoreCase = true) -> "audio/wav"
                name.endsWith(".m4a", ignoreCase = true) -> "audio/mp4"
                name.endsWith(".webm", ignoreCase = true) -> "video/webm"
                name.endsWith(".ogg", ignoreCase = true) -> "audio/ogg"
                name.endsWith(".pdf", ignoreCase = true) -> "application/pdf"
                name.endsWith(".jpg", ignoreCase = true) || name.endsWith(".jpeg", ignoreCase = true) -> "image/jpeg"
                name.endsWith(".png", ignoreCase = true) -> "image/png"
                else -> "*/*"
            }
        }
        
        val dataArray = fileObj.getJSONArray("data")
        val bytes = ByteArray(dataArray.length())
        for (i in 0 until dataArray.length()) {
            bytes[i] = dataArray.getInt(i).toByte()
        }

        // Write to cache directory
        val outFile = File(cacheDir, name)
        outFile.outputStream().use { it.write(bytes) }

        val uri = FileProvider.getUriForFile(this, "${BuildConfig.APPLICATION_ID}.fileprovider", outFile)

        android.util.Log.d("FlowLink", "Opening file: $name, type: $type, uri: $uri")

        // Create intent with proper MIME type
        val openIntent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, type)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            // Add category for better app selection
            addCategory(Intent.CATEGORY_DEFAULT)
        }

        try {
            // Check if there's an app that can handle this intent
            val resolveInfo = packageManager.queryIntentActivities(openIntent, PackageManager.MATCH_DEFAULT_ONLY)
            if (resolveInfo.isEmpty()) {
                // No app found, try with a more generic type
                android.util.Log.w("FlowLink", "No app found for type $type, trying generic")
                openIntent.setDataAndType(uri, "*/*")
                val genericResolveInfo = packageManager.queryIntentActivities(openIntent, PackageManager.MATCH_DEFAULT_ONLY)
                if (genericResolveInfo.isEmpty()) {
                    throw Exception("No activity found to handle intent")
                }
            }
            
            // Use chooser to let user pick the app
            val chooser = Intent.createChooser(openIntent, "Open $name with")
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            startActivity(chooser)
        } catch (e: android.content.ActivityNotFoundException) {
            android.util.Log.e("FlowLink", "No activity found to handle file", e)
            Toast.makeText(this, "No app found to open $name. Please install a media player app.", Toast.LENGTH_LONG).show()
        } catch (e: Exception) {
            android.util.Log.e("FlowLink", "Failed to open file", e)
            Toast.makeText(this, "Failed to open file: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }

    private fun startScreenSharing(viewerDeviceId: String) {
        android.util.Log.d("FlowLink", "Starting screen sharing for viewer: $viewerDeviceId")
        
        // Send WebRTC offer message to initiate screen sharing
        // Note: Full MediaProjection implementation would capture actual screen frames
        // For now, we send the signaling message so the viewer knows sharing started
        val sessionId = sessionManager.getCurrentSessionId()
        if (sessionId == null) {
            Toast.makeText(this, "Not in a session", Toast.LENGTH_SHORT).show()
            return
        }
        
        // Create a basic WebRTC offer structure
        // In a full implementation, this would come from PeerConnection.createOffer()
        val offerJson = org.json.JSONObject().apply {
            put("type", "offer")
            put("sdp", "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n")
            // This is a minimal SDP - full implementation would use WebRTC PeerConnection
        }
        
        // Send WebRTC offer via WebSocket
        webSocketManager.sendMessage(org.json.JSONObject().apply {
            put("type", "webrtc_offer")
            put("sessionId", sessionId)
            put("deviceId", sessionManager.getDeviceId())
            put("payload", org.json.JSONObject().apply {
                put("toDevice", viewerDeviceId)
                put("data", offerJson)
                put("purpose", "remote_desktop")
            })
            put("timestamp", System.currentTimeMillis())
        }.toString())
        
        Toast.makeText(this, "Screen sharing started", Toast.LENGTH_SHORT).show()
        android.util.Log.d("FlowLink", "Sent WebRTC offer for screen sharing")
    }
}
