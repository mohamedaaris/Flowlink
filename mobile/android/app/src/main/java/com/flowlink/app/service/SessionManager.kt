package com.flowlink.app.service

import android.content.Context
import android.content.SharedPreferences
import android.net.Uri
import com.flowlink.app.model.Device
import com.flowlink.app.model.Session
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.UUID

/**
 * Session Manager
 * 
 * Handles session creation, joining, and device management
 */
class SessionManager(private val context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("flowlink", Context.MODE_PRIVATE)
    private val deviceId: String = getOrCreateDeviceId()
    private val deviceName: String = "${android.os.Build.MODEL} (${android.os.Build.DEVICE})"
    private val deviceType: String = "phone"
    
    init {
        android.util.Log.d("FlowLink", "SessionManager initialized")
        android.util.Log.d("FlowLink", "  Device ID: $deviceId")
        android.util.Log.d("FlowLink", "  Device Name: $deviceName")
        android.util.Log.d("FlowLink", "  Device Type: $deviceType")
    }

    private fun getOrCreateDeviceId(): String {
        val savedId = prefs.getString("device_id", null)
        if (savedId != null) {
            android.util.Log.d("FlowLink", "Using existing device ID: $savedId")
            return savedId
        }
        
        // Generate a more unique device ID using multiple factors
        val androidId = android.provider.Settings.Secure.getString(
            context.contentResolver,
            android.provider.Settings.Secure.ANDROID_ID
        )
        val timestamp = System.currentTimeMillis()
        val random = UUID.randomUUID().toString().substring(0, 8)
        
        // Combine Android ID, timestamp, and random string for uniqueness
        val newId = "$androidId-$timestamp-$random"
        prefs.edit().putString("device_id", newId).apply()
        android.util.Log.d("FlowLink", "Generated NEW device ID: $newId")
        return newId
    }

    suspend fun createSession(): Session = withContext(Dispatchers.IO) {
        val sessionId = UUID.randomUUID().toString()
        val code = generateSessionCode()
        
        val session = Session(
            sessionId = sessionId,
            code = code,
            createdBy = deviceId,
            createdAt = System.currentTimeMillis(),
            expiresAt = System.currentTimeMillis() + (60 * 60 * 1000) // 1 hour
        )

        // Store session locally
        prefs.edit()
            .putString("current_session_id", sessionId)
            .putString("current_session_code", code)
            .apply()

        session
    }

    suspend fun joinSession(code: String): Session = withContext(Dispatchers.IO) {
        // We don't know the real sessionId until backend responds; store code for signaling.
        val sessionId = UUID.randomUUID().toString()

        val session = Session(
            sessionId = sessionId,
            code = code,
            createdBy = "",
            createdAt = System.currentTimeMillis(),
            expiresAt = System.currentTimeMillis() + (60 * 60 * 1000)
        )

        prefs.edit()
            .putString("current_session_id", sessionId)
            .putString("current_session_code", code)
            .apply()

        session
    }

    suspend fun leaveSession() {
        withContext(Dispatchers.IO) {
            prefs.edit()
                .remove("current_session_id")
                .remove("current_session_code")
                .apply()
        }
    }

    fun getCurrentSessionId(): String? {
        return prefs.getString("current_session_id", null)
    }

  fun getCurrentSessionCode(): String? {
    return prefs.getString("current_session_code", null)
  }

  suspend fun setSessionInfo(sessionId: String, code: String) {
    withContext(Dispatchers.IO) {
      prefs.edit()
        .putString("current_session_id", sessionId)
        .putString("current_session_code", code)
        .apply()
    }
  }

    fun getDeviceId(): String = deviceId
    fun getDeviceName(): String = deviceName
    fun getDeviceType(): String = deviceType

    suspend fun handleIncomingFile(uri: Uri) {
        // Handle incoming file intent
        // This would be called when FlowLink sends a file
        withContext(Dispatchers.IO) {
            // Process file
            // For MVP, just log it
            android.util.Log.d("FlowLink", "Received file: $uri")
        }
    }

    private fun generateSessionCode(): String {
        return (100000..999999).random().toString()
    }
}

