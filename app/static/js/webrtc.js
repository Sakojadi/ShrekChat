/**
 * WebRTC Audio Call functionality for ShrekChat
 */

// WebRTC variables
let localStream = null;
let peerConnection = null;
let callInProgress = false;
let remoteUsername = null;
let callType = 'audio'; // Default to audio call

// DOM elements
let callButton;
let callPopup;

// Configure WebRTC with STUN/TURN servers
const servers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
    // Add TURN servers in production for better connectivity
  ]
};

// Initialize WebRTC functionality
document.addEventListener('DOMContentLoaded', function() {
  console.log("WebRTC module loaded");
  
  // Initialize DOM elements
  callButton = document.getElementById('callButton');
  
  // Create call popup
  createCallPopup();
  
  if (callButton) {
    callButton.addEventListener('click', function() {
      console.log("Call button clicked");
      const chatContent = document.getElementById('chatContent');
      if (!chatContent) return;

      // Check if this is a group chat (don't allow calls in groups)
      const isGroup = chatContent.hasAttribute('data-current-room-id') && 
                     !chatContent.hasAttribute('data-current-user-id');

      if (isGroup) {
        showToast('Audio calls are only available for direct chats');
        return;
      }

      // Get current chat user info
      const currentRoomId = chatContent.getAttribute('data-current-room-id');
      const currentUserId = chatContent.getAttribute('data-current-user-id');
      const recipientUsername = document.getElementById('chatContactName')?.textContent;
      
      if (!currentRoomId || !currentUserId || !recipientUsername) {
        console.error("Missing data for call", {currentRoomId, currentUserId, recipientUsername});
        return;
      }

      // Store recipient info
      remoteUsername = recipientUsername;
      
      // Start the call
      startCall(currentRoomId, currentUserId);
    });
  } else {
    console.error("Call button not found!");
  }
});

// Create call popup element
function createCallPopup() {
  // Check if it already exists
  let existingPopup = document.getElementById('call-popup');
  if (existingPopup) {
    callPopup = existingPopup;
    return;
  }
  
  // Create new popup
  callPopup = document.createElement('div');
  callPopup.id = 'call-popup';
  callPopup.className = 'call-popup';
  callPopup.style.display = 'none';
  callPopup.style.zIndex = '10000'; // Make sure it's above everything
  document.body.appendChild(callPopup);
  
  console.log("Call popup created");
}

// Start a call with a user
function startCall(roomId, userId) {
  if (callInProgress) {
    showToast('Call already in progress');
    return;
  }

  // Check if browser supports WebRTC
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast('Your browser does not support audio calls');
    return;
  }

  // Create call popup UI
  showCallPopup('outgoing', remoteUsername);

  // Get user media (audio only)
  navigator.mediaDevices.getUserMedia({
    audio: true,
    video: false
  })
  .then(function(stream) {
    console.log("Got local audio stream");
    localStream = stream;
    
    // Initialize peer connection
    createPeerConnection();
    
    // Add local stream to peer connection
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
    
    // Create offer
    return peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false
    });
  })
  .then(function(offer) {
    console.log("Created offer:", offer);
    
    // Set local description
    return peerConnection.setLocalDescription(offer);
  })
  .then(function() {
    // Send offer to remote peer via WebSocket
    if (window.shrekChatWebSocket && window.shrekChatWebSocket.chatWebSocket) {
      const callOffer = {
        type: "call_offer",
        room_id: roomId,
        target_user_id: userId,
        sdp: peerConnection.localDescription,
        call_type: callType
      };
      
      window.shrekChatWebSocket.sendCallSignal(callOffer);
    }
  })
  .catch(function(error) {
    console.error("Error starting call:", error);
    endCall();
    showToast('Failed to start audio call');
  });

  callInProgress = true;
}

// Handle an incoming call
function handleIncomingCall(data) {
  console.log("INCOMING CALL RECEIVED:", data);
  
  if (callInProgress) {
    // Send busy signal
    sendCallResponse(data.room_id, data.caller_id, 'busy');
    return;
  }

  // Force audio permission immediately on call receipt
  navigator.mediaDevices.getUserMedia({
    audio: true,
    video: false
  })
  .then(function(stream) {
    console.log("Got local audio stream for incoming call");
    localStream = stream;
    
    // Store call data for accepting
    window.currentCallData = data;
    
    // Store remote user information
    remoteUsername = data.caller_name || 'Unknown';
    
    // Show incoming call popup
    showCallPopup('incoming', remoteUsername);
    
    // Add accept/reject buttons
    const acceptButton = document.querySelector('.call-accept');
    const rejectButton = document.querySelector('.call-reject');

    if (acceptButton) {
      acceptButton.onclick = function() {
        acceptCall(data);
      };
    }
    
    if (rejectButton) {
      rejectButton.onclick = function() {
        rejectCall(data);
      };
    }
  })
  .catch(function(error) {
    console.error("Error accessing microphone:", error);
    // Show incoming call popup anyway - can ask for permission when accepting
    
    // Store call data for accepting
    window.currentCallData = data;
    
    // Store remote user information
    remoteUsername = data.caller_name || 'Unknown';
    
    // Show incoming call popup
    showCallPopup('incoming', remoteUsername);
    
    // Add accept/reject buttons
    const acceptButton = document.querySelector('.call-accept');
    const rejectButton = document.querySelector('.call-reject');

    if (acceptButton) {
      acceptButton.onclick = function() {
        acceptCall(data);
      };
    }
    
    if (rejectButton) {
      rejectButton.onclick = function() {
        rejectCall(data);
      };
    }
  });
}

// Accept an incoming call
function acceptCall(data) {
  console.log("Accepting call from", data.caller_name);
  
  // Update UI
  updateCallPopup('connecting');
  
  // Get user media (audio only)
  navigator.mediaDevices.getUserMedia({
    audio: true,
    video: false
  })
  .then(function(stream) {
    console.log("Got local audio stream");
    localStream = stream;
    
    // Initialize peer connection
    createPeerConnection();
    
    // Add local stream to peer connection
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
    
    // Set remote description from offer
    return peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
  })
  .then(function() {
    // Create answer
    return peerConnection.createAnswer();
  })
  .then(function(answer) {
    console.log("Created answer:", answer);
    
    // Set local description
    return peerConnection.setLocalDescription(answer);
  })
  .then(function() {
    // Send answer to caller via WebSocket
    sendCallResponse(data.room_id, data.caller_id, 'accepted', peerConnection.localDescription);
  })
  .catch(function(error) {
    console.error("Error accepting call:", error);
    endCall();
    showToast('Failed to establish call');
  });

  callInProgress = true;
}

// Reject an incoming call
function rejectCall(data) {
  console.log("Rejecting call from", data.caller_name);
  
  // Send rejection to caller
  sendCallResponse(data.room_id, data.caller_id, 'rejected');
  
  // Hide call popup
  hideCallPopup();
}

// Send call response (accept/reject/busy)
function sendCallResponse(roomId, targetUserId, status, sdp = null) {
  if (window.shrekChatWebSocket) {
    const response = {
      type: "call_response",
      room_id: roomId,
      target_user_id: targetUserId,
      status: status
    };
    
    if (sdp) {
      response.sdp = sdp;
    }
    
    window.shrekChatWebSocket.sendCallSignal(response);
  }
}

// Handle a call response (accept/reject/busy)
function handleCallResponse(data) {
  console.log("Call response received:", data.status);
  
  if (data.status === 'accepted') {
    // Call was accepted, establish connection
    peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp))
      .then(function() {
        console.log("Remote description set, call established");
        updateCallPopup('established');
      })
      .catch(function(error) {
        console.error("Error setting remote description:", error);
        endCall();
      });
  } 
  else if (data.status === 'rejected') {
    // Call was rejected
    showToast(`${remoteUsername} rejected your call`);
    endCall();
  } 
  else if (data.status === 'busy') {
    // User is busy
    showToast(`${remoteUsername} is busy with another call`);
    endCall();
  }
}

// Handle ICE candidate
function handleIceCandidate(data) {
  if (peerConnection) {
    const candidate = new RTCIceCandidate(data.candidate);
    peerConnection.addIceCandidate(candidate)
      .catch(function(error) {
        console.error("Error adding ICE candidate:", error);
      });
  }
}

// Create RTCPeerConnection
function createPeerConnection() {
  if (peerConnection) {
    peerConnection.close();
  }
  
  peerConnection = new RTCPeerConnection(servers);
  
  // Handle ICE candidate events
  peerConnection.onicecandidate = function(event) {
    if (event.candidate) {
      // Get the current data we need
      const chatContent = document.getElementById('chatContent');
      const currentRoomId = chatContent.getAttribute('data-current-room-id');
      let targetUserId;
      
      if (window.currentCallData) {
        // If we're answering a call, send ICE to the caller
        targetUserId = window.currentCallData.caller_id;
      } else {
        // If we're initiating, send to the target user
        targetUserId = chatContent.getAttribute('data-current-user-id');
      }
      
      // Send ICE candidate to remote peer via WebSocket
      const iceData = {
        type: "ice_candidate",
        candidate: event.candidate,
        room_id: currentRoomId,
        target_user_id: targetUserId
      };
      
      console.log("Sending ICE candidate to:", targetUserId);
      
      if (window.shrekChatWebSocket) {
        window.shrekChatWebSocket.sendCallSignal(iceData);
      }
    }
  };
  
  // Handle connection state changes
  peerConnection.onconnectionstatechange = function() {
    console.log("Connection state:", peerConnection.connectionState);
    
    if (peerConnection.connectionState === 'connected') {
      // Call connected successfully
      updateCallPopup('established');
    } 
    else if (peerConnection.connectionState === 'disconnected' || 
             peerConnection.connectionState === 'failed' ||
             peerConnection.connectionState === 'closed') {
      // Call ended or failed
      endCall();
    }
  };
  
  // Handle receiving remote stream
  peerConnection.ontrack = function(event) {
    console.log("Remote track received");
    
    // Play remote audio
    const remoteAudio = document.createElement('audio');
    remoteAudio.id = 'remoteAudio';
    remoteAudio.srcObject = event.streams[0];
    remoteAudio.autoplay = true;
    document.body.appendChild(remoteAudio);
    
    // Remove any previous remote audio elements
    const oldRemoteAudio = document.getElementById('remoteAudio');
    if (oldRemoteAudio && oldRemoteAudio !== remoteAudio) {
      oldRemoteAudio.remove();
    }
  };
}

// End the current call
function endCall() {
  console.log("Ending call");
  
  // Stop local media tracks
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  
  // Close peer connection
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  
  // Remove remote audio element
  const remoteAudio = document.getElementById('remoteAudio');
  if (remoteAudio) {
    remoteAudio.remove();
  }
  
  // Hide call popup
  hideCallPopup();
  
  callInProgress = false;
  remoteUsername = null;
}

// Show call popup UI
function showCallPopup(type, username) {
  // Make sure the popup exists
  if (!callPopup) {
    createCallPopup();
  }
  
  console.log(`Showing ${type} call popup for ${username}`);
  
  callPopup.innerHTML = `
    <div class="call-popup-content">
      <div class="call-avatar">
        <i class="fas fa-phone"></i>
      </div>
      <div class="call-info">
        <h3>${username}</h3>
        <p class="call-status">${type === 'outgoing' ? 'Calling...' : 'Incoming call'}</p>
        <div class="call-timer">00:00</div>
      </div>
      <div class="call-actions">
        ${type === 'incoming' ? `
          <button class="call-accept" title="Accept">
            <i class="fas fa-phone"></i>
          </button>
          <button class="call-reject" title="Reject">
            <i class="fas fa-phone-slash"></i>
          </button>
        ` : `
          <button class="call-end" title="End call">
            <i class="fas fa-phone-slash"></i>
          </button>
        `}
      </div>
    </div>
  `;
  
  // Ensure proper styling
  callPopup.style.display = 'flex';
  callPopup.style.position = 'fixed';
  callPopup.style.top = '0';
  callPopup.style.left = '0';
  callPopup.style.right = '0';
  callPopup.style.bottom = '0';
  callPopup.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  callPopup.style.zIndex = '10000';
  callPopup.style.alignItems = 'center';
  callPopup.style.justifyContent = 'center';
  
  // Add event handlers
  const endCallButton = callPopup.querySelector('.call-end');
  if (endCallButton) {
    endCallButton.onclick = endCall;
  }
  
  // Play sound for incoming calls
  if (type === 'incoming') {
    try {
      // Use both notification sounds for better chance of hearing it
      const ringtone1 = new Audio('/static/sounds/notification.mp3');
      const ringtone2 = new Audio('/static/sounds/notification2.mp3');
      
      ringtone1.loop = true;
      ringtone2.loop = true;
      
      // Play both sounds with a small delay between them
      const playSound = () => {
        ringtone1.play().catch(e => console.log('Failed to play ringtone1'));
        setTimeout(() => {
          ringtone2.play().catch(e => console.log('Failed to play ringtone2'));
        }, 500);
      };
      
      // Try to play immediately
      playSound();
      
      // Also set an interval to keep trying to play the sound
      // (browsers might block autoplay until user interaction)
      const soundInterval = setInterval(playSound, 3000);
      
      // Store ringtones to stop them later
      callPopup.ringtones = [ringtone1, ringtone2];
      callPopup.soundInterval = soundInterval;
      
      // Try to show a system notification as well
      if ("Notification" in window) {
        if (Notification.permission === "granted") {
          new Notification(`Incoming call from ${username}`, {
            icon: '/static/images/shrek.jpg',
            body: 'Click to answer'
          });
        } else if (Notification.permission !== "denied") {
          Notification.requestPermission().then(permission => {
            if (permission === "granted") {
              new Notification(`Incoming call from ${username}`, {
                icon: '/static/images/shrek.jpg',
                body: 'Click to answer'
              });
            }
          });
        }
      }
      
    } catch (error) {
      console.log('Failed to play ringtone', error);
    }
  }
}

// Hide call popup UI
function hideCallPopup() {
  if (!callPopup) return;
  
  // Stop ringtones if playing
  if (callPopup.ringtones && callPopup.ringtones.length) {
    callPopup.ringtones.forEach(ringtone => {
      if (ringtone) {
        ringtone.pause();
        ringtone.currentTime = 0;
      }
    });
    callPopup.ringtones = null;
  }
  
  // Clear sound interval if exists
  if (callPopup.soundInterval) {
    clearInterval(callPopup.soundInterval);
    callPopup.soundInterval = null;
  }
  
  // Clear timer interval
  if (callTimerInterval) {
    clearInterval(callTimerInterval);
    callTimerInterval = null;
  }
  
  // Hide popup
  callPopup.style.display = 'none';
  callPopup.innerHTML = '';
}

function updateCallPopup(state) {
  const statusElement = callPopup.querySelector('.call-status');
  const timerElement = callPopup.querySelector('.call-timer');
  
  if (statusElement) {
    switch (state) {
      case 'connecting':
        statusElement.textContent = 'Connecting...';
        break;
      case 'established':
        statusElement.textContent = 'Connected';
        // Start call timer
        startCallTimer(timerElement);
        break;
      default:
        statusElement.textContent = 'Calling...';
    }
  }

  // Make sure we show the end call button regardless of initial popup type
  const callActions = callPopup.querySelector('.call-actions');
  if (callActions && state === 'established') {
    callActions.innerHTML = `
      <button class="call-end" title="End call">
        <i class="fas fa-phone-slash"></i>
      </button>
    `;
    
    const endCallButton = callPopup.querySelector('.call-end');
    if (endCallButton) {
      endCallButton.onclick = endCall;
    }
  }
}

// Start call timer
let callTimerInterval;
function startCallTimer(timerElement) {
  if (!timerElement) return;
  
  let seconds = 0;
  let minutes = 0;
  
  // Clear any existing timer
  if (callTimerInterval) {
    clearInterval(callTimerInterval);
  }
  
  callTimerInterval = setInterval(() => {
    seconds++;
    if (seconds >= 60) {
      seconds = 0;
      minutes++;
    }
    
    const formattedMinutes = minutes.toString().padStart(2, '0');
    const formattedSeconds = seconds.toString().padStart(2, '0');
    
    timerElement.textContent = `${formattedMinutes}:${formattedSeconds}`;
  }, 1000);
}

// Helper function to show toast notifications
function showToast(message, duration = 3000) {
  // If we have the window.shrekChatUtils, use that
  if (window.shrekChatUtils && window.shrekChatUtils.showToast) {
    window.shrekChatUtils.showToast(message, duration);
    return;
  }

  // Otherwise create our own toast
  const toast = document.createElement('div');
  toast.className = 'toast-notification';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background-color: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 10px 20px;
    border-radius: 4px;
    z-index: 10000;
    font-size: 14px;
  `;
  
  document.body.appendChild(toast);
  
  // Remove after duration
  setTimeout(() => {
    toast.remove();
  }, duration);
}

// Expose WebRTC functions to global scope
window.shrekChatWebRTC = {
  startCall,
  endCall,
  handleIncomingCall,
  handleCallResponse,
  handleIceCandidate
};