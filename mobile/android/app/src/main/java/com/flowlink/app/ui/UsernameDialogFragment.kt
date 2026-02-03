package com.flowlink.app.ui

import android.app.Dialog
import android.content.Context
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.fragment.app.DialogFragment
import com.flowlink.app.R

/**
 * Username Dialog Fragment
 * 
 * Shows a dialog asking for username on first app launch
 */
class UsernameDialogFragment : DialogFragment() {
    
    interface UsernameDialogListener {
        fun onUsernameSubmitted(username: String)
    }
    
    private var listener: UsernameDialogListener? = null
    private lateinit var usernameInput: EditText
    private lateinit var errorText: TextView
    private lateinit var submitButton: Button
    private lateinit var deviceNameText: TextView
    
    override fun onAttach(context: Context) {
        super.onAttach(context)
        try {
            listener = context as UsernameDialogListener
        } catch (e: ClassCastException) {
            throw ClassCastException("$context must implement UsernameDialogListener")
        }
    }
    
    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        val dialog = super.onCreateDialog(savedInstanceState)
        dialog.setCanceledOnTouchOutside(false)
        dialog.setCancelable(false)
        return dialog
    }
    
    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return inflater.inflate(R.layout.fragment_username_dialog, container, false)
    }
    
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        usernameInput = view.findViewById(R.id.username_input)
        errorText = view.findViewById(R.id.error_text)
        submitButton = view.findViewById(R.id.submit_button)
        deviceNameText = view.findViewById(R.id.device_name_text)
        
        // Set device name
        val deviceName = "${android.os.Build.MODEL} (${android.os.Build.DEVICE})"
        deviceNameText.text = "Device: $deviceName"
        
        submitButton.setOnClickListener {
            validateAndSubmit()
        }
        
        // Clear error when user types
        usernameInput.addTextChangedListener(object : android.text.TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                errorText.visibility = View.GONE
            }
            override fun afterTextChanged(s: android.text.Editable?) {}
        })
    }
    
    private fun validateAndSubmit() {
        val username = usernameInput.text.toString().trim()
        
        when {
            username.isEmpty() -> {
                showError("Username is required")
                return
            }
            username.length < 2 -> {
                showError("Username must be at least 2 characters")
                return
            }
            username.length > 20 -> {
                showError("Username must be less than 20 characters")
                return
            }
        }
        
        // Store username in SharedPreferences
        val prefs = requireContext().getSharedPreferences("flowlink", Context.MODE_PRIVATE)
        prefs.edit().putString("username", username).apply()
        
        listener?.onUsernameSubmitted(username)
        dismiss()
    }
    
    private fun showError(message: String) {
        errorText.text = message
        errorText.visibility = View.VISIBLE
    }
    
    companion object {
        const val TAG = "UsernameDialogFragment"
        
        fun newInstance(): UsernameDialogFragment {
            return UsernameDialogFragment()
        }
    }
}