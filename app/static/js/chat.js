/**
 * Chat functionality for ShrekChat
 */

console.log("Script execution started");

document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM loaded - chat.js");

    // DOM Elements - Chat
    const contactsList = document.getElementById('contactsList');
    const searchInput = document.getElementById('searchInput');
    
    const chatContent = document.getElementById('chatContent');
    const welcomeContainer = document.getElementById('welcomeContainer');
    const chatMessages = document.getElementById('chatMessages');
    const messageInput = document.getElementById('messageInput');
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    
    const chatContactName = document.getElementById('chatContactName');
    const chatContactStatus = document.getElementById('chatContactPresence');
    const chatContactAvatar = document.getElementById('chatContactAvatar');
    const chatHeader = document.getElementById('chatHeader');
    const overlay = document.getElementById('overlay');
    
    // DOM Elements - Contact Info
    const contactInfoPopup = document.getElementById('contactInfoPopup');
    const closeContactInfoPopup = document.getElementById('closeContactInfoPopup');
    const contactInfoName = document.getElementById('contactInfoName');
    const contactInfoUsername = document.getElementById('contactInfoUsername');
    const contactInfoEmail = document.getElementById('contactInfoEmail');
    const contactInfoAvatar = document.getElementById('contactInfoAvatar');
    const contactInfoStatus = document.getElementById('contactInfoStatus');
    const closeInfoButton = document.getElementById('closeInfoButton');
    
    // DOM Elements - Message Template
    const messageTemplate = document.getElementById('messageTemplate');
    
    // Store current username to identify self messages
    const currentUsername = document.querySelector('.profile-name')?.textContent.trim();
    
    // Mobile responsiveness
    const backButton = document.querySelector('.back-btn');
    const sidebar = document.querySelector('.sidebar');

    // Log key DOM elements for debugging
    console.log("Chat.js: Key DOM elements loaded", {
        contactsList: !!contactsList,
        chatContent: !!chatContent,
        chatContactName: !!chatContactName,
        chatContactStatus: !!chatContactStatus,
        messageTemplate: !!messageTemplate
    });

    if (!chatContactName || !chatContactStatus) {
        console.error("Critical DOM elements missing:", {
            chatContactName: !!chatContactName,
            chatContactStatus: !!chatContactStatus
        });
    }

    // Mobile back button
    if (backButton) {
        backButton.addEventListener('click', function() {
            if (sidebar) {
                sidebar.classList.add('active');
            }
            if (chatContent) {
                chatContent.style.display = 'none';
            }
            if (welcomeContainer) {
                welcomeContainer.style.display = 'flex';
            }
        });
    }
    
    // Load rooms list (both direct chats and groups)
    function loadContacts() {
        console.log("Loading contacts...");
        fetch('/api/rooms')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to load rooms');
                }
                return response.json();
            })
            .then(rooms => {
                console.log("Loaded rooms:", rooms.length);
                contactsList.innerHTML = '';
                rooms.forEach(function(room) {
                    addRoomToList(room);
                });
            })
            .catch(error => {
                console.error('Error loading rooms:', error);
            });
    }
    
    // Refresh rooms list without clearing existing chats - used after adding a new room
    function refreshRoomsList() {
        fetch('/api/rooms')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to load rooms');
                }
                return response.json();
            })
            .then(rooms => {
                const existingRoomIds = Array.from(
                    document.querySelectorAll('.contact-item')
                ).map(el => el.getAttribute('data-room-id'));
                
                rooms.forEach(function(room) {
                    if (!existingRoomIds.includes(room.id.toString())) {
                        addRoomToList(room);
                    }
                });
            })
            .catch(error => {
                console.error('Error refreshing rooms:', error);
            });
    }
    
    // Add a single room to the list (direct chat or group)
    function addRoomToList(roomData) {
        const contactElement = document.createElement('div');
        contactElement.className = 'contact-item';
        contactElement.setAttribute('data-room-id', roomData.id);
        
        if (roomData.is_group) {
            contactElement.setAttribute('data-is-group', 'true');
        } else {
            contactElement.setAttribute('data-user-id', roomData.user_id);
        }
        
        const statusClass = roomData.status || 'offline';
        
        contactElement.innerHTML = `
            <div class="contact-avatar">
                <img src="${roomData.avatar || '/static/images/shrek.jpg'}" alt="${roomData.name} Avatar">
                ${!roomData.is_group ? `<span class="status-indicator ${statusClass}"></span>` : ''}
            </div>
            <div class="contact-info">
                <div class="contact-name-time">
                    <h4>${roomData.name || roomData.username || roomData.full_name}</h4>
                    <span class="message-time">${roomData.last_message_time || 'Now'}</span>
                </div>
                <p class="last-message">${roomData.last_message || 'Click to start chatting!'}</p>
            </div>
            ${roomData.unread_count > 0 ? `<div class="unread-count">${roomData.unread_count}</div>` : ''}
        `;
        
        contactElement.addEventListener('click', function() {
            console.log("Contact clicked:", roomData.id, roomData.name);
            openChat(roomData);
        });
        
        contactsList.appendChild(contactElement);
    }
    
    // Open a chat room (direct or group)
    function openChat(roomData) {
        console.log("openChat called with:", roomData);
        
        try {
            document.querySelectorAll('.contact-item').forEach(contact => {
                contact.classList.remove('active');
            });
            
            const contactElement = document.querySelector(`.contact-item[data-room-id="${roomData.id}"]`);
            if (contactElement) {
                contactElement.classList.add('active');
                const unreadCount = contactElement.querySelector('.unread-count');
                if (unreadCount) {
                    unreadCount.remove();
                }
            }
            
            // Update chat header
            updateChatHeader(roomData);
            
            // Set the current chat area data attributes
            if (chatContent) {
                chatContent.setAttribute('data-current-room-id', roomData.id);
                if (!roomData.is_group) {
                    chatContent.setAttribute('data-current-user-id', roomData.user_id);
                } else {
                    chatContent.removeAttribute('data-current-user-id');
                }
            }
            
            // Store room info in WebSocket module
            if (window.shrekChatWebSocket) {
                window.shrekChatWebSocket.setCurrentRoom(
                    roomData.id, 
                    roomData.is_group, 
                    !roomData.is_group ? roomData.user_id : null
                );
            }
            
            // Clear messages and show chat area
            chatMessages.innerHTML = '';
            if (welcomeContainer) welcomeContainer.style.display = 'none';
            if (chatContent) chatContent.style.display = 'flex';
            
            if (sidebar) {
                sidebar.classList.remove('active');
            }
            
            // Connect WebSocket and load messages
            // Use the new callback parameter to ensure WebSocket is connected before sending read receipts
            if (window.shrekChatWebSocket) {
                window.shrekChatWebSocket.connectChatWebSocket(roomData.id, function() {
                    // Load messages after WebSocket is connected
                    loadMessages(roomData.id);
                }, false); // false = don't suppress UI updates
            } else {
                // Fallback if WebSocket module is not available
                loadMessages(roomData.id);
            }
            
            setupContactInfoHandler(roomData);
            
        } catch (error) {
            console.error("Error in openChat function:", error);
        }
    }
    
    // Update chat header with contact info
    function updateChatHeader(roomData) {
        const chatContactNameElement = document.getElementById('chatContactName');
        const chatContactStatusElement = document.getElementById('chatContactPresence');
        const chatContactAvatarElement = document.getElementById('chatContactAvatar');
        
        if (!chatContactNameElement || !chatContactStatusElement || !chatContactAvatarElement) {
            console.error("Critical DOM elements missing for chat header update");
            return;
        }
        
        chatContactNameElement.textContent = roomData.name || roomData.username || roomData.full_name || 'Chat';
        
        if (roomData.is_group) {
            chatContactStatusElement.textContent = 'Group';
            const existingIndicator = chatContactStatusElement.querySelector('.status-indicator');
            if (existingIndicator) {
                existingIndicator.remove();
            }
        } else {
            const statusText = roomData.status === 'online' ? 'Online' : 'Offline';
            chatContactStatusElement.innerHTML = statusText;
            const existingIndicator = chatContactStatusElement.querySelector('.status-indicator');
            if (existingIndicator) {
                existingIndicator.remove();
            }
            // const statusIndicator = document.createElement('span');
            // statusIndicator.className = `status-indicator ${roomData.status || 'offline'}`;
            // chatContactStatusElement.prepend(statusIndicator);
        }
        
        chatContactAvatarElement.src = roomData.avatar || '/static/images/shrek.jpg';
    }
    
    // Setup handler for contact info button
    function setupContactInfoHandler(roomData) {
        const viewContactInfo = document.getElementById('viewContactInfo');
        if (viewContactInfo) {
            viewContactInfo.textContent = roomData.is_group ? 'Group info' : 'Contact info';
            const newViewContactInfo = viewContactInfo.cloneNode(true);
            viewContactInfo.parentNode.replaceChild(newViewContactInfo, viewContactInfo);
            newViewContactInfo.addEventListener('click', function() {
                if (roomData.is_group) {
                    const groupManagementPopup = document.getElementById('groupManagementPopup');
                    if (groupManagementPopup) {
                        groupManagementPopup.classList.add('open');
                        overlay.classList.add('active');
                        if (window.loadGroupDetails) {
                            window.loadGroupDetails(roomData.id);
                        }
                    }
                } else {
                    showContactInfo(roomData);
                }
                const dropdownMenu = document.querySelector('.dropdown-menu.active');
                if (dropdownMenu) {
                    dropdownMenu.classList.remove('active');
                }
            });
        }
        
        const chatContactInfo = document.querySelector('.chat-contact-info');
        if (chatContactInfo) {
            const newChatContactInfo = chatContactInfo.cloneNode(true);
            chatContactInfo.parentNode.replaceChild(newChatContactInfo, chatContactInfo);
            newChatContactInfo.addEventListener('click', function() {
                if (roomData.is_group) {
                    const groupManagementPopup = document.getElementById('groupManagementPopup');
                    if (groupManagementPopup) {
                        groupManagementPopup.classList.add('open');
                        overlay.classList.add('active');
                        if (window.loadGroupDetails) {
                            window.loadGroupDetails(roomData.id);
                        }
                    }
                } else {
                    showContactInfo(roomData);
                }
            });
        }
    }
    
    // Display contact info popup
    function showContactInfo(userData) {
        contactInfoName.textContent = userData.full_name || userData.username;
        contactInfoUsername.textContent = userData.username;
        contactInfoEmail.textContent = userData.email || 'No email provided';
        contactInfoAvatar.src = userData.avatar || '/static/images/shrek.jpg';
        contactInfoStatus.textContent = userData.status === 'online' ? 'Online' : 'Offline';
        contactInfoStatus.className = `status-text ${userData.status || 'offline'}`;
        contactInfoPopup.classList.add('open');
        overlay.classList.add('active');
    }
    
    // Load messages for a room
    function loadMessages(roomId) {
        console.log("Loading messages for room:", roomId);
        chatMessages.innerHTML = '<div class="loading-messages">Loading messages...</div>';
        
        fetch(`/api/messages/${roomId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to load messages');
                }
                return response.json();
            })
            .then(messages => {
                chatMessages.innerHTML = '';
                
                if (messages.length === 0) {
                    // Empty chat - just leave it blank
                    chatMessages.innerHTML = '';
                } else {
                    messages.forEach(message => {
                        displayMessage(message);
                    });
                }
                
                // Send read receipts for all unread messages that aren't from current user
                const unreadMessageIds = messages
                    .filter(msg => msg.sender !== 'user' && !msg.read)
                    .map(msg => msg.id);
                
                if (unreadMessageIds.length > 0 && window.shrekChatWebSocket) {
                    console.log("Sending read receipts for messages:", unreadMessageIds);
                    window.shrekChatWebSocket.sendReadReceipts(roomId, unreadMessageIds);
                    
                    // Also mark these as read in the UI
                    unreadMessageIds.forEach(id => {
                        if (window.shrekChatUtils) {
                            window.shrekChatUtils.updateMessageStatus(id, "read");
                        }
                    });
                }
                
                // Scroll to bottom
                chatMessages.scrollTop = chatMessages.scrollHeight;
            })
            .catch(error => {
                console.error('Error loading messages:', error);
                chatMessages.innerHTML = '<div class="error-messages">Failed to load messages. Please try again.</div>';
            });
    }
    
    // Display a message in the chat
    function displayMessage(message) {
        console.log("displayMessage called with:", message);
        
        // More robust duplicate message checking
        if (message.id && document.querySelector(`.message[data-message-id="${message.id}"]`)) {
            console.log("Skipping duplicate message:", message.id);
            return;
        }
        
        // Handle temp messages separately to avoid duplicates
        if (message.temp_id && document.querySelector(`.message[data-message-id="${message.temp_id}"]`)) {
            console.log("This is a temp message we've already displayed:", message.temp_id);
            return;
        }
        
        const isRoomGroup = window.shrekChatWebSocket ? 
                           window.shrekChatWebSocket.getCurrentRoomIsGroup() : 
                           message.is_group || false;
        
        const templateToUse = isRoomGroup ? 
            document.getElementById('groupMessageTemplate') : 
            messageTemplate;
        
        if (!templateToUse) {
            console.error("Message template not found for", isRoomGroup ? "group" : "direct", "message");
            return;
        }
        
        try {
            const messageElement = templateToUse.content.cloneNode(true);
            const messageDiv = messageElement.querySelector('.message');
            const messageContent = messageElement.querySelector('.message-content');
            const messageTime = messageElement.querySelector('.message-time');
            
            // Apply message content safely
            messageContent.textContent = message.content;
            messageTime.textContent = message.time || (window.shrekChatUtils ? 
                                     window.shrekChatUtils.formatTime(new Date()) : 
                                     new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}));
            
            // Set message ID for future reference
            if (message.id) {
                messageDiv.setAttribute('data-message-id', message.id);
            } else if (message.temp_id) {
                messageDiv.setAttribute('data-message-id', message.temp_id);
                // Mark it as temporary for later updating
                messageDiv.setAttribute('data-temp-message', 'true');
            }
            
            // Determine if this message is from the current user - FIXED LOGIC
            let isCurrentUser = false;
            
            // Get current username from the profile sidebar
            const currentUsername = document.querySelector('.profile-name')?.textContent.trim();
            
            // Case 1: For our own messages with temp_id or marked as optimistic
            if (message._isOptimistic === true) {
                isCurrentUser = true;
            } 
            // Case 2: For messages with special "user" marker from the server
            else if (message.sender === 'user') {
                isCurrentUser = true;
            }
            // Case 3: For regular messages, check sender against current username
            else if (currentUsername) {
                isCurrentUser = message.sender === currentUsername;
            }
            
            console.log(`Message from ${message.sender}, currentUsername: ${currentUsername}, isCurrentUser: ${isCurrentUser}`);
            
            // For group messages, show sender name
            if (isRoomGroup) {
                const messageSender = messageElement.querySelector('.message-sender');
                if (messageSender) {
                    messageSender.textContent = isCurrentUser ? "You" : (message.sender_name || message.sender);
                }
            }
            
            // Style and add status indicators for outgoing messages
            if (isCurrentUser) {                
                messageDiv.classList.add('outgoing');
                
                if (!isRoomGroup) {
                    const messageStatusSingle = messageElement.querySelector('.message-status-single');
                    const messageStatusDouble = messageElement.querySelector('.message-status-double');
                    
                    if (messageStatusSingle && messageStatusDouble) {
                        const messageStatus = message.status || 
                                             (message.delivered ? (message.read ? 'read' : 'delivered') : 'sent');
                        
                        if (messageStatus === 'sent' || !message.delivered) {
                            messageStatusSingle.style.display = 'inline';
                            messageStatusDouble.style.display = 'none';
                        } else if (messageStatus === 'delivered' || (message.delivered && !message.read)) {
                            messageStatusDouble.style.display = 'inline';
                            messageStatusDouble.classList.remove('read');
                            messageStatusSingle.style.display = 'none';
                        } else if (messageStatus === 'read' || message.read) {
                            messageStatusDouble.style.display = 'inline';
                            messageStatusDouble.classList.add('read');
                            messageStatusSingle.style.display = 'none';
                        }
                        
                        // Check if there's a pending status update for this message
                        if (window.pendingMessageStatuses && message.id && window.pendingMessageStatuses[message.id]) {
                            const pendingStatus = window.pendingMessageStatuses[message.id];
                            console.log(`Applying pending status update for message ${message.id}: ${pendingStatus}`);
                            
                            // Apply the pending status
                            if (pendingStatus === 'read') {
                                messageStatusDouble.style.display = 'inline';
                                messageStatusDouble.classList.add('read');
                                messageStatusSingle.style.display = 'none';
                            } else if (pendingStatus === 'delivered') {
                                messageStatusDouble.style.display = 'inline';
                                messageStatusDouble.classList.remove('read');
                                messageStatusSingle.style.display = 'none';
                            }
                            
                            // Remove the pending status now that it's been applied
                            delete window.pendingMessageStatuses[message.id];
                        }
                    }
                }
            } else {
                messageDiv.classList.add('incoming');
                // Remove any status indicators for incoming messages
                const statusIndicators = messageElement.querySelectorAll('.message-status');
                statusIndicators.forEach(indicator => indicator.remove());
            }
            
            // Append the message to the chat
            chatMessages.appendChild(messageElement);
            
            // Ensure new messages are visible - using requestAnimationFrame for better scrolling
            requestAnimationFrame(() => {
                chatMessages.scrollTop = chatMessages.scrollHeight;
            });
            
        } catch (error) {
            console.error("Error displaying message:", error, message);
        }
    }
    
    // Send message function
    function sendMessage() {
        const message = messageInput.value.trim();
        
        if (!message) {
            return; // Don't send empty messages
        }
        
        const currentRoomId = chatContent.getAttribute('data-current-room-id');
        if (!currentRoomId) {
            console.log("Please select a contact or group first.");
            return;
        }
        
        // Clear input field before sending
        messageInput.value = '';
        
        // Check if WebSocket is available
        if (!window.shrekChatWebSocket) {
            console.error("WebSocket module not available");
            const errorMsg = document.createElement('div');
            errorMsg.className = 'system-message error';
            errorMsg.textContent = "Failed to send message. Please try again.";
            chatMessages.appendChild(errorMsg);
            return;
        }
        
        // Send via WebSocket
        const result = window.shrekChatWebSocket.sendChatMessage(message, currentRoomId);
        
        if (result && result.success) {
            // Create optimistic message to show immediately
            const isRoomGroup = window.shrekChatWebSocket.getCurrentRoomIsGroup();
            const optimisticMessage = {
                temp_id: result.tempId,
                content: message,
                sender: 'user',
                sender_name: currentUsername,
                time: result.timeStr,
                delivered: false,
                read: false,
                is_group: isRoomGroup,
                _isOptimistic: true
            };
            
            // Show message in UI immediately
            displayMessage(optimisticMessage);
            
            // Update last message in the sidebar
            if (window.shrekChatUtils) {
                window.shrekChatUtils.updateLastMessage(currentRoomId, message, result.timeStr);
            }
            
            // Scroll to see the new message
            requestAnimationFrame(() => {
                chatMessages.scrollTop = chatMessages.scrollHeight;
            });
            
            // Set a timeout to check for confirmation
            setTimeout(() => {
                const tempMessage = document.querySelector(`.message[data-message-id="${result.tempId}"][data-temp-message="true"]`);
                if (tempMessage) {
                    console.log("No confirmation received for message:", result.tempId, "- may need to resend");
                    // Add a visual indicator that message might not have sent
                    const statusIndicator = tempMessage.querySelector('.message-status-single');
                    if (statusIndicator) {
                        statusIndicator.classList.add('warning');
                    }
                }
            }, 5000);
        } else {
            // Show error to user
            const errorMsg = document.createElement('div');
            errorMsg.className = 'system-message error';
            errorMsg.textContent = "Failed to send message. Please try again.";
            chatMessages.appendChild(errorMsg);
        }
    }
    
    // Event listeners
    if (sendMessageBtn) {
        sendMessageBtn.addEventListener('click', sendMessage);
    }
    
    if (messageInput) {
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }
    
    if (closeContactInfoPopup) {
        closeContactInfoPopup.addEventListener('click', function() {
            contactInfoPopup.classList.remove('open');
            overlay.classList.remove('active');
        });
    }
    
    if (closeInfoButton) {
        closeInfoButton.addEventListener('click', function() {
            contactInfoPopup.classList.remove('open');
            overlay.classList.remove('active');
        });
    }
    
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const contacts = document.querySelectorAll('.contact-item');
            
            contacts.forEach(function(contact) {
                const name = contact.querySelector('h4').textContent.toLowerCase();
                const lastMessage = contact.querySelector('.last-message').textContent.toLowerCase();
                
                if (name.includes(searchTerm) || lastMessage.includes(searchTerm)) {
                    contact.style.display = 'flex';
                } else {
                    contact.style.display = 'none';
                }
            });
        });
    }

    // Handle dropdowns
    document.querySelectorAll('.dropdown-toggle').forEach(function(toggle) {
        toggle.addEventListener('click', function(e) {
            e.stopPropagation();
            
            const menu = this.nextElementSibling;
            menu.classList.toggle('active');
            
            document.querySelectorAll('.dropdown-menu.active').forEach(function(otherMenu) {
                if (otherMenu !== menu) {
                    otherMenu.classList.remove('active');
                }
            });
            
            document.addEventListener('click', function closeDropdown() {
                menu.classList.remove('active');
                document.removeEventListener('click', closeDropdown);
            });
        });
    });
    
    // Initialize chat
    console.log("Initializing chat...");
    loadContacts();
    
    // Initialize WebSockets if the module is available
    if (window.shrekChatWebSocket) {
        window.shrekChatWebSocket.initializeWebSockets();
    } else {
        console.error("WebSocket module not loaded!");
    }
    
    // Expose functions for other modules to use
    window.refreshRoomsList = refreshRoomsList;
    window.addRoomToList = addRoomToList;
    window.openChat = openChat;
    window.displayMessage = displayMessage;
    
    console.log("Chat initialization complete");
});
