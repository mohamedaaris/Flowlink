package com.flowlink.app.service

import android.content.Context
import android.util.Log
import org.webrtc.AudioSource
import org.webrtc.AudioTrack
import org.webrtc.DataChannel
import org.webrtc.DefaultVideoDecoderFactory
import org.webrtc.DefaultVideoEncoderFactory
import org.webrtc.EglBase
import org.webrtc.IceCandidate
import org.webrtc.MediaConstraints
import org.webrtc.MediaStream
import org.webrtc.PeerConnection
import org.webrtc.PeerConnectionFactory
import org.webrtc.RtpReceiver
import java.nio.ByteBuffer

/**
 * WebRTC Manager for Android
 *
 * Simplified for data-channel use only (no video capture).
 */
class WebRTCManager(
    private val context: Context,
    private val sessionManager: SessionManager
) {
    private val peers: MutableMap<String, PeerConnection> = mutableMapOf()
    private val dataChannels: MutableMap<String, DataChannel> = mutableMapOf()

    private val eglBase: EglBase = EglBase.create()
    private var peerConnectionFactory: PeerConnectionFactory? = null

    init {
        initializePeerConnectionFactory()
    }

    private fun initializePeerConnectionFactory() {
        try {
            val initializationOptions = PeerConnectionFactory.InitializationOptions.builder(context)
                .createInitializationOptions()
            PeerConnectionFactory.initialize(initializationOptions)

            val options = PeerConnectionFactory.Options()
            val encoderFactory = DefaultVideoEncoderFactory(
                eglBase.eglBaseContext,
                /* enableIntelVp8Encoder= */ true,
                /* enableH264HighProfile= */ true
            )
            val decoderFactory = DefaultVideoDecoderFactory(eglBase.eglBaseContext)

            peerConnectionFactory = PeerConnectionFactory.builder()
                .setOptions(options)
                .setVideoEncoderFactory(encoderFactory)
                .setVideoDecoderFactory(decoderFactory)
                .createPeerConnectionFactory()

            // Minimal audio track (some implementations require at least one track)
            val audioSource: AudioSource = peerConnectionFactory!!.createAudioSource(MediaConstraints())
            val audioTrack: AudioTrack = peerConnectionFactory!!.createAudioTrack("flowlink-audio", audioSource)
            audioTrack.setEnabled(false) // disabled by default

            Log.d("FlowLink", "WebRTC PeerConnectionFactory initialized")
        } catch (e: Exception) {
            Log.e("FlowLink", "Failed to initialize WebRTC", e)
        }
    }

    /**
     * Create peer connection to target device
     */
    fun createPeerConnection(
        targetDeviceId: String,
        onDataChannel: (DataChannel) -> Unit
    ): PeerConnection? {
        val factory = peerConnectionFactory ?: run {
            Log.w("FlowLink", "PeerConnectionFactory not initialized")
            return null
        }

        val rtcConfig = PeerConnection.RTCConfiguration(
            listOf(
                PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer()
            )
        )

        val observer = object : PeerConnection.Observer {
            override fun onSignalingChange(state: PeerConnection.SignalingState) {}
            override fun onIceConnectionChange(state: PeerConnection.IceConnectionState) {}
            override fun onIceConnectionReceivingChange(p0: Boolean) {}
            override fun onIceGatheringChange(state: PeerConnection.IceGatheringState) {}
            override fun onIceCandidate(candidate: IceCandidate) {
                Log.d("FlowLink", "ICE candidate: ${candidate.sdp}")
                // TODO: send ICE over WebSocket
            }
            override fun onIceCandidatesRemoved(candidates: Array<IceCandidate>) {}
            override fun onAddStream(stream: MediaStream) {}
            override fun onRemoveStream(stream: MediaStream) {}
            override fun onDataChannel(channel: DataChannel) {
                dataChannels[targetDeviceId] = channel
                onDataChannel(channel)
            }
            override fun onRenegotiationNeeded() {}
            override fun onAddTrack(receiver: RtpReceiver, mediaStreams: Array<MediaStream>) {}
        }

        val peerConnection = factory.createPeerConnection(rtcConfig, observer)
        if (peerConnection == null) {
            Log.e("FlowLink", "Failed to create PeerConnection")
            return null
        }
        peers[targetDeviceId] = peerConnection

        // Create data channel
        val dataChannelInit = DataChannel.Init().apply { ordered = true }
        val dc = peerConnection.createDataChannel("flowlink", dataChannelInit)
        if (dc != null) {
            dataChannels[targetDeviceId] = dc
        }

        return peerConnection
    }

    /**
     * Send data via WebRTC data channel
     */
    fun sendData(targetDeviceId: String, data: ByteArray): Boolean {
        val dc = dataChannels[targetDeviceId]
        return if (dc != null && dc.state() == DataChannel.State.OPEN) {
            val buffer = DataChannel.Buffer(ByteBuffer.wrap(data), false)
            dc.send(buffer)
            true
        } else {
            Log.w("FlowLink", "Data channel not open for device: $targetDeviceId")
            false
        }
    }

    /**
     * Cleanup peer connection
     */
    fun closePeerConnection(targetDeviceId: String) {
        peers[targetDeviceId]?.close()
        dataChannels[targetDeviceId]?.close()
        peers.remove(targetDeviceId)
        dataChannels.remove(targetDeviceId)
    }

    /**
     * Cleanup all connections
     */
    fun cleanup() {
        peers.keys.toList().forEach { closePeerConnection(it) }
        peerConnectionFactory?.dispose()
        eglBase.release()
        PeerConnectionFactory.stopInternalTracingCapture()
        PeerConnectionFactory.shutdownInternalTracer()
    }
}

