/**
 * Shared utility functions for ShrekChat
 */

// Format a date into time string (HH:MM)
function formatTime(date) {
    return date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', hour12: false});
}

// Debounce function for search inputs
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

// Update display of message status indicators
function updateMessageStatus(messageId, status) {
    const messageElement = document.querySelector(`.message[data-message-id="${messageId}"]`);
    if (messageElement) {
        const messageStatusSingle = messageElement.querySelector('.message-status-single');
        const messageStatusDouble = messageElement.querySelector('.message-status-double');
        
        if (messageStatusSingle && messageStatusDouble) {
            if (status === 'delivered') {
                messageStatusDouble.style.display = 'inline';
                messageStatusDouble.classList.remove('read');
                messageStatusSingle.style.display = 'none';
            } else if (status === 'read') {
                messageStatusDouble.style.display = 'inline';
                messageStatusDouble.classList.add('read');
                messageStatusSingle.style.display = 'none';
            }
        }
    } else {
        // Message element not found in DOM - might be an old message that's not currently visible
        // Store this status update to apply when the message becomes visible
        if (!window.pendingMessageStatuses) {
            window.pendingMessageStatuses = {};
        }
        window.pendingMessageStatuses[messageId] = status;
        console.log(`Stored pending status update for message ${messageId}: ${status}`);
    }
}

// Update a contact's online status in the UI
function updateContactStatus(userId, status) {
    const contactElement = document.querySelector(`.contact-item[data-user-id="${userId}"]`);
    if (contactElement) {
        const statusIndicator = contactElement.querySelector('.status-indicator');
        if (statusIndicator) {
            statusIndicator.className = `status-indicator ${status}`;
        }
        
        // Also update the chat header if this is the current contact
        const chatContactStatus = document.getElementById('chatContactPresence');
        const chatHeader = document.getElementById('chatHeader');
        const currentUserId = parseInt(document.querySelector('.chat-area')?.getAttribute('data-current-user-id'));
        
        if (currentUserId === userId && chatContactStatus && chatHeader) {
            const headerStatusIndicator = chatHeader.querySelector('.status-indicator');
            if (headerStatusIndicator) {
                headerStatusIndicator.className = `status-indicator ${status}`;
            }
            chatContactStatus.textContent = status === 'online' ? 'Online' : 'Offline';
            
            const newStatusIndicator = document.createElement('span');
            newStatusIndicator.className = `status-indicator ${status}`;
            chatContactStatus.prepend(newStatusIndicator);
        }
    }
}

// Update the last message preview in a chat contact list item
function updateLastMessage(roomId, message, time) {
    const contactElement = document.querySelector(`.contact-item[data-room-id="${roomId}"]`);
    
    if (contactElement) {
        const lastMessageElement = contactElement.querySelector('.last-message');
        const messageTimeElement = contactElement.querySelector('.message-time');
        
        if (lastMessageElement) {
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

// Increment the unread message count badge for a room
function incrementUnreadCount(roomId) {
    const contactElement = document.querySelector(`.contact-item[data-room-id="${roomId}"]`);
    
    if (contactElement) {
        let unreadCount = contactElement.querySelector('.unread-count');
        
        if (unreadCount) {
            const count = parseInt(unreadCount.textContent) + 1;
            unreadCount.textContent = count;
        } else {
            unreadCount = document.createElement('div');
            unreadCount.className = 'unread-count';
            unreadCount.textContent = '1';
            contactElement.appendChild(unreadCount);
        }
        
        // Move this contact to the top of the list
        const parentElement = contactElement.parentElement;
        if (parentElement) {
            parentElement.insertBefore(contactElement, parentElement.firstChild);
        }
        
        // Try to play notification sound
        try {
            const notificationSound = new Audio('/static/sounds/notification.mp3');
            notificationSound.play().catch(e => console.log('Failed to play notification sound'));
        } catch (soundError) {
            console.log('Failed to play notification sound', soundError);
        }
    }
}

// Export all utility functions
window.shrekChatUtils = {
    formatTime,
    debounce,
    updateMessageStatus,
    updateContactStatus,
    updateLastMessage,
    incrementUnreadCount
};