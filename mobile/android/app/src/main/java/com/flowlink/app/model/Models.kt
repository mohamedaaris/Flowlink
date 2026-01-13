package com.flowlink.app.model

/**
 * Data models for FlowLink Android app
 */

data class Session(
    val sessionId: String,
    val code: String,
    val createdBy: String,
    val createdAt: Long,
    val expiresAt: Long
)

data class Device(
    val id: String,
    val name: String,
    val type: String,
    val online: Boolean,
    val permissions: Map<String, Boolean> = emptyMap()
)

data class Intent(
    val intentType: String,
    val payload: Map<String, String>?,
    val targetDevice: String,
    val sourceDevice: String,
    val autoOpen: Boolean,
    val timestamp: Long
)

