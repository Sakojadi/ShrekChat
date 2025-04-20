document.addEventListener('DOMContentLoaded', function() {
    // Get DOM elements
    const addFriendButton = document.getElementById('addFriendButton');
    const addFriendInput = document.getElementById('addFriendInput');
    const searchResults = document.getElementById('searchResults');
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
                addFriendInput.value = '';
            }
            if (searchResults) {
                searchResults.innerHTML = '';
            }
            selectedUsername = null;
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

    // Event listeners for opening popup
    if (addFriendMenuItem) {
        addFriendMenuItem.addEventListener('click', function() {
            const profileSidebar = document.getElementById('profileSidebar');
            if (profileSidebar) {
                profileSidebar.classList.remove('active');
            }
            showAddFriendPopup();
        });
    }

    // Event listeners for closing popup
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
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Search failed');
                    }
                    return response.json();
                })
                .then(data => {
                    searchResults.innerHTML = '';
                    
                    if (data.length === 0) {
                        const noResults = document.createElement('div');
                        noResults.className = 'no-results';
                        noResults.textContent = 'No users found';
                        searchResults.appendChild(noResults);
                        return;
                    }
                    
                    data.forEach(user => {
                        const div = document.createElement('div');
                        div.className = 'search-result-item';
                        
                        // Add a visual indicator if chat already exists
                        let chatIndicator = '';
                        if (user.has_chat) {
                            chatIndicator = '<span class="already-friend">Already a friend</span>';
                        }
                        
                        div.innerHTML = `
                            <div class="search-result-avatar">
                                <img src="${user.avatar || '/static/images/shrek.jpg'}" alt="${user.full_name || user.username}">
                            </div>
                            <div class="search-result-info">
                                <div class="search-result-name">${user.full_name || user.username}</div>
                                <div class="search-result-username">@${user.username}</div>
                                ${chatIndicator}
                            </div>
                        `;
                        
                        div.addEventListener('click', function() {
                            addFriendInput.value = user.username;
                            selectedUsername = user.username;
                            searchResults.innerHTML = '';
                        });
                        
                        searchResults.appendChild(div);
                    });
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
            
            // Send request to create direct message room
            fetch('/api/rooms/direct', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username_to_add: username
                })
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
                
                // Refresh the contacts list
                if (window.refreshRoomsList) {
                    window.refreshRoomsList();
                } else {
                    // Fallback to location reload if no refresh function is available
                    window.location.reload();
                }
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
