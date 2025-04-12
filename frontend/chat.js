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
            
            // Update contacts list here if needed
            console.log('Contacts:', data.contacts);
        } catch (error) {
            console.error('Error fetching contacts:', error);
        }
    }
    
    // Fetch messages for a specific contact
    async function fetchMessages(contact) {
        try {
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
            
            // Scroll to bottom
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        } catch (error) {
            console.error('Error fetching messages:', error);
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
            
            // For demo purposes, simulate a reply
            if (document.querySelector('.contact.active .contact-name').textContent === 'Donkey') {
                setTimeout(simulateReply, 1000 + Math.random() * 2000);
            }
        }
    }
    
    // Simulate reply function (for demo)
    function simulateReply() {
        const replies = [
            "Are we there yet?",
            "I love parfaits! Have you ever met a person, you say, 'Let's get some parfait,' they say, 'No, I don't like parfait'?",
            "That's right, fool! Now I'm a flying, talking donkey!",
            "You know what ELSE everybody likes? Parfaits! Have you ever met a person, you say, 'Let's get some parfait,' they say, 'No, no, I don't like parfait'?",
            "We can stay up late, swapping manly stories, and in the morning, I'm making waffles!"
        ];
        
        const randomReply = replies[Math.floor(Math.random() * replies.length)];
        
        // Create timestamp
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const timeString = `${hours}:${minutes}`;
        
        // Create reply HTML
        const replyHTML = `
            <div class="message received">
                <div class="message-content">
                    <p>${randomReply}</p>
                    <span class="message-time">${timeString}</span>
                </div>
            </div>
        `;
        
        // Add reply to container
        messagesContainer.insertAdjacentHTML('beforeend', replyHTML);
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // Update last message in contact list
        document.querySelector('.contact.active .contact-last-message').textContent = randomReply;
        document.querySelector('.contact.active .contact-time').textContent = timeString;
    }
    
    // Event listeners
    sendButton.addEventListener('click', sendMessage);
    
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    // Switch between contacts
    contacts.forEach(contact => {
        contact.addEventListener('click', function() {
            // Remove active class from all contacts
            contacts.forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked contact
            this.classList.add('active');
            
            // Update chat header with contact info
            const contactName = this.querySelector('.contact-name').textContent;
            const contactImg = this.querySelector('.contact-avatar img').src;
            const isOnline = this.querySelector('.status').classList.contains('online');
            
            document.querySelector('.chat-header .contact-name').textContent = contactName;
            document.querySelector('.chat-header .contact-avatar img').src = contactImg;
            
            if (isOnline) {
                document.querySelector('.chat-header .status').classList.add('online');
                document.querySelector('.chat-header .status').classList.remove('offline');
                document.querySelector('.chat-header .contact-status').textContent = 'Online';
            } else {
                document.querySelector('.chat-header .status').classList.add('offline');
                document.querySelector('.chat-header .status').classList.remove('online');
                document.querySelector('.chat-header .contact-status').textContent = 'Offline';
            }
            
            // Set current contact for sending messages
            currentContact = this.querySelector('.contact-name').textContent;
            
            // Fetch messages for this contact
            fetchMessages(currentContact);
            
            // Remove unread count badge if exists
            const unreadBadge = this.querySelector('.unread-count');
            if (unreadBadge) {
                unreadBadge.remove();
            }
        });
    });
    
    // Set initial active contact
    if (contacts.length > 0) {
        currentContact = document.querySelector('.contact.active .contact-name').textContent;
        // Load initial messages
        fetchMessages(currentContact);
    }
    
    // Initial load
    fetchContacts();
    
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
});
