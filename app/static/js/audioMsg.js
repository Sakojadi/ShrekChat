/**
 * Audio message handling for ShrekChat
 */

let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
const MAX_RECORDING_TIME = 300000; // 5 minutes max

// Initialize audio recording
function initAudioRecording() {
    const audioBtn = document.getElementById('audioRecordBtn');
    if (!audioBtn) return;

    // Add click event for toggle recording
    audioBtn.addEventListener('click', toggleRecording);
}

// Toggle recording state
async function toggleRecording() {
    // Check if user is blocked before allowing recording
    const chatContent = document.getElementById('chatContent');
    if (chatContent) {
        const currentUserId = chatContent.getAttribute('data-current-user-id');
        if (currentUserId) {
            // If checkIfBlocked is available, check block status
            if (typeof checkIfBlocked === 'function') {
                try {
                    const blockStatus = await checkIfBlocked(currentUserId);
                    if (blockStatus.is_blocked) {
                        alert('You cannot send audio messages to a blocked user');
                        return;
                    }
                    if (blockStatus.is_blocker) {
                        alert('You cannot send audio messages to a user who has blocked you');
                        return;
                    }
                } catch (error) {
                    console.error('Error checking block status:', error);
                }
            }
        }
    }

    // If we get here, user is not blocked
    if (isRecording) {
        stopRecording();
    } else {
        await startRecording();
    }
}

// Start recording audio
async function startRecording() {
    if (isRecording) return;

    try {
        // First check if we have permission
        const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
        console.log('Microphone permission status:', permissionStatus.state);

        if (permissionStatus.state === 'denied') {
            throw new Error('Microphone access was denied. Please check your browser settings.');
        }

        // Try to get the media stream
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100
            }
        });
        
        console.log('Got media stream:', stream.getAudioTracks());

        // Try different mimeTypes in order of preference
        const mimeTypes = [
            'audio/mp3',
            'audio/webm',
            'audio/ogg',
            'audio/wav'
        ];

        let selectedMimeType = null;
        for (const mimeType of mimeTypes) {
            if (MediaRecorder.isTypeSupported(mimeType)) {
                selectedMimeType = mimeType;
                console.log('Using mimeType:', mimeType);
                break;
            }
        }

        if (!selectedMimeType) {
            throw new Error('No supported audio format found');
        }

        mediaRecorder = new MediaRecorder(stream, {
            mimeType: selectedMimeType
        });
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            console.log('Data available:', event.data.size, 'bytes');
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            console.log('Recording stopped, chunks:', audioChunks.length);
            const audioBlob = new Blob(audioChunks, { type: selectedMimeType });
            console.log('Created blob:', audioBlob.size, 'bytes');
            await sendAudioMessage(audioBlob);
            
            // Stop all tracks
            stream.getTracks().forEach(track => {
                track.stop();
                console.log('Stopped track:', track.label);
            });
        };

        mediaRecorder.onerror = (event) => {
            console.error('MediaRecorder error:', event);
            alert('Error during recording: ' + event.error.message);
        };

        mediaRecorder.start();
        isRecording = true;
        document.getElementById('audioRecordBtn').classList.add('recording');
        
        // Auto-stop after max recording time
        setTimeout(() => {
            if (isRecording) {
                stopRecording();
            }
        }, MAX_RECORDING_TIME);
    } catch (error) {
        console.error('Error accessing microphone:', error);
        alert('Could not access microphone: ' + error.message);
    }
}

// Stop recording audio
function stopRecording() {
    if (!isRecording) return;

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
    
    isRecording = false;
    document.getElementById('audioRecordBtn').classList.remove('recording');
}

// Send audio message
async function sendAudioMessage(audioBlob) {
    if (!window.shrekChatWebSocket || !window.shrekChatWebSocket.getCurrentRoomId()) {
        console.error('No active chat room');
        return;
    }

    const roomId = window.shrekChatWebSocket.getCurrentRoomId();
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio-message.mp3');
    formData.append('room_id', roomId);
    formData.append('attachment_type', 'audio');

    try {
        const response = await fetch('/api/messages/attachment', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to upload audio message');
        }

        const result = await response.json();
        if (result.success) {
            console.log('Audio message sent successfully');
              // Create a temporary message element
            const messageElement = document.createElement('div');
            messageElement.className = 'message outgoing';
            messageElement.setAttribute('data-temp-message', 'true');
            
            // Generate a temporary message ID for tracking
            const tempId = `temp-${Date.now()}`;
            messageElement.setAttribute('data-message-id', tempId);
            
            // Get current time
            const now = new Date();
            const timeStr = window.shrekChatUtils?.formatTime(now) || 
                now.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', hour12:false});
              // Create audio player
            const audioUrl = URL.createObjectURL(audioBlob);
            messageElement.innerHTML = `
                <div class="message-content">
                    <div class="attachment-preview">
                        <audio src="${audioUrl}" controls></audio>
                        <div class="attachment-info">
                            <span class="attachment-name">audio-message.mp3</span>
                        </div>
                    </div>
                </div>
                <div class="message-info">
                    <div class="message-time">${timeStr}</div>
                    <div class="message-status">
                        <i class="fas fa-check message-status-single"></i>
                        <i class="fas fa-check-double message-status-double"></i>
                    </div>
                </div>
            `;
              // Add message to chat
            const chatMessages = document.getElementById('chatMessages');
            if (chatMessages) {
                chatMessages.appendChild(messageElement);
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
            
            // Update last message in sidebar
            if (window.shrekChatUtils && window.shrekChatUtils.updateLastMessage) {
                window.shrekChatUtils.updateLastMessage(roomId, '🎵 Audio message', timeStr);
            }
            
            // Update the message with the real message ID from the server response
            if (result.message && result.message.id) {
                // Remove temp flag and set the real message ID
                messageElement.removeAttribute('data-temp-message');
                messageElement.setAttribute('data-message-id', result.message.id);
                
                // Update message status indicators
                const messageStatusSingle = messageElement.querySelector('.message-status-single');
                const messageStatusDouble = messageElement.querySelector('.message-status-double');
                
                if (messageStatusSingle && messageStatusDouble) {
                    messageStatusSingle.style.display = 'none';
                    messageStatusDouble.style.display = 'inline';
                }
                
                // Check if we need to update for read status
                if (result.message.read) {
                    messageStatusDouble.classList.add('read');
                }
            }
        } else {
            throw new Error('Failed to send audio message');
        }
    } catch (error) {
        console.error('Error sending audio message:', error);
        alert('Failed to send audio message: ' + error.message);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initAudioRecording);
