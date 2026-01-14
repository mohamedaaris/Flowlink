package com.flowlink.app.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.flowlink.app.MainActivity
import com.flowlink.app.databinding.FragmentDeviceTilesBinding
import com.flowlink.app.model.Device
import com.flowlink.app.model.Intent as FlowIntent
import com.flowlink.app.service.SessionManager
import com.flowlink.app.service.WebSocketManager
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

class DeviceTilesFragment : Fragment() {
    private var _binding: FragmentDeviceTilesBinding? = null
    private val binding get() = _binding!!
    private var sessionId: String? = null
    private var sessionManager: SessionManager? = null
    private val connectedDevices = mutableMapOf<String, Device>()
    private var deviceAdapter: DeviceTileAdapter? = null
    private var pendingFileTargetDeviceId: String? = null

    // Launcher to let the user pick a file/media to send when there is no
    // useful clipboard content available.
    private val pickFileLauncher = registerForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri: Uri? ->
        val targetDeviceId = pendingFileTargetDeviceId
        pendingFileTargetDeviceId = null

        if (uri == null || targetDeviceId == null) {
            return@registerForActivityResult
        }

        val mainActivity = activity as? MainActivity ?: return@registerForActivityResult
        val ctx = requireContext()

        try {
            val resolver = ctx.contentResolver
            val name = resolver.query(uri, null, null, null, null)?.use { cursor ->
                val nameIndex = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                if (nameIndex != -1 && cursor.moveToFirst()) {
                    cursor.getString(nameIndex)
                } else {
                    uri.lastPathSegment ?: "flowlink-file"
                }
            } ?: (uri.lastPathSegment ?: "flowlink-file")

            val type = resolver.getType(uri) ?: "*/*"
            val bytes = resolver.openInputStream(uri)?.use { it.readBytes() } ?: return@registerForActivityResult

            val dataArray = JSONArray().apply {
                bytes.forEach { b -> put(b.toInt() and 0xFF) }
            }

            val fileJson = JSONObject().apply {
                put("name", name)
                put("size", bytes.size)
                put("type", type)
                put("data", dataArray)
            }

            val payload = mapOf(
                "file" to fileJson.toString()
            )

            val flowIntent = FlowIntent(
                intentType = "file_handoff",
                payload = payload,
                targetDevice = targetDeviceId,
                sourceDevice = sessionManager?.getDeviceId() ?: "",
                autoOpen = true,
                timestamp = System.currentTimeMillis()
            )

            mainActivity.webSocketManager.sendIntent(flowIntent, targetDeviceId)
            Toast.makeText(ctx, "Sent file to device", Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
            android.util.Log.e("FlowLink", "Failed to send file", e)
            Toast.makeText(ctx, "Failed to send file: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }

    companion object {
        fun newInstance(sessionId: String): DeviceTilesFragment {
            return DeviceTilesFragment().apply {
                arguments = Bundle().apply {
                    putString("session_id", sessionId)
                }
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        sessionId = arguments?.getString("session_id")
        sessionManager = SessionManager(requireContext())
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentDeviceTilesBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.btnLeaveSession.setOnClickListener {
            (activity as? MainActivity)?.leaveSession()
        }

        // Setup RecyclerView
        binding.rvDevices.layoutManager = LinearLayoutManager(requireContext())
        deviceAdapter = DeviceTileAdapter(emptyList()) { device ->
            handleDeviceTileClick(device)
        }
        binding.rvDevices.adapter = deviceAdapter

        // Show session info
        val code = sessionManager?.getCurrentSessionCode() ?: sessionId
        updateStatus(code)

        // Listen for device connections
        val mainActivity = activity as? MainActivity
        val currentDeviceId = sessionManager?.getDeviceId()
        
        if (mainActivity != null && currentDeviceId != null) {
            lifecycleScope.launch {
                // Collect device connections - this will receive devices from both
                // device_connected messages and session_joined messages
                mainActivity.webSocketManager.deviceConnected.collectLatest { deviceInfo ->
                    deviceInfo?.let {
                        // Only add devices that are not the current device
                        if (it.id != currentDeviceId && !connectedDevices.containsKey(it.id)) {
                            val device = Device(
                                id = it.id,
                                name = it.name,
                                type = it.type,
                                online = true,
                                permissions = mapOf(
                                    "files" to false,
                                    "media" to false,
                                    "prompts" to false,
                                    "clipboard" to false,
                                    "remote_browse" to false
                                ),
                                joinedAt = System.currentTimeMillis(),
                                lastSeen = System.currentTimeMillis()
                            )
                            connectedDevices[it.id] = device
                            updateDeviceList()
                            updateStatus(code)
                            android.util.Log.d("FlowLink", "Added device to tiles: ${device.name} (${device.id})")
                        }
                    }
                }
            }
            
            // Ensure WebSocket is connected to receive device updates
            val connectionState = mainActivity.webSocketManager.connectionState.value
            val sessionCode = sessionManager?.getCurrentSessionCode()
            if (sessionCode != null) {
                if (connectionState !is WebSocketManager.ConnectionState.Connected) {
                    // Reconnect to get session state and device list
                    android.util.Log.d("FlowLink", "Reconnecting WebSocket to get device list")
                    mainActivity.webSocketManager.connect(sessionCode)
                } else {
                    android.util.Log.d("FlowLink", "WebSocket already connected, waiting for devices")
                }
            }
        }
    }

    private fun updateStatus(code: String?) {
        val statusText = if (connectedDevices.isEmpty()) {
            "Connected to session: $code\n\nWaiting for other devices..."
        } else {
            "Connected to session: $code\n\n${connectedDevices.size} device(s) connected"
        }
        binding.tvStatus.text = statusText
    }

    private fun updateDeviceList() {
        deviceAdapter = DeviceTileAdapter(connectedDevices.values.toList()) { device ->
            handleDeviceTileClick(device)
        }
        binding.rvDevices.adapter = deviceAdapter
    }

    /**
     * When the user taps a device tile on the phone:
     * - If clipboard has a recent URL, send it as a link/media intent and auto-open on laptop.
     * - If clipboard has text, send it as clipboard_sync.
     * - If clipboard is empty or unusable, open a file picker and send the chosen file/media.
     */
    private fun handleDeviceTileClick(device: Device) {
        val ctx = requireContext()
        val mainActivity = activity as? MainActivity

        if (mainActivity == null || sessionManager == null) {
            Toast.makeText(ctx, "Not ready to send yet. Try again.", Toast.LENGTH_SHORT).show()
            return
        }

        try {
            val clipboard = ctx.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            val clip: ClipData? = clipboard.primaryClip
            val text = if (clip != null && clip.itemCount > 0) {
                clip.getItemAt(0).coerceToText(ctx).toString()
            } else {
                ""
            }.trim()

            if (text.isNotEmpty()) {
                // Decide intent type based on clipboard content
                val normalized = normalizeUrl(text) ?: text

                val flowIntent: FlowIntent = when {
                    isMediaUrl(normalized) -> {
                        // Media URL (YouTube / Spotify / direct media) -> media_continuation
                        val mediaJson = JSONObject().apply {
                            put("url", normalized)
                            put("type", if (isVideoUrl(normalized)) "video" else "audio")
                            // We don't have precise playback time from Android apps,
                            // so start from the beginning on the laptop.
                            put("timestamp", 0)
                            put("state", "play")
                        }

                        FlowIntent(
                            intentType = "media_continuation",
                            payload = mapOf("media" to mediaJson.toString()),
                            targetDevice = device.id,
                            sourceDevice = sessionManager?.getDeviceId() ?: "",
                            autoOpen = true,
                            timestamp = System.currentTimeMillis()
                        )
                    }
                    isHttpUrl(normalized) -> {
                        // Regular web URL -> link_open
                        val linkJson = JSONObject().apply {
                            put("url", normalized)
                        }

                        FlowIntent(
                            intentType = "link_open",
                            payload = mapOf("link" to linkJson.toString()),
                            targetDevice = device.id,
                            sourceDevice = sessionManager?.getDeviceId() ?: "",
                            autoOpen = true,
                            timestamp = System.currentTimeMillis()
                        )
                    }
                    else -> {
                        // Plain text -> clipboard_sync
                        val clipboardJson = JSONObject().apply {
                            put("text", text)
                        }

                        FlowIntent(
                            intentType = "clipboard_sync",
                            payload = mapOf("clipboard" to clipboardJson.toString()),
                            targetDevice = device.id,
                            sourceDevice = sessionManager?.getDeviceId() ?: "",
                            autoOpen = true,
                            timestamp = System.currentTimeMillis()
                        )
                    }
                }

                mainActivity.webSocketManager.sendIntent(flowIntent, device.id)

                val preview = if (text.length > 50) text.substring(0, 50) + "..." else text
                Toast.makeText(
                    ctx,
                    "Sent from clipboard to ${device.name}: $preview",
                    Toast.LENGTH_SHORT
                ).show()
            } else {
                // No usable clipboard text: fall back to picking a file/media to send.
                pendingFileTargetDeviceId = device.id
                Toast.makeText(
                    ctx,
                    "Choose a file or media to send to ${device.name}",
                    Toast.LENGTH_SHORT
                ).show()
                // Allow any type; laptop side will detect and open appropriately.
                pickFileLauncher.launch(arrayOf("*/*"))
            }
        } catch (e: Exception) {
            android.util.Log.e("FlowLink", "Failed to handle device tile click", e)
            Toast.makeText(ctx, "Failed to send: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }

    private fun isHttpUrl(text: String): Boolean {
        return try {
            val uri = Uri.parse(text)
            val scheme = uri.scheme?.lowercase()
            scheme == "http" || scheme == "https"
        } catch (e: Exception) {
            false
        }
    }

    private fun isMediaUrl(text: String): Boolean {
        val lower = text.lowercase()
        val mediaExtensionRegex =
            Regex(""".*\.(mp4|mp3|webm|ogg|avi|mov|m4a|flac|wav|mkv)(\?.*)?$""", RegexOption.IGNORE_CASE)
        return lower.contains("youtube.com") ||
                lower.contains("youtu.be") ||
                lower.contains("spotify.com") ||
                mediaExtensionRegex.matches(lower)
    }

    private fun isVideoUrl(text: String): Boolean {
        val lower = text.lowercase()
        val videoRegex =
            Regex(""".*\.(mp4|webm|avi|mov|mkv)(\?.*)?$""", RegexOption.IGNORE_CASE)
        return lower.contains("youtube.com") ||
                lower.contains("youtu.be") ||
                videoRegex.matches(lower)
    }

    /**
     * Normalize common URL forms like "youtube.com/..." into a full https:// URL
     * so laptop-side handlers treat them correctly.
     */
    private fun normalizeUrl(text: String): String? {
        if (text.isBlank()) return null
        val trimmed = text.trim()

        // Already has a scheme
        val hasScheme = Regex("^[a-zA-Z][a-zA-Z\\d+\\-.]*://").containsMatchIn(trimmed)
        if (hasScheme) return trimmed

        // Looks like a bare domain or domain + path
        val domainLike =
            Regex("^(www\\.)?[a-z0-9.-]+\\.[a-z]{2,}([/?].*)?$", RegexOption.IGNORE_CASE)
        return if (domainLike.matches(trimmed)) {
            "https://$trimmed"
        } else {
            null
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
        sessionManager = null
        deviceAdapter = null
    }
}

