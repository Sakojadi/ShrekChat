/**
 * Shared utility functions for ShrekChat
 */

// Format a date into time string (HH:MM)
function formatTime(date) {
    return date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', hour12: false});
}

// Format a date for display in chat header (Today, Yesterday, or DD-MM-YY)
function formatDateForChat(dateStr) {
    // If no date string is provided, return empty string
    if (!dateStr) return '';
    
    // Parse the date string (assuming ISO format or similar)
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
        return ''; // Invalid date
    }
    
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Reset hours, minutes, seconds and milliseconds for today and yesterday
    today.setHours(0, 0, 0, 0);
    yesterday.setHours(0, 0, 0, 0);
    
    // Create a date object from the input date with time part removed
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    
    // Check if date is today
    if (compareDate.getTime() === today.getTime()) {
        return 'Today';
    }
    
    // Check if date is yesterday
    if (compareDate.getTime() === yesterday.getTime()) {
        return 'Yesterday';
    }
    
    // Format as DD-MM-YY for other dates
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Months are 0-based
    const year = date.getFullYear().toString().slice(-2); // Get last 2 digits of year
    
    return `${day}-${month}-${year}`;
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

// Cache for storing latest user statuses
const statusCache = {};

// Update a contact's online status in the UI
function updateContactStatus(userId, status, source = 'unknown') {
    // Get timestamp for logging
    const timestamp = new Date().toISOString();
    
    // First, check if this user is blocked
    if (window.isUserBlocked && typeof window.isUserBlocked === 'function') {
        window.isUserBlocked(userId).then(blocked => {
            if (blocked) {
                // If user is blocked by current user, show 'blocked' status
                console.log(`[${timestamp}] User ${userId} is blocked by you, showing blocked status (source: ${source})`);
                applyStatusToUI(userId, 'blocked', timestamp);
                return;
            } else {
                // Check if current user is blocked by this user
                checkIfBlocked(userId).then(blockStatus => {
                    if (blockStatus.is_blocker) {
                        // If this user has blocked the current user, hide status completely
                        console.log(`[${timestamp}] User ${userId} has blocked you, hiding status completely (source: ${source})`);
                        applyStatusToUI(userId, 'hidden', timestamp);
                    } else {
                        // Otherwise, proceed with normal status
                        const validStatus = status === 'online' || status === 'offline' ? status : 'offline';
                        console.log(`[${timestamp}] Updating status for user ${userId} to ${validStatus} (source: ${source})`);
                        applyStatusToUI(userId, validStatus, timestamp);
                    }
                }).catch(err => {
                    // On error, show normal status
                    const validStatus = status === 'online' || status === 'offline' ? status : 'offline';
                    console.log(`[${timestamp}] Error checking block status: ${err}, using ${validStatus} (source: ${source})`);
                    applyStatusToUI(userId, validStatus, timestamp);
                });
            }
        }).catch(err => {
            // If there's an error checking block status, fall back to normal status
            const validStatus = status === 'online' || status === 'offline' ? status : 'offline';
            console.log(`[${timestamp}] Error checking block status for ${userId}, using ${validStatus}: ${err}`);
            applyStatusToUI(userId, validStatus, timestamp);
        });
    } else {
        // If block check function is not available, proceed with normal status
        const validStatus = status === 'online' || status === 'offline' ? status : 'offline';
        console.log(`[${timestamp}] Updating status for user ${userId} to ${validStatus} (source: ${source})`);
        applyStatusToUI(userId, validStatus, timestamp);
    }
}

// Apply a status to the UI (separating this from the status checking logic)
function applyStatusToUI(userId, status, timestamp) {
    // Update cache
    statusCache[userId] = { status: status, updatedAt: timestamp };

    // Batch DOM updates for performance
    requestAnimationFrame(() => {
        // Update contact in sidebar
        const contactElement = document.querySelector(`.contact-item[data-user-id="${userId}"]`);
        if (contactElement) {
            const statusIndicator = contactElement.querySelector('.status-indicator');
            if (statusIndicator) {
                statusIndicator.classList.remove('online', 'offline', 'blocked', 'hidden');
                statusIndicator.classList.add(status);
                
                // For 'hidden' status, make the indicator invisible
                if (status === 'hidden') {
                    statusIndicator.style.display = 'none';
                } else {
                    statusIndicator.style.display = '';
                }
            } else {
                console.warn(`[${timestamp}] Status indicator not found for user ${userId} in sidebar`);
            }
        } else {
            console.warn(`[${timestamp}] Contact element not found for user ${userId} in sidebar`);
        }

        // Update chat header if this user is currently open
        const chatContent = document.getElementById('chatContent');
        const currentUserId = chatContent?.getAttribute('data-current-user-id');
        if (currentUserId && parseInt(currentUserId) === parseInt(userId)) {
            const chatContactStatus = document.getElementById('chatContactPresence');
            if (chatContactStatus) {
                if (status === 'hidden') {
                    // Hide status completely for users who have blocked the current user
                    chatContactStatus.style.display = 'none';
                } else {
                    chatContactStatus.style.display = '';
                    if (status === 'blocked') {
                        chatContactStatus.textContent = 'Blocked';
                    } else {
                        chatContactStatus.textContent = status === 'online' ? 'Online' : 'Offline';
                    }
                    chatContactStatus.className = `status-text ${status}`;
                }
            } else {
                console.warn(`[${timestamp}] Chat contact status element not found for user ${userId}`);
            }
        }

        // Update contact info popup if open
        const contactInfoPopup = document.getElementById('contactInfoPopup');
        if (contactInfoPopup && contactInfoPopup.classList.contains('open')) {
            const contactInfoUserId = contactInfoPopup.getAttribute('data-user-id');
            if (contactInfoUserId && parseInt(contactInfoUserId) === parseInt(userId)) {
                const contactInfoStatus = document.getElementById('contactInfoStatus');
                if (contactInfoStatus) {
                    if (status === 'hidden') {
                        // Hide status completely for users who have blocked the current user
                        contactInfoStatus.style.display = 'none';
                    } else {
                        contactInfoStatus.style.display = '';
                        if (status === 'blocked') {
                            contactInfoStatus.textContent = 'Blocked';
                        } else {
                            contactInfoStatus.textContent = status === 'online' ? 'Online' : 'Offline';
                        }
                        contactInfoStatus.className = `status-text ${status}`;
                    }
                } else {
                    console.warn(`[${timestamp}] Contact info status element not found for user ${userId}`);
                }
            }
        }
    });

    // Dispatch custom event for other modules
    const statusEvent = new CustomEvent('status-update', {
        detail: { userId, status: status, source: 'status-update' }
    });
    window.dispatchEvent(statusEvent);
}

// Update the last message preview in a chat contact list item
function updateLastMessage(roomId, content, time) {
    const contactElement = document.querySelector(`.contact-item[data-room-id="${roomId}"]`);
    
    if (contactElement) {
        const lastMessageElement = contactElement.querySelector('.last-message');
        const messageTimeElement = contactElement.querySelector('.message-time');
        
        if (lastMessageElement) {
            // Process attachment markup for sidebar display
            let displayMessage = content;
            
            // Check for attachment markers and use friendly names
            if (typeof content === 'string') {
                if (content.includes('<img-attachment')) {
                    displayMessage = '📷 Photo';
                } else if (content.includes('<video-attachment')) {
                    displayMessage = '🎥 Video';
                } else if (content.includes('<audio-attachment')) {
                    displayMessage = '🎵 Audio';
                } else if (content.includes('<doc-attachment')) {
                    displayMessage = '📄 Document';
                } else {
                    // For normal text messages, truncate if too long
                    displayMessage = content.length > 30 ? content.substring(0, 27) + '...' : content;
                }
            }
            
            lastMessageElement.textContent = displayMessage;
        }
        
        if (messageTimeElement && time) {
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
    }
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
            } else if (status === 'sent') {
                messageStatusSingle.style.display = 'inline';
                messageStatusDouble.style.display = 'none';
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

// Update the room list with a new room
function updateRoomList(roomData) {
    const contactsList = document.getElementById('contactsList');
    if (!contactsList) return;

    // Check if room already exists
    const existingRoom = document.querySelector(`.contact-item[data-room-id="${roomData.id}"]`);
    if (existingRoom) {
        // Update existing room
        const nameElement = existingRoom.querySelector('.contact-info h4');
        const avatarElement = existingRoom.querySelector('.contact-avatar img');
        const lastMessageElement = existingRoom.querySelector('.last-message');
        const messageTimeElement = existingRoom.querySelector('.message-time');
        
        if (nameElement) nameElement.textContent = roomData.name;
        if (avatarElement) avatarElement.src = roomData.avatar || '/static/images/shrek.jpg';
        if (lastMessageElement) lastMessageElement.textContent = roomData.last_message || 'Click to start chatting!';
        if (messageTimeElement) messageTimeElement.textContent = roomData.last_message_time || 'Now';
        
        // Move to top of list
        contactsList.insertBefore(existingRoom, contactsList.firstChild);
    } else {
        // Add new room
        if (window.addRoomToList) {
            window.addRoomToList(roomData);
        }
    }
}

// Helper function to get consistent display name for attachments
function getAttachmentDisplayName(message) {
    // Use the provided display_name if available
    if (message.display_name) {
        return message.display_name;
    }
    
    // Otherwise determine from content/attachment type
    if (message.content) {
        if (message.content.includes('<img-attachment')) return '📷 Photo';
        if (message.content.includes('<video-attachment')) return '🎥 Video';
        if (message.content.includes('<audio-attachment')) return '🎵 Audio';
        if (message.content.includes('<doc-attachment')) return '📄 Document';
    }
    
    // Check legacy attachment format
    if (message.attachment && message.attachment.type) {
        const type = message.attachment.type;
        if (type === 'photo' || type === 'image') return '📷 Photo';
        if (type === 'video') return '🎥 Video';
        if (type === 'audio') return '🎵 Audio';
        return `📎 ${type.charAt(0).toUpperCase() + type.slice(1)}`;
    }
    
    // Default fallback
    return '📎 Attachment';
}

// Export all utility functions
window.shrekChatUtils = {
    formatTime,
    formatDateForChat,
    debounce,
    updateMessageStatus,
    updateContactStatus,
    updateLastMessage,
    incrementUnreadCount,
    updateRoomList,
    getAttachmentDisplayName,
    statusCache
};