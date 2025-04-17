// Messages.js - WebSocket-based chat functionality with functional programming approach
// This file handles real-time messaging using WebSockets

document.addEventListener("DOMContentLoaded", function() {
    // Check authentication
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user") || "{}");

    // Variables
    let websocket = null;
    let currentContact = null;
    let messagesContainer = document.querySelector(".messages-container");
    let messageInput = document.getElementById("messageInput");
    let sendButton = document.querySelector(".send-button");
    
    // Initialize the messaging system
    function initMessaging() {
        if (!token || !user.username) {
            console.error("User not authenticated");
            return;
        }
        
        // Create WebSocket connection
        connectWebSocket();
        
        // Set up event listeners
        setupEventListeners();
        
        // Make functions available to other scripts
        exposeGlobalFunctions();
    }
    
    // Connect to WebSocket server
    function connectWebSocket() {
        // Close any existing connection
        if (websocket) {
            websocket.close();
        }
        
        // Create new WebSocket connection with auth token
        const wsUrl = `ws://localhost:8000/api/chat/ws/${token}`;
        websocket = new WebSocket(wsUrl);
        
        // Set up WebSocket event handlers
        websocket.onopen = handleWebSocketOpen;
        websocket.onmessage = handleWebSocketMessage;
        websocket.onclose = handleWebSocketClose;
        websocket.onerror = handleWebSocketError;
    }
    
    // WebSocket event handlers
    function handleWebSocketOpen(event) {
        event.preventDefault();
        console.log("WebSocket connection established");
        // Update UI to indicate connected status
        updateConnectionStatus(true);
    }
    
    function handleWebSocketMessage(event) {
        const message = JSON.parse(event.data);
        
        if (message.type === "message_status") {
            // Handle message status updates (delivered, read, etc.)
            updateMessageStatus(message);
        } else {
            // Handle incoming chat message
            handleIncomingMessage(message);
        }
    }
    
    function handleWebSocketClose(event) {
        console.log("WebSocket connection closed");
        updateConnectionStatus(false);
        
        // Try to reconnect after a delay
        setTimeout(connectWebSocket, 3000);
    }
    
    function handleWebSocketError(error) {
        console.error("WebSocket error:", error);
        updateConnectionStatus(false);
    }
    
    // Update UI based on connection status
    function updateConnectionStatus(isConnected) {
        // This could update a connection indicator in the UI
        // For now, just log the status
        console.log("Connection status:", isConnected ? "Connected" : "Disconnected");
    }
    
    // Handle incoming messages
    function handleIncomingMessage(message) {
        // If message is from/to current contact, display it
        const isCurrentConversation = (
            (currentContact === message.sender && user.username === message.receiver) ||
            (currentContact === message.receiver && user.username === message.sender)
        );
        
        if (isCurrentConversation) {
            appendMessageToChat(message);
        }
        
        // Update contact in sidebar with last message
        updateContactLastMessage(message);
    }
    
    // Update message status (delivered, read, etc.)
    function updateMessageStatus(statusUpdate) {
        const messageId = statusUpdate.message_id;
        const status = statusUpdate.status;
        
        // Find message element by ID and update status
        const messageElement = document.querySelector(`.message[data-id="${messageId}"]`);
        if (messageElement) {
            const statusElement = messageElement.querySelector(".message-status");
            if (statusElement) {
                statusElement.textContent = status;
                statusElement.className = `message-status ${status}`;
            }
        }
    }
    
    // Send a message through WebSocket
    function sendMessage() {
        if (!websocket || websocket.readyState !== WebSocket.OPEN) {
            alert("Connection to server lost. Reconnecting...");
            connectWebSocket();
            return;
        }
        
        const content = messageInput.value.trim();
        if (!content || !currentContact) {
            return;
        }
        
        const message = {
            sender: user.username,
            receiver: currentContact,
            content: content,
            timestamp: new Date().toISOString()
        };
        
        // Send message through WebSocket
        websocket.send(JSON.stringify(message));
        
        // Clear input field
        messageInput.value = "";
        
        // Add message to UI immediately (optimistic UI update)
        appendMessageToChat(message, true);
    }
    
    // Fetch message history for a contact
    function fetchMessages(contactName) {
        if (!token || !contactName) {
            return;
        }
        
        // Set current contact
        currentContact = contactName;
        
        // Clear messages container
        clearMessages();
        
        // Show loading indicator
        showLoadingIndicator();
        
        // Fetch messages from API
        fetch(`http://localhost:8000/api/chat/messages/${contactName}`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to fetch messages: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Hide loading indicator
            hideLoadingIndicator();
            
            // Display messages
            if (data.messages && data.messages.length > 0) {
                data.messages.forEach(message => {
                    appendMessageToChat(message);
                });
                
                // Scroll to bottom
                scrollToBottom();
            }
        })
        .catch(error => {
            console.error("Error fetching messages:", error);
            hideLoadingIndicator();
            
            // Show error message in chat
            messagesContainer.innerHTML = `
                <div class="messages-error">
                    <p>Failed to load messages. Please try again.</p>
                </div>
            `;
        });
    }
    
    // Delete all messages with a contact
    function deleteAllMessages(contactName) {
        if (!token || !contactName) {
            return;
        }
        
        fetch(`http://localhost:8000/api/chat/delete-messages/${contactName}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to delete messages: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Clear messages container
            clearMessages();
            
            // Show success message
            messagesContainer.innerHTML = `
                <div class="system-message">
                    <p>${data.message || "All messages deleted successfully"}</p>
                </div>
            `;
            
            // Update contact in sidebar
            const contactElement = document.querySelector(`.contact[data-username="${contactName}"]`);
            if (contactElement) {
                const lastMessageElement = contactElement.querySelector(".contact-last-message");
                if (lastMessageElement) {
                    lastMessageElement.textContent = "No messages";
                }
            }
        })
        .catch(error => {
            console.error("Error deleting messages:", error);
            alert("Failed to delete messages. Please try again.");
        });
    }
    
    // Helper functions for UI updates
    function appendMessageToChat(message, isPending = false) {
        const isOutgoing = message.sender === user.username;
        const formattedTime = formatMessageTime(message.timestamp);
        
        const messageHTML = `
            <div class="message ${isOutgoing ? 'outgoing' : 'incoming'}" data-id="${message.id || 'pending'}">
                <div class="message-content">${escapeHtml(message.content)}</div>
                <div class="message-meta">
                    <span class="message-time">${formattedTime}</span>
                    ${isOutgoing ? `<span class="message-status ${isPending ? 'pending' : (message.read ? 'read' : 'delivered')}">
                        ${isPending ? 'sending' : (message.read ? 'read' : 'delivered')}
                    </span>` : ''}
                </div>
            </div>
        `;
        
        messagesContainer.insertAdjacentHTML('beforeend', messageHTML);
        
        // Scroll to the new message
        scrollToBottom();
    }
    
    function clearMessages() {
        messagesContainer.innerHTML = '';
    }
    
    function showLoadingIndicator() {
        messagesContainer.innerHTML = `
            <div class="loading-indicator">
                <div class="spinner"></div>
                <p>Loading messages...</p>
            </div>
        `;
    }
    
    function hideLoadingIndicator() {
        const loadingIndicator = messagesContainer.querySelector('.loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
    }
    
    function scrollToBottom() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    function formatMessageTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Update contact in sidebar with latest message
    function updateContactLastMessage(message) {
        // Determine which username to look for in contacts list
        const contactUsername = message.sender === user.username ? message.receiver : message.sender;
        
        // Find contact element
        const contactElement = document.querySelector(`.contact[data-username="${contactUsername}"]`);
        if (contactElement) {
            // Update last message text
            const lastMessageElement = contactElement.querySelector(".contact-last-message");
            if (lastMessageElement) {
                const messagePreview = message.content.length > 30 
                    ? message.content.substring(0, 27) + "..." 
                    : message.content;
                lastMessageElement.textContent = messagePreview;
            }
            
            // Update time
            const timeElement = contactElement.querySelector(".contact-time");
            if (timeElement) {
                timeElement.textContent = formatMessageTime(message.timestamp);
            }
            
            // Add unread indicator if not current contact
            if (currentContact !== contactUsername && message.sender !== user.username) {
                const unreadBadge = contactElement.querySelector(".unread-count");
                if (unreadBadge) {
                    const count = parseInt(unreadBadge.textContent) + 1;
                    unreadBadge.textContent = count;
                } else {
                    contactElement.querySelector(".contact-meta").insertAdjacentHTML(
                        "beforeend",
                        '<div class="unread-count">1</div>'
                    );
                }
            }
            
            // Move this contact to the top of the contacts list
            const contactsList = document.getElementById("contactsList");
            if (contactsList && contactsList.firstChild) {
                contactsList.insertBefore(contactElement, contactsList.firstChild);
            }
        }
    }
    
    // Set up event listeners
    function setupEventListeners() {
        // Send message on button click
        if (sendButton) {
            sendButton.addEventListener("click", sendMessage);
        }
        
        // Send message on Enter key
        if (messageInput) {
            messageInput.addEventListener("keypress", function(event) {
                if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                }
            });
        }
    }
    
    // Expose functions to be called from other scripts
    function exposeGlobalFunctions() {
        window.messagesManager = {
            fetchMessages: fetchMessages,
            deleteAllMessages: deleteAllMessages,
            setCurrentContact: (contactName) => {
                currentContact = contactName;
            },
            getCurrentContact: () => currentContact,
            isConnected: () => websocket && websocket.readyState === WebSocket.OPEN
        };
    }
    
    // Initialize the messaging system when DOM is loaded
    initMessaging();
});