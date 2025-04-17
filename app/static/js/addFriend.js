document.addEventListener('DOMContentLoaded', function() {
    const addFriendButton = document.getElementById('addFriendButton');
    const addFriendInput = document.getElementById('addFriendInput');
    const searchResults = document.getElementById('searchResults');
    const showAddContactBtn = document.getElementById('showAddContactBtn');
    const addFriendPopup = document.getElementById('addFriendPopup');
    const overlay = document.getElementById('overlay');
    const closeAddFriendPopup = document.getElementById('closeAddFriendPopup');
    const addFriendMenuItem = document.getElementById('addContactMenuItem');
    
    let selectedUsername = null;

    // Show add friend popup
    function showAddFriendPopup() {
        if (addFriendPopup) {
            addFriendPopup.classList.add('open');
            if (overlay) overlay.classList.add('active');
            if (addFriendInput) {
                addFriendInput.focus();
            }
        }
    }

    // Close add friend popup
    function closePopup() {
        if (addFriendPopup) {
            addFriendPopup.classList.remove('open');
            if (overlay) overlay.classList.remove('active');
            if (addFriendInput) {
                addFriendInput.value = '';
            }
            if (searchResults) {
                searchResults.innerHTML = '';
            }
            selectedUsername = null;
        }
    }

    // Event listeners for opening/closing popup
    if (showAddContactBtn) {
        showAddContactBtn.addEventListener('click', showAddFriendPopup);
    }
    
    if (addFriendMenuItem) {
        addFriendMenuItem.addEventListener('click', function() {
            const profileSidebar = document.getElementById('profileSidebar');
            if (profileSidebar) {
                profileSidebar.classList.remove('active');
            }
            showAddFriendPopup();
        });
    }

    if (closeAddFriendPopup) {
        closeAddFriendPopup.addEventListener('click', closePopup);
    }

    if (overlay) {
        overlay.addEventListener('click', function(e) {
            // Only close if clicking directly on overlay, not on popup content
            if (e.target === overlay) {
                closePopup();
            }
        });
    }

    // Search for users as the user types
    if (addFriendInput) {
        addFriendInput.addEventListener('input', debounce(function() {
            const query = addFriendInput.value.trim();
            
            if (query.length < 2) {
                searchResults.innerHTML = '';
                return;
            }
            
            fetch(`/api/users/search?query=${encodeURIComponent(query)}`)
                .then(response => response.json())
                .then(data => {
                    searchResults.innerHTML = '';
                    
                    if (data.length === 0) {
                        const noResults = document.createElement('div');
                        noResults.className = 'no-results';
                        noResults.textContent = 'No users found';
                        searchResults.appendChild(noResults);
                        return;
                    }
                    
                    const searchResultTemplate = document.getElementById('searchResultTemplate');
                    
                    if (searchResultTemplate) {
                        data.forEach(user => {
                            const searchResultItem = searchResultTemplate.content.cloneNode(true);
                            searchResultItem.querySelector('.search-result-name').textContent = user.name;
                            searchResultItem.querySelector('.search-result-username').textContent = user.username;
                            
                            const resultDiv = searchResultItem.querySelector('.search-result-item');
                            resultDiv.addEventListener('click', function() {
                                addFriendInput.value = user.username;
                                selectedUsername = user.username;
                                searchResults.innerHTML = '';
                            });
                            
                            searchResults.appendChild(searchResultItem);
                        });
                    } else {
                        // Fallback if template is not found
                        data.forEach(user => {
                            const div = document.createElement('div');
                            div.className = 'search-result-item';
                            div.innerHTML = `
                                <div class="search-result-avatar">
                                    <img src="/static/images/shrek.jpg" alt="${user.name}">
                                </div>
                                <div class="search-result-info">
                                    <div class="search-result-name">${user.name}</div>
                                    <div class="search-result-username">@${user.username}</div>
                                </div>
                            `;
                            
                            div.addEventListener('click', function() {
                                addFriendInput.value = user.username;
                                selectedUsername = user.username;
                                searchResults.innerHTML = '';
                            });
                            
                            searchResults.appendChild(div);
                        });
                    }
                })
                .catch(error => {
                    console.error('Error searching for users:', error);
                    searchResults.innerHTML = '<div class="error">Error searching for users</div>';
                });
        }, 300));
    }

    // Add contact/friend
    if (addFriendButton) {
        addFriendButton.addEventListener('click', function() {
            const username = selectedUsername || addFriendInput.value.trim();
            
            if (!username) {
                alert('Please enter or select a username');
                return;
            }
            
            // Create form data
            const formData = new FormData();
            formData.append('contact_username', username);
            
            fetch('/api/contacts/add', {
                method: 'POST',
                body: formData
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(data => {
                        throw new Error(data.detail || 'Failed to add contact');
                    });
                }
                return response.json();
            })
            .then(data => {
                alert('Contact added successfully!');
                closePopup();
                
                // Refresh the contacts list by fetching fresh data from the server
                fetch('/api/contacts')
                    .then(response => response.json())
                    .then(contacts => {
                        const contactsList = document.getElementById('contactsList');
                        
                        // Save the add contact button
                        const addContactButton = document.querySelector('.add-contact-button');
                        
                        // Clear existing contacts
                        contactsList.innerHTML = '';
                        
                        // Add contacts from the server
                        contacts.forEach(contact => {
                            const contactElement = document.createElement('div');
                            contactElement.className = 'contact-item';
                            contactElement.setAttribute('data-contact-id', contact.id);
                            
                            contactElement.innerHTML = `
                                <div class="contact-avatar">
                                    <img src="${contact.avatar}" alt="${contact.name} Avatar">
                                    <span class="status-indicator ${contact.status}"></span>
                                </div>
                                <div class="contact-info">
                                    <div class="contact-name-time">
                                        <h4>${contact.name}</h4>
                                        <span class="message-time">${contact.last_message_time}</span>
                                    </div>
                                    <p class="last-message">${contact.last_message}</p>
                                </div>
                                ${contact.unread_count > 0 ? 
                                `<div class="unread-count">${contact.unread_count}</div>` : ''}
                            `;
                            
                            // Attach click handler
                            contactElement.addEventListener('click', function() {
                                // Get all contact items and remove active class
                                document.querySelectorAll('.contact-item').forEach(item => {
                                    item.classList.remove('active');
                                });
                                
                                // Add active class to clicked contact
                                this.classList.add('active');
                                
                                // Get contact details
                                const contactId = this.getAttribute('data-contact-id');
                                const contactName = this.querySelector('.contact-name-time h4').textContent;
                                const contactStatus = this.querySelector('.status-indicator').classList.contains('online') ? 'Online' : 'Offline';
                                const contactAvatar = this.querySelector('.contact-avatar img').src;
                                
                                // Update chat header
                                document.getElementById('chatContactName').textContent = contactName;
                                document.getElementById('chatContactPresence').textContent = contactStatus;
                                document.getElementById('chatContactAvatar').src = contactAvatar;
                                
                                // Update contact info sidebar
                                document.getElementById('profileContactName').textContent = contactName;
                                document.getElementById('profileContactStatus').textContent = contactStatus;
                                document.getElementById('profileContactAvatar').src = contactAvatar;
                                
                                // Hide sidebar on mobile
                                document.querySelector('.sidebar').classList.remove('active');
                                
                                // Load messages for this contact
                                fetch(`/api/messages/${contactId}`)
                                    .then(response => response.json())
                                    .then(messages => {
                                        const chatMessages = document.getElementById('chatMessages');
                                        chatMessages.innerHTML = '';
                                        
                                        const messageTemplate = document.getElementById('messageTemplate');
                                        
                                        messages.forEach(msg => {
                                            const messageElement = messageTemplate.content.cloneNode(true);
                                            const messageDiv = messageElement.querySelector('.message');
                                            const messageContent = messageElement.querySelector('.message-content');
                                            const messageTime = messageElement.querySelector('.message-time');
                                            
                                            // Set message content and time
                                            messageContent.textContent = msg.content;
                                            messageTime.textContent = msg.time;
                                            
                                            // Add appropriate class based on sender
                                            if (msg.sender === 'user') {
                                                messageDiv.classList.add('outgoing');
                                            } else {
                                                messageDiv.classList.add('incoming');
                                            }
                                            
                                            // Add message to chat
                                            chatMessages.appendChild(messageElement);
                                        });
                                        
                                        // Scroll to bottom
                                        chatMessages.scrollTop = chatMessages.scrollHeight;
                                    })
                                    .catch(error => {
                                        console.error('Error loading messages:', error);
                                    });
                            });
                            
                            contactsList.appendChild(contactElement);
                        });
                        
                        // Add back the add contact button
                        if (addContactButton) {
                            contactsList.appendChild(addContactButton);
                        }
                        
                        // Select the newly added contact
                        if (contacts.length > 0) {
                            const newContact = contacts.find(c => c.username === username);
                            if (newContact) {
                                const newContactElement = document.querySelector(`[data-contact-id="${newContact.id}"]`);
                                if (newContactElement) {
                                    newContactElement.click();
                                }
                            }
                        }
                    })
                    .catch(error => console.error('Error refreshing contacts:', error));
            })
            .catch(error => {
                console.error('Error adding contact:', error);
                alert(error.message);
            });
        });
    }

    // Helper function to debounce search input
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
});
