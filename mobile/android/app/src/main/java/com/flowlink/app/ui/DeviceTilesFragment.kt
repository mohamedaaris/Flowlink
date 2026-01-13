package com.flowlink.app.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.flowlink.app.MainActivity
import com.flowlink.app.databinding.FragmentDeviceTilesBinding
import com.flowlink.app.service.SessionManager
import com.flowlink.app.service.WebSocketManager
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class DeviceTilesFragment : Fragment() {
    private var _binding: FragmentDeviceTilesBinding? = null
    private val binding get() = _binding!!
    private var sessionId: String? = null
    private var sessionManager: SessionManager? = null
    private val connectedDevices = mutableListOf<String>()

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

        // Show session info (prefer human-friendly 6-digit code if available)
        val code = sessionManager?.getCurrentSessionCode() ?: sessionId
        updateStatus(code)

        // Listen for device connections
        val mainActivity = activity as? MainActivity
        if (mainActivity != null) {
            lifecycleScope.launch {
                mainActivity.webSocketManager.deviceConnected.collectLatest { deviceInfo ->
                    deviceInfo?.let {
                        if (!connectedDevices.contains(it.id)) {
                            connectedDevices.add(it.id)
                            updateStatus(code)
                        }
                    }
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

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
        sessionManager = null
    }
}

