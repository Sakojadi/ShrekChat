/**
 * User blocking functionality for ShrekChat
 */
document.addEventListener('DOMContentLoaded', function() {
    setupBlockedUsersUI();
    setupBlockUserToggle();
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
                        // Refresh the current chat to ensure all UI elements update correctly
                        refreshChatAfterBlockStatusChange(userId, true);
                    });
                    
                    const blockBtns = document.querySelectorAll(`.block-user-btn[data-user-id="${userId}"]`);
                    blockBtns.forEach(btn => {
                        btn.classList.remove('block-user-btn');
                        btn.classList.add('unblock-user-btn');
                        btn.innerHTML = '<i class="fas fa-user-check"></i> Unblock';
                        btn.setAttribute('aria-label', 'Unblock user');
                        btn.setAttribute('role', 'button');
                    });
                    
                    const chatHeader = document.querySelector('.chat-header .chat-contact-info');
                    if (chatHeader && chatHeader.closest('.chat-content').getAttribute('data-current-user-id') === userId) {
                        // Update chat header to show blocked status
                        updateChatHeaderForBlockedUser(true);
                        
                        // Disable message input with appropriate message
                        const messageInput = document.getElementById('messageInput');
                        if (messageInput) {
                            messageInput.disabled = true;
                            messageInput.placeholder = 'Unblock this user to send messages';
                        }
                        
                        // Show blocked message in chat
                        showBlockedMessage(true, false);
                    }
                    
                    const blockedUsersPopup = document.getElementById('blockedUsersPopup');
                    if (blockedUsersPopup.classList.contains('open')) {
                        loadBlockedUsers();
                    }
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
                        // Refresh the current chat to ensure all UI elements update correctly
                        refreshChatAfterBlockStatusChange(userId, false);
                    });
                    
                    // Play Shrek-themed sound (hypothetical)
                    playSound('/static/sounds/swamp-bubble.mp3');
                    
                    const unblockBtns = document.querySelectorAll(`.unblock-user-btn[data-user-id="${userId}"]`);
                    unblockBtns.forEach(btn => {
                        btn.classList.remove('unblock-user-btn');
                        btn.classList.add('block-user-btn');
                        btn.innerHTML = '<i class="fas fa-user-slash"></i> Block';
                        btn.setAttribute('aria-label', 'Block user');
                        btn.setAttribute('role', 'button');
                        btn.disabled = false;
                    });
                    
                    const blockedUserItems = document.querySelectorAll(`.blocked-user-item .unblock-user-btn[data-user-id="${userId}"]`);
                    blockedUserItems.forEach(btn => {
                        const item = btn.closest('.blocked-user-item');
                        if (item) {
                            item.remove();
                        }
                    });
                    
                    const blockedUsersList = document.querySelector('.blocked-users-list');
                    if (blockedUsersList && blockedUsersList.children.length === 0) {
                        const emptyBlockedList = document.querySelector('.empty-blocked-list');
                        if (emptyBlockedList) {
                            emptyBlockedList.style.display = 'block';
                        }
                    }
                    
                    const chatHeader = document.querySelector('.chat-header .chat-contact-info');
                    if (chatHeader && chatHeader.closest('.chat-content').getAttribute('data-current-user-id') === userId) {
                        // Restore normal chat header display
                        updateChatHeaderForBlockedUser(false);
                        
                        const messageInput = document.getElementById('messageInput');
                        if (messageInput) {
                            messageInput.disabled = false;
                            messageInput.placeholder = 'Type a message...';
                        }
                        
                        // Immediately re-enable audio recording and call buttons
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
                        
                        // Remove any block messages from chat
                        const existingBlockMessages = document.querySelectorAll('.block-message');
                        existingBlockMessages.forEach(msg => msg.remove());
                    }
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
    
    // Re-enable attachment button
    const attachmentBtn = document.querySelector('.attachment-btn');
    if (attachmentBtn) {
        attachmentBtn.disabled = false;
        attachmentBtn.classList.remove('disabled');
        attachmentBtn.title = 'Add attachment';
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