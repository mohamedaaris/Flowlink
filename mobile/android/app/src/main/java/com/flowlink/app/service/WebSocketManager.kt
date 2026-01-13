package com.flowlink.app.service

import android.util.Log
import com.flowlink.app.model.Intent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import okhttp3.*
import okio.ByteString
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * WebSocket Manager
 * 
 * Handles WebSocket connection to backend for signaling
 */
class WebSocketManager(private val sessionManager: SessionManager) {
    private val client = OkHttpClient.Builder()
        .pingInterval(30, TimeUnit.SECONDS)
        .build()

    private var webSocket: WebSocket? = null
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val _connectionState = MutableStateFlow<ConnectionState>(ConnectionState.Disconnected)
    val connectionState: StateFlow<ConnectionState> = _connectionState

    private val _receivedIntents = MutableStateFlow<Intent?>(null)
    val receivedIntents: StateFlow<Intent?> = _receivedIntents

    private val _sessionCreated = MutableStateFlow<SessionCreatedEvent?>(null)
    val sessionCreated: StateFlow<SessionCreatedEvent?> = _sessionCreated

    data class SessionCreatedEvent(
        val sessionId: String,
        val code: String,
        val expiresAt: Long
    )

    // IMPORTANT: Change this based on your setup
    // For Android Emulator: "ws://10.0.2.2:8080"
    // For Physical Device: "ws://YOUR_COMPUTER_IP:8080" (e.g., "ws://192.168.1.100:8080")
    // Find your IP: Windows PowerShell -> ipconfig -> IPv4 Address
    private val WS_URL = "ws://192.168.0.109:8080" // Android emulator localhost

    fun connect(sessionCode: String) {
        if (_connectionState.value == ConnectionState.Connected) {
            return
        }

        val request = Request.Builder()
            .url(WS_URL)
            .build()

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.d("FlowLink", "WebSocket connected")
                _connectionState.value = ConnectionState.Connected

                // Only send session_join if we have a code (not for session_create)
                if (sessionCode.isNotEmpty()) {
                    sendMessage(JSONObject().apply {
                        put("type", "session_join")
                        put("payload", JSONObject().apply {
                            put("code", sessionCode)
                            put("deviceId", sessionManager.getDeviceId())
                            put("deviceName", sessionManager.getDeviceName())
                            put("deviceType", sessionManager.getDeviceType())
                        })
                        put("timestamp", System.currentTimeMillis())
                    }.toString())
                }
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                Log.d("FlowLink", "WebSocket message: $text")
                handleMessage(text)
            }

            override fun onMessage(webSocket: WebSocket, bytes: ByteString) {
                Log.d("FlowLink", "WebSocket binary message")
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                Log.d("FlowLink", "WebSocket closing: $reason")
                _connectionState.value = ConnectionState.Disconnected
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                Log.d("FlowLink", "WebSocket closed: $reason")
                _connectionState.value = ConnectionState.Disconnected
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.e("FlowLink", "WebSocket failure", t)
                _connectionState.value = ConnectionState.Error(t.message ?: "Unknown error")
            }
        })
    }

    fun disconnect() {
        webSocket?.close(1000, "Normal closure")
        webSocket = null
        _connectionState.value = ConnectionState.Disconnected
    }

    fun sendMessage(message: String) {
        webSocket?.send(message) ?: Log.w("FlowLink", "WebSocket not connected")
    }

    fun sendIntent(intent: Intent, targetDeviceId: String) {
        val intentPayload = JSONObject()
        intent.payload?.forEach { (key, value) ->
            // Try to parse as JSON if it's a JSON string, otherwise use as-is
            try {
                val jsonValue = JSONObject(value)
                intentPayload.put(key, jsonValue) // Keep as nested JSON object
            } catch (e: Exception) {
                // Not JSON, use as string
                intentPayload.put(key, value)
            }
        }
        
        val message = JSONObject().apply {
            put("type", "intent_send")
            put("sessionId", sessionManager.getCurrentSessionId())
            put("deviceId", sessionManager.getDeviceId())
            put("payload", JSONObject().apply {
                put("intent", JSONObject().apply {
                    put("intent_type", intent.intentType)
                    put("payload", intentPayload)
                    put("target_device", targetDeviceId)
                    put("source_device", sessionManager.getDeviceId())
                    put("auto_open", intent.autoOpen)
                    put("timestamp", intent.timestamp)
                })
                put("targetDevice", targetDeviceId)
            })
            put("timestamp", System.currentTimeMillis())
        }.toString()

        sendMessage(message)
    }

    private fun handleMessage(text: String) {
        try {
            val json = JSONObject(text)
            val type = json.getString("type")

            when (type) {
                "intent_received" -> {
                    val intentJson = json.getJSONObject("payload").getJSONObject("intent")
                    val payloadObj = intentJson.optJSONObject("payload")
                    
                    // Properly parse nested JSON payload (don't convert everything to strings)
                    val payloadMap = payloadObj?.let { obj ->
                        obj.keys().asSequence().associateWith { key ->
                            // Try to get as JSONObject first (for nested structures like "media", "link", etc.)
                            val value = obj.opt(key)
                            when {
                                value is org.json.JSONObject -> value.toString() // Keep as JSON string for nested objects
                                value is org.json.JSONArray -> value.toString()
                                else -> value.toString()
                            }
                        }
                    }
                    
                    val intent = Intent(
                        intentType = intentJson.getString("intent_type"),
                        payload = payloadMap,
                        targetDevice = intentJson.getString("target_device"),
                        sourceDevice = intentJson.getString("source_device"),
                        autoOpen = intentJson.getBoolean("auto_open"),
                        timestamp = intentJson.getLong("timestamp")
                    )
                    _receivedIntents.value = intent
                }
                "device_connected" -> {
                    Log.d("FlowLink", "Device connected")
                }
                "device_disconnected" -> {
                    Log.d("FlowLink", "Device disconnected")
                }
                "session_created" -> {
                    val payload = json.getJSONObject("payload")
                    val sessionId = payload.getString("sessionId")
                    val code = payload.getString("code")
                    val expiresAt = payload.getLong("expiresAt")
                    
                    // Store session info
                    scope.launch {
                        sessionManager.setSessionInfo(sessionId, code)
                    }
                    
                    _sessionCreated.value = SessionCreatedEvent(sessionId, code, expiresAt)
                    Log.d("FlowLink", "Session created: $code")
                }
                "session_expired" -> {
                    Log.d("FlowLink", "Session expired")
                    // Clear local session so user can start fresh
                    scope.launch {
                        sessionManager.leaveSession()
                    }
                    disconnect()
                }
            }
        } catch (e: Exception) {
            Log.e("FlowLink", "Error handling message", e)
        }
    }

    sealed class ConnectionState {
        object Disconnected : ConnectionState()
        object Connecting : ConnectionState()
        object Connected : ConnectionState()
        data class Error(val message: String) : ConnectionState()
    }
}