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
    private val deviceName: String = android.os.Build.MODEL
    private val deviceType: String = "phone"

    private fun getOrCreateDeviceId(): String {
        val savedId = prefs.getString("device_id", null)
        return savedId ?: UUID.randomUUID().toString().also {
            prefs.edit().putString("device_id", it).apply()
        }
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

