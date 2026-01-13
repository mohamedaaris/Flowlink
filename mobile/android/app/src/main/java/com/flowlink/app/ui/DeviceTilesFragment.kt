package com.flowlink.app.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.flowlink.app.MainActivity
import com.flowlink.app.databinding.FragmentDeviceTilesBinding
import com.flowlink.app.model.Device
import com.flowlink.app.service.SessionManager
import com.flowlink.app.service.WebSocketManager
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class DeviceTilesFragment : Fragment() {
    private var _binding: FragmentDeviceTilesBinding? = null
    private val binding get() = _binding!!
    private var sessionId: String? = null
    private var sessionManager: SessionManager? = null
    private val connectedDevices = mutableMapOf<String, Device>()
    private var deviceAdapter: DeviceTileAdapter? = null

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
        deviceAdapter = DeviceTileAdapter(emptyList())
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
        deviceAdapter = DeviceTileAdapter(connectedDevices.values.toList())
        binding.rvDevices.adapter = deviceAdapter
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
        sessionManager = null
        deviceAdapter = null
    }
}

