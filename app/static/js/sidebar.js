/**
 * Sidebar functionality for ShrekChat
 */

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements - Sidebar
    const profileButton = document.getElementById('profileButton');
    const profileSidebar = document.getElementById('profileSidebar');
    const closeProfileSidebar = document.getElementById('closeProfileSidebar');
    const overlay = document.getElementById('overlay');
    const logoutMenuItem = document.getElementById('logoutMenuItem');
    const editProfileMenuItem = document.getElementById('editProfileMenuItem');
    const editProfilePopup = document.getElementById('editProfilePopup');
    const closeEditProfilePopup = document.getElementById('closeEditProfilePopup');
    const editProfileForm = document.getElementById('editProfileForm');

    // Toggle profile sidebar
    if (profileButton) {
        profileButton.addEventListener('click', function() {
            profileSidebar.classList.add('active');
            overlay.classList.add('active');
        });
    }
    
    if (closeProfileSidebar) {
        closeProfileSidebar.addEventListener('click', function() {
            profileSidebar.classList.remove('active');
            overlay.classList.remove('active');
        });
    }

    // Handle logout
    if (logoutMenuItem) {
        logoutMenuItem.addEventListener('click', function() {
            window.location.href = '/logout';
        });
    }

    // Toggle edit profile popup
    if (editProfileMenuItem) {
        editProfileMenuItem.addEventListener('click', function() {
            if (profileSidebar) {
                profileSidebar.classList.remove('active');
            }
            
            if (editProfilePopup) {
                editProfilePopup.classList.add('open');
                overlay.classList.add('active');
                
                // Load current profile data
                loadProfileData();
            }
        });
    }

    if (closeEditProfilePopup) {
        closeEditProfilePopup.addEventListener('click', function() {
            editProfilePopup.classList.remove('open');
            overlay.classList.remove('active');
        });
    }

    // Handle overlay clicks to close popups
    if (overlay) {
        overlay.addEventListener('click', function() {
            profileSidebar.classList.remove('active');
            
            // Close all popups
            const popups = document.querySelectorAll('.popup');
            popups.forEach(popup => {
                popup.classList.remove('open');
            });
            
            overlay.classList.remove('active');
        });
    }

    // Load profile data from API
    function loadProfileData() {
        fetch('/api/profile')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to load profile data');
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    // Populate form fields with current profile data
                    document.getElementById('profileNickname').value = data.data.username || '';
                    document.getElementById('profileEmail').value = data.data.email || '';
                    document.getElementById('profilePhone').value = data.data.phone_number || '';
                    document.getElementById('profileCountry').value = data.data.country || '';
                } else {
                    console.error('Error loading profile:', data.message);
                }
            })
            .catch(error => {
                console.error('Error loading profile data:', error);
            });
    }

    // Handle profile form submission
    if (editProfileForm) {
        editProfileForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = {
                username: document.getElementById('profileNickname').value,
                email: document.getElementById('profileEmail').value,
                phone_number: document.getElementById('profilePhone').value,
                country: document.getElementById('profileCountry').value
            };

            // Only include fields that are not empty
            Object.keys(formData).forEach(key => {
                if (!formData[key]) delete formData[key];
            });
            
            fetch('/api/profile/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to update profile');
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    // Update profile name in the sidebar if username was changed
                    if (formData.username) {
                        document.querySelector('.profile-name').textContent = formData.username;
                    }
                    
                    // Close popup
                    editProfilePopup.classList.remove('open');
                    overlay.classList.remove('active');
                    
                    // Show success notification
                    Swal.fire({
                        icon: 'success',
                        title: 'Profile Updated',
                        text: 'Your profile has been updated successfully!',
                        confirmButtonText: 'OK'
                    });
                    
                    // Reload page if username was changed
                    if (formData.username) {
                        setTimeout(() => {
                            window.location.reload();
                        }, 1000);
                    }
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Update Failed',
                        text: 'Failed to update profile: ' + data.message,
                        confirmButtonText: 'OK'
                    });
                }
            })
            .catch(error => {
                console.error('Error updating profile:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'An error occurred while updating your profile',
                    confirmButtonText: 'OK'
                });
            });
        });
    }
});