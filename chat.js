document.addEventListener('DOMContentLoaded', function() {
    // Variables
    const sendButton = document.querySelector('.send-button');
    const messageInput = document.querySelector('.input-area input');
    const messagesContainer = document.querySelector('.messages-container');
    const contacts = document.querySelectorAll('.contact');
    
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
                window.location.href = 'login.html';
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
    
    // Send message function
    function sendMessage() {
        const messageText = messageInput.value.trim();
        
        if (messageText) {
            // Create timestamp
            const now = new Date();
            const hours = now.getHours().toString().padStart(2, '0');
            const minutes = now.getMinutes().toString().padStart(2, '0');
            const timeString = `${hours}:${minutes}`;
            
            // Create message HTML
            const messageHTML = `
                <div class="message sent">
                    <div class="message-content">
                        <p>${messageText}</p>
                        <span class="message-time">${timeString}</span>
                    </div>
                </div>
            `;
            
            // Add message to container
            messagesContainer.insertAdjacentHTML('beforeend', messageHTML);
            
            // Clear input
            messageInput.value = '';
            
            // Scroll to bottom
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            
            // Simulate reply after 1-3 seconds (for demo purposes)
            setTimeout(simulateReply, 1000 + Math.random() * 2000);
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
            
            // Clear existing messages (in a real app, you'd load the conversation history)
            messagesContainer.innerHTML = '<div class="message-date">Today</div>';
            
            // Remove unread count badge if exists
            const unreadBadge = this.querySelector('.unread-count');
            if (unreadBadge) {
                unreadBadge.remove();
            }
        });
    });
});
