package com.flowlink.app.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import com.flowlink.app.MainActivity
import com.flowlink.app.databinding.FragmentSessionManagerBinding

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
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}

