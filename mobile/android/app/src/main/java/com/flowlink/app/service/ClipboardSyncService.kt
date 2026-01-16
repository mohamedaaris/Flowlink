package com.flowlink.app.service

import android.app.Service
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.os.IBinder
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel

/**
 * Background service to monitor clipboard changes and sync with other devices
 */
class ClipboardSyncService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var clipboardManager: ClipboardManager? = null
    private var lastClipboardText: String = ""
    private var isEnabled = false
    
    private val clipboardListener = ClipboardManager.OnPrimaryClipChangedListener {
        if (!isEnabled) return@OnPrimaryClipChangedListener
        
        val clip = clipboardManager?.primaryClip
        if (clip != null && clip.itemCount > 0) {
            val text = clip.getItemAt(0).coerceToText(this).toString()
            
            // Ignore if same as last text (avoid loops)
            if (text == lastClipboardText || text.isBlank()) {
                return@OnPrimaryClipChangedListener
            }
            
            // Ignore sensitive data patterns
            if (isSensitiveData(text)) {
                Log.d("FlowLink", "Clipboard sync: Skipping sensitive data")
                return@OnPrimaryClipChangedListener
            }
            
            lastClipboardText = text
            Log.d("FlowLink", "📋 Clipboard changed: ${text.take(50)}...")
            
            // Send to all connected devices
            sendClipboardToDevices(text)
        }
    }
    
    override fun onCreate() {
        super.onCreate()
        clipboardManager = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        Log.d("FlowLink", "ClipboardSyncService created")
    }
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_ENABLE -> {
                isEnabled = true
                clipboardManager?.addPrimaryClipChangedListener(clipboardListener)
                Log.d("FlowLink", "📋 Clipboard sync ENABLED")
            }
            ACTION_DISABLE -> {
                isEnabled = false
                clipboardManager?.removePrimaryClipChangedListener(clipboardListener)
                Log.d("FlowLink", "📋 Clipboard sync DISABLED")
            }
            ACTION_UPDATE_CLIPBOARD -> {
                val text = intent.getStringExtra(EXTRA_TEXT)
                if (text != null) {
                    updateClipboard(text)
                }
            }
        }
        return START_STICKY
    }
    
    override fun onBind(intent: Intent?): IBinder? = null
    
    override fun onDestroy() {
        super.onDestroy()
        clipboardManager?.removePrimaryClipChangedListener(clipboardListener)
        scope.cancel()
        Log.d("FlowLink", "ClipboardSyncService destroyed")
    }
    
    private fun updateClipboard(text: String) {
        // Update local clipboard without triggering the listener
        lastClipboardText = text
        val clip = ClipData.newPlainText("FlowLink", text)
        clipboardManager?.setPrimaryClip(clip)
        Log.d("FlowLink", "📋 Clipboard updated from remote: ${text.take(50)}...")
    }
    
    private fun sendClipboardToDevices(text: String) {
        // Broadcast to MainActivity to send via WebSocket
        val broadcastIntent = Intent(ACTION_CLIPBOARD_CHANGED)
        broadcastIntent.putExtra(EXTRA_TEXT, text)
        broadcastIntent.setPackage(packageName)
        sendBroadcast(broadcastIntent)
    }
    
    private fun isSensitiveData(text: String): Boolean {
        // Check for common sensitive patterns
        val sensitivePatterns = listOf(
            Regex("\\b\\d{13,19}\\b"), // Credit card numbers
            Regex("\\b\\d{3}-\\d{2}-\\d{4}\\b"), // SSN
            Regex("password", RegexOption.IGNORE_CASE),
            Regex("\\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}\\b.*password", RegexOption.IGNORE_CASE),
            Regex("\\bpin\\b.*\\d{4,6}", RegexOption.IGNORE_CASE)
        )
        
        return sensitivePatterns.any { it.containsMatchIn(text) }
    }
    
    companion object {
        const val ACTION_ENABLE = "com.flowlink.app.ENABLE_CLIPBOARD_SYNC"
        const val ACTION_DISABLE = "com.flowlink.app.DISABLE_CLIPBOARD_SYNC"
        const val ACTION_UPDATE_CLIPBOARD = "com.flowlink.app.UPDATE_CLIPBOARD"
        const val ACTION_CLIPBOARD_CHANGED = "com.flowlink.app.CLIPBOARD_CHANGED"
        const val EXTRA_TEXT = "text"
    }
}
