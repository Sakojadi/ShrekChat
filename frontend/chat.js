document.addEventListener('DOMContentLoaded', function() {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (!token || !user.username) {
        // Redirect to login if not authenticated
        window.location.href = 'auth/login.html';
        return;
    }
    
    // API URL
    const API_URL = 'http://localhost:8000/api';
    
    // Variables
    const sendButton = document.querySelector('.send-button');
    const messageInput = document.querySelector('.input-area input');
    const messagesContainer = document.querySelector('.messages-container');
    const contacts = document.querySelectorAll('.contact');
    let currentContact = null;
    
    // Set the current user's name in the profile
    document.querySelector('.profile-name').textContent = user.username;
    
    // Load user profile data
    async function loadUserProfile() {
        try {
            const response = await fetch(`${API_URL}/users/profile`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch user profile');
            }
            
            const data = await response.json();
            
            // Update profile sidebar with user data
            document.getElementById('profileName').textContent = data.username || user.username;
            document.getElementById('profileStatus').textContent = data.status || 'Online';
            
            // Set profile picture if available
            if (data.profilePicture) {
                document.getElementById('profilePicture').src = data.profilePicture;
            }
            
            // Update profile in edit profile popup
            const profileEditNameInput = document.querySelector('#editProfilePopup input[placeholder="Ваше имя"]');
            const profileEditEmailInput = document.querySelector('#editProfilePopup input[placeholder="Ваш email"]');
            const profileEditPhoneInput = document.querySelector('#editProfilePopup input[placeholder="Ваш телефон"]');
            
            if (profileEditNameInput) profileEditNameInput.value = data.username || '';
            if (profileEditEmailInput) profileEditEmailInput.value = data.email || '';
            if (profileEditPhoneInput) profileEditPhoneInput.value = data.phone || '';
        } catch (error) {
            console.error('Error loading user profile:', error);
        }
    }
    
    // Fetch all users for adding contacts
    async function fetchAllUsers() {
        try {
            const response = await fetch(`${API_URL}/users/all`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch users');
            }
            
            const data = await response.json();
            
            // Update members list for group creation
            const membersList = document.querySelector('#createGroupMembersPopup .members-list');
            if (membersList) {
                membersList.innerHTML = '';
                
                data.users.forEach((user, index) => {
                    if (user.username !== user.username) {
                        const memberHTML = `
                            <div class="member-item">
                                <div class="member-checkbox">
                                    <input type="checkbox" id="member${index}">
                                    <label for="member${index}"></label>
                                </div>
                                <div class="member-avatar">
                                    <img src="${user.profilePicture || 'images/default-avatar.png'}" alt="${user.username}">
                                </div>
                                <div class="member-name">${user.username}</div>
                            </div>
                        `;
                        membersList.insertAdjacentHTML('beforeend', memberHTML);
                    }
                });
            }
        } catch (error) {
            console.error('Error fetching all users:', error);
        }
    }
    
    // Profile sidebar functionality
    const profileButton = document.getElementById('profileButton');
    const profileSidebar = document.getElementById('profileSidebar');
    const closeProfile = document.querySelector('.close-profile');
    const overlay = document.getElementById('overlay');
    const themeToggle = document.getElementById('themeToggle');
    
    // Check for saved theme preference
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-theme');
        themeToggle.checked = true;
    }
    
    // Open profile sidebar
    profileButton.addEventListener('click', function() {
        profileSidebar.classList.add('open');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    });
    
    // Close profile sidebar
    function closeProfileSidebar() {
        profileSidebar.classList.remove('open');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    closeProfile.addEventListener('click', closeProfileSidebar);
    overlay.addEventListener('click', closeProfileSidebar);
    
    // Theme toggle
    themeToggle.addEventListener('change', function() {
        if (this.checked) {
            document.body.classList.add('dark-theme');
            localStorage.setItem('theme', 'dark');
        } else {
            document.body.classList.remove('dark-theme');
            localStorage.setItem('theme', 'light');
        }
    });
    
    // Menu item click events
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', function() {
            if (this.querySelector('span').textContent === 'Выйти') {
                // Log out functionality - redirects to login page
                window.location.href = 'auth/login.html';
            }
        });
    });
    
    // Mobile sidebar toggle
    if (window.innerWidth <= 768) {
        const chatHeader = document.querySelector('.chat-header');
        const sidebar = document.querySelector('.sidebar');
        
        // Create toggle button for mobile
        const toggleButton = document.createElement('i');
        toggleButton.className = 'fas fa-bars toggle-sidebar';
        chatHeader.prepend(toggleButton);
        
        toggleButton.addEventListener('click', function() {
            sidebar.classList.toggle('open');
        });
        
        // Close sidebar when a contact is selected on mobile
        contacts.forEach(contact => {
            contact.addEventListener('click', function() {
                sidebar.classList.remove('open');
            });
        });
    }
    
    // Fetch contacts from the server
    async function fetchContacts() {
        try {
            const response = await fetch(`${API_URL}/chat/contacts`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch contacts');
            }
            
            const data = await response.json();
            const contactsList = document.getElementById('contactsList');
            const noContactsMessage = document.getElementById('noContactsMessage');
            
            // Clear any existing contacts
            contactsList.innerHTML = '';
            
            if (data.contacts && data.contacts.length > 0) {
                // Hide the no contacts message
                if (noContactsMessage) {
                    noContactsMessage.style.display = 'none';
                }
                
                // Create HTML for each contact
                data.contacts.forEach((contact, index) => {
                    const isActive = index === 0; // Make first contact active
                    const contactHTML = `
                        <div class="contact ${isActive ? 'active' : ''}">
                            <div class="contact-avatar">
                                <img src="images/default-avatar.png" alt="${contact}">
                                <span class="status online"></span>
                            </div>
                            <div class="contact-info">
                                <div class="contact-name">${contact}</div>
                                <div class="contact-last-message">No messages yet</div>
                            </div>
                            <div class="contact-meta">
                                <div class="contact-time"></div>
                            </div>
                        </div>
                    `;
                    contactsList.insertAdjacentHTML('beforeend', contactHTML);
                });
                
                // Re-attach event listeners to the new contacts
                attachContactEventListeners();
                
                // Set initial active contact
                if (data.contacts.length > 0) {
                    currentContact = data.contacts[0];
                    // Load initial messages
                    fetchMessages(currentContact);
                    
                    // Update chat header
                    updateChatHeader(currentContact);
                }
            } else {
                // Show no contacts message
                if (noContactsMessage) {
                    noContactsMessage.style.display = 'block';
                }
            }
        } catch (error) {
            console.error('Error fetching contacts:', error);
        }
    }
    
    // Function to update chat header with contact info
    function updateChatHeader(contactName) {
        document.querySelector('.chat-header .contact-name').textContent = contactName;
        document.querySelector('.chat-header .contact-avatar img').src = 'images/default-avatar.png';
        document.querySelector('.chat-header .status').classList.add('online');
        document.querySelector('.chat-header .status').classList.remove('offline');
        document.querySelector('.chat-header .contact-status').textContent = 'Online';
    }
    
    // Function to attach event listeners to contacts
    function attachContactEventListeners() {
        const contacts = document.querySelectorAll('.contact');
        
        contacts.forEach(contact => {
            contact.addEventListener('click', function() {
                // Remove active class from all contacts
                contacts.forEach(c => c.classList.remove('active'));
                
                // Add active class to clicked contact
                this.classList.add('active');
                
                // Update chat header with contact info
                const contactName = this.querySelector('.contact-name').textContent;
                
                updateChatHeader(contactName);
                
                // Set current contact for sending messages
                currentContact = contactName;
                
                // Fetch messages for this contact
                fetchMessages(currentContact);
                
                // Remove unread count badge if exists
                const unreadBadge = this.querySelector('.unread-count');
                if (unreadBadge) {
                    unreadBadge.remove();
                }
                
                // For mobile: close sidebar when contact is selected
                if (window.innerWidth <= 768) {
                    const sidebar = document.querySelector('.sidebar');
                    sidebar.classList.remove('open');
                }
            });
            
            // Context menu for viewing profile
            contact.addEventListener('contextmenu', function(e) {
                e.preventDefault();
                
                // Update the view profile popup with contact info
                const contactName = this.querySelector('.contact-name').textContent;
                
                document.querySelector('#viewProfilePopup .profile-view-avatar img').src = 'images/default-avatar.png';
                document.querySelector('#viewProfilePopup h3').textContent = contactName;
                
                // Open the view profile popup
                openPopup('viewProfile');
            });
        });
    }
    
    // Fetch messages for a specific contact
    async function fetchMessages(contact) {
        try {
            // Show loading indicator
            messagesContainer.innerHTML = '<div class="loading-messages">Loading messages...</div>';
            
            const response = await fetch(`${API_URL}/chat/messages/${contact}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch messages');
            }
            
            const data = await response.json();
            
            // Clear existing messages
            messagesContainer.innerHTML = '<div class="message-date">Today</div>';
            
            // Check if there are any messages
            if (data.messages && data.messages.length > 0) {
                // Display fetched messages
                data.messages.forEach(msg => {
                    const isReceived = msg.sender !== user.username;
                    const messageHTML = `
                        <div class="message ${isReceived ? 'received' : 'sent'}">
                            <div class="message-content">
                                <p>${msg.content}</p>
                                <span class="message-time">${formatMessageTime(msg.timestamp)}</span>
                            </div>
                        </div>
                    `;
                    messagesContainer.insertAdjacentHTML('beforeend', messageHTML);
                });
            } else {
                // Show wave container if no messages
                showWaveContainer(contact);
            }
            
            // Scroll to bottom
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        } catch (error) {
            console.error('Error fetching messages:', error);
            messagesContainer.innerHTML = '<div class="error-message">Failed to load messages</div>';
        }
    }
    
    // Helper function to format message time
    function formatMessageTime(timestamp) {
        const date = new Date(timestamp);
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
    
    // Send message function
    async function sendMessage() {
        const messageText = messageInput.value.trim();
        
        if (messageText && currentContact) {
            // Create timestamp
            const now = new Date();
            const timestamp = now.toISOString();
            const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
            
            // Create message HTML
            const messageHTML = `
                <div class="message sent">
                    <div class="message-content">
                        <p>${messageText}</p>
                        <span class="message-time">${timeString}</span>
                    </div>
                </div>
            `;
            
            // Add message to container immediately for better UX
            messagesContainer.insertAdjacentHTML('beforeend', messageHTML);
            
            // Clear input
            messageInput.value = '';
            
            // Scroll to bottom
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            
            // Send message to backend
            try {
                const response = await fetch(`${API_URL}/chat/send`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        sender: user.username,
                        receiver: currentContact,
                        content: messageText,
                        timestamp: timestamp
                    })
                });
                
                if (!response.ok) {
                    console.error('Failed to send message:', await response.json());
                }
            } catch (error) {
                console.error('Error sending message:', error);
            }
        }
    }
    
    // Replace simulateReply with dynamic response handling
    function simulateReply() {
        const now = new Date();
        const timeString = formatTime(now);
        
        // Create a generic reply with timestamp
        const replyHTML = `
            <div class="message received">
                <div class="message-content">
                    <p>Auto reply: This is an automated response. Real-time messaging will be implemented later.</p>
                    <span class="message-time">${timeString}</span>
                </div>
            </div>
        `;
        
        messagesContainer.insertAdjacentHTML('beforeend', replyHTML);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // Update last message in contact list
        const activeContact = document.querySelector('.contact.active');
        if (activeContact) {
            const lastMessageElement = activeContact.querySelector('.contact-last-message');
            const timeElement = activeContact.querySelector('.contact-time');
            
            if (lastMessageElement) lastMessageElement.textContent = 'Auto reply: This is an automated response';
            if (timeElement) timeElement.textContent = timeString;
        }
    }
    
    function formatTime(date) {
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
    
    // Dropdown functionality
    const dropdownToggle = document.querySelector('.dropdown-toggle');
    const dropdownMenu = document.querySelector('.dropdown-menu');
    
    dropdownToggle.addEventListener('click', function(e) {
        e.stopPropagation();
        dropdownMenu.classList.toggle('show');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function() {
        dropdownMenu.classList.remove('show');
    });
    
    // Delete all messages functionality
    const deleteAllMessagesBtn = document.getElementById('deleteAllMessages');
    deleteAllMessagesBtn.addEventListener('click', async function() {
        if (currentContact && confirm(`Are you sure you want to delete all messages with ${currentContact}?`)) {
            try {
                const response = await fetch(`${API_URL}/chat/delete-messages/${currentContact}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (response.ok) {
                    // Clear messages from UI
                    messagesContainer.innerHTML = '<div class="message-date">Today</div>';
                    
                    // Show wave container
                    showWaveContainer(currentContact);
                    
                    // Update contact last message
                    const activeContact = document.querySelector('.contact.active .contact-last-message');
                    if (activeContact) {
                        activeContact.textContent = 'No messages yet';
                    }
                } else {
                    console.error('Failed to delete messages');
                }
            } catch (error) {
                console.error('Error deleting messages:', error);
            }
        }
        
        // Close dropdown
        dropdownMenu.classList.remove('show');
    });
    
    // Function to show wave container
    function showWaveContainer(contactName) {
        // Remove existing wave container if any
        const existingWaveContainer = messagesContainer.querySelector('.wave-container');
        if (existingWaveContainer) {
            existingWaveContainer.remove();
        }
        
        // Add wave container
        const waveHTML = `
            <div class="wave-container">
                <div class="wave-message">Wave to ${contactName}</div>
                <button class="wave-button" data-contact="${contactName}">
                    <i class="fas fa-hand-paper"></i>
                    Send Wave
                </button>
            </div>
        `;
        messagesContainer.insertAdjacentHTML('beforeend', waveHTML);
        
        // Add event listener to wave button
        const waveButton = messagesContainer.querySelector('.wave-button');
        waveButton.addEventListener('click', function() {
            sendWave(this.dataset.contact);
        });
    }
    
    // Function to send a wave
    async function sendWave(contactName) {
        // Create and send wave message (using 👋 emoji)
        const waveEmoji = "👋";
        
        // Create timestamp
        const now = new Date();
        const timestamp = now.toISOString();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        // Create message HTML
        const messageHTML = `
            <div class="message sent">
                <div class="message-content">
                    <p>${waveEmoji}</p>
                    <span class="message-time">${timeString}</span>
                </div>
            </div>
        `;
        
        // Remove wave container
        const waveContainer = messagesContainer.querySelector('.wave-container');
        if (waveContainer) {
            waveContainer.remove();
        }
        
        // Add message to container
        messagesContainer.insertAdjacentHTML('beforeend', messageHTML);
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // Update contact last message
        const activeContact = document.querySelector('.contact.active .contact-last-message');
        if (activeContact) {
            activeContact.textContent = waveEmoji;
        }
        
        // Update contact time
        const contactTime = document.querySelector('.contact.active .contact-time');
        if (contactTime) {
            contactTime.textContent = timeString;
        }
        
        // Send to backend
        try {
            const response = await fetch(`${API_URL}/chat/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    sender: user.username,
                    receiver: contactName,
                    content: waveEmoji,
                    timestamp: timestamp
                })
            });
            
            if (!response.ok) {
                console.error('Failed to send wave:', await response.json());
            }
        } catch (error) {
            console.error('Error sending wave:', error);
        }
    }
    
    // Event listeners
    sendButton.addEventListener('click', sendMessage);
    
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    // Logout functionality
    const logoutButton = document.querySelector('.menu-item.logout');
    logoutButton.addEventListener('click', function() {
        // Clear auth data from localStorage
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // Redirect to login page
        window.location.href = 'auth/login.html';
    });
    
    // Popup functionality
    const popups = {
        editProfile: document.getElementById('editProfilePopup'),
        addFriends: document.getElementById('addFriendsPopup'),
        createGroupMembers: document.getElementById('createGroupMembersPopup'),
        createGroupDetails: document.getElementById('createGroupDetailsPopup'),
        groupMembers: document.getElementById('groupMembersPopup'),
        viewProfile: document.getElementById('viewProfilePopup')
    };
    
    // Close buttons for all popups
    const closeButtons = document.querySelectorAll('.close-popup');
    closeButtons.forEach(button => {
        button.addEventListener('click', closeAllPopups);
    });
    
    // Close all popups function
    function closeAllPopups() {
        for (const popup in popups) {
            popups[popup].classList.remove('open');
        }
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    // Open popup function
    function openPopup(popupId) {
        closeAllPopups();
        popups[popupId].classList.add('open');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    // Close popups when clicking on overlay
    overlay.addEventListener('click', closeAllPopups);
    
    // Menu item click events to open the corresponding popups
    menuItems.forEach(item => {
        item.addEventListener('click', function() {
            const menuText = this.querySelector('span').textContent;
            
            switch(menuText) {
                case 'Мой профиль':
                    openPopup('editProfile');
                    break;
                case 'Добавить друга':
                    openPopup('addFriends');
                    break;
                case 'Новая группа':
                    openPopup('createGroupMembers');
                    break;
                case 'Выйти':
                    window.location.href = 'auth/login.html';
                    break;
            }
        });
    });
    
    // Navigation between create group popups
    const goToGroupDetailsBtn = document.getElementById('goToGroupDetails');
    const backToGroupMembersBtn = document.getElementById('backToGroupMembers');
    
    goToGroupDetailsBtn.addEventListener('click', function() {
        popups.createGroupMembers.classList.remove('open');
        popups.createGroupDetails.classList.add('open');
    });
    
    backToGroupMembersBtn.addEventListener('click', function() {
        popups.createGroupDetails.classList.remove('open');
        popups.createGroupMembers.classList.add('open');
    });
    
    // Handle "Close" buttons in popups
    const closeActionButtons = document.querySelectorAll('.popup-actions .btn-outline');
    closeActionButtons.forEach(button => {
        button.addEventListener('click', closeAllPopups);
    });
    
    // Handle contact click to view profile
    contacts.forEach(contact => {
        contact.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            
            // Update the view profile popup with contact info
            const contactName = this.querySelector('.contact-name').textContent;
            const contactImg = this.querySelector('.contact-avatar img').src;
            
            document.querySelector('#viewProfilePopup .profile-view-avatar img').src = contactImg;
            document.querySelector('#viewProfilePopup h3').textContent = contactName;
            
            // Open the view profile popup
            openPopup('viewProfile');
        });
    });
    
    // Handle group member management
    const groupIcons = document.querySelectorAll('.fa-users');
    groupIcons.forEach(icon => {
        icon.addEventListener('click', function() {
            openPopup('groupMembers');
        });
    });
    
    // Initial data loading
    loadUserProfile();
    fetchAllUsers();
    fetchContacts();
});
