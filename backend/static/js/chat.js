// Socket.IO chat client implementation
document.addEventListener('DOMContentLoaded', function() {
    // This function will be initialized when the DOM is fully loaded
    // Socket connection is initiated in the template's script block
    
    // Initialize profile data
    loadUserProfile();
    
    // Add event listeners for the UI components
    setupUIEventListeners();
    
    // Function to load user profile data
    function loadUserProfile() {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const token = localStorage.getItem('token');
        
        if (!user.username || !token) {
            return;
        }
        
        fetch('/api/users/profile', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => response.json())
        .then(data => {
            // Update profile sidebar with user data
            document.getElementById("profileName").textContent = data.username || user.username;
            document.getElementById("profileStatus").textContent = data.status || "Online";
            
            // Set profile pictures
            const profilePicture = data.profilePicture || "/static/images/shrek-logo.png";
            document.getElementById("profilePicture").src = profilePicture;
            
            // Update profile in edit profile popup if it exists
            const profileUsername = document.getElementById("profileUsername");
            if (profileUsername) {
                profileUsername.value = data.username || user.username;
            }
            
            const profileEmail = document.getElementById("profileEmail");
            if (profileEmail) {
                profileEmail.value = data.email || "";
            }
            
            const profileCountry = document.getElementById("profileCountry");
            if (profileCountry) {
                profileCountry.value = data.country || "";
            }
        })
        .catch(error => console.error("Error loading profile:", error));
    }
    
    // Set up event listeners for UI elements
    function setupUIEventListeners() {
        // Profile form submission
        const profileForm = document.getElementById('profileEditForm');
        if (profileForm) {
            profileForm.addEventListener('submit', function(e) {
                e.preventDefault();
                updateProfile();
            });
        }
        
        // Add friend form submission
        const addFriendForm = document.getElementById('addFriendForm');
        if (addFriendForm) {
            addFriendForm.addEventListener('submit', function(e) {
                e.preventDefault();
                addFriend();
            });
        }
        
        // Create group form submission
        const createGroupForm = document.getElementById('createGroupForm');
        if (createGroupForm) {
            createGroupForm.addEventListener('submit', function(e) {
                e.preventDefault();
                createGroup();
            });
        }
    }
    
    // Update user profile
    function updateProfile() {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        const username = document.getElementById('profileUsername').value;
        const email = document.getElementById('profileEmail').value;
        const status = document.getElementById('profileStatus').value;
        const country = document.getElementById('profileCountry').value;
        const profilePic = document.getElementById('profilePic').files[0];
        
        // Create form data for file upload
        const formData = new FormData();
        formData.append('username', username);
        formData.append('email', email);
        formData.append('status', status);
        formData.append('country', country);
        
        if (profilePic) {
            formData.append('profile_picture', profilePic);
        }
        
        fetch('/api/users/update-profile', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            // Reload profile data
            loadUserProfile();
            
            // Close popup
            closeAllPopups();
            
            // Show success message
            alert('Profile updated successfully');
        })
        .catch(error => {
            console.error('Error updating profile:', error);
            alert('Failed to update profile');
        });
    }
    
    // Add a new friend
    function addFriend() {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        const username = document.getElementById('friendUsername').value;
        const messageElement = document.getElementById('addFriendMessage');
        
        fetch('/api/contacts/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ username })
        })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                messageElement.textContent = data.message;
                messageElement.className = 'form-message success';
                
                // Reload contacts
                setTimeout(() => {
                    loadContacts();
                    closeAllPopups();
                }, 1500);
            }
        })
        .catch(error => {
            console.error('Error adding friend:', error);
            messageElement.textContent = 'Failed to add friend';
            messageElement.className = 'form-message error';
        });
    }
    
    // Create a new group
    function createGroup() {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        const name = document.getElementById('groupName').value;
        const description = document.getElementById('groupDescription').value;
        const selectedContacts = Array.from(
            document.querySelectorAll('.selected-contacts .selected-contact')
        ).map(contact => contact.dataset.username);
        
        const messageElement = document.getElementById('createGroupMessage');
        
        fetch('/api/groups/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                name,
                description,
                members: selectedContacts
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                messageElement.textContent = data.message;
                messageElement.className = 'form-message success';
                
                // Reload contacts (which should include groups)
                setTimeout(() => {
                    loadContacts();
                    closeAllPopups();
                }, 1500);
            }
        })
        .catch(error => {
            console.error('Error creating group:', error);
            messageElement.textContent = 'Failed to create group';
            messageElement.className = 'form-message error';
        });
    }
    
    // Helper function to close all popups
    function closeAllPopups() {
        document.querySelectorAll('.popup').forEach(popup => {
            popup.classList.remove('open');
        });
    }
    
    // Make certain functions available globally
    window.closeAllPopups = closeAllPopups;
    
    // Initialize Socket.IO connection and chat functionality is handled
    // in the Jinja template itself for this implementation
});