/**
 * WebRTC audio call implementation for ShrekChat
 * Using functional programming approach
 */

// WebRTC configuration
const rtcConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// Call state variables
let peerConnection = null;
let localStream = null;
let remoteStream = null;
let callActive = false;
let currentCallData = null;
let callDuration = 0;
let callTimer = null;
let isAudioMuted = false;
let isAudioOnly = true; // Default to audio-only calls
let ringtone = null;
let dialTone = null;

/**
 * Initialize WebRTC audio call functionality
 */
function initWebRTC() {
    // Set up WebSocket handler for call signaling
    setupWebSocketHandler();
    
    // Find and setup button event listeners
    setupEventListeners();
    
    console.log('WebRTC audio call initialized');
}

/**
 * Set up event listeners for call buttons
 */
function setupEventListeners() {
    // Audio call button in chat header
    const audioCallBtn = document.getElementById('audioCallBtn');
    console.log('Found audioCallBtn:', !!audioCallBtn);
    if (audioCallBtn) {
        audioCallBtn.addEventListener('click', function(e) {
            console.log('Audio call button clicked');
            startCall();
        });
    } else {
        console.error('Audio call button not found in the DOM');
    }
    
    // Incoming call buttons
    const acceptCallBtn = document.getElementById('acceptCallBtn');
    if (acceptCallBtn) {
        acceptCallBtn.addEventListener('click', acceptIncomingCall);
    }
    
    const declineCallBtn = document.getElementById('declineCallBtn');
    if (declineCallBtn) {
        declineCallBtn.addEventListener('click', declineIncomingCall);
    }
    
    // Outgoing call buttons
    const cancelCallBtn = document.getElementById('cancelCallBtn');
    if (cancelCallBtn) {
        cancelCallBtn.addEventListener('click', cancelOutgoingCall);
    }
    
    // Active call buttons
    const endCallBtn = document.getElementById('endCallBtn');
    if (endCallBtn) {
        endCallBtn.addEventListener('click', endCall);
    }
    
    const toggleMuteBtn = document.getElementById('toggleMuteBtn');
    if (toggleMuteBtn) {
        toggleMuteBtn.addEventListener('click', toggleMute);
    }
}

/**
 * Set up WebSocket handler for call signaling
 */
function setupWebSocketHandler() {
    // Listen for call-related events on the existing WebSocket
    window.addEventListener('websocket_message', (e) => {
        const data = e.detail;
        if (!data || !data.type) return;
        
        switch (data.type) {
            case 'call_offer':
                handleCallOffer(data);
                break;
            case 'call_answer':
                handleCallAnswer(data);
                break;
            case 'call_ice_candidate':
                handleIceCandidate(data);
                break;
            case 'call_end':
                handleCallEnd(data);
                break;
            case 'call_declined':
                handleCallDeclined(data);
                break;
        }
    });
}

/**
 * Start a new call to the current chat contact
 */
async function startCall() {
    console.log('startCall function called');
    try {
        // Get current chat contact info
        const currentRoomId = window.shrekChatWebSocket?.getCurrentRoomId();
        const isGroup = window.shrekChatWebSocket?.getCurrentRoomIsGroup();
        const contactName = document.getElementById('chatContactName')?.textContent;
        const contactAvatar = document.getElementById('chatContactAvatar')?.src;
        
        console.log('Call details:', { 
            currentRoomId, 
            isGroup, 
            contactName, 
            contactAvatar,
            hasWebSocket: !!window.shrekChatWebSocket
        });
        
        if (!currentRoomId || isGroup) {
            console.error("Cannot call: No valid contact selected or in a group chat");
            // Show error alert
            if (window.alertPopup) {
                window.alertPopup.showError("Cannot start call", "Please select a valid contact to call. Group calls are not supported.");
            }
            return;
        }
        
        // Get the target user ID
        const contactItem = document.querySelector(`.contact-item[data-room-id="${currentRoomId}"]`);
        console.log('Contact item found:', !!contactItem);
        
        const targetUserId = contactItem?.dataset.userId;
        console.log('Target user ID:', targetUserId);
        
        if (!targetUserId) {
            console.error("Cannot call: Target user ID not found");
            if (window.alertPopup) {
                window.alertPopup.showError("Cannot start call", "Unable to identify the contact. Please try again.");
            }
            return;
        }
        
        // Set up WebRTC connection
        peerConnection = new RTCPeerConnection(rtcConfiguration);
        
        // Set up media stream
        localStream = await navigator.mediaDevices.getUserMedia({ 
            audio: true, 
            video: false // Audio only
        });
        
        // Add tracks to the peer connection
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        
        // Set up remote stream handling
        peerConnection.ontrack = (event) => {
            remoteStream = event.streams[0];
            // We're doing audio only, so no video element to attach
        };
        
        // Set up ICE candidate handling
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                sendCallSignaling({
                    type: 'call_ice_candidate',
                    target_user_id: targetUserId,
                    room_id: currentRoomId,
                    candidate: event.candidate
                });
            }
        };
        
        // Create and send offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        // Store call data
        currentCallData = {
            roomId: currentRoomId,
            targetUserId: targetUserId,
            contactName: contactName,
            contactAvatar: contactAvatar
        };
        
        // Send the offer through WebSocket
        sendCallSignaling({
            type: 'call_offer',
            target_user_id: targetUserId,
            room_id: currentRoomId,
            sdp: offer
        });
        
        // Show outgoing call UI
        showOutgoingCall(contactName, contactAvatar);
        
    } catch (error) {
        console.error("Error starting call:", error);
        cleanupCall();
        
        // Show error alert
        if (window.alertPopup) {
            window.alertPopup.showError("Call Failed", "Could not access microphone. Please check your device permissions.");
        }
    }
}

/**
 * Handle incoming call offer
 */
async function handleCallOffer(data) {
    try {
        // If already in a call, decline this one
        if (callActive) {
            sendCallSignaling({
                type: 'call_decline',
                target_user_id: data.caller_id,
                room_id: data.room_id
            });
            return;
        }
        
        // Store call data
        currentCallData = {
            roomId: data.room_id,
            targetUserId: data.caller_id,
            contactName: data.caller_name,
            contactAvatar: data.caller_avatar,
            offer: data.sdp
        };
        
        // Show incoming call UI
        showIncomingCall(data.caller_name, data.caller_avatar);
        
        // Play ringtone
        playRingtone();
        
    } catch (error) {
        console.error("Error handling call offer:", error);
        cleanupCall();
    }
}

/**
 * Accept an incoming call
 */
async function acceptIncomingCall() {
    try {
        // Stop ringtone
        stopRingtone();
        
        const incomingCallOverlay = document.getElementById('incomingCallOverlay');
        // Hide incoming call UI
        if (incomingCallOverlay) {
            incomingCallOverlay.style.display = 'none';
        }
        
        // Set up WebRTC connection
        peerConnection = new RTCPeerConnection(rtcConfiguration);
        
        // Set up media stream
        localStream = await navigator.mediaDevices.getUserMedia({ 
            audio: true, 
            video: false // Audio only
        });
        
        // Add tracks to the peer connection
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        
        // Set up remote stream handling
        peerConnection.ontrack = (event) => {
            remoteStream = event.streams[0];
            // Audio only, no video element to attach
        };
        
        // Set up ICE candidate handling
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                sendCallSignaling({
                    type: 'call_ice_candidate',
                    target_user_id: currentCallData.targetUserId,
                    room_id: currentCallData.roomId,
                    candidate: event.candidate
                });
            }
        };
        
        // Set remote description (the offer)
        await peerConnection.setRemoteDescription(new RTCSessionDescription(currentCallData.offer));
        
        // Create and send answer
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        // Send the answer through WebSocket
        sendCallSignaling({
            type: 'call_answer',
            target_user_id: currentCallData.targetUserId,
            room_id: currentCallData.roomId,
            sdp: answer
        });
        
        // Start call
        startActiveCall();
        
    } catch (error) {
        console.error("Error accepting call:", error);
        cleanupCall();
        
        // Show error alert
        if (window.alertPopup) {
            window.alertPopup.showError("Call Failed", "Could not access microphone. Please check your device permissions.");
        }
    }
}

/**
 * Handle call answer from the other party
 */
async function handleCallAnswer(data) {
    try {
        // Stop dial tone
        stopDialTone();
        
        const outgoingCallOverlay = document.getElementById('outgoingCallOverlay');
        // Hide outgoing call UI
        if (outgoingCallOverlay) {
            outgoingCallOverlay.style.display = 'none';
            outgoingCallOverlay.classList.remove('visible');
        }
        
        // Set remote description (the answer)
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
        
        // Start call
        startActiveCall();
        
    } catch (error) {
        console.error("Error handling call answer:", error);
        cleanupCall();
    }
}

/**
 * Handle ICE candidate from the other party
 */
async function handleIceCandidate(data) {
    try {
        if (peerConnection && peerConnection.remoteDescription) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
    } catch (error) {
        console.error("Error handling ICE candidate:", error);
    }
}

/**
 * Decline an incoming call
 */
function declineIncomingCall() {
    // Stop ringtone
    stopRingtone();
    
    // Send decline message
    if (currentCallData && currentCallData.roomId) {
        sendCallSignaling({
            type: 'call_decline',
            target_user_id: currentCallData.targetUserId,
            room_id: currentCallData.roomId
        });
    }
    
    const incomingCallOverlay = document.getElementById('incomingCallOverlay');
    // Hide incoming call UI
    if (incomingCallOverlay) {
        incomingCallOverlay.style.display = 'none';
    }
    
    // Cleanup
    cleanupCall();
}

/**
 * Handle call decline from the other party
 */
function handleCallDeclined(data) {
    // Stop dial tone
    stopDialTone();
    
    const outgoingCallOverlay = document.getElementById('outgoingCallOverlay');
    // Hide outgoing call UI
    if (outgoingCallOverlay) {
        outgoingCallOverlay.style.display = 'none';
        outgoingCallOverlay.classList.remove('visible');
    }
    
    // Show decline alert
    if (window.alertPopup) {
        window.alertPopup.showInfo("Call Declined", "The other party declined your call.");
    }
    
    // Cleanup
    cleanupCall();
}

/**
 * Cancel an outgoing call
 */
function cancelOutgoingCall() {
    // Stop dial tone
    stopDialTone();
    
    // Send end call message
    if (currentCallData && currentCallData.roomId) {
        sendCallSignaling({
            type: 'call_end',
            target_user_id: currentCallData.targetUserId,
            room_id: currentCallData.roomId
        });
    }
    
    const outgoingCallOverlay = document.getElementById('outgoingCallOverlay');
    // Hide outgoing call UI
    if (outgoingCallOverlay) {
        outgoingCallOverlay.style.display = 'none';
        outgoingCallOverlay.classList.remove('visible');
    }
    
    // Cleanup
    cleanupCall();
}

/**
 * End an active call
 */
function endCall() {
    // Send end call message
    if (currentCallData && currentCallData.roomId) {
        sendCallSignaling({
            type: 'call_end',
            target_user_id: currentCallData.targetUserId,
            room_id: currentCallData.roomId
        });
    }
    
    const activeCallOverlay = document.getElementById('activeCallOverlay');
    // Hide active call UI
    if (activeCallOverlay) {
        activeCallOverlay.style.display = 'none';
    }
    
    // Stop timer
    stopCallTimer();
    
    // Cleanup
    cleanupCall();
}

/**
 * Handle call end from the other party
 */
function handleCallEnd(data) {
    // Hide all call UIs
    const incomingCallOverlay = document.getElementById('incomingCallOverlay');
    const outgoingCallOverlay = document.getElementById('outgoingCallOverlay');
    const activeCallOverlay = document.getElementById('activeCallOverlay');
    
    if (incomingCallOverlay) incomingCallOverlay.style.display = 'none';
    if (outgoingCallOverlay) {
        outgoingCallOverlay.style.display = 'none';
        outgoingCallOverlay.classList.remove('visible');
    }
    if (activeCallOverlay) activeCallOverlay.style.display = 'none';
    
    // Stop sounds
    stopRingtone();
    stopDialTone();
    
    // Stop timer
    stopCallTimer();
    
    // Cleanup
    cleanupCall();
}

/**
 * Show the outgoing call UI
 */
function showOutgoingCall(contactName, contactAvatar) {
    const outgoingCallOverlay = document.getElementById('outgoingCallOverlay');
    const calleeAvatar = document.getElementById('calleeAvatar');
    const calleeName = document.getElementById('calleeName');
    const outgoingCallStatus = document.getElementById('outgoingCallStatus');
    
    if (calleeAvatar) calleeAvatar.src = contactAvatar || '/static/images/shrek.jpg';
    if (calleeName) calleeName.textContent = contactName || 'User';
    if (outgoingCallStatus) outgoingCallStatus.textContent = 'Calling...';
    
    if (outgoingCallOverlay) {
        outgoingCallOverlay.style.display = 'flex';
        outgoingCallOverlay.classList.add('visible');
    }
    
    // Play outgoing call sound
    playDialTone();
}

/**
 * Show the incoming call UI
 */
function showIncomingCall(callerName, callerAvatar) {
    const incomingCallOverlay = document.getElementById('incomingCallOverlay');
    const callerAvatarElem = document.getElementById('callerAvatar');
    const callerNameElem = document.getElementById('callerName');
    
    if (callerAvatarElem) callerAvatarElem.src = callerAvatar || '/static/images/shrek.jpg';
    if (callerNameElem) callerNameElem.textContent = callerName || 'User';
    
    if (incomingCallOverlay) incomingCallOverlay.style.display = 'flex';
    activeCallOverlay.style.display = 'flex';
}

/**
 * Start an active call
 */
function startActiveCall() {
    const incomingCallOverlay = document.getElementById('incomingCallOverlay');
    const outgoingCallOverlay = document.getElementById('outgoingCallOverlay');
    const activeCallOverlay = document.getElementById('activeCallOverlay');
    const activeCallAvatar = document.getElementById('activeCallAvatar');
    const activeCallName = document.getElementById('activeCallName');
    
    // Hide other call UIs
    if (incomingCallOverlay) incomingCallOverlay.style.display = 'none';
    if (outgoingCallOverlay) outgoingCallOverlay.style.display = 'none';
    
    // Set up active call UI
    if (activeCallAvatar) {
        activeCallAvatar.src = currentCallData.contactAvatar || '/static/images/shrek.jpg';
    }
    if (activeCallName) {
        activeCallName.textContent = currentCallData.contactName || 'User';
    }
    
    if (activeCallOverlay) activeCallOverlay.style.display = 'flex';
    
    // Set call as active and start timer
    callActive = true;
    startCallTimer();
}

/**
 * Toggle mute state
 */
function toggleMute() {
    if (!localStream) return;
    
    isAudioMuted = !isAudioMuted;
    
    localStream.getAudioTracks().forEach(track => {
        track.enabled = !isAudioMuted;
    });
    
    // Update mute button UI
    const toggleMuteBtn = document.getElementById('toggleMuteBtn');
    if (toggleMuteBtn) {
        if (isAudioMuted) {
            toggleMuteBtn.querySelector('i').className = 'fas fa-microphone-slash';
        } else {
            toggleMuteBtn.querySelector('i').className = 'fas fa-microphone';
        }
    }
}

/**
 * Start the call timer
 */
function startCallTimer() {
    callDuration = 0;
    updateCallDuration();
    
    callTimer = setInterval(() => {
        callDuration++;
        updateCallDuration();
    }, 1000);
}

/**
 * Stop the call timer
 */
function stopCallTimer() {
    if (callTimer) {
        clearInterval(callTimer);
        callTimer = null;
    }
}

/**
 * Update the call duration display
 */
function updateCallDuration() {
    const callDurationElement = document.getElementById('callDuration');
    if (!callDurationElement) return;
    
    const minutes = Math.floor(callDuration / 60).toString().padStart(2, '0');
    const seconds = (callDuration % 60).toString().padStart(2, '0');
    
    callDurationElement.textContent = `${minutes}:${seconds}`;
}

/**
 * Play ringtone for incoming call
 */
function playRingtone() {
    try {
        ringtone = new Audio('/static/sounds/notification.mp3');
        ringtone.loop = true;
        ringtone.play().catch(e => console.log('Failed to play ringtone:', e));
    } catch (error) {
        console.error('Failed to play ringtone:', error);
    }
}

/**
 * Stop ringtone
 */
function stopRingtone() {
    if (ringtone) {
        ringtone.pause();
        ringtone = null;
    }
}

/**
 * Play dial tone for outgoing call
 */
function playDialTone() {
    try {
        dialTone = new Audio('/static/sounds/notification2.mp3');
        dialTone.loop = true;
        dialTone.play().catch(e => console.log('Failed to play dial tone:', e));
    } catch (error) {
        console.error('Failed to play dial tone:', error);
    }
}

/**
 * Stop dial tone
 */
function stopDialTone() {
    if (dialTone) {
        dialTone.pause();
        dialTone = null;
    }
}

/**
 * Send a call signaling message through the WebSocket
 */
function sendCallSignaling(message) {
    if (window.shrekChatWebSocket && window.shrekChatWebSocket.sendCallSignaling) {
        window.shrekChatWebSocket.sendCallSignaling(message);
    } else {
        console.error("WebSocket interface is not available");
    }
}

/**
 * Clean up call resources
 */
function cleanupCall() {
    // Stop media streams
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    // Close peer connection
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    // Reset call state
    callActive = false;
    currentCallData = null;
    isAudioMuted = false;
    
    // Stop sounds
    stopRingtone();
    stopDialTone();
}

// Export functions for use by other modules
window.shrekChatCall = {
    startCall,
    acceptIncomingCall,
    declineIncomingCall,
    endCall,
    toggleMute,
    handleCallOffer,
    handleCallAnswer,
    handleIceCandidate,
    handleCallEnd,
    handleCallDeclined,
    cleanupCall
};

// Initialize WebRTC when the page loads
document.addEventListener('DOMContentLoaded', initWebRTC);