package com.flowlink.app.service

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.util.Log
import org.json.JSONObject
import org.webrtc.*

/**
 * Remote Desktop Manager for Android
 * 
 * Handles screen sharing and remote control functionality using WebRTC
 */
class RemoteDesktopManager(
    private val context: Context,
    private val webSocketManager: WebSocketManager,
    private val sessionId: String,
    private val sourceDeviceId: String,
    private val viewerDeviceId: String,
    private val isSource: Boolean
) {
    private var peerConnection: PeerConnection? = null
    private var dataChannel: DataChannel? = null
    private var videoCapturer: VideoCapturer? = null
    private var videoSource: VideoSource? = null
    private var videoTrack: VideoTrack? = null
    private var localStream: MediaStream? = null
    // Don't store MediaProjection - create fresh each time to avoid reuse error
    
    private val peerConnectionFactory: PeerConnectionFactory by lazy {
        // Initialize WebRTC
        val initOptions = PeerConnectionFactory.InitializationOptions.builder(context)
            .setEnableInternalTracer(true)
            .setFieldTrials("")
            .createInitializationOptions()
        
        try {
            PeerConnectionFactory.initialize(initOptions)
            Log.d(TAG, "WebRTC initialized successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize WebRTC", e)
        }
        
        val options = PeerConnectionFactory.Options()
        
        val encoderFactory = DefaultVideoEncoderFactory(
            EglBase.create().eglBaseContext,
            true,  // enableIntelVp8Encoder
            true   // enableH264HighProfile
        )
        
        val decoderFactory = DefaultVideoDecoderFactory(EglBase.create().eglBaseContext)
        
        PeerConnectionFactory.builder()
            .setOptions(options)
            .setVideoEncoderFactory(encoderFactory)
            .setVideoDecoderFactory(decoderFactory)
            .createPeerConnectionFactory()
    }
    
    companion object {
        private const val TAG = "RemoteDesktopManager"
        const val SCREEN_CAPTURE_REQUEST_CODE = 1001
    }
    
    /**
     * Request screen capture permission (call from Activity)
     */
    fun requestScreenCapturePermission(activity: Activity) {
        val mediaProjectionManager = context.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        val captureIntent = mediaProjectionManager.createScreenCaptureIntent()
        activity.startActivityForResult(captureIntent, SCREEN_CAPTURE_REQUEST_CODE)
    }
    
    /**
     * Start screen sharing after permission granted
     * CRITICAL: This must be called IMMEDIATELY after receiving permission
     * The Intent data can only be used ONCE and cannot be stored/cloned
     */
    fun startScreenShare(resultCode: Int, data: Intent) {
        Log.d(TAG, "=== START SCREEN SHARE ===")
        Log.d(TAG, "Result code: $resultCode")
        
        var mediaProjection: MediaProjection? = null
        
        try {
            // Validate result code first
            if (resultCode != Activity.RESULT_OK) {
                throw Exception("Invalid result code: $resultCode")
            }
            
            // Clean up existing resources
            if (videoCapturer != null || videoTrack != null || peerConnection != null) {
                Log.d(TAG, "Cleaning up existing resources...")
                stopScreenShare()
                Thread.sleep(300)
            }
            
            // Get MediaProjectionManager
            val mediaProjectionManager = context.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
            
            // CRITICAL: Get MediaProjection IMMEDIATELY
            // Do NOT store, clone, or delay this call
            Log.d(TAG, "Getting MediaProjection IMMEDIATELY...")
            try {
                mediaProjection = mediaProjectionManager.getMediaProjection(resultCode, data)
                if (mediaProjection == null) {
                    throw Exception("MediaProjection returned null")
                }
            } catch (e: IllegalStateException) {
                Log.e(TAG, "IllegalStateException getting MediaProjection", e)
                throw Exception("MediaProjection failed: ${e.message}. The permission may have expired or is already in use.")
            } catch (e: Exception) {
                Log.e(TAG, "Exception getting MediaProjection", e)
                throw Exception("Failed to get MediaProjection: ${e.message}")
            }
            
            Log.d(TAG, "✅ MediaProjection obtained successfully")
            
            // Register callback for when projection stops
            val mediaProjectionCallback = object : MediaProjection.Callback() {
                override fun onStop() {
                    Log.d(TAG, "MediaProjection stopped by system")
                    stopScreenShare()
                }
            }
            mediaProjection.registerCallback(mediaProjectionCallback, null)
            
            // Create peer connection
            Log.d(TAG, "Creating peer connection...")
            createPeerConnection()
            
            // CRITICAL: Create ScreenCapturerAndroid with the ORIGINAL Intent
            // Pass the Intent DIRECTLY - do not clone or modify
            Log.d(TAG, "Creating ScreenCapturerAndroid...")
            videoCapturer = ScreenCapturerAndroid(data, mediaProjectionCallback)
            Log.d(TAG, "✅ ScreenCapturerAndroid created")
            
            // Create video source and track
            Log.d(TAG, "Creating video source...")
            val surfaceTextureHelper = SurfaceTextureHelper.create("CaptureThread", EglBase.create().eglBaseContext)
            videoSource = peerConnectionFactory.createVideoSource(videoCapturer!!.isScreencast)
            
            Log.d(TAG, "Initializing video capturer...")
            videoCapturer!!.initialize(
                surfaceTextureHelper,
                context,
                videoSource!!.capturerObserver
            )
            
            Log.d(TAG, "Creating video track...")
            videoTrack = peerConnectionFactory.createVideoTrack("screen_video_${System.currentTimeMillis()}", videoSource)
            videoTrack!!.setEnabled(true)
            
            // Create local stream and add track
            Log.d(TAG, "Creating local stream...")
            localStream = peerConnectionFactory.createLocalMediaStream("screen_stream_${System.currentTimeMillis()}")
            localStream!!.addTrack(videoTrack)
            
            // Add stream to peer connection
            Log.d(TAG, "Adding stream to peer connection...")
            peerConnection?.addStream(localStream)
            
            // Start capturing
            Log.d(TAG, "Starting video capture at 1280x720@30fps...")
            videoCapturer!!.startCapture(1280, 720, 30)
            
            // Create and send offer
            Log.d(TAG, "Creating and sending WebRTC offer...")
            createAndSendOffer()
            
            Log.d(TAG, "Screen sharing started successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start screen share", e)
            // Clean up on error
            mediaProjection?.stop()
            stopScreenShare()
            throw e
        }
    }
    
    /**
     * Create screen capturer using MediaProjection
     * Note: This method is no longer used as we create the capturer directly in startScreenShare
     */
    @Deprecated("Use startScreenShare directly")
    private fun createScreenCapturer(): VideoCapturer {
        // This is kept for reference but not used
        throw UnsupportedOperationException("Use startScreenShare directly")
    }
    
    /**
     * Create WebRTC peer connection
     */
    private fun createPeerConnection() {
        val iceServers = listOf(
            PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer(),
            PeerConnection.IceServer.builder("stun:stun1.l.google.com:19302").createIceServer()
        )
        
        val rtcConfig = PeerConnection.RTCConfiguration(iceServers).apply {
            bundlePolicy = PeerConnection.BundlePolicy.MAXBUNDLE
            rtcpMuxPolicy = PeerConnection.RtcpMuxPolicy.REQUIRE
            tcpCandidatePolicy = PeerConnection.TcpCandidatePolicy.DISABLED
        }
        
        peerConnection = peerConnectionFactory.createPeerConnection(
            rtcConfig,
            object : PeerConnection.Observer {
                override fun onIceCandidate(candidate: IceCandidate) {
                    sendIceCandidate(candidate)
                }
                
                override fun onDataChannel(dc: DataChannel) {
                    dataChannel = dc
                    setupDataChannel()
                }
                
                override fun onIceConnectionChange(state: PeerConnection.IceConnectionState) {
                    Log.d(TAG, "ICE connection state: $state")
                }
                
                override fun onIceConnectionReceivingChange(receiving: Boolean) {
                    Log.d(TAG, "ICE connection receiving change: $receiving")
                }
                
                override fun onIceGatheringChange(state: PeerConnection.IceGatheringState) {
                    Log.d(TAG, "ICE gathering state: $state")
                }
                
                override fun onAddStream(stream: MediaStream) {
                    Log.d(TAG, "Remote stream added")
                }
                
                override fun onSignalingChange(state: PeerConnection.SignalingState) {}
                override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>?) {}
                override fun onRemoveStream(stream: MediaStream?) {}
                override fun onRenegotiationNeeded() {}
                override fun onAddTrack(receiver: RtpReceiver?, streams: Array<out MediaStream>?) {}
            }
        )
        
        // Create data channel for input events
        if (isSource) {
            val init = DataChannel.Init()
            dataChannel = peerConnection?.createDataChannel("input", init)
            setupDataChannel()
        }
    }
    
    /**
     * Setup data channel for input events
     */
    private fun setupDataChannel() {
        dataChannel?.registerObserver(object : DataChannel.Observer {
            override fun onBufferedAmountChange(amount: Long) {}
            
            override fun onStateChange() {
                Log.d(TAG, "Data channel state: ${dataChannel?.state()}")
            }
            
            override fun onMessage(buffer: DataChannel.Buffer) {
                if (isSource) {
                    // Receive input events from viewer
                    val data = ByteArray(buffer.data.remaining())
                    buffer.data.get(data)
                    val message = String(data)
                    handleInputEvent(message)
                }
            }
        })
    }
    
    /**
     * Create and send WebRTC offer
     */
    private fun createAndSendOffer() {
        val constraints = MediaConstraints().apply {
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveAudio", "false"))
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveVideo", "false"))
        }
        
        peerConnection?.createOffer(object : SdpObserver {
            override fun onCreateSuccess(sdp: SessionDescription) {
                peerConnection?.setLocalDescription(object : SdpObserver {
                    override fun onSetSuccess() {
                        sendOffer(sdp)
                    }
                    override fun onSetFailure(error: String) {
                        Log.e(TAG, "Failed to set local description: $error")
                    }
                    override fun onCreateSuccess(p0: SessionDescription?) {}
                    override fun onCreateFailure(p0: String?) {}
                }, sdp)
            }
            
            override fun onCreateFailure(error: String) {
                Log.e(TAG, "Failed to create offer: $error")
            }
            
            override fun onSetSuccess() {}
            override fun onSetFailure(error: String?) {}
        }, constraints)
    }
    
    /**
     * Send WebRTC offer via WebSocket
     */
    private fun sendOffer(sdp: SessionDescription) {
        Log.d(TAG, "=== SENDING WEBRTC OFFER ===")
        Log.d(TAG, "Session ID: $sessionId")
        Log.d(TAG, "Source Device ID (mobile): $sourceDeviceId")
        Log.d(TAG, "Viewer Device ID (laptop): $viewerDeviceId")
        Log.d(TAG, "SDP Type: ${sdp.type.canonicalForm()}")
        
        val message = JSONObject().apply {
            put("type", "webrtc_offer")
            put("sessionId", sessionId)
            put("deviceId", sourceDeviceId)
            put("payload", JSONObject().apply {
                put("toDevice", viewerDeviceId)
                put("data", JSONObject().apply {
                    put("type", sdp.type.canonicalForm())
                    put("sdp", sdp.description)
                })
                put("purpose", "remote_desktop")
            })
            put("timestamp", System.currentTimeMillis())
        }
        
        Log.d(TAG, "WebSocket ready state: ${if (webSocketManager != null) "connected" else "null"}")
        webSocketManager.sendMessage(message.toString())
        Log.d(TAG, "✅ WebRTC offer sent successfully")
    }
    
    /**
     * Send ICE candidate via WebSocket
     */
    private fun sendIceCandidate(candidate: IceCandidate) {
        val message = JSONObject().apply {
            put("type", "webrtc_ice_candidate")
            put("sessionId", sessionId)
            put("deviceId", if (isSource) sourceDeviceId else viewerDeviceId)
            put("payload", JSONObject().apply {
                put("toDevice", if (isSource) viewerDeviceId else sourceDeviceId)
                put("data", JSONObject().apply {
                    put("candidate", candidate.sdp)
                    put("sdpMid", candidate.sdpMid)
                    put("sdpMLineIndex", candidate.sdpMLineIndex)
                })
            })
            put("timestamp", System.currentTimeMillis())
        }
        
        webSocketManager.sendMessage(message.toString())
    }
    
    /**
     * Handle WebRTC signaling messages
     */
    fun handleSignaling(message: JSONObject) {
        val type = message.optString("type")
        val payload = message.optJSONObject("payload") ?: return
        val data = payload.optJSONObject("data") ?: return
        
        when (type) {
            "webrtc_offer" -> {
                // Viewer receives offer
                val sdp = SessionDescription(
                    SessionDescription.Type.OFFER,
                    data.optString("sdp")
                )
                peerConnection?.setRemoteDescription(object : SdpObserver {
                    override fun onSetSuccess() {
                        createAndSendAnswer()
                    }
                    override fun onSetFailure(error: String) {
                        Log.e(TAG, "Failed to set remote description: $error")
                    }
                    override fun onCreateSuccess(p0: SessionDescription?) {}
                    override fun onCreateFailure(p0: String?) {}
                }, sdp)
            }
            "webrtc_answer" -> {
                // Source receives answer
                val sdp = SessionDescription(
                    SessionDescription.Type.ANSWER,
                    data.optString("sdp")
                )
                peerConnection?.setRemoteDescription(object : SdpObserver {
                    override fun onSetSuccess() {
                        Log.d(TAG, "Remote description set successfully")
                    }
                    override fun onSetFailure(error: String) {
                        Log.e(TAG, "Failed to set remote description: $error")
                    }
                    override fun onCreateSuccess(p0: SessionDescription?) {}
                    override fun onCreateFailure(p0: String?) {}
                }, sdp)
            }
            "webrtc_ice_candidate" -> {
                val candidate = IceCandidate(
                    data.optString("sdpMid"),
                    data.optInt("sdpMLineIndex"),
                    data.optString("candidate")
                )
                peerConnection?.addIceCandidate(candidate)
            }
        }
    }
    
    /**
     * Create and send WebRTC answer
     */
    private fun createAndSendAnswer() {
        val constraints = MediaConstraints()
        peerConnection?.createAnswer(object : SdpObserver {
            override fun onCreateSuccess(sdp: SessionDescription) {
                peerConnection?.setLocalDescription(object : SdpObserver {
                    override fun onSetSuccess() {
                        sendAnswer(sdp)
                    }
                    override fun onSetFailure(error: String) {
                        Log.e(TAG, "Failed to set local description: $error")
                    }
                    override fun onCreateSuccess(p0: SessionDescription?) {}
                    override fun onCreateFailure(p0: String?) {}
                }, sdp)
            }
            override fun onCreateFailure(error: String) {
                Log.e(TAG, "Failed to create answer: $error")
            }
            override fun onSetSuccess() {}
            override fun onSetFailure(error: String?) {}
        }, constraints)
    }
    
    /**
     * Send WebRTC answer via WebSocket
     */
    private fun sendAnswer(sdp: SessionDescription) {
        val message = JSONObject().apply {
            put("type", "webrtc_answer")
            put("sessionId", sessionId)
            put("deviceId", viewerDeviceId)
            put("payload", JSONObject().apply {
                put("toDevice", sourceDeviceId)
                put("data", JSONObject().apply {
                    put("type", sdp.type.canonicalForm())
                    put("sdp", sdp.description)
                })
            })
            put("timestamp", System.currentTimeMillis())
        }
        
        webSocketManager.sendMessage(message.toString())
        Log.d(TAG, "Sent WebRTC answer")
    }
    
    /**
     * Handle input event from viewer
     */
    private fun handleInputEvent(message: String) {
        try {
            val json = JSONObject(message)
            val eventType = json.optString("type")
            Log.d(TAG, "Received input event: $eventType")
            
            // Note: Android doesn't allow programmatic input injection without root
            // This would require accessibility service or root access
            // For now, just log the events
        } catch (e: Exception) {
            Log.e(TAG, "Failed to handle input event", e)
        }
    }
    
    /**
     * Stop screen sharing
     */
    fun stopScreenShare() {
        try {
            Log.d(TAG, "Stopping screen share...")
            
            // Stop video capturer first
            videoCapturer?.let {
                try {
                    it.stopCapture()
                    Log.d(TAG, "Video capturer stopped")
                } catch (e: Exception) {
                    Log.e(TAG, "Error stopping video capturer", e)
                }
            }
            
            // Close data channel
            dataChannel?.let {
                try {
                    it.close()
                    Log.d(TAG, "Data channel closed")
                } catch (e: Exception) {
                    Log.e(TAG, "Error closing data channel", e)
                }
            }
            dataChannel = null
            
            // Close peer connection
            peerConnection?.let {
                try {
                    it.close()
                    Log.d(TAG, "Peer connection closed")
                } catch (e: Exception) {
                    Log.e(TAG, "Error closing peer connection", e)
                }
            }
            peerConnection = null
            
            // Dispose video track
            videoTrack?.let {
                try {
                    it.setEnabled(false)
                    it.dispose()
                    Log.d(TAG, "Video track disposed")
                } catch (e: Exception) {
                    Log.e(TAG, "Error disposing video track", e)
                }
            }
            videoTrack = null
            
            // Dispose video source
            videoSource?.let {
                try {
                    it.dispose()
                    Log.d(TAG, "Video source disposed")
                } catch (e: Exception) {
                    Log.e(TAG, "Error disposing video source", e)
                }
            }
            videoSource = null
            
            // Dispose video capturer
            videoCapturer?.let {
                try {
                    it.dispose()
                    Log.d(TAG, "Video capturer disposed")
                } catch (e: Exception) {
                    Log.e(TAG, "Error disposing video capturer", e)
                }
            }
            videoCapturer = null
            
            // Dispose local stream
            localStream?.let {
                try {
                    it.dispose()
                    Log.d(TAG, "Local stream disposed")
                } catch (e: Exception) {
                    Log.e(TAG, "Error disposing local stream", e)
                }
            }
            localStream = null
            
            // Note: MediaProjection is NOT stored as a class variable anymore
            // It's created fresh each time in startScreenShare() to avoid reuse errors
            // The MediaProjection will be stopped automatically when the ScreenCapturerAndroid is disposed
            
            Log.d(TAG, "Screen sharing stopped successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Error in stopScreenShare", e)
        }
    }
    
    /**
     * Cleanup resources
     */
    fun cleanup() {
        stopScreenShare()
    }
}
