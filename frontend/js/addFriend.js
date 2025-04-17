const addFriendButton = document.getElementById('addFriendButton');

addFriendButton.addEventListener('click', async function() {
    console.log('Add Friend button clicked');
    
    const API_URL = 'http://localhost:8000/api';
    const token = localStorage.getItem('token');
    
    if (!token) {
        alert('You must be logged in to add friends');
        return;
    }
    
    const friendInput = document.getElementById('addFriendInput').value.trim();
    
    if (!friendInput) {
        alert('Please enter a username or email');
        return;
    }
    
    try {
        // Call the API to add a friend
        const response = await fetch(`${API_URL}/contacts/add-contact/${friendInput}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.detail || 'Failed to add friend');
        }
        
        // Show success message
        alert('Friend added successfully!');
        
        // Close popup
        const popups = document.querySelectorAll('.popup');
        popups.forEach(popup => popup.classList.remove('open'));
        
        // Refresh contacts list
        fetchContacts();
        
    } catch (error) {
        console.error('Error adding friend:', error);
        alert(error.message);
    }
});
