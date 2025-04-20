/**
 * WebSocket handling for ShrekChat
 */

// WebSocket connections
let chatWebSocket = null;
let presenceWebSocket = null;
let currentRoomId = null;
let currentRoomIsGroup = false;
let currentUserId = null;

// Debug mode - set to true for verbose logging
const WEBSOCKET_DEBUG = true;

// Logger function for WebSocket operations
function wsLog(message, data = null) {
    if (WEBSOCKET_DEBUG) {
        if (data) {
            console.log(`[WebSocket] ${message}`, data);
        } else {
            console.log(`[WebSocket] ${message}`);
        }
    }
}

// Initialize WebSocket - Should be called on page load
function initializeWebSockets() {
    wsLog("Initializing WebSockets...");
    
    // Connect to presence WebSocket - this one stays connected all the time
    connectPresenceWebSocket();
    
    // Check if we have a lastOpenedRoomId in localStorage to reconnect
    const lastOpenedRoomId = localStorage.getItem('lastOpenedRoomId');
    if (lastOpenedRoomId) {
        // Check if we already have an active chat open (to prevent reloading when receiving notifications)
        const chatContent = document.getElementById('chatContent');
        
        // If already in a chat, don't try to reconnect automatically
        if (chatContent && chatContent.style.display === 'flex') {
            wsLog("User is already in an active chat, skipping auto-reconnect");
            
            // Still connect the WebSocket to the current room but don't reload the UI
            const currentRoomId = chatContent.getAttribute('data-current-room-id');
            if (currentRoomId) {
                connectChatWebSocket(currentRoomId, null, true); // true = suppressReload
            }
            return;
        }
        
        wsLog(`Attempting to reconnect to last opened room: ${lastOpenedRoomId}`);
        // Get the room data to reopen the chat
        fetch(`/api/rooms/${lastOpenedRoomId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to load room');
                }
                return response.json();
            })
            .then(roomData => {
                if (roomData) {
                    wsLog(`Reopening last active chat: ${roomData.name}`);
                    // If we have openChat function exposed, use it
                    if (window.openChat) {
                        window.openChat(roomData);
                    }
                    // Highlight this contact in the sidebar
                    const contactElement = document.querySelector(`.contact-item[data-room-id="${roomData.id}"]`);
                    if (contactElement) {
                        contactElement.classList.add('active');
                    }
                }
            })
            .catch(error => {
                console.error("Error reconnecting to room:", error);
            });
    }
}

// Connect to presence WebSocket
function connectPresenceWebSocket() {
    // Get username from the DOM
    const currentUsername = document.querySelector('.profile-name')?.textContent.trim();
    
    // Only connect if we have a username
    if (!currentUsername) {
        console.error("Cannot connect to presence WebSocket: No username available");
        return;
    }
    
    const socket_protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${socket_protocol}//${window.location.host}/ws/presence?username=${encodeURIComponent(currentUsername)}`;
    
    wsLog(`Connecting to presence WebSocket: ${wsUrl}`);
    try {
        presenceWebSocket = new WebSocket(wsUrl);
        
        presenceWebSocket.onopen = function() {
            wsLog("Presence WebSocket connection established successfully");
            
            // Send periodic pings to keep the connection alive
            setInterval(function() {
                if (presenceWebSocket && presenceWebSocket.readyState === WebSocket.OPEN) {
                    presenceWebSocket.send("ping");
                    wsLog("Sent ping to presence WebSocket");
                }
            }, 30000);
        };
        
        presenceWebSocket.onmessage = function(event) {
            try {
                const data = JSON.parse(event.data);
                wsLog("Received presence message:", data);
                
                if (data.type === "status") {
                    // Use the utility function to update status
                    if (window.shrekChatUtils) {
                        window.shrekChatUtils.updateContactStatus(data.user_id, data.status);
                    }
                }
            } catch (error) {
                console.error("Error parsing presence message:", error, event.data);
            }
        };
        
        presenceWebSocket.onerror = function(event) {
            console.error("Presence WebSocket error:", event);
        };
        
        presenceWebSocket.onclose = function(event) {
            wsLog(`Presence WebSocket closed. Code: ${event.code}, Reason: ${event.reason}`);
            if (event.code !== 1000) {
                wsLog("Presence WebSocket connection closed unexpectedly - trying to reconnect in 5 seconds");
                // Try to reconnect after delay
                setTimeout(connectPresenceWebSocket, 5000);
            }
        };
    } catch (error) {
        console.error("Error creating presence WebSocket:", error);
    }
}

// Connect to chat WebSocket for a specific room
function connectChatWebSocket(roomId, onConnectCallback, suppressReload = false) {
    wsLog(`Connecting chat WebSocket for room: ${roomId}`);
    
    // Store current room ID
    currentRoomId = roomId;
    
    // Close previous WebSocket if open
    if (chatWebSocket) {
        wsLog("Closing existing chat WebSocket");
        try {
            chatWebSocket.close();
        } catch (e) {
            console.error("Error closing existing WebSocket:", e);
        }
        chatWebSocket = null;
    }
    
    // Check if we have a valid room ID
    if (!roomId) {
        console.error("Cannot connect WebSocket: No room ID provided");
        return;
    }
    
    // Get token for this chat session
    wsLog("Fetching chat token...");
    fetch(`/api/token/chat?roomId=${roomId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to get chat token. Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            const token = data.token;
            if (!token) {
                throw new Error('No token received from server');
            }
            
            wsLog("Chat token received successfully");
            
            const socket_protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${socket_protocol}//${window.location.host}/ws/chat/${encodeURIComponent(token)}`;
            
            wsLog(`Creating chat WebSocket connection: ${wsUrl}`);
            try {
                chatWebSocket = new WebSocket(wsUrl);
                
                chatWebSocket.onopen = function(event) {
                    wsLog(`Chat WebSocket connection established for room ${roomId}`);
                    // Send a ping to verify connection is working
                    chatWebSocket.send(JSON.stringify({type: "ping"}));
                    
                    // Set up a heartbeat to keep the connection alive
                    const heartbeatInterval = setInterval(function() {
                        if (chatWebSocket && chatWebSocket.readyState === WebSocket.OPEN) {
                            try {
                                chatWebSocket.send(JSON.stringify({type: "ping"}));
                                wsLog("Sent heartbeat ping");
                            } catch (e) {
                                console.error("Error sending heartbeat:", e);
                                clearInterval(heartbeatInterval);
                            }
                        } else {
                            wsLog("Clearing heartbeat interval - WebSocket not open");
                            clearInterval(heartbeatInterval);
                        }
                    }, 30000);
                    
                    // Clear the interval when the socket closes
                    chatWebSocket.addEventListener('close', function() {
                        wsLog("Clearing heartbeat interval - WebSocket closed");
                        clearInterval(heartbeatInterval);
                    });
                    
                    // Call the callback if provided
                    if (typeof onConnectCallback === 'function') {
                        onConnectCallback();
                    }
                };
                
                setupChatWebSocketEvents(chatWebSocket, () => {
                    wsLog("Attempting to reconnect chat WebSocket...");
                    connectChatWebSocket(roomId, onConnectCallback, suppressReload);
                });
                
                chatWebSocket.onerror = function(event) {
                    console.error("Chat WebSocket error:", event);
                };
                
                chatWebSocket.onclose = function(event) {
                    wsLog(`Chat WebSocket closed. Code: ${event.code}, Reason: ${event.reason}`);
                    if (event.code !== 1000) {
                        wsLog("Chat WebSocket connection closed unexpectedly - attempting to reconnect");
                        // Try to reconnect if this is still the current room
                        if (currentRoomId === roomId) {
                            setTimeout(() => {
                                wsLog("Attempting to reconnect chat WebSocket...");
                                connectChatWebSocket(roomId, onConnectCallback, suppressReload);
                            }, 3000);
                        }
                    }
                };
            } catch (error) {
                console.error("Error creating chat WebSocket:", error);
            }
        })
        .catch(error => {
            console.error('Error getting chat token:', error);
            // Try again after a delay
            wsLog("Will try to reconnect after delay");
            setTimeout(() => connectChatWebSocket(roomId, onConnectCallback, suppressReload), 5000);
        });
}

// Process WebSocket events
function setupChatWebSocketEvents(webSocket, reconnectCallback) {
    webSocket.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
            wsLog("ChatSocket message received:", data);
            
            if (data.type === "message") {
                handleChatMessage(data);
            } else if (data.type === "message_read") {
                handleMessageRead(data);
            } else if (data.type === "typing") {
                handleTypingIndicator(data);
            } else if (data.type === "status") {
                if (window.shrekChatUtils) {
                    window.shrekChatUtils.updateContactStatus(data.user_id, data.status);
                }
            } else if (data.type === "new_room") {
                handleNewRoom(data);
            } else if (data.type === "chat_cleared") {
                handleChatCleared(data);
            } else if (data.type === "pong") {
                // Heartbeat response - nothing to do
                wsLog("Received pong response");
            } else if (data.type === "error") {
                console.error("WebSocket error from server:", data.error || data.message);
                // Display error to user in console
                if (data.message_id) {
                    console.error(`Error with message ID ${data.message_id}: ${data.error || data.message}`);
                }
            } else if (data.type === "message_updated") {
                // Handle message update notification
                handleMessageUpdated(data);
            } else if (data.type === "message_deleted") {
                // Handle message deletion notification
                handleMessageDeleted(data);
            } else if (data.type === "group_deleted") {
                // Handle group deletion notification
                handleGroupDeleted(data);
            }
        } catch (error) {
            console.error("Error processing WebSocket message:", error, event.data);
        }
    };
}

// Handle message update notification
function handleMessageUpdated(data) {
    wsLog("Message update notification received:", data);
    
    // Update the message in the UI if it's in the current chat
    const currentRoomId = window.shrekChatWebSocket ? window.shrekChatWebSocket.getCurrentRoomId() : null;
    
    if (parseInt(currentRoomId) === parseInt(data.room_id)) {
        // Dispatch custom event that our chatFunc.js can listen for
        const updateEvent = new CustomEvent('message-updated', {
            detail: {
                messageId: data.message_id,
                content: data.content
            }
        });
        window.dispatchEvent(updateEvent);
    }
}

// Handle message deletion notification
function handleMessageDeleted(data) {
    wsLog("Message deletion notification received:", data);
    
    // Remove the message from UI if it's in the current chat
    const currentRoomId = window.shrekChatWebSocket ? window.shrekChatWebSocket.getCurrentRoomId() : null;
    
    if (parseInt(currentRoomId) === parseInt(data.room_id)) {
        // Dispatch custom event that our chatFunc.js can listen for
        const deleteEvent = new CustomEvent('message-deleted', {
            detail: {
                messageId: data.message_id,
                deletedBy: data.deleted_by
            }
        });
        window.dispatchEvent(deleteEvent);
    }
}

// Handle incoming chat message
function handleChatMessage(data) {
    const message = data.message;
    const isConfirmation = message.sender === "user";
    
    wsLog("Handling chat message:", message);
    
    // Use utility function to update last message preview
    if (window.shrekChatUtils) {
        window.shrekChatUtils.updateLastMessage(message.room_id, message.content, message.time);
    }
    
    // Check if this message belongs to the currently open room
    if (parseInt(currentRoomId) === parseInt(message.room_id)) {
        if (isConfirmation && message.temp_id) {
            // This is a confirmation of a message we sent - update the temp message
            wsLog(`Received confirmation for temp message: ${message.temp_id} -> ${message.id}`);
            const tempMessage = document.querySelector(`.message[data-message-id="${message.temp_id}"]`);
            if (tempMessage) {
                tempMessage.setAttribute('data-message-id', message.id);
                tempMessage.removeAttribute('data-temp-message');
                const messageStatusSingle = tempMessage.querySelector('.message-status-single');
                const messageStatusDouble = tempMessage.querySelector('.message-status-double');
                if (messageStatusSingle && messageStatusDouble) {
                    messageStatusSingle.style.display = 'none';
                    messageStatusDouble.style.display = 'inline';
                }
            } else {
                // If for some reason we can't find the temp message, just display it
                wsLog("Temp message not found in DOM, displaying as new message");
                if (window.displayMessage) {
                    window.displayMessage(message);
                }
            }
        } else {
            // This is a new message from someone else - display it
            // First check if it's already displayed to prevent duplicates
            const existingMessage = message.id ? 
                document.querySelector(`.message[data-message-id="${message.id}"]`) : 
                null;
                
            if (!existingMessage && window.displayMessage) {
                wsLog("Displaying new message");
                window.displayMessage(message);
                // Ensure we scroll to see the new message
                setTimeout(() => {
                    const chatMessages = document.getElementById('chatMessages');
                    if (chatMessages) {
                        chatMessages.scrollTop = chatMessages.scrollHeight;
                    }
                }, 50);
            } else if (existingMessage) {
                wsLog("Message already exists in DOM, skipping display");
            }
            
            // Send read receipt for messages from others
            if (!isConfirmation && chatWebSocket && chatWebSocket.readyState === WebSocket.OPEN) {
                wsLog(`Sending read receipt for message: ${message.id}`);
                const readData = {
                    type: "seen",
                    room_id: currentRoomId,
                    message_ids: [message.id]
                };
                chatWebSocket.send(JSON.stringify(readData));
            }
        }
    } else {
        wsLog(`Message is for room ${message.room_id}, but current room is ${currentRoomId}`);
        // Message is for a different room than the one currently open
        if (!isConfirmation && window.shrekChatUtils) {
            window.shrekChatUtils.incrementUnreadCount(message.room_id);
        }
    }
}

// Handle message read receipts
function handleMessageRead(data) {
    wsLog("Handling read receipt:", data);
    
    // Handle both single message_id and array of message_ids
    if (window.shrekChatUtils) {
        if (Array.isArray(data.message_ids)) {
            data.message_ids.forEach(id => {
                window.shrekChatUtils.updateMessageStatus(id, "read");
                wsLog(`Updating message ${id} to 'read' status`);
            });
        } else if (data.message_id) {
            window.shrekChatUtils.updateMessageStatus(data.message_id, "read");
            wsLog(`Updating message ${data.message_id} to 'read' status`);
        }
        
        // After updating messages, update the chat interface
        // This is needed specifically for the case where User B needs to see
        // that User A has read their messages without a page reload
        if (data.room_id && data.room_id === currentRoomId) {
            wsLog("Updating read receipts in current chat view");
        }
    }
}

// Handle typing indicators
function handleTypingIndicator(data) {
    wsLog("Typing indicator:", data);
    // Implementation would depend on how you want to show typing indicators in the UI
}

// Handle new room notifications
function handleNewRoom(data) {
    wsLog("Handling new room notification:", data);
    
    // Check if we already have this room in the sidebar
    const existingRoom = document.querySelector(`.contact-item[data-room-id="${data.room.id}"]`);
    if (existingRoom) {
        wsLog("Room already exists in sidebar, skipping");
        return;
    }
    
    // Use the addRoomToList function to add the room to the sidebar
    if (window.addRoomToList) {
        wsLog("Adding new room to sidebar:", data.room);
        window.addRoomToList(data.room);
        
        // Play a notification sound if available
        try {
            const notificationSound = new Audio('/static/sounds/notification.mp3');
            notificationSound.play().catch(e => console.log('Failed to play notification sound'));
        } catch (soundError) {
            console.log('Failed to play notification sound', soundError);
        }
    } else {
        console.error("addRoomToList function not available");
    }
}

// Handle chat cleared notifications
function handleChatCleared(data) {
    wsLog("Handling chat cleared notification:", data);
    
    // Check if this notification is for the currently open chat
    if (parseInt(data.room_id) === parseInt(currentRoomId)) {
        // Clear the messages in the UI
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.innerHTML = '';
            
            // Add a system message showing that the chat was cleared
            const clearMessage = document.createElement('div');
            clearMessage.className = 'system-message info';
            clearMessage.textContent = `Chat was cleared by ${data.cleared_by}`;
            chatMessages.appendChild(clearMessage);
        }
    }
    
    // Update the last message in the sidebar regardless of whether the chat is open
    if (window.shrekChatUtils) {
        window.shrekChatUtils.updateLastMessage(
            data.room_id, 
            'Chat cleared', 
            new Date(data.cleared_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
        );
    }
}

// Handle group deletion notification
function handleGroupDeleted(data) {
    wsLog("Handling group deletion notification:", data);
    
    // Remove the group from the sidebar
    const groupElement = document.querySelector(`.contact-item[data-room-id="${data.room_id}"]`);
    if (groupElement) {
        groupElement.remove();
        wsLog(`Group ${data.room_id} removed from sidebar`);
    }
    
    // If the deleted group is the currently open chat, show the welcome screen
    if (parseInt(data.room_id) === parseInt(currentRoomId)) {
        wsLog(`Currently open group ${data.room_id} was deleted, showing welcome screen`);
        const welcomeContainer = document.getElementById('welcomeContainer');
        const chatContent = document.getElementById('chatContent');
        if (welcomeContainer && chatContent) {
            welcomeContainer.style.display = 'flex';
            chatContent.style.display = 'none';
        }
    }
}

// Send a message through WebSocket
function sendChatMessage(message, roomId) {
    if (!message.trim() || !roomId) {
        console.error("Cannot send message: Empty message or missing room ID");
        return false;
    }
    
    if (!chatWebSocket) {
        console.error("Cannot send message: WebSocket is not initialized");
        return false;
    }
    
    if (chatWebSocket.readyState !== WebSocket.OPEN) {
        console.error(`WebSocket is not connected. Current state: ${
            chatWebSocket.readyState === WebSocket.CONNECTING ? 'CONNECTING' :
            chatWebSocket.readyState === WebSocket.CLOSING ? 'CLOSING' : 
            chatWebSocket.readyState === WebSocket.CLOSED ? 'CLOSED' : 'UNKNOWN'
        }`);
        return false;
    }
    
    wsLog(`Sending message to room ${roomId}: ${message}`);
    
    const now = new Date();
    const timeStr = window.shrekChatUtils ? 
                   window.shrekChatUtils.formatTime(now) : 
                   now.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', hour12:false});
    const tempId = 'temp-' + Date.now();
    
    const msgData = {
        type: "message",
        content: message,
        room_id: roomId,
        time: timeStr,
        temp_id: tempId
    };
    
    try {
        // Convert to JSON and send
        const jsonStr = JSON.stringify(msgData);
        wsLog(`Sending WebSocket message: ${jsonStr}`);
        chatWebSocket.send(jsonStr);
        return { success: true, tempId, timeStr };
    } catch (error) {
        console.error("Error sending message:", error);
        return { success: false, error };
    }
}

// Send read receipts for messages
function sendReadReceipts(roomId, messageIds) {
    if (!roomId || !messageIds || !messageIds.length || !chatWebSocket) {
        console.error("Cannot send read receipts: Missing parameters");
        return false;
    }
    
    if (chatWebSocket.readyState !== WebSocket.OPEN) {
        console.error("WebSocket is not connected");
        return false;
    }
    
    wsLog(`Sending read receipts for messages: ${messageIds.join(', ')}`);
    
    const readData = {
        type: "seen",
        room_id: roomId,
        message_ids: messageIds
    };
    
    try {
        chatWebSocket.send(JSON.stringify(readData));
        return true;
    } catch (error) {
        console.error("Error sending read receipts:", error);
        return false;
    }
}

// Set current room information
function setCurrentRoom(roomId, isGroup, userId) {
    wsLog(`Setting current room: id=${roomId}, isGroup=${isGroup}, userId=${userId}`);
    currentRoomId = roomId;
    currentRoomIsGroup = isGroup;
    currentUserId = userId;
    
    // Only store the current room ID when explicitly changing rooms via UI actions
    // Don't update localStorage for WebSocket events or notifications
    // Check if this is a user-initiated action (not a WebSocket notification)
    const isUserAction = document.getElementById('chatContent')?.style.display === 'flex';
    if (roomId && isUserAction) {
        localStorage.setItem('lastOpenedRoomId', roomId);
    }
}

// Export the WebSocket API
window.shrekChatWebSocket = {
    initializeWebSockets,
    connectPresenceWebSocket,
    connectChatWebSocket,
    sendChatMessage,
    sendReadReceipts,
    setCurrentRoom,
    getCurrentRoomId: () => currentRoomId,
    getCurrentRoomIsGroup: () => currentRoomIsGroup,
    getCurrentUserId: () => currentUserId,
    
    // Add update message function
    updateMessage: function(roomId, messageId, content, callback) {
        if (!chatWebSocket || chatWebSocket.readyState !== WebSocket.OPEN) {
            console.error("WebSocket is not connected");
            if (typeof callback === 'function') callback(false);
            return false;
        }
        
        wsLog(`Updating message ${messageId} in room ${roomId}`);
        
        const updateData = {
            type: "update_message",
            room_id: roomId,
            message_id: messageId,
            content: content
        };
        
        try {
            // Set up a one-time listener for the response
            const messageHandler = function(event) {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === "message_updated" && data.message_id === messageId) {
                        wsLog("Message update confirmed:", data);
                        // Remove this one-time listener
                        chatWebSocket.removeEventListener('message', messageHandler);
                        if (typeof callback === 'function') callback(true);
                    }
                    else if (data.type === "error" && data.message_id === messageId) {
                        wsLog("Message update failed:", data);
                        chatWebSocket.removeEventListener('message', messageHandler);
                        if (typeof callback === 'function') callback(false);
                    }
                } catch (error) {
                    console.error("Error parsing message update response:", error);
                }
            };
            
            // Add the temporary message handler
            chatWebSocket.addEventListener('message', messageHandler);
            
            // Set a timeout to clean up if we don't get a response
            setTimeout(() => {
                chatWebSocket.removeEventListener('message', messageHandler);
                if (typeof callback === 'function') callback(false);
            }, 5000);
            
            chatWebSocket.send(JSON.stringify(updateData));
            return true;
        } catch (error) {
            console.error("Error sending message update:", error);
            if (typeof callback === 'function') callback(false);
            return false;
        }
    },
    
    // Add delete message function
    deleteMessage: function(roomId, messageId, callback) {
        if (!chatWebSocket || chatWebSocket.readyState !== WebSocket.OPEN) {
            console.error("WebSocket is not connected");
            if (typeof callback === 'function') callback(false);
            return false;
        }
        
        wsLog(`Deleting message ${messageId} in room ${roomId}`);
        
        const deleteData = {
            type: "delete_message",
            room_id: roomId,
            message_id: messageId
        };
        
        try {
            // Set up a one-time listener for the response
            const messageHandler = function(event) {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === "message_deleted" && data.message_id === messageId) {
                        wsLog("Message deletion confirmed:", data);
                        // Remove this one-time listener
                        chatWebSocket.removeEventListener('message', messageHandler);
                        if (typeof callback === 'function') callback(true);
                    }
                    else if (data.type === "error" && data.message_id === messageId) {
                        wsLog("Message deletion failed:", data);
                        chatWebSocket.removeEventListener('message', messageHandler);
                        if (typeof callback === 'function') callback(false);
                    }
                } catch (error) {
                    console.error("Error parsing message deletion response:", error);
                }
            };
            
            // Add the temporary message handler
            chatWebSocket.addEventListener('message', messageHandler);
            
            // Set a timeout to clean up if we don't get a response
            setTimeout(() => {
                chatWebSocket.removeEventListener('message', messageHandler);
                if (typeof callback === 'function') callback(false);
            }, 5000);
            
            chatWebSocket.send(JSON.stringify(deleteData));
            return true;
        } catch (error) {
            console.error("Error sending message deletion:", error);
            if (typeof callback === 'function') callback(false);
            return false;
        }
    }
};