/**
 * Chat functionality for ShrekChat
 */

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const contactItems = document.querySelectorAll('.contact-item');
    const chatMessages = document.getElementById('chatMessages');
    const messageInput = document.getElementById('messageInput');
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    const backBtn = document.querySelector('.back-btn');
    const sidebar = document.querySelector('.sidebar');
    const chatContactName = document.getElementById('chatContactName');
    const chatContactStatus = document.getElementById('chatContactPresence');
    const chatContactAvatar = document.getElementById('chatContactAvatar');
    const contactInfoBtn = document.getElementById('contactInfoBtn');
    const contactInfoSidebar = document.getElementById('contactInfoSidebar');
    const closeProfileBtn = document.querySelector('.close-profile-btn');
    const profileContactName = document.getElementById('profileContactName');
    const profileContactStatus = document.getElementById('profileContactStatus');
    const profileContactAvatar = document.getElementById('profileContactAvatar');
    const searchInput = document.getElementById('searchInput');
    const overlay = document.getElementById('overlay');
    const profileButton = document.getElementById('profileButton');
    const profileSidebar = document.getElementById('profileSidebar');
    const closeProfileSidebar = document.getElementById('closeProfileSidebar');
    const editProfileMenuItem = document.getElementById('editProfileMenuItem');
    const createGroupMenuItem = document.getElementById('createGroupMenuItem');
    const addContactMenuItem = document.getElementById('addContactMenuItem');
    const editProfilePopup = document.getElementById('editProfilePopup');
    const createGroupPopup = document.getElementById('createGroupPopup');
    const addFriendPopup = document.getElementById('addFriendPopup'); // For adding friends/contacts
    const closeEditProfilePopup = document.getElementById('closeEditProfilePopup');
    const closeAddFriendPopup = document.getElementById('closeAddFriendPopup');
    const chatContactInfo = document.querySelector('.chat-contact-info');
    const contactInfoPopup = document.getElementById('contactInfoPopup');
    const closeContactInfoPopup = document.getElementById('closeContactInfoPopup');
    const closeInfoButton = document.getElementById('closeInfoButton');
    const contactInfoAvatar = document.getElementById('contactInfoAvatar');
    const contactInfoName = document.getElementById('contactInfoName');
    const contactInfoStatus = document.getElementById('contactInfoStatus');
    const contactInfoUsername = document.getElementById('contactInfoUsername');
    const contactInfoEmail = document.getElementById('contactInfoEmail');
    const viewContactInfo = document.getElementById('viewContactInfo');
    const welcomeContainer = document.getElementById('welcomeContainer');
    const chatContent = document.getElementById('chatContent');
    const dropdownToggle = document.querySelector('.dropdown-toggle');
    const dropdownMenu = document.querySelector('.dropdown-menu');
    const themeToggle = document.getElementById('themeToggle');
    const logoutMenuItem = document.getElementById('logoutMenuItem');
    
    let currentContactId = null;
    let ws = null;
    let presenceWs = null; // WebSocket for online/offline status
    let currentContactUsername = null;
    let currentContactEmail = null;
    let messageMap = new Map(); // Map to store message IDs for receipt tracking
    
    // Get the current user's username from the page
    const currentUsername = document.querySelector('.profile-name') ? 
                            document.querySelector('.profile-name').textContent.trim() : '';

    // Show welcome container initially, hide chat content
    if (welcomeContainer && chatContent) {
        welcomeContainer.style.display = 'flex';
        chatContent.style.display = 'none';
    }

    // Connect to presence WebSocket to track online/offline status
    function connectPresenceWebSocket() {
        const wsUrl = `ws://${window.location.host}/ws/presence?username=${encodeURIComponent(currentUsername)}`;
        presenceWs = new WebSocket(wsUrl);
        
        presenceWs.onopen = function() {
            console.log("Presence WebSocket connected");
            
            // Start ping interval to keep connection alive
            setInterval(function() {
                if (presenceWs && presenceWs.readyState === WebSocket.OPEN) {
                    presenceWs.send("ping");
                }
            }, 30000); // Send ping every 30 seconds
        };
        
        presenceWs.onmessage = function(event) {
            const data = JSON.parse(event.data);
            
            if (data.type === "status_update") {
                updateContactStatus(data.user_id, data.status);
            }
        };
        
        presenceWs.onclose = function() {
            console.log("Presence WebSocket closed, reconnecting...");
            // Try to reconnect after a delay
            setTimeout(connectPresenceWebSocket, 2000);
        };
        
        presenceWs.onerror = function(error) {
            console.error("Presence WebSocket error:", error);
        };
    }
    
    // Connect to presence WebSocket when page loads
    connectPresenceWebSocket();
    
    // Function to update contact status in UI
    function updateContactStatus(userId, status) {
        const contactElement = document.querySelector(`.contact-item[data-contact-id="${userId}"]`);
        if (contactElement) {
            const statusIndicator = contactElement.querySelector('.status-indicator');
            if (statusIndicator) {
                statusIndicator.classList.remove('online', 'offline');
                statusIndicator.classList.add(status);
            }
            
            // If this is the currently selected contact, update the chat header
            if (currentContactId == userId) {
                chatContactStatus.textContent = status === 'online' ? 'Online' : 'Offline';
                
                // Also update contact info popup if open
                if (contactInfoStatus && contactInfoPopup.classList.contains('open')) {
                    contactInfoStatus.textContent = status === 'online' ? 'Online' : 'Offline';
                }
            }
        }
    }

    // Open contact info popup when clicking on chat header
    if (chatContactInfo) {
        chatContactInfo.addEventListener('click', function() {
            openContactInfoPopup();
        });
    }
    
    // Also open contact info from dropdown menu
    if (viewContactInfo) {
        viewContactInfo.addEventListener('click', function() {
            openContactInfoPopup();
            
            // Close dropdown menu
            if (dropdownMenu) {
                dropdownMenu.classList.remove('active');
            }
        });
    }
    
    // Function to open contact info popup
    function openContactInfoPopup() {
        if (contactInfoPopup && currentContactId) {
            contactInfoPopup.classList.add('open');
            overlay.classList.add('active');
            
            // Set contact info in popup
            contactInfoAvatar.src = chatContactAvatar.src;
            contactInfoName.textContent = chatContactName.textContent;
            contactInfoStatus.textContent = chatContactStatus.textContent;
            contactInfoUsername.textContent = currentContactUsername || '';
            contactInfoEmail.textContent = currentContactEmail || '';
        }
    }
    
    // Close contact info popup
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
    
    // Toggle profile sidebar - open from left side
    if (profileButton && profileSidebar) {
        profileButton.addEventListener('click', function() {
            profileSidebar.classList.add('active');
            overlay.classList.add('active');
        });
    }
    
    // Close profile sidebar
    if (closeProfileSidebar) {
        closeProfileSidebar.addEventListener('click', function() {
            profileSidebar.classList.remove('active');
            overlay.classList.remove('active');
        });
    }
    
    // Handle profile sidebar menu item clicks
    // Toggle edit profile popup
    if (editProfileMenuItem) {
        editProfileMenuItem.addEventListener('click', function() {
            profileSidebar.classList.remove('active');
            if (editProfilePopup) {
                editProfilePopup.classList.add('open');
                overlay.classList.add('active');
            }
        });
    }
    
    // Toggle create group popup
    if (createGroupMenuItem) {
        createGroupMenuItem.addEventListener('click', function() {
            profileSidebar.classList.remove('active');
            if (createGroupPopup) {
                createGroupPopup.classList.add('open');
                overlay.classList.add('active');
                
                // Reset selected contacts if the variable exists
                if (window.selectedContacts !== undefined) {
                    window.selectedContacts = [];
                }
                
                // Disable next button
                const proceedBtn = document.getElementById('proceedToGroupDetails');
                if (proceedBtn) {
                    proceedBtn.disabled = true;
                }
                
                // Load contacts for selection if the function exists
                if (window.loadContactsForSelection && typeof window.loadContactsForSelection === 'function') {
                    window.loadContactsForSelection();
                }
            }
        });
    }
    
    // Toggle add friend popup
    if (addContactMenuItem) {
        addContactMenuItem.addEventListener('click', function() {
            profileSidebar.classList.remove('active');
            if (addFriendPopup) {
                addFriendPopup.classList.add('open');
                overlay.classList.add('active');
                
                // Focus on input
                const addFriendInput = document.getElementById('addFriendInput');
                if (addFriendInput) {
                    addFriendInput.focus();
                }
            }
        });
    }
    
    // Handle theme toggle in profile sidebar
    if (themeToggle) {
        themeToggle.addEventListener('change', function() {
            document.body.classList.toggle('dark-theme', this.checked);
            localStorage.setItem('darkTheme', this.checked ? 'enabled' : 'disabled');
        });
        
        // Set initial theme state
        const savedTheme = localStorage.getItem('darkTheme');
        if (savedTheme === 'enabled') {
            themeToggle.checked = true;
            document.body.classList.add('dark-theme');
        }
    }
    
    // Close edit profile popup
    if (closeEditProfilePopup) {
        closeEditProfilePopup.addEventListener('click', function() {
            editProfilePopup.classList.remove('open');
            overlay.classList.remove('active');
        });
    }

    
    // Close add friend popup
    if (closeAddFriendPopup) {
        closeAddFriendPopup.addEventListener('click', function() {
            addFriendPopup.classList.remove('open');
            overlay.classList.remove('active');
        });
    }
    
    // Toggle mobile sidebar
    if (backBtn) {
        backBtn.addEventListener('click', function() {
            sidebar.classList.add('active');
        });
    }
    
    
    if (dropdownToggle && dropdownMenu) {
        dropdownToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            dropdownMenu.classList.toggle('active');
        });
        
        document.addEventListener('click', function() {
            dropdownMenu.classList.remove('active');
        });
    }
    
    // Search contacts functionality
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const query = this.value.toLowerCase().trim();
            const contactItems = document.querySelectorAll('.contact-item');
            
            contactItems.forEach(contact => {
                const name = contact.querySelector('.contact-name-time h4').textContent.toLowerCase();
                const message = contact.querySelector('.last-message').textContent.toLowerCase();
                
                if (name.includes(query) || message.includes(query)) {
                    contact.style.display = 'flex';
                } else {
                    contact.style.display = 'none';
                }
            });
        });
    }
    
    // Contact selection
    contactItems.forEach(item => {
        item.addEventListener('click', function() {
            // Remove active class from all contacts
            contactItems.forEach(contact => contact.classList.remove('active'));
            
            // Add active class to selected contact
            this.classList.add('active');
            
            // Get contact id
            const contactId = this.getAttribute('data-contact-id');
            currentContactId = contactId;
            currentContactUsername = this.querySelector('.contact-name-time h4').textContent;
            
            // Update chat header with contact info
            const contactName = this.querySelector('.contact-name-time h4').textContent;
            const contactStatus = this.querySelector('.status-indicator').classList.contains('online') ? 'Online' : 'Offline';
            const contactAvatar = this.querySelector('.contact-info img') || this.querySelector('.contact-avatar img');
            const avatarSrc = contactAvatar ? contactAvatar.src : '/static/images/shrek.jpg';
            
            chatContactName.textContent = contactName;
            chatContactStatus.textContent = contactStatus;
            chatContactAvatar.src = avatarSrc;
            
            // Update profile sidebar
            if (profileContactName) profileContactName.textContent = contactName;
            if (profileContactStatus) profileContactStatus.textContent = contactStatus;
            if (profileContactAvatar) profileContactAvatar.src = avatarSrc;
            
            // Show mobile chat area
            sidebar.classList.remove('active');
            
            // Show chat content, hide welcome container - FIXED DISPLAY TOGGLE
            console.log("Showing chat content for contact:", contactId);
            if (welcomeContainer && chatContent) {
                welcomeContainer.style.display = 'none';
                chatContent.style.display = 'flex';
            }
            
            // Clear any unread counter for this contact
            const unreadCounter = this.querySelector('.unread-count');
            if (unreadCounter) {
                unreadCounter.remove();
            }
            
            // Get contact email and other details for info popup
            fetch(`/api/contacts`)
                .then(response => response.json())
                .then(contacts => {
                    const contact = contacts.find(c => c.id == contactId);
                    if (contact) {
                        currentContactEmail = contact.email;
                    }
                })
                .catch(error => {
                    console.error('Error fetching contact details:', error);
                });
            
            // Clear previous chat messages and show loading indicator
            chatMessages.innerHTML = '<div class="loading-messages">Loading messages...</div>';
            
            // Load chat messages
            loadMessages(contactId);
            
            // Close previous WebSocket if open
            if (ws) {
                ws.close();
            }
            
            // Open new WebSocket connection with username as query parameter
            const wsUrl = `ws://${window.location.host}/ws/chat/${contactId}?username=${encodeURIComponent(currentUsername)}`;
            ws = new WebSocket(wsUrl);
            
            // WebSocket event handlers
            ws.onopen = function(event) {
                console.log("WebSocket connection established");
            };
            
            ws.onmessage = function(event) {
                const data = JSON.parse(event.data);
                
                // Handle different message types
                if (data.type === "read_receipt") {
                    // Handle read receipt
                    updateMessageStatus(data.message_id, "read");
                } else if (data.type === "delivered_receipt") {
                    // Handle delivered receipt
                    updateMessageStatus(data.message_id, "delivered");
                } else if (data.type === "status_update") {
                    // Handle status update
                    updateContactStatus(data.user_id, data.status);
                } else {
                    // Handle regular message
                    const messageElement = document.getElementById('messageTemplate').content.cloneNode(true);
                    const messageDiv = messageElement.querySelector('.message');
                    const messageContent = messageElement.querySelector('.message-content');
                    const messageTime = messageElement.querySelector('.message-time');
                    const statusSingle = messageElement.querySelector('.message-status-single');
                    const statusDouble = messageElement.querySelector('.message-status-double');
                    
                    // Set message content and time
                    messageContent.textContent = data.content;
                    messageTime.textContent = data.time;
                    
                    // Store the message ID in the element for future reference
                    if (data.id) {
                        messageDiv.dataset.messageId = data.id;
                    }
                    
                    // Determine if this is an incoming or outgoing message
                    if (data.sender === currentContactUsername || data.sender === chatContactName.textContent) {
                        messageDiv.classList.add('incoming');
                        
                        // For incoming messages, send read receipt
                        if (data.id && ws && ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({
                                type: "read_receipt",
                                message_id: data.id
                            }));
                        }
                    } else {
                        messageDiv.classList.add('outgoing');
                        
                        // Set status for outgoing message
                        if (data.status) {
                            if (data.status === "sent") {
                                statusSingle.classList.add('sent');
                            } else if (data.status === "delivered") {
                                statusDouble.classList.add('delivered');
                            } else if (data.status === "read") {
                                statusDouble.classList.add('read');
                            }
                        }
                        
                        // Save message ID for status updates
                        if (data.id) {
                            messageMap.set(data.id, messageDiv);
                        }
                    }
                    
                    chatMessages.appendChild(messageElement);
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                    
                    // Update last message in contact list
                    updateContactLastMessage(contactId, data.content, data.time);
                }
            };
            
            ws.onerror = function(error) {
                console.error("WebSocket error:", error);
                alert("Error connecting to chat service. Please try again later.");
            };
            
            ws.onclose = function(event) {
                if (event.code !== 1000) {
                    console.log("WebSocket connection closed unexpectedly:", event.code, event.reason);
                }
            };
        });
    });
    
    // Function to update message status indicators
    function updateMessageStatus(messageId, status) {
        const messageElement = messageMap.get(messageId) || document.querySelector(`.message[data-message-id="${messageId}"]`);
        
        if (messageElement) {
            const statusSingle = messageElement.querySelector('.message-status-single');
            const statusDouble = messageElement.querySelector('.message-status-double');
            
            if (status === "delivered") {
                // Remove sent status
                if (statusSingle) statusSingle.classList.remove('sent');
                // Show delivered status
                if (statusDouble) {
                    statusDouble.classList.add('delivered');
                    statusDouble.classList.remove('read');
                }
            } else if (status === "read") {
                // Remove sent status
                if (statusSingle) statusSingle.classList.remove('sent');
                // Show read status
                if (statusDouble) {
                    statusDouble.classList.remove('delivered');
                    statusDouble.classList.add('read');
                }
            }
        }
    }
    
    // Toggle contact info sidebar
    if (contactInfoBtn && contactInfoSidebar) {
        contactInfoBtn.addEventListener('click', function() {
            contactInfoSidebar.classList.toggle('active');
            overlay.classList.toggle('active');
        });
    }
    
    // Close profile sidebar
    if (closeProfileBtn && contactInfoSidebar) {
        closeProfileBtn.addEventListener('click', function() {
            contactInfoSidebar.classList.remove('active');
            overlay.classList.remove('active');
        });
    }
    
    // Close any sidebar or popup when overlay is clicked
    if (overlay) {
        overlay.addEventListener('click', function() {
            const activeSidebars = document.querySelectorAll('.profile-sidebar.active');
            activeSidebars.forEach(sidebar => sidebar.classList.remove('active'));
            
            const openPopups = document.querySelectorAll('.popup.open');
            openPopups.forEach(popup => popup.classList.remove('open'));
            
            overlay.classList.remove('active');
        });
    }
    
    // Send message
    if (sendMessageBtn && messageInput) {
        sendMessageBtn.addEventListener('click', sendMessage);
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }
    
    // Load messages from API
    function loadMessages(contactId) {
        fetch(`/api/messages/${contactId}`)
            .then(response => response.json())
            .then(data => {
                displayMessages(data);
            })
            .catch(error => {
                console.error('Error loading messages:', error);
            });
    }
    
    // Display messages in chat
    function displayMessages(messages) {
        // Clear previous messages
        chatMessages.innerHTML = '';
        messageMap.clear();
        
        const messageTemplate = document.getElementById('messageTemplate');
        
        messages.forEach(msg => {
            const messageElement = messageTemplate.content.cloneNode(true);
            const messageDiv = messageElement.querySelector('.message');
            const messageContent = messageElement.querySelector('.message-content');
            const messageTime = messageElement.querySelector('.message-time');
            const statusSingle = messageElement.querySelector('.message-status-single');
            const statusDouble = messageElement.querySelector('.message-status-double');
            
            // Set message content and time
            messageContent.textContent = msg.content;
            messageTime.textContent = msg.time;
            
            // Store message ID in dataset
            if (msg.id) {
                messageDiv.dataset.messageId = msg.id;
            }
            
            // Add appropriate class based on sender
            if (msg.sender === 'user') {
                messageDiv.classList.add('outgoing');
                
                // Set message status
                if (msg.status) {
                    if (msg.status === "sent") {
                        statusSingle.classList.add('sent');
                    } else if (msg.status === "delivered") {
                        statusDouble.classList.add('delivered');
                    } else if (msg.status === "read") {
                        statusDouble.classList.add('read');
                    }
                }
                
                // Store message element for future status updates
                if (msg.id) {
                    messageMap.set(msg.id, messageDiv);
                }
            } else {
                messageDiv.classList.add('incoming');
            }
            
            // Add message to chat
            chatMessages.appendChild(messageElement);
        });
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Send message function
    function sendMessage() {
        const message = messageInput.value.trim();
        
        if (message && currentContactId && ws && ws.readyState === WebSocket.OPEN) {
            const now = new Date();
            const msgData = {
                type: "message",
                content: message,
                time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                recipient: currentContactUsername || chatContactName.textContent
            };
            
            try {
                ws.send(JSON.stringify(msgData));
                messageInput.value = '';
            } catch (error) {
                console.error("Error sending message:", error);
                alert("Failed to send message. Please try again.");
            }
        } else if (message) {
            if (!ws || ws.readyState !== WebSocket.OPEN) {
                console.error("WebSocket is not connected");
                alert("Chat connection is not available. Please refresh the page and try again.");
            }
        }
    }
    
    // Update the last message and time for a contact in the sidebar
    function updateContactLastMessage(contactId, message, time) {
        const contactElement = document.querySelector(`.contact-item[data-contact-id="${contactId}"]`);
        if (contactElement) {
            const lastMessageElement = contactElement.querySelector('.last-message');
            const messageTimeElement = contactElement.querySelector('.message-time');
            
            if (lastMessageElement) {
                // Truncate message if too long
                const displayMessage = message.length > 30 ? message.substring(0, 27) + '...' : message;
                lastMessageElement.textContent = displayMessage;
            }
            
            if (messageTimeElement) {
                messageTimeElement.textContent = time;
            }
            
            // Move this contact to the top of the list
            const parentElement = contactElement.parentElement;
            if (parentElement) {
                parentElement.insertBefore(contactElement, parentElement.firstChild);
            }
        }
    }
    
    // Select the first contact by default
    if (contactItems.length > 0) {
        contactItems[0].click();
    }
});