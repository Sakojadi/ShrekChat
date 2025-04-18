/**
 * Group Chat functionality for ShrekChat
 */

document.addEventListener('DOMContentLoaded', function() {
    let socket_protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';

    // DOM Elements - Group Creation
    const createGroupMenuItem = document.getElementById('createGroupMenuItem');
    const createGroupPopup = document.getElementById('createGroupPopup');
    const closeCreateGroupPopup = document.getElementById('closeCreateGroupPopup');
    const selectableContacts = document.getElementById('selectableContacts');
    const cancelGroupCreation = document.getElementById('cancelGroupCreation');
    const proceedToGroupDetails = document.getElementById('proceedToGroupDetails');
    const groupMemberSearch = document.getElementById('groupMemberSearch');
    
    // DOM Elements - Group Details
    const groupDetailsPopup = document.getElementById('groupDetailsPopup');
    const closeGroupDetailsPopup = document.getElementById('closeGroupDetailsPopup');
    const groupAvatarPreview = document.getElementById('groupAvatarPreview');
    const groupAvatarInput = document.getElementById('groupAvatarInput');
    const avatarUploadOverlay = document.querySelector('.avatar-upload-overlay');
    const groupNameInput = document.getElementById('groupNameInput');
    const groupDescriptionInput = document.getElementById('groupDescriptionInput');
    const selectedMembersCount = document.getElementById('selectedMembersCount');
    const selectedMembersAvatars = document.getElementById('selectedMembersAvatars');
    const backToMemberSelection = document.getElementById('backToMemberSelection');
    const createGroupButton = document.getElementById('createGroupButton');
    
    // DOM Elements - Group Management
    const groupManagementPopup = document.getElementById('groupManagementPopup');
    const closeGroupManagementPopup = document.getElementById('closeGroupManagementPopup');
    const groupManagementAvatar = document.getElementById('groupManagementAvatar');
    const groupManagementName = document.getElementById('groupManagementName');
    const groupManagementDescription = document.getElementById('groupManagementDescription');
    const groupMembersCount = document.getElementById('groupMembersCount');
    const groupMembersList = document.getElementById('groupMembersList');
    const addGroupMemberLink = document.getElementById('addGroupMemberLink');
    const backToGroupChat = document.getElementById('backToGroupChat');
    const editGroupButton = document.getElementById('editGroupButton');
    const leaveGroupButton = document.getElementById('leaveGroupButton');
    
    // DOM Elements - Add Group Member
    const addGroupMemberPopup = document.getElementById('addGroupMemberPopup');
    const closeAddGroupMemberPopup = document.getElementById('closeAddGroupMemberPopup');
    const addMemberSearch = document.getElementById('addMemberSearch');
    const addMemberContacts = document.getElementById('addMemberContacts');
    const cancelAddMember = document.getElementById('cancelAddMember');
    const confirmAddMember = document.getElementById('confirmAddMember');
    
    // General elements
    const contactsList = document.getElementById('contactsList');
    const overlay = document.getElementById('overlay');
    
    // State
    let selectedContacts = [];
    let currentGroupId = null;
    let groupAvatarFile = null;
    let selectedContactsForAdd = [];
    
    // Templates
    const selectableContactTemplate = document.getElementById('selectableContactTemplate');
    const selectedMemberAvatarTemplate = document.getElementById('selectedMemberAvatarTemplate');
    const groupContactItemTemplate = document.getElementById('groupContactItemTemplate');
    const groupMemberTemplate = document.getElementById('groupMemberTemplate');
    
    // Close Create Group popup
    if (closeCreateGroupPopup) {
        closeCreateGroupPopup.addEventListener('click', function() {
            createGroupPopup.classList.remove('open');
            overlay.classList.remove('active');
        });
    }
    
    // Cancel Group Creation
    if (cancelGroupCreation) {
        cancelGroupCreation.addEventListener('click', function() {
            createGroupPopup.classList.remove('open');
            overlay.classList.remove('active');
        });
    }
    
    // Proceed to Group Details
    if (proceedToGroupDetails) {
        proceedToGroupDetails.addEventListener('click', function() {
            if (selectedContacts.length > 0) {
                createGroupPopup.classList.remove('open');
                groupDetailsPopup.classList.add('open');
                
                // Reset group details form
                groupNameInput.value = '';
                groupDescriptionInput.value = '';
                groupAvatarPreview.src = '/static/images/shrek.jpg';
                groupAvatarFile = null;
                
                // Update selected members count
                selectedMembersCount.textContent = selectedContacts.length;
                
                // Clear and populate selected members avatars
                selectedMembersAvatars.innerHTML = '';
                selectedContacts.forEach(function(contact) {
                    const memberAvatarElement = selectedMemberAvatarTemplate.content.cloneNode(true);
                    const avatarImg = memberAvatarElement.querySelector('img');
                    avatarImg.src = contact.avatar;
                    avatarImg.alt = contact.name;
                    selectedMembersAvatars.appendChild(memberAvatarElement);
                });
            }
        });
    }
    
    // Back to Member Selection
    if (backToMemberSelection) {
        backToMemberSelection.addEventListener('click', function() {
            groupDetailsPopup.classList.remove('open');
            createGroupPopup.classList.add('open');
        });
    }
    
    // Close Group Details popup
    if (closeGroupDetailsPopup) {
        closeGroupDetailsPopup.addEventListener('click', function() {
            groupDetailsPopup.classList.remove('open');
            overlay.classList.remove('active');
        });
    }
    
    // Group avatar upload
    if (avatarUploadOverlay && groupAvatarInput) {
        avatarUploadOverlay.addEventListener('click', function() {
            groupAvatarInput.click();
        });
        
        groupAvatarInput.addEventListener('change', function() {
            if (this.files && this.files[0]) {
                const file = this.files[0];
                groupAvatarFile = file;
                
                const reader = new FileReader();
                reader.onload = function(e) {
                    groupAvatarPreview.src = e.target.result;
                }
                reader.readAsDataURL(file);
            }
        });
    }
    // Toggle create group popup
    if (createGroupMenuItem) {
        createGroupMenuItem.addEventListener('click', function() {
            const profileSidebar = document.getElementById('profileSidebar');
            if (profileSidebar) {
                profileSidebar.classList.remove('active');
            }
            
            if (createGroupPopup) {
                createGroupPopup.classList.add('open');
                overlay.classList.add('active');
                
                // Reset selected contacts
                selectedContacts = [];
                
                // Disable next button
                proceedToGroupDetails.disabled = true;
                
                // Load contacts for selection
                loadContactsForSelection();
            }
        });
    }
    
    // Create Group
    if (createGroupButton) {
        createGroupButton.addEventListener('click', function() {
            const groupName = groupNameInput.value.trim();
            const groupDescription = groupDescriptionInput.value.trim();
            
            if (!groupName) {
                alert('Please enter a group name');
                return;
            }
            
            if (selectedContacts.length === 0) {
                alert('Please select at least one contact');
                return;
            }
            
            // Create FormData object to send the group data
            const formData = new FormData();
            formData.append('name', groupName);
            formData.append('description', groupDescription);
            
            // Convert selected contacts to comma-separated IDs string
            const memberIds = selectedContacts.map(contact => contact.id).join(',');
            formData.append('member_ids', memberIds);
            
            // Add group avatar if selected
            if (groupAvatarFile) {
                formData.append('avatar', groupAvatarFile);
            }
            
            // Create the group using API
            fetch('/api/groups', {
                method: 'POST',
                body: formData
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to create group');
                }
                return response.json();
            })
            .then(data => {
                console.log('Group created:', data);
                
                // Add the new group to the contacts list
                addGroupToContactsList(data);
                
                // Close popup
                groupDetailsPopup.classList.remove('open');
                overlay.classList.remove('active');
                
                // Reset selected contacts
                selectedContacts = [];
            })
            .catch(error => {
                console.error('Error creating group:', error);
                alert('Failed to create group. Please try again.');
            });
        });
    }
    
    // Close Group Management popup
    if (closeGroupManagementPopup) {
        closeGroupManagementPopup.addEventListener('click', function() {
            groupManagementPopup.classList.remove('open');
            overlay.classList.remove('active');
        });
    }
    
    // Back to Group Chat
    if (backToGroupChat) {
        backToGroupChat.addEventListener('click', function() {
            groupManagementPopup.classList.remove('open');
            overlay.classList.remove('active');
        });
    }
    
    // Open Add Group Member popup
    if (addGroupMemberLink) {
        addGroupMemberLink.addEventListener('click', function() {
            groupManagementPopup.classList.remove('open');
            addGroupMemberPopup.classList.add('open');
            
            // Reset selected contacts
            selectedContactsForAdd = [];
            confirmAddMember.disabled = true;
            
            // Load contacts not in the group
            loadContactsForAddingToGroup();
        });
    }
    
    // Close Add Group Member popup
    if (closeAddGroupMemberPopup) {
        closeAddGroupMemberPopup.addEventListener('click', function() {
            addGroupMemberPopup.classList.remove('open');
            groupManagementPopup.classList.add('open');
        });
    }
    
    // Cancel Add Member
    if (cancelAddMember) {
        cancelAddMember.addEventListener('click', function() {
            addGroupMemberPopup.classList.remove('open');
            groupManagementPopup.classList.add('open');
        });
    }
    
    // Confirm Add Member
    if (confirmAddMember) {
        confirmAddMember.addEventListener('click', function() {
            if (selectedContactsForAdd.length > 0 && currentGroupId) {
                // Add members to group using API
                const memberIds = selectedContactsForAdd.map(contact => contact.id);
                
                fetch(`/api/groups/${currentGroupId}/members`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ members: memberIds })
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Failed to add members');
                    }
                    return response.json();
                })
                .then(data => {
                    console.log('Members added:', data);
                    
                    // Close popup
                    addGroupMemberPopup.classList.remove('open');
                    
                    // Reload group management popup
                    loadGroupDetails(currentGroupId);
                    groupManagementPopup.classList.add('open');
                    
                    // Reset selected contacts
                    selectedContactsForAdd = [];
                })
                .catch(error => {
                    console.error('Error adding members:', error);
                    alert('Failed to add members. Please try again.');
                });
            }
        });
    }
    
    // Leave Group
    if (leaveGroupButton) {
        leaveGroupButton.addEventListener('click', function() {
            if (currentGroupId) {
                if (confirm('Are you sure you want to leave this group?')) {
                    // Leave group using API
                    fetch(`/api/groups/${currentGroupId}/leave`, {
                        method: 'POST'
                    })
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Failed to leave group');
                        }
                        return response.json();
                    })
                    .then(data => {
                        console.log('Left group:', data);
                        
                        // Remove group from contacts list
                        const groupElement = document.querySelector(`.contact-item[data-contact-id="group-${currentGroupId}"]`);
                        if (groupElement) {
                            groupElement.remove();
                        }
                        
                        // Close popup
                        groupManagementPopup.classList.remove('open');
                        overlay.classList.remove('active');
                        
                        // Show welcome screen
                        const welcomeContainer = document.getElementById('welcomeContainer');
                        const chatContent = document.getElementById('chatContent');
                        if (welcomeContainer && chatContent) {
                            welcomeContainer.style.display = 'flex';
                            chatContent.style.display = 'none';
                        }
                    })
                    .catch(error => {
                        console.error('Error leaving group:', error);
                        alert('Failed to leave group. Please try again.');
                    });
                }
            }
        });
    }
    
    // Load contacts for selection
    function loadContactsForSelection() {
        if (selectableContacts) {
            selectableContacts.innerHTML = '<div class="loading">Loading contacts...</div>';
            
            fetch('/api/contacts')
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Failed to load contacts');
                    }
                    return response.json();
                })
                .then(contacts => {
                    selectableContacts.innerHTML = '';
                    
                    if (contacts.length === 0) {
                        selectableContacts.innerHTML = '<div class="no-contacts-message">No contacts found</div>';
                        return;
                    }
                    
                    contacts.forEach(function(contact) {
                        const contactElement = document.createElement('div');
                        contactElement.className = 'selectable-contact';
                        contactElement.setAttribute('data-contact-id', contact.id);
                        
                        // Create contact HTML with visible checkbox
                        contactElement.innerHTML = `
                            <input type="checkbox" id="contact_${contact.id}" class="contact-select">
                            <div class="contact-avatar">
                                <img src="${contact.avatar || '/static/images/shrek.jpg'}" alt="${contact.name}">
                            </div>
                            <div class="contact-name">${contact.name}</div>
                        `;
                        
                        const contactSelect = contactElement.querySelector('.contact-select');
                        
                        // Handle checkbox click
                        contactSelect.addEventListener('change', function() {
                            if (this.checked) {
                                selectedContacts.push({
                                    id: contact.id,
                                    name: contact.name,
                                    avatar: contact.avatar || '/static/images/shrek.jpg'
                                });
                            } else {
                                selectedContacts = selectedContacts.filter(c => c.id !== contact.id);
                            }
                            
                            // Enable/disable next button - require at least 2 members
                            proceedToGroupDetails.disabled = selectedContacts.length < 2;
                        });
                        
                        // Handle clicking on the contact row
                        contactElement.addEventListener('click', function(event) {
                            if (event.target !== contactSelect) {
                                contactSelect.checked = !contactSelect.checked;
                                
                                // Trigger the change event
                                const changeEvent = new Event('change');
                                contactSelect.dispatchEvent(changeEvent);
                            }
                        });
                        
                        selectableContacts.appendChild(contactElement);
                    });
                })
                .catch(error => {
                    console.error('Error loading contacts:', error);
                    selectableContacts.innerHTML = '<div class="error">Failed to load contacts. Please try again.</div>';
                });
        }
    }
    
    // Load contacts for adding to group
    function loadContactsForAddingToGroup() {
        if (addMemberContacts && currentGroupId) {
            addMemberContacts.innerHTML = '<div class="loading">Loading contacts...</div>';
            
            // Get group members
            fetch(`/api/groups/${currentGroupId}/members`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Failed to load group members');
                    }
                    return response.json();
                })
                .then(groupMembers => {
                    // Get all contacts
                    return fetch('/api/contacts')
                        .then(response => {
                            if (!response.ok) {
                                throw new Error('Failed to load contacts');
                            }
                            return response.json();
                        })
                        .then(contacts => {
                            // Filter out contacts already in the group
                            const groupMemberIds = groupMembers.map(member => member.id);
                            return contacts.filter(contact => !groupMemberIds.includes(contact.id));
                        });
                })
                .then(availableContacts => {
                    addMemberContacts.innerHTML = '';
                    
                    if (availableContacts.length === 0) {
                        addMemberContacts.innerHTML = '<div class="no-contacts-message">All contacts are already in the group</div>';
                        return;
                    }
                    
                    availableContacts.forEach(function(contact) {
                        const contactElement = selectableContactTemplate.content.cloneNode(true);
                        const contactDiv = contactElement.querySelector('.selectable-contact');
                        const contactAvatar = contactElement.querySelector('img');
                        const contactName = contactElement.querySelector('.contact-name');
                        const contactSelect = contactElement.querySelector('.contact-select');
                        
                        // Set contact data
                        contactAvatar.src = contact.avatar || '/static/images/shrek.jpg';
                        contactName.textContent = contact.name;
                        contactDiv.setAttribute('data-contact-id', contact.id);
                        
                        // Handle checkbox click
                        contactSelect.addEventListener('change', function() {
                            if (this.checked) {
                                selectedContactsForAdd.push({
                                    id: contact.id,
                                    name: contact.name,
                                    avatar: contact.avatar || '/static/images/shrek.jpg'
                                });
                            } else {
                                selectedContactsForAdd = selectedContactsForAdd.filter(c => c.id !== contact.id);
                            }
                            
                            // Enable/disable add button
                            confirmAddMember.disabled = selectedContactsForAdd.length === 0;
                        });
                        
                        // Handle clicking on the contact row
                        contactDiv.addEventListener('click', function(event) {
                            if (event.target !== contactSelect) {
                                contactSelect.checked = !contactSelect.checked;
                                
                                // Trigger the change event
                                const changeEvent = new Event('change');
                                contactSelect.dispatchEvent(changeEvent);
                            }
                        });
                        
                        addMemberContacts.appendChild(contactElement);
                    });
                })
                .catch(error => {
                    console.error('Error loading contacts:', error);
                    addMemberContacts.innerHTML = '<div class="error">Failed to load contacts. Please try again.</div>';
                });
        }
    }
    
    // Load group details
    function loadGroupDetails(groupId) {
        if (groupManagementPopup && groupId) {
            currentGroupId = groupId;
            
            // Get group details
            fetch(`/api/groups/${groupId}`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Failed to load group details');
                    }
                    return response.json();
                })
                .then(group => {
                    // Update group management popup
                    groupManagementAvatar.src = group.avatar || '/static/images/shrek.jpg';
                    groupManagementName.textContent = group.name;
                    groupManagementDescription.textContent = group.description || 'No description';
                    
                    // Load group members
                    return fetch(`/api/groups/${groupId}/members`)
                        .then(response => {
                            if (!response.ok) {
                                throw new Error('Failed to load group members');
                            }
                            return response.json();
                        })
                        .then(members => {
                            // Update members count
                            groupMembersCount.textContent = `(${members.length})`;
                            
                            // Clear and populate members list
                            groupMembersList.innerHTML = '';
                            
                            members.forEach(function(member) {
                                const memberElement = groupMemberTemplate.content.cloneNode(true);
                                const memberAvatar = memberElement.querySelector('.member-avatar img');
                                const memberName = memberElement.querySelector('.member-name');
                                const memberRole = memberElement.querySelector('.member-role');
                                const memberActionsToggle = memberElement.querySelector('.member-actions-toggle');
                                const makeAdminAction = memberElement.querySelector('.dropdown-item.make-admin');
                                const removeMemberAction = memberElement.querySelector('.dropdown-item.remove-member');
                                
                                // Set member data
                                memberAvatar.src = member.avatar || '/static/images/shrek.jpg';
                                memberName.textContent = member.name;
                                memberRole.textContent = member.role || 'Participant';
                                
                                // Handle member actions toggle
                                if (memberActionsToggle) {
                                    memberActionsToggle.addEventListener('click', function(e) {
                                        e.stopPropagation();
                                        const dropdownMenu = this.nextElementSibling;
                                        dropdownMenu.classList.toggle('active');
                                        
                                        // Close other open dropdowns
                                        document.querySelectorAll('.group-member .dropdown-menu.active').forEach(function(menu) {
                                            if (menu !== dropdownMenu) {
                                                menu.classList.remove('active');
                                            }
                                        });
                                        
                                        // Close dropdown when clicking outside
                                        document.addEventListener('click', function closeDropdown() {
                                            dropdownMenu.classList.remove('active');
                                            document.removeEventListener('click', closeDropdown);
                                        });
                                    });
                                }
                                
                                // Handle make admin action
                                if (makeAdminAction) {
                                    makeAdminAction.addEventListener('click', function() {
                                        if (confirm(`Make ${member.name} an admin of this group?`)) {
                                            // Make admin using API
                                            fetch(`/api/groups/${groupId}/members/${member.id}/make-admin`, {
                                                method: 'POST'
                                            })
                                            .then(response => {
                                                if (!response.ok) {
                                                    throw new Error('Failed to make admin');
                                                }
                                                return response.json();
                                            })
                                            .then(data => {
                                                console.log('Made admin:', data);
                                                
                                                // Update member role
                                                memberRole.textContent = 'Admin';
                                            })
                                            .catch(error => {
                                                console.error('Error making admin:', error);
                                                alert('Failed to make admin. Please try again.');
                                            });
                                        }
                                    });
                                }
                                
                                // Handle remove member action
                                if (removeMemberAction) {
                                    removeMemberAction.addEventListener('click', function() {
                                        if (confirm(`Remove ${member.name} from this group?`)) {
                                            // Remove member using API
                                            fetch(`/api/groups/${groupId}/members/${member.id}`, {
                                                method: 'DELETE'
                                            })
                                            .then(response => {
                                                if (!response.ok) {
                                                    throw new Error('Failed to remove member');
                                                }
                                                return response.json();
                                            })
                                            .then(data => {
                                                console.log('Removed member:', data);
                                                
                                                // Remove member from list
                                                const memberDiv = this.closest('.group-member');
                                                memberDiv.remove();
                                                
                                                // Update members count
                                                const currentCount = parseInt(groupMembersCount.textContent.match(/\d+/)[0]);
                                                groupMembersCount.textContent = `(${currentCount - 1})`;
                                            })
                                            .catch(error => {
                                                console.error('Error removing member:', error);
                                                alert('Failed to remove member. Please try again.');
                                            });
                                        }
                                    });
                                }
                                
                                groupMembersList.appendChild(memberElement);
                            });
                        });
                })
                .catch(error => {
                    console.error('Error loading group details:', error);
                    alert('Failed to load group details. Please try again.');
                });
        }
    }
    
    // Add group to contacts list
    function addGroupToContactsList(group) {
        if (contactsList && groupContactItemTemplate) {
            const groupElement = groupContactItemTemplate.content.cloneNode(true);
            const contactItem = groupElement.querySelector('.contact-item');
            const contactAvatar = groupElement.querySelector('.contact-avatar img');
            const contactName = groupElement.querySelector('.contact-name-time h4');
            const lastMessage = groupElement.querySelector('.last-message');
            
            // Set group data
            contactAvatar.src = group.avatar || '/static/images/shrek.jpg';
            contactName.textContent = group.name;
            lastMessage.textContent = 'Group created. Click to start chatting!';
            contactItem.setAttribute('data-contact-id', `group-${group.id}`);
            contactItem.setAttribute('data-is-group', 'true');
            
            // Handle click to open group chat
            contactItem.addEventListener('click', function() {
                // Remove active class from all contacts
                document.querySelectorAll('.contact-item').forEach(contact => {
                    contact.classList.remove('active');
                });
                
                // Add active class to selected contact
                this.classList.add('active');
                
                // Update chat header with group info
                const chatContactName = document.getElementById('chatContactName');
                const chatContactStatus = document.getElementById('chatContactPresence');
                const chatContactAvatar = document.getElementById('chatContactAvatar');
                
                if (chatContactName) chatContactName.textContent = group.name;
                if (chatContactStatus) chatContactStatus.textContent = 'Group';
                if (chatContactAvatar) chatContactAvatar.src = group.avatar || '/static/images/shrek.jpg';
                
                // Show chat content, hide welcome container
                const welcomeContainer = document.getElementById('welcomeContainer');
                const chatContent = document.getElementById('chatContent');
                if (welcomeContainer && chatContent) {
                    welcomeContainer.style.display = 'none';
                    chatContent.style.display = 'flex';
                }
                
                // Show mobile chat area
                const sidebar = document.querySelector('.sidebar');
                if (sidebar) {
                    sidebar.classList.remove('active');
                }
                
                // Update contact info popup handler (chat header click)
                const chatContactInfo = document.querySelector('.chat-contact-info');
                if (chatContactInfo) {
                    // Remove existing event listeners (we need to use cloneNode trick)
                    const newChatContactInfo = chatContactInfo.cloneNode(true);
                    chatContactInfo.parentNode.replaceChild(newChatContactInfo, chatContactInfo);
                    
                    // Add new event listener for group chat
                    newChatContactInfo.addEventListener('click', function() {
                        groupManagementPopup.classList.add('open');
                        overlay.classList.add('active');
                        
                        // Load group details
                        loadGroupDetails(group.id);
                    });
                }
                
                // Update view contact info dropdown option
                const viewContactInfo = document.getElementById('viewContactInfo');
                if (viewContactInfo) {
                    viewContactInfo.textContent = 'Group info';
                    
                    // Remove existing event listeners
                    const newViewContactInfo = viewContactInfo.cloneNode(true);
                    viewContactInfo.parentNode.replaceChild(newViewContactInfo, viewContactInfo);
                    
                    // Add new event listener
                    newViewContactInfo.addEventListener('click', function() {
                        groupManagementPopup.classList.add('open');
                        overlay.classList.add('active');
                        
                        // Load group details
                        loadGroupDetails(group.id);
                        
                        // Close dropdown menu
                        const dropdownMenu = document.querySelector('.dropdown-menu.active');
                        if (dropdownMenu) {
                            dropdownMenu.classList.remove('active');
                        }
                    });
                }
                
                // Load group messages
                loadGroupMessages(group.id);
                
                // Connect to group chat WebSocket
                connectToGroupChat(group.id);
            });
            
            // Insert at the top of the contacts list
            contactsList.insertBefore(groupElement, contactsList.firstChild);
        }
    }
    
    // Load group messages
    function loadGroupMessages(groupId) {
        const chatMessages = document.getElementById('chatMessages');
        
        if (chatMessages) {
            chatMessages.innerHTML = '<div class="loading-messages">Loading messages...</div>';
            
            fetch(`/api/groups/${groupId}/messages`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Failed to load messages');
                    }
                    return response.json();
                })
                .then(messages => {
                    chatMessages.innerHTML = '';
                    
                    if (messages.length === 0) {
                        chatMessages.innerHTML = '<div class="no-messages">No messages yet. Be the first to say hello!</div>';
                        return;
                    }
                    
                    messages.forEach(function(message) {
                        displayGroupMessage(message);
                    });
                    
                    // Scroll to bottom
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                })
                .catch(error => {
                    console.error('Error loading group messages:', error);
                    chatMessages.innerHTML = '<div class="error">Failed to load messages. Please try again.</div>';
                });
        }
    }
    
    // Display group message
    function displayGroupMessage(message) {
        const chatMessages = document.getElementById('chatMessages');
        const messageTemplate = document.getElementById('groupMessageTemplate');
        
        if (chatMessages && messageTemplate) {
            const messageElement = messageTemplate.content.cloneNode(true);
            const messageDiv = messageElement.querySelector('.message');
            const messageSender = messageElement.querySelector('.message-sender');
            const messageContent = messageElement.querySelector('.message-content');
            const messageTime = messageElement.querySelector('.message-time');
            
            // Get current username
            const currentUsername = document.querySelector('.profile-name') ? 
                                   document.querySelector('.profile-name').textContent.trim() : '';
            
            // Set message content and time
            messageContent.textContent = message.content;
            messageTime.textContent = message.time;
            
            // Determine if this is an incoming or outgoing message
            if (message.sender === "user" || message.sender === currentUsername) {
                messageDiv.classList.add('outgoing');
                messageDiv.classList.add('group-message');
                messageSender.textContent = "You";
            } else {
                messageDiv.classList.add('incoming');
                messageDiv.classList.add('group-message');
                messageSender.textContent = message.sender_name || message.sender;
            }
            
            chatMessages.appendChild(messageElement);
        }
    }
    
    // Connect to group chat WebSocket
    function connectToGroupChat(groupId) {
        // Close previous WebSocket if open
        if (window.groupChatWs) {
            window.groupChatWs.close();
        }
        
        // Get current username
        const currentUsername = document.querySelector('.profile-name') ? 
                               document.querySelector('.profile-name').textContent.trim() : '';

        // Open new WebSocket connection
        const wsUrl = `${socket_protocol + window.location.host}/ws/group/${groupId}?username=${encodeURIComponent(currentUsername)}`;
        window.groupChatWs = new WebSocket(wsUrl);
        
        // WebSocket event handlers
        window.groupChatWs.onopen = function(event) {
            console.log("Group WebSocket connection established");
        };
        
        window.groupChatWs.onmessage = function(event) {
            const data = JSON.parse(event.data);
            
            if (data.type === "message") {
                displayGroupMessage(data);
                
                // Scroll to bottom
                const chatMessages = document.getElementById('chatMessages');
                if (chatMessages) {
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }
                
                // Update last message in contact list
                updateGroupLastMessage(groupId, data.content, data.time);
            }
        };
        
        window.groupChatWs.onerror = function(error) {
            console.error("Group WebSocket error:", error);
        };
        
        window.groupChatWs.onclose = function(event) {
            if (event.code !== 1000) {
                console.log("Group WebSocket connection closed unexpectedly:", event.code, event.reason);
            }
        };
        
        // Update send button to use group chat WebSocket
        const sendMessageBtn = document.getElementById('sendMessageBtn');
        const messageInput = document.getElementById('messageInput');
        
        if (sendMessageBtn && messageInput) {
            // Remove existing event listeners
            const newSendMessageBtn = sendMessageBtn.cloneNode(true);
            sendMessageBtn.parentNode.replaceChild(newSendMessageBtn, sendMessageBtn);
            
            // Add new event listener for group chat
            newSendMessageBtn.addEventListener('click', function() {
                sendGroupMessage(groupId);
            });
            
            // Update keypress event for message input
            messageInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    sendGroupMessage(groupId);
                }
            });
        }
    }
    
    // Send group message
    function sendGroupMessage(groupId) {
        const messageInput = document.getElementById('messageInput');
        
        if (messageInput && window.groupChatWs && window.groupChatWs.readyState === WebSocket.OPEN) {
            const message = messageInput.value.trim();
            
            if (message) {
                const now = new Date();
                const msgData = {
                    type: "message",
                    content: message,
                    time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                };
                
                try {
                    window.groupChatWs.send(JSON.stringify(msgData));
                    messageInput.value = '';
                } catch (error) {
                    console.error("Error sending group message:", error);
                    alert("Failed to send message. Please try again.");
                }
            }
        } else if (messageInput && messageInput.value.trim()) {
            if (!window.groupChatWs || window.groupChatWs.readyState !== WebSocket.OPEN) {
                console.error("Group WebSocket is not connected");
                alert("Chat connection is not available. Please refresh the page and try again.");
            }
        }
    }
    
    // Update group's last message in contacts list
    function updateGroupLastMessage(groupId, message, time) {
        const contactElement = document.querySelector(`.contact-item[data-contact-id="group-${groupId}"]`);
        
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
    
    // Search functionality for group member selection
    if (groupMemberSearch) {
        groupMemberSearch.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const contacts = selectableContacts.querySelectorAll('.selectable-contact');
            
            contacts.forEach(function(contact) {
                const name = contact.querySelector('.contact-name').textContent.toLowerCase();
                
                if (name.includes(searchTerm)) {
                    contact.style.display = 'flex';
                } else {
                    contact.style.display = 'none';
                }
            });
        });
    }
    
    // Search functionality for add member
    if (addMemberSearch) {
        addMemberSearch.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const contacts = addMemberContacts.querySelectorAll('.selectable-contact');
            
            contacts.forEach(function(contact) {
                const name = contact.querySelector('.contact-name').textContent.toLowerCase();
                
                if (name.includes(searchTerm)) {
                    contact.style.display = 'flex';
                } else {
                    contact.style.display = 'none';
                }
            });
        });
    }
    
    // Load existing groups on page load
    function loadGroups() {
        fetch('/api/groups')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to load groups');
                }
                return response.json();
            })
            .then(groups => {
                groups.forEach(function(group) {
                    addGroupToContactsList(group);
                });
            })
            .catch(error => {
                console.error('Error loading groups:', error);
            });
    }
    
    // Load groups on page load
    loadGroups();
});