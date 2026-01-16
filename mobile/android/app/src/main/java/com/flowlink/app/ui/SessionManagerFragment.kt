package com.flowlink.app.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.flowlink.app.MainActivity
import com.flowlink.app.databinding.FragmentSessionManagerBinding
import kotlinx.coroutines.launch

class SessionManagerFragment : Fragment() {
    private var _binding: FragmentSessionManagerBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentSessionManagerBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.btnCreateSession.setOnClickListener {
            (activity as? MainActivity)?.createSession()
        }

        binding.btnJoinSession.setOnClickListener {
            (activity as? MainActivity)?.scanQRCode()
        }

        binding.btnEnterCode.setOnClickListener {
            val code = binding.etSessionCode.text.toString()
            if (code.length == 6) {
                (activity as? MainActivity)?.joinSession(code)
            } else {
                Toast.makeText(requireContext(), "Please enter a 6-digit code", Toast.LENGTH_SHORT).show()
            }
        }

        binding.btnClearSession.setOnClickListener {
            val mainActivity = activity as? MainActivity
            if (mainActivity != null) {
                lifecycleScope.launch {
                    mainActivity.sessionManager.leaveSession()
                    mainActivity.webSocketManager.disconnect()
                    Toast.makeText(requireContext(), "Session cleared", Toast.LENGTH_SHORT).show()
                    android.util.Log.d("FlowLink", "Session manually cleared by user")
                }
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}

