package com.flowlink.app

import android.app.Application
import com.flowlink.app.service.WebSocketManager

class FlowLinkApplication : Application() {
    lateinit var webSocketManager: WebSocketManager
        private set
    
    override fun onCreate() {
        super.onCreate()
        // WebSocketManager will be initialized by MainActivity
    }
    
    fun initWebSocketManager(manager: WebSocketManager) {
        webSocketManager = manager
    }
}
