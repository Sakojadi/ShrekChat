/**
 * Group Chat functionality for ShrekChat
 */

document.addEventListener('DOMContentLoaded', function() {
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
            fetch('/api/rooms/group', {
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
                if (window.refreshRoomsList) {
                    window.refreshRoomsList();
                } else {
                    // Use the room data to add a new room item to the list
                    const roomData = {
                        id: data.id,
                        name: data.name,
                        avatar: data.avatar || '/static/images/shrek-logo.png',
                        is_group: true,
                        last_message: 'Group created. Click to start chatting!',
                        last_message_time: 'Now'
                    };
                    
                    if (window.addRoomToList) {
                        window.addRoomToList(roomData);
                    }
                }
                
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
                
                fetch(`/api/rooms/${currentGroupId}/members`, {
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
                    fetch(`/api/rooms/${currentGroupId}/leave`, {
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
                        const groupElement = document.querySelector(`.contact-item[data-room-id="${currentGroupId}"]`);
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
            
            fetch('/api/rooms')
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Failed to load rooms');
                    }
                    return response.json();
                })
                .then(rooms => {
                    selectableContacts.innerHTML = '';
                    
                    // Filter to get only direct chat rooms
                    const directRooms = rooms.filter(room => !room.is_group);
                    
                    if (directRooms.length === 0) {
                        selectableContacts.innerHTML = '<div class="no-contacts-message">No contacts found. Add friends first!</div>';
                        return;
                    }
                    
                    directRooms.forEach(function(room) {
                        const contactElement = document.createElement('div');
                        contactElement.className = 'selectable-contact';
                        contactElement.setAttribute('data-contact-id', room.user_id);
                        
                        // Create contact HTML with visible checkbox
                        contactElement.innerHTML = `
                            <input type="checkbox" id="contact_${room.user_id}" class="contact-select">
                            <div class="contact-avatar">
                                <img src="${room.avatar || '/static/images/shrek.jpg'}" alt="${room.name}">
                            </div>
                            <div class="contact-name">${room.name}</div>
                        `;
                        
                        const contactSelect = contactElement.querySelector('.contact-select');
                        
                        // Handle checkbox click
                        contactSelect.addEventListener('change', function() {
                            if (this.checked) {
                                selectedContacts.push({
                                    id: room.user_id,
                                    name: room.name,
                                    avatar: room.avatar || '/static/images/shrek.jpg'
                                });
                            } else {
                                selectedContacts = selectedContacts.filter(c => c.id !== room.user_id);
                            }
                            
                            // Enable/disable next button - require at least one member
                            proceedToGroupDetails.disabled = selectedContacts.length === 0;
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
                    console.error('Error loading rooms:', error);
                    selectableContacts.innerHTML = '<div class="error">Failed to load contacts. Please try again.</div>';
                });
        }
    }
    
    // Load contacts for adding to group
    function loadContactsForAddingToGroup() {
        if (addMemberContacts && currentGroupId) {
            addMemberContacts.innerHTML = '<div class="loading">Loading contacts...</div>';
            
            // Get group members
            fetch(`/api/rooms/${currentGroupId}/members`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Failed to load group members');
                    }
                    return response.json();
                })
                .then(groupMembers => {
                    // Get all rooms/contacts
                    return fetch('/api/rooms')
                        .then(response => {
                            if (!response.ok) {
                                throw new Error('Failed to load rooms');
                            }
                            return response.json();
                        })
                        .then(rooms => {
                            // Filter out group chats and contacts already in the group
                            const groupMemberIds = groupMembers.map(member => member.id);
                            return rooms.filter(room => 
                                !room.is_group && !groupMemberIds.includes(room.user_id)
                            );
                        });
                })
                .then(availableContacts => {
                    addMemberContacts.innerHTML = '';
                    
                    if (availableContacts.length === 0) {
                        addMemberContacts.innerHTML = '<div class="no-contacts-message">All contacts are already in the group</div>';
                        return;
                    }
                    
                    availableContacts.forEach(function(room) {
                        const contactElement = selectableContactTemplate.content.cloneNode(true);
                        const contactDiv = contactElement.querySelector('.selectable-contact');
                        const contactAvatar = contactElement.querySelector('img');
                        const contactName = contactElement.querySelector('.contact-name');
                        const contactSelect = contactElement.querySelector('.contact-select');
                        
                        // Set contact data
                        contactAvatar.src = room.avatar || '/static/images/shrek.jpg';
                        contactName.textContent = room.name;
                        contactDiv.setAttribute('data-contact-id', room.user_id);
                        
                        // Handle checkbox click
                        contactSelect.addEventListener('change', function() {
                            if (this.checked) {
                                selectedContactsForAdd.push({
                                    id: room.user_id,
                                    name: room.name,
                                    avatar: room.avatar || '/static/images/shrek.jpg'
                                });
                            } else {
                                selectedContactsForAdd = selectedContactsForAdd.filter(c => c.id !== room.user_id);
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
    function loadGroupDetails(roomId) {
        if (groupManagementPopup && roomId) {
            currentGroupId = roomId;
            
            // Get group details
            fetch(`/api/rooms/${roomId}`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Failed to load group details');
                    }
                    return response.json();
                })
                .then(room => {
                    // Update group management popup
                    groupManagementAvatar.src = room.avatar || '/static/images/shrek-logo.png';
                    groupManagementName.textContent = room.name;
                    groupManagementDescription.textContent = room.description || 'No description';
                    
                    // Load group members
                    return fetch(`/api/rooms/${roomId}/members`)
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
                                memberRole.textContent = member.is_admin ? 'Admin' : 'Participant';
                                
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
                                            fetch(`/api/rooms/${roomId}/members/${member.id}/make-admin`, {
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
                                            fetch(`/api/rooms/${roomId}/members/${member.id}`, {
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
    
    // Expose loadGroupDetails globally to be accessed from chat.js
    window.loadGroupDetails = loadGroupDetails;
});