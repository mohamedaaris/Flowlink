package com.flowlink.app.service

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import android.widget.Toast
import com.flowlink.app.model.Intent as FlowLinkIntent
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Intent Handler
 * 
 * Processes incoming FlowLink intents and auto-opens them on Android
 */
class IntentHandler(private val context: Context) {

    suspend fun handleIntent(intent: FlowLinkIntent): Boolean = withContext(Dispatchers.Main) {
        try {
            when (intent.intentType) {
                "file_handoff" -> handleFileHandoff(intent)
                "media_continuation" -> handleMediaContinuation(intent)
                "link_open" -> handleLinkOpen(intent)
                "prompt_injection" -> handlePromptInjection(intent)
                "clipboard_sync" -> handleClipboardSync(intent)
                else -> {
                    Log.w("FlowLink", "Unknown intent type: ${intent.intentType}")
                    false
                }
            }
        } catch (e: Exception) {
            Log.e("FlowLink", "Error handling intent", e)
            Toast.makeText(context, "Failed to process intent: ${e.message}", Toast.LENGTH_LONG).show()
            false
        }
    }

    private suspend fun handleFileHandoff(intent: FlowLinkIntent): Boolean = withContext(Dispatchers.IO) {
        val fileName = intent.payload?.get("file.name") ?: return@withContext false
        val fileType = intent.payload?.get("file.type") ?: "*/*"
        
        // In a real implementation, file data would be transferred via WebRTC
        // For MVP, we'll show a notification or download prompt
        Log.d("FlowLink", "File handoff: $fileName ($fileType)")
        
        // Try to open file if we have a URI
        // This would require file transfer to be completed first
        true
    }

    private fun handleMediaContinuation(intent: FlowLinkIntent): Boolean {
        val url = intent.payload?.get("media.url") ?: return false
        val timestamp = intent.payload?.get("media.timestamp")?.toDoubleOrNull() ?: 0.0
        val mediaType = intent.payload?.get("media.type") ?: "video"

        val mediaUri = if (timestamp > 0) {
            "$url#t=${timestamp.toInt()}"
        } else {
            url
        }

        val viewIntent = Intent(Intent.ACTION_VIEW).apply {
            data = Uri.parse(mediaUri)
            when (mediaType) {
                "video" -> type = "video/*"
                "audio" -> type = "audio/*"
                else -> type = "*/*"
            }
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }

        return try {
            context.startActivity(viewIntent)
            true
        } catch (e: Exception) {
            Log.e("FlowLink", "Failed to open media", e)
            false
        }
    }

    private fun handleLinkOpen(intent: FlowLinkIntent): Boolean {
        val url = intent.payload?.get("link.url") ?: return false

        val browserIntent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }

        return try {
            context.startActivity(browserIntent)
            true
        } catch (e: Exception) {
            Log.e("FlowLink", "Failed to open link", e)
            false
        }
    }

    private fun handlePromptInjection(intent: FlowLinkIntent): Boolean {
        val text = intent.payload?.get("prompt.text") ?: return false
        val targetApp = intent.payload?.get("prompt.target_app") ?: "browser"

        return when (targetApp) {
            "editor" -> {
                // Try to open in a code editor app
                // For MVP, open in browser search
                val searchUrl = "https://www.google.com/search?q=${Uri.encode(text)}"
                handleLinkOpen(FlowLinkIntent(
                    intentType = "link_open",
                    payload = mapOf("link.url" to searchUrl),
                    targetDevice = "",
                    sourceDevice = "",
                    autoOpen = true,
                    timestamp = System.currentTimeMillis()
                ))
            }
            "browser" -> {
                val searchUrl = "https://www.google.com/search?q=${Uri.encode(text)}"
                handleLinkOpen(FlowLinkIntent(
                    intentType = "link_open",
                    payload = mapOf("link.url" to searchUrl),
                    targetDevice = "",
                    sourceDevice = "",
                    autoOpen = true,
                    timestamp = System.currentTimeMillis()
                ))
            }
            else -> false
        }
    }

    private suspend fun handleClipboardSync(intent: FlowLinkIntent): Boolean = withContext(Dispatchers.Main) {
        val text = intent.payload?.get("clipboard.text") ?: return@withContext false

        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
        val clip = android.content.ClipData.newPlainText("FlowLink", text)
        clipboard.setPrimaryClip(clip)

        Toast.makeText(context, "Clipboard synced", Toast.LENGTH_SHORT).show()
        true
    }
}

