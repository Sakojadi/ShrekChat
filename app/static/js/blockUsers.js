/**
 * User blocking functionality for ShrekChat
 */
document.addEventListener('DOMContentLoaded', function() {
    setupBlockedUsersUI();
    setupBlockUserToggle();
    setupBlockStatusChangeDetector();
    
    // Update blocked status for all blocked users
    setTimeout(updateAllBlockedUsersStatus, 1000); // Slight delay to ensure other components are loaded
});

// Utility to debounce functions
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

// Setup blocked users UI functionality
function setupBlockedUsersUI() {
    // Add block/unblock buttons to user profile cards
    addBlockButtonsToUserCards();
    
    // Setup blocked users section in profile sidebar
    setupBlockedUsersSection();
    
    // Listen for clicks on block/unblock buttons with debouncing
    document.addEventListener('click', debounce(function(e) {
        // Handle block user button click
        if (e.target.closest('.block-user-btn')) {
            const userId = e.target.closest('.block-user-btn').dataset.userId;
            blockUser(userId);
        }
        
        // Handle unblock user button click
        if (e.target.closest('.unblock-user-btn')) {
            const userId = e.target.closest('.unblock-user-btn').dataset.userId;
            unblockUser(userId);
        }
    }, 300));
}

// Add block buttons to user profile cards and chat headers
function addBlockButtonsToUserCards() {
    const chatHeaderUserInfo = document.querySelector('.chat-header .user-info:not(.group-info)');
    if (chatHeaderUserInfo) {
        const userId = chatHeaderUserInfo.getAttribute('data-user-id');
        if (userId) {
            checkIfBlocked(userId).then(blocked => {
                const blockBtn = document.createElement('button');
                blockBtn.className = blocked.is_blocked ? 'unblock-user-btn' : 'block-user-btn';
                blockBtn.dataset.userId = userId;
                blockBtn.innerHTML = blocked.is_blocked ? 
                    '<i class="fas fa-user-check"></i> Unblock' : 
                    '<i class="fas fa-user-slash"></i> Block';
                blockBtn.setAttribute('aria-label', blocked.is_blocked ? 'Unblock user' : 'Block user');
                blockBtn.setAttribute('role', 'button');
                
                const chatActions = document.querySelector('.chat-header .chat-actions');
                if (chatActions) {
                    chatActions.appendChild(blockBtn);
                }
            });
        }
    }
}

// Setup blocked users section in profile sidebar
function setupBlockedUsersSection() {
    const profileMenu = document.querySelector('.profile-menu');
    if (profileMenu) {
        // Create menu item for blocked users
        const blockedUsersItem = document.createElement('div');
        blockedUsersItem.className = 'profile-menu-item blocked-users';
        blockedUsersItem.id = 'blockedUsersMenuItem';
        blockedUsersItem.innerHTML = '<i class="fas fa-user-slash"></i><span>Blocked Users</span>';
        blockedUsersItem.setAttribute('aria-label', 'View blocked users');
        
        // Add menu item before logout
        const logoutMenuItem = document.querySelector('.profile-menu-item.danger');
        if (logoutMenuItem) {
            profileMenu.insertBefore(blockedUsersItem, logoutMenuItem);
        } else {
            profileMenu.appendChild(blockedUsersItem);
        }
        
        // Remove any existing popup
        const existingPopup = document.getElementById('blockedUsersPopup');
        if (existingPopup) {
            existingPopup.remove();
        }
        
        // Create the popup with proper structure to match other popups
        const blockedUsersPopup = document.createElement('div');
        blockedUsersPopup.id = 'blockedUsersPopup';
        blockedUsersPopup.className = 'popup blocked-users-popup';
        blockedUsersPopup.innerHTML = `
            <div class="popup-header">
                <h3><i class="fas fa-user-slash"></i> Blocked Users</h3>
                <button id="closeBlockedUsersPopup" class="popup-close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="popup-content">
                <div class="empty-blocked-list">
                    <p>You haven't blocked any users yet</p>
                </div>
                <ul class="blocked-users-list"></ul>
            </div>
        `;
        
        document.body.appendChild(blockedUsersPopup);
        
        // Add event listener to the menu item
        blockedUsersItem.addEventListener('click', function() {
            const profileSidebar = document.getElementById('profileSidebar');
            if (profileSidebar) {
                profileSidebar.classList.remove('active');
            }
            
            // Use the same pattern as other popups
            blockedUsersPopup.classList.add('open');
            
            // Show overlay
            const overlay = document.getElementById('overlay');
            if (overlay) {
                overlay.classList.add('active');
            }
            
            // Focus on the close button for accessibility
            const closeBtn = document.getElementById('closeBlockedUsersPopup');
            if (closeBtn) closeBtn.focus();
            
            loadBlockedUsers();
        });
        
        // Add event listener to close button
        const closeBlockedUsersPopup = document.getElementById('closeBlockedUsersPopup');
        if (closeBlockedUsersPopup) {
            closeBlockedUsersPopup.addEventListener('click', function() {
                blockedUsersPopup.classList.remove('open');
                
                // Hide overlay
                const overlay = document.getElementById('overlay');
                if (overlay) {
                    overlay.classList.remove('active');
                }
            });
        }
        
        // Close when clicking on overlay
        const overlay = document.getElementById('overlay');
        if (overlay) {
            overlay.addEventListener('click', function() {
                blockedUsersPopup.classList.remove('open');
                overlay.classList.remove('active');
            });
        }
    }
}

// Load blocked users from API
function loadBlockedUsers() {
    const blockedUsersList = document.querySelector('.blocked-users-list');
    const emptyBlockedList = document.querySelector('.empty-blocked-list');
    
    if (blockedUsersList) {
        blockedUsersList.innerHTML = '<div class="blocked-loading">Loading...</div>';
        
        fetch('/api/users/blocked')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to load blocked users');
                }
                return response.json();
            })
            .then(data => {
                blockedUsersList.innerHTML = '';
                
                if (data.success) {
                    if (data.blocked_users && data.blocked_users.length > 0) {
                        if (emptyBlockedList) emptyBlockedList.style.display = 'none';
                        
                        data.blocked_users.forEach(user => {
                            // Create container for the blocked user
                            const blockedUserItem = document.createElement('li');
                            blockedUserItem.className = 'blocked-user-item';
                            
                            // Create avatar container
                            const userAvatar = document.createElement('div');
                            userAvatar.className = 'user-avatar';
                            
                            // Create and set up the avatar image with explicit dimensions
                            const avatarImg = document.createElement('img');
                            avatarImg.src = user.avatar || '/static/images/shrek.jpg';
                            avatarImg.alt = `${user.username}'s avatar`;
                            avatarImg.width = 40;
                            avatarImg.height = 40;
                            avatarImg.style.objectFit = 'cover';
                            userAvatar.appendChild(avatarImg);
                            
                            // Create user info container
                            const userInfo = document.createElement('div');
                            userInfo.className = 'user-info';
                            
                            // Create username span
                            const userName = document.createElement('span');
                            userName.className = 'user-name';
                            userName.textContent = user.full_name || user.username;
                            userInfo.appendChild(userName);
                            
                            // Create unblock button
                            const unblockBtn = document.createElement('button');
                            unblockBtn.className = 'unblock-user-btn';
                            unblockBtn.dataset.userId = user.id;
                            unblockBtn.innerHTML = '<i class="fas fa-user-check"></i> Unblock';
                            unblockBtn.setAttribute('aria-label', 'Unblock user');
                            
                            // Append all elements to the list item
                            blockedUserItem.appendChild(userAvatar);
                            blockedUserItem.appendChild(userInfo);
                            blockedUserItem.appendChild(unblockBtn);
                            
                            // Add the complete item to the list
                            blockedUsersList.appendChild(blockedUserItem);
                        });
                    } else {
                        if (emptyBlockedList) {
                            emptyBlockedList.style.display = 'block';
                        }
                    }
                } else {
                    blockedUsersList.innerHTML = '<div class="blocked-error">Failed to load</div>';
                }
            })
            .catch(error => {
                blockedUsersList.innerHTML = '<div class="blocked-error">Failed to load</div>';
                console.error('Error loading blocked users:', error);
            });
    }
}

/**
 * Specifically update the status of a blocked user to show 'blocked'
 * Unlike the general status update function, this is called specifically when block status changes
 */
function updateBlockedUserStatus(userId) {
    console.log(`Explicitly updating user ${userId} to blocked status`);
    
    // Apply blocked status class to all instances of this user's status indicators
    const statusIndicators = document.querySelectorAll(`.contact-item[data-user-id="${userId}"] .status-indicator`);
    statusIndicators.forEach(indicator => {
        // Remove existing status classes
        indicator.classList.remove('online', 'offline');
        // Add blocked class
        indicator.classList.add('blocked');
    });
    
    // Update status text in chat header if this user is currently open
    const chatContent = document.getElementById('chatContent');
    const currentUserId = chatContent?.getAttribute('data-current-user-id');
    if (currentUserId && parseInt(currentUserId) === parseInt(userId)) {
        const chatContactStatus = document.getElementById('chatContactPresence');
        if (chatContactStatus) {
            chatContactStatus.textContent = 'Blocked';
            chatContactStatus.className = 'status-text blocked';
        }
    }
    
    // Update contact info popup if open
    const contactInfoPopup = document.getElementById('contactInfoPopup');
    if (contactInfoPopup && contactInfoPopup.classList.contains('open')) {
        const contactInfoUserId = contactInfoPopup.getAttribute('data-user-id');
        if (contactInfoUserId && parseInt(contactInfoUserId) === parseInt(userId)) {
            const contactInfoStatus = document.getElementById('contactInfoStatus');
            if (contactInfoStatus) {
                contactInfoStatus.textContent = 'Blocked';
                contactInfoStatus.className = 'status-text blocked';
            }
        }
    }
}

// Block a user by ID
function blockUser(userId) {
    if (!userId) return;
    
    Swal.fire({
        title: 'Block User',
        text: 'Are you sure you want to block this user? You will no longer be able to exchange messages with them.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Block',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#d33'
    }).then((result) => {
        if (result.isConfirmed) {
            // Immediately update the UI to show blocked status
            updateBlockedUserStatus(userId);
            
            fetch(`/api/users/block/${userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    Swal.fire({
                        icon: 'success',
                        title: 'User Blocked',
                        text: data.message
                    }).then(() => {
                        // Simply reload the page after blocking a user
                        window.location.reload();
                    });
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: data.message || 'Failed to block user'
                    });
                }
            })
            .catch(error => {
                console.error('Error blocking user:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'An error occurred while trying to block the user'
                });
            });
        }
    });
}

// Unblock a user by ID
function unblockUser(userId) {
    if (!userId) return;
    
    Swal.fire({
        title: 'Unblock User',
        text: 'Are you sure you want to unblock this user? You will be able to exchange messages again.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Unblock',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#7BAE37'
    }).then((result) => {
        if (result.isConfirmed) {
            const button = document.querySelector(`.unblock-user-btn[data-user-id="${userId}"]`);
            if (button) {
                button.disabled = true;
                button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Unblocking...';
            }
            
            fetch(`/api/users/unblock/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    Swal.fire({
                        icon: 'success',
                        title: 'User Unblocked',
                        text: data.message
                    }).then(() => {
                        // Simply reload the page after unblocking a user
                        window.location.reload();
                    });
                    
                    // Play Shrek-themed sound (hypothetical)
                    playSound('/static/sounds/swamp-bubble.mp3');
                } else {
                    if (button) {
                        button.disabled = false;
                        button.innerHTML = '<i class="fas fa-user-check"></i> Unblock';
                    }
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: data.message || 'Failed to unblock user'
                    });
                }
            })
            .catch(error => {
                if (button) {
                    button.disabled = false;
                    button.innerHTML = '<i class="fas fa-user-check"></i> Unblock';
                }
                console.error('Error unblocking user:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'An error occurred while trying to unblock the user'
                });
            });
        }
    });
}

// Check if a user is blocked or has blocked the current user
function checkIfBlocked(userId) {
    return fetch(`/api/users/check-blocked/${userId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to check blocked status');
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                return {
                    is_blocked: data.is_blocked,
                    is_blocker: data.is_blocker
                };
            } else {
                console.error('Error checking blocked status:', data.message);
                return { is_blocked: false, is_blocker: false };
            }
        })
        .catch(error => {
            console.error('Error checking blocked status:', error);
            return { is_blocked: false, is_blocker: false };
        });
}

// Check and update block status when opening chat
function checkAndUpdateBlockStatus(userId) {
    if (!userId) return;
    
    checkIfBlocked(userId).then(blocked => {
        if (blocked.is_blocked) {
            // User is blocked by current user
            updateChatHeaderForBlockedUser(true);
            
            // Disable message input with appropriate message
            const messageInput = document.getElementById('messageInput');
            if (messageInput) {
                messageInput.disabled = true;
                messageInput.placeholder = 'Unblock this user to send messages';
            }
            
            // Show blocked message in chat
            showBlockedMessage(true, false);
        } else if (blocked.is_blocker) {
            // Current user is blocked by this user
            const messageInput = document.getElementById('messageInput');
            if (messageInput) {
                messageInput.disabled = true;
                messageInput.placeholder = 'This user has blocked you';
            }
            
            // Show blocked message in chat
            showBlockedMessage(false, true);
        }
    });
}

// Reset any block status UI from previous chats
function resetBlockStatus() {
    // Reset message input
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.disabled = false;
        messageInput.placeholder = 'Type a message...';
    }
    
    // Remove any block messages
    const existingBlockMessages = document.querySelectorAll('.block-message');
    existingBlockMessages.forEach(msg => msg.remove());
    
    // Reset header if it was in a blocked state
    const chatContactInfo = document.querySelector('.chat-contact-info');
    if (chatContactInfo && chatContactInfo.hasAttribute('data-original-state')) {
        updateChatHeaderForBlockedUser(false);
    }
    
    // Re-enable audio recording and call buttons
    const audioRecordBtn = document.getElementById('audioRecordBtn');
    if (audioRecordBtn) {
        audioRecordBtn.disabled = false;
        audioRecordBtn.classList.remove('disabled');
        audioRecordBtn.title = 'Record audio message';
    }
    
    const audioCallBtn = document.getElementById('audioCallBtn');
    if (audioCallBtn) {
        audioCallBtn.disabled = false;
        audioCallBtn.classList.remove('disabled');
        audioCallBtn.title = 'Start audio call';
    }
}

// Show blocked message in chat area
function showBlockedMessage(isBlocked, isBlocker) {
    const messagesContainer = document.getElementById('chatMessages');
    const messageInput = document.getElementById('messageInput');
    const audioRecordBtn = document.getElementById('audioRecordBtn');
    const audioCallBtn = document.getElementById('audioCallBtn');
    const attachmentBtn = document.querySelector('.attachment-btn');
    
    if (!messagesContainer || !messageInput) return;
    
    const existingBlockMessages = document.querySelectorAll('.block-message');
    existingBlockMessages.forEach(msg => msg.remove());
    
    messageInput.disabled = false;
    messageInput.placeholder = 'Type a message...';
    
    // Reset audio and call buttons
    if (audioRecordBtn) {
        audioRecordBtn.disabled = false;
        audioRecordBtn.classList.remove('disabled');
        audioRecordBtn.title = 'Record audio message';
    }
    
    if (audioCallBtn) {
        audioCallBtn.disabled = false;
        audioCallBtn.classList.remove('disabled');
        audioCallBtn.title = 'Start audio call';
    }
    
    // Reset attachment button
    if (attachmentBtn) {
        attachmentBtn.disabled = false;
        attachmentBtn.classList.remove('disabled');
        attachmentBtn.title = 'Add attachment';
    }
    
    if (isBlocked || isBlocker) {
        // Disable audio messaging and calling buttons for blocked users
        if (audioRecordBtn) {
            audioRecordBtn.disabled = true;
            audioRecordBtn.classList.add('disabled');
            audioRecordBtn.title = isBlocked ? 'Cannot send audio to blocked user' : 'Cannot send audio to a user who blocked you';
        }
        
        if (audioCallBtn) {
            audioCallBtn.disabled = true;
            audioCallBtn.classList.add('disabled');
            audioCallBtn.title = isBlocked ? 'Cannot call blocked user' : 'Cannot call a user who blocked you';
        }
        
        // Disable attachment button
        if (attachmentBtn) {
            attachmentBtn.disabled = true;
            attachmentBtn.classList.add('disabled');
            attachmentBtn.title = isBlocked ? 'Cannot send attachments to blocked user' : 'Cannot send attachments to a user who blocked you';
        }
    }
    
    if (isBlocked) {
        // When the current user has blocked the contact
        const blockMessage = document.createElement('div');
        blockMessage.className = 'system-message block-message outgoing-block';
        blockMessage.textContent = 'You have blocked this user. You cannot exchange messages until you unblock them.';
        messagesContainer.appendChild(blockMessage);
        
        messageInput.disabled = true;
        messageInput.placeholder = 'Unblock this user to send messages';
    } else if (isBlocker) {
        // When the contact has blocked the current user
        const blockMessage = document.createElement('div');
        blockMessage.className = 'system-message block-message incoming-block';
        blockMessage.textContent = 'You have been blocked by this user and cannot send messages.';
        messagesContainer.appendChild(blockMessage);
        
        messageInput.disabled = true;
        messageInput.placeholder = 'This user has blocked you';
    }
}

// Setup toggle block user functionality in chat dropdown
function setupBlockUserToggle() {
    const toggleBlockUserItem = document.getElementById('toggleBlockUser');
    
    if (toggleBlockUserItem) {
        toggleBlockUserItem.addEventListener('click', function() {
            const chatHeader = document.querySelector('.chat-header .chat-contact-info');
            if (chatHeader) {
                const userId = chatHeader.getAttribute('data-user-id');
                if (userId) {
                    checkIfBlocked(userId).then(blocked => {
                        if (blocked.is_blocked) {
                            unblockUser(userId);
                        } else {
                            blockUser(userId);
                            // Immediately update UI
                            updateBlockedUserStatus(userId);
                        }
                    });
                }
            }
        });
    }
}

// Update the text of the "Block user" menu item based on blocked status
function updateBlockUserMenuItem(userId) {
    const toggleBlockUserItem = document.getElementById('toggleBlockUser');
    if (toggleBlockUserItem && userId) {
        checkIfBlocked(userId).then(blocked => {
            toggleBlockUserItem.innerHTML = blocked.is_blocked ? 
                '<i class="fas fa-user-check"></i><span>Unblock user</span>' : 
                '<i class="fas fa-user-slash"></i><span>Block user</span>';
            toggleBlockUserItem.setAttribute('aria-label', blocked.is_blocked ? 'Unblock user' : 'Block user');
            toggleBlockUserItem.setAttribute('role', 'menuitem');
        });
    }
}

// Update chat header to show blocked status
function updateChatHeaderForBlockedUser(isBlocked) {
    const chatContactAvatar = document.getElementById('chatContactAvatar');
    const chatContactName = document.getElementById('chatContactName');
    const chatContactPresence = document.getElementById('chatContactPresence');
    const chatContactInfo = document.querySelector('.chat-contact-info');
    
    if (!chatContactInfo) return;
    
    // Save original data for restoration if needed
    if (isBlocked && !chatContactInfo.hasAttribute('data-original-state')) {
        const originalState = {
            avatarSrc: chatContactAvatar ? chatContactAvatar.src : null,
            name: chatContactName ? chatContactName.textContent : null,
            presence: chatContactPresence ? chatContactPresence.textContent : null
        };
        chatContactInfo.setAttribute('data-original-state', JSON.stringify(originalState));
    }
    
    if (isBlocked) {
        // Create blocked user UI
        if (chatContactAvatar) {
            // Hide the original avatar by setting it to a block icon or placeholder
            chatContactAvatar.src = '/static/images/user-slash-solid.svg';
            chatContactAvatar.style.filter = 'opacity(0.5) grayscale(100%)';
        }
        
        if (chatContactName) {
            // Change name to blocked message
            chatContactName.textContent = 'YOU HAVE BLOCKED THE USER';
            chatContactName.style.color = '#e53935'; // Red color for emphasis
        }
        
        if (chatContactPresence) {
            // Hide status
            chatContactPresence.style.display = 'none';
        }
    } else {
        // Restore original user data if we have it
        try {
            const originalStateStr = chatContactInfo.getAttribute('data-original-state');
            if (originalStateStr) {
                const originalState = JSON.parse(originalStateStr);
                
                if (chatContactAvatar && originalState.avatarSrc) {
                    chatContactAvatar.src = originalState.avatarSrc;
                    chatContactAvatar.style.filter = '';
                }
                
                if (chatContactName && originalState.name) {
                    chatContactName.textContent = originalState.name;
                    chatContactName.style.color = '';
                }
                
                if (chatContactPresence && originalState.presence) {
                    chatContactPresence.textContent = originalState.presence;
                    chatContactPresence.style.display = '';
                }
                
                // Clear the saved state
                chatContactInfo.removeAttribute('data-original-state');
            }
        } catch (e) {
            console.error('Error restoring chat header:', e);
        }
    }
}

// Create a proper refresh function for block status changes
function refreshChatAfterBlockStatusChange(userId, isBlocked) {
    console.log(`Refreshing chat immediately after ${isBlocked ? 'blocking' : 'unblocking'} user ${userId}`);
    
    // Get current room data
    const currentRoomId = document.getElementById('chatContent').getAttribute('data-current-room-id');
    const currentUserId = document.getElementById('chatContent').getAttribute('data-current-user-id');
    
    // Only proceed if we're in the chat of the user being blocked/unblocked
    if (currentUserId === userId) {
        // Add visual refresh indication
        const chatContent = document.getElementById('chatContent');
        if (chatContent) {
            chatContent.style.opacity = '0.7';
            chatContent.style.transition = 'opacity 0.3s';
            
            // Short delay to ensure visual feedback is visible
            setTimeout(() => {
                if (isBlocked) {
                    // Apply blocked UI immediately
                    updateChatHeaderForBlockedUser(true);
                    
                    // Disable message input
                    const messageInput = document.getElementById('messageInput');
                    if (messageInput) {
                        messageInput.disabled = true;
                        messageInput.placeholder = 'Unblock this user to send messages';
                    }
                    
                    // Disable audio recording and call buttons
                    const audioRecordBtn = document.getElementById('audioRecordBtn');
                    if (audioRecordBtn) {
                        audioRecordBtn.disabled = true;
                        audioRecordBtn.classList.add('disabled');
                        audioRecordBtn.title = 'Cannot send audio to blocked user';
                    }
                    
                    const audioCallBtn = document.getElementById('audioCallBtn');
                    if (audioCallBtn) {
                        audioCallBtn.disabled = true;
                        audioCallBtn.classList.add('disabled');
                        audioCallBtn.title = 'Cannot call blocked user';
                    }
                    
                    // Show blocked message (remove existing ones first)
                    const existingBlockMessages = document.querySelectorAll('.block-message');
                    existingBlockMessages.forEach(msg => msg.remove());
                    
                    const messagesContainer = document.getElementById('chatMessages');
                    if (messagesContainer) {
                        const blockMessage = document.createElement('div');
                        blockMessage.className = 'system-message block-message outgoing-block';
                        blockMessage.textContent = 'You have blocked this user. You cannot exchange messages until you unblock them.';
                        messagesContainer.appendChild(blockMessage);
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    }
                } else {
                    // Reset block status immediately
                    resetBlockStatus();
                    
                    // Remove block messages
                    const existingBlockMessages = document.querySelectorAll('.block-message');
                    existingBlockMessages.forEach(msg => msg.remove());
                    
                    // Restore chat header
                    updateChatHeaderForBlockedUser(false);
                    
                    // Enable message input
                    const messageInput = document.getElementById('messageInput');
                    if (messageInput) {
                        messageInput.disabled = false;
                        messageInput.placeholder = 'Type a message...';
                    }
                    
                    // Re-enable audio recording and call buttons
                    const audioRecordBtn = document.getElementById('audioRecordBtn');
                    if (audioRecordBtn) {
                        audioRecordBtn.disabled = false;
                        audioRecordBtn.classList.remove('disabled');
                        audioRecordBtn.title = 'Record audio message';
                    }
                    
                    const audioCallBtn = document.getElementById('audioCallBtn');
                    if (audioCallBtn) {
                        audioCallBtn.disabled = false;
                        audioCallBtn.classList.remove('disabled');
                        audioCallBtn.title = 'Start audio call';
                    }
                    
                    // Add a system message showing the user was unblocked
                    const messagesContainer = document.getElementById('chatMessages');
                    if (messagesContainer) {
                        const unblockMessage = document.createElement('div');
                        unblockMessage.className = 'system-message info';
                        unblockMessage.textContent = 'You have unblocked this user. You can now exchange messages again.';
                        messagesContainer.appendChild(unblockMessage);
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    }
                }
                
                // Restore opacity after changes
                setTimeout(() => {
                    chatContent.style.opacity = '1';
                }, 300);
            }, 150);
        }
    }
}

// Play sound effect (hypothetical)
function playSound(soundPath) {
    try {
        const audio = new Audio(soundPath);
        audio.play().catch(error => console.warn('Failed to play sound:', error));
    } catch (error) {
        console.warn('Sound playback not supported:', error);
    }
}

/**
 * Update status indicators for all blocked users on page load
 * This ensures blocked users always show the blocked status
 */
function updateAllBlockedUsersStatus() {
    console.log("Updating status indicators for all blocked users");
    
    // Fetch all blocked users
    fetch('/api/users/blocked')
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to load blocked users');
            }
            return response.json();
        })
        .then(data => {
            if (data.success && data.blocked_users && data.blocked_users.length > 0) {
                // Update the status for each blocked user
                data.blocked_users.forEach(user => {
                    updateBlockedUserStatus(user.id);
                    console.log(`Applied blocked status to user ${user.id}`);
                });
            }
        })
        .catch(error => {
            console.error('Error updating blocked users status:', error);
        });
}

/**
 * Update the global event listener for block status changes to handle unblocking
 * for both the user who unblocks and the user who was unblocked
 */
function setupBlockStatusChangeDetector() {
    console.log("Setting up block status change detector");
    
    // Listen for block status change events from WebSocket
    window.addEventListener('block_status_changed', function(event) {
        console.log("Block status change detected:", event.detail);
        
        // Handle unblock notification (when someone unblocks you)
        if (event.detail && !event.detail.is_blocked && event.detail.blocker_id) {
            // This means someone unblocked us
            handleUnblockedByUser(event.detail.blocker_id);
            return; // Don't reload the page, just update UI
        }
        
        // For other block status changes (when you block/unblock someone, or when someone blocks you)
        // force a page reload to ensure consistency
        forcePageReload();
    });
    
    // Create a custom event dispatcher for WebSocket handlers to use
    window.dispatchBlockStatusChange = function(data) {
        console.log("Dispatching block status change event", data);
        window.dispatchEvent(new CustomEvent('block_status_changed', { 
            detail: data 
        }));
    };
    
    // Poll for block status changes every 5 seconds as a backup
    // This ensures we catch changes even if WebSocket notifications fail
    startBlockStatusPolling();
}

// Poll for block status changes as a backup mechanism
function startBlockStatusPolling() {
    // Only start polling if we're in a direct chat
    const chatContent = document.getElementById('chatContent');
    if (!chatContent) return;
    
    const userId = chatContent.getAttribute('data-current-user-id');
    if (!userId) return;
    
    // Store current block status
    window.lastKnownBlockStatus = null;
    
    // Get initial status
    checkIfBlocked(userId).then(status => {
        window.lastKnownBlockStatus = status;
    });
    
    // Set up polling interval
    window.blockStatusPollingInterval = setInterval(() => {
        const currentUserId = document.getElementById('chatContent')?.getAttribute('data-current-user-id');
        if (!currentUserId) return;
        
        checkIfBlocked(currentUserId).then(newStatus => {
            // If we have a previous status to compare with
            if (window.lastKnownBlockStatus) {
                // If block status changed
                if (newStatus.is_blocked !== window.lastKnownBlockStatus.is_blocked || 
                    newStatus.is_blocker !== window.lastKnownBlockStatus.is_blocker) {
                    console.log("Block status change detected via polling:", 
                        window.lastKnownBlockStatus, "→", newStatus);
                    
                    // Force reload
                    forcePageReload();
                }
            }
            
            // Update stored status
            window.lastKnownBlockStatus = newStatus;
        });
    }, 5000); // Check every 5 seconds
}

// Force an immediate page reload
function forcePageReload() {
    console.log("FORCING PAGE RELOAD DUE TO BLOCK STATUS CHANGE");
    
    // Show a brief notification
    if (window.Swal) {
        Swal.fire({
            title: 'Block Status Changed',
            text: 'The page will reload to reflect changes.',
            icon: 'info',
            showConfirmButton: false,
            timer: 1500,
            allowOutsideClick: false,
            allowEscapeKey: false
        });
    }
    
    // Force reload after a brief delay to show notification
    setTimeout(() => {
        // Clear hash and force reload from server, bypassing cache
        window.location.href = window.location.href.split('#')[0];
        window.location.reload(true);
    }, 1600);
}

// Check if a user is blocked by the current user
window.isUserBlocked = function(userId) {
    // Convert userId to number if it's a string
    const id = parseInt(userId);
    if (isNaN(id)) {
        return Promise.resolve(false);
    }
    
    // Use existing checkIfBlocked function if available
    if (window.checkIfBlocked) {
        return window.checkIfBlocked(id).then(result => {
            return result.is_blocked === true;
        }).catch(error => {
            console.error('Error checking if user is blocked:', error);
            return false;
        });
    }
    
    // Fallback - fetch from API directly
    return fetch(`/api/users/check-blocked/${id}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to check blocked status');
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                return data.is_blocked === true;
            }
            return false;
        })
        .catch(error => {
            console.error('Error checking if user is blocked:', error);
            return false;
        });
};

/**
 * Handle when the current user is unblocked by another user
 * This function is called when we receive a WebSocket notification that someone unblocked us
 */
function handleUnblockedByUser(blockerId) {
    console.log(`You've been unblocked by user ID: ${blockerId}`);
    
    // Check if we're currently in a chat with this user
    const chatContent = document.getElementById('chatContent');
    const currentUserId = chatContent?.getAttribute('data-current-user-id');
    
    if (currentUserId && parseInt(currentUserId) === parseInt(blockerId)) {
        // We're currently chatting with the user who unblocked us
        // Remove any "You have been blocked" messages
        const existingBlockMessages = document.querySelectorAll('.block-message.incoming-block');
        existingBlockMessages.forEach(msg => msg.remove());
        
        // Re-enable the message input
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.disabled = false;
            messageInput.placeholder = 'Type a message...';
        }
        
        // Re-enable audio recording and call buttons
        const audioRecordBtn = document.getElementById('audioRecordBtn');
        if (audioRecordBtn) {
            audioRecordBtn.disabled = false;
            audioRecordBtn.classList.remove('disabled');
            audioRecordBtn.title = 'Record audio message';
        }
        
        const audioCallBtn = document.getElementById('audioCallBtn');
        if (audioCallBtn) {
            audioCallBtn.disabled = false;
            audioCallBtn.classList.remove('disabled');
            audioCallBtn.title = 'Start audio call';
        }
        
        // Re-enable attachment button
        const attachmentBtn = document.querySelector('.attachment-btn');
        if (attachmentBtn) {
            attachmentBtn.disabled = false;
            attachmentBtn.classList.remove('disabled');
            attachmentBtn.title = 'Add attachment';
        }
        
        // Show a notification that the user has unblocked you
        const messagesContainer = document.getElementById('chatMessages');
        if (messagesContainer) {
            const unblockMessage = document.createElement('div');
            unblockMessage.className = 'system-message info';
            unblockMessage.textContent = 'This user has unblocked you. You can now exchange messages again.';
            messagesContainer.appendChild(unblockMessage);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
        
        // Show a brief toast notification
        if (window.Swal) {
            Swal.fire({
                title: 'You\'ve been unblocked',
                text: 'This user has unblocked you. You can now exchange messages again.',
                icon: 'info',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 5000
            });
        }
    } else {
        // We're not currently chatting with this user, just show a notification
        if (window.Swal) {
            Swal.fire({
                title: 'You\'ve been unblocked',
                text: 'A user who previously blocked you has removed the block.',
                icon: 'info',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 5000
            });
        }
    }
}

// Make the function available globally
window.handleUnblockedByUser = handleUnblockedByUser;

/**
 * Handle when the current user is blocked by another user
 * This function is called when we receive a WebSocket notification that someone blocked us
 */
function handleBlockedByUser(blockerId) {
    console.log(`You've been blocked by user ID: ${blockerId}`);
    
    // Check if we're currently in a chat with this user
    const chatContent = document.getElementById('chatContent');
    const currentUserId = chatContent?.getAttribute('data-current-user-id');
    
    if (currentUserId && parseInt(currentUserId) === parseInt(blockerId)) {
        // We're currently chatting with the user who blocked us
        
        // Disable the message input
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.disabled = true;
            messageInput.placeholder = 'This user has blocked you';
        }
        
        // Disable audio recording and call buttons
        const audioRecordBtn = document.getElementById('audioRecordBtn');
        if (audioRecordBtn) {
            audioRecordBtn.disabled = true;
            audioRecordBtn.classList.add('disabled');
            audioRecordBtn.title = 'Cannot send audio to a user who blocked you';
        }
        
        const audioCallBtn = document.getElementById('audioCallBtn');
        if (audioCallBtn) {
            audioCallBtn.disabled = true;
            audioCallBtn.classList.add('disabled');
            audioCallBtn.title = 'Cannot call a user who blocked you';
        }
        
        // Disable attachment button
        const attachmentBtn = document.querySelector('.attachment-btn');
        if (attachmentBtn) {
            attachmentBtn.disabled = true;
            attachmentBtn.classList.add('disabled');
            attachmentBtn.title = 'Cannot send attachments to a user who blocked you';
        }
        
        // Show "You have been blocked" message
        const messagesContainer = document.getElementById('chatMessages');
        if (messagesContainer) {
            // Remove any existing block messages first
            const existingBlockMessages = document.querySelectorAll('.block-message');
            existingBlockMessages.forEach(msg => msg.remove());
            
            // Add the block message
            const blockMessage = document.createElement('div');
            blockMessage.className = 'system-message block-message incoming-block';
            blockMessage.textContent = 'You have been blocked by this user and cannot send messages.';
            messagesContainer.appendChild(blockMessage);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }
    
    // Show a notification toast regardless of which chat is open
    if (window.Swal) {
        Swal.fire({
            title: 'You\'ve been blocked',
            text: 'This user has blocked you. You cannot exchange messages with them.',
            icon: 'warning',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 5000
        });
    }
}

// Make the function available globally
window.handleBlockedByUser = handleBlockedByUser;