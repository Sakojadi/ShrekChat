/**
 * Admin Panel functionality for ShrekChat
 * Provides access to user statistics and analytics
 */

document.addEventListener('DOMContentLoaded', function() {
    // Constants
    const ADMIN_PASSWORD = "shrek1234"; // Hardcoded password for admin access
    
    // DOM Elements
    const adminMenuItem = document.getElementById('adminMenuItem');
    const adminPanelPopup = document.getElementById('adminPanelPopup');
    const closeAdminPanelPopup = document.getElementById('closeAdminPanelPopup');
    const adminAuthSection = document.getElementById('adminAuthSection');
    const adminStatsSection = document.getElementById('adminStatsSection');
    const adminPassword = document.getElementById('adminPassword');
    const adminLoginBtn = document.getElementById('adminLoginBtn');
    const overlay = document.getElementById('overlay');
    
    // Initialize Chart.js
    let charts = {};
    
    // Set up event listeners
    if (adminMenuItem) {
        adminMenuItem.addEventListener('click', function() {
            // Close the profile sidebar
            const profileSidebar = document.getElementById('profileSidebar');
            if (profileSidebar) {
                profileSidebar.classList.remove('active');
            }
            
            // Show the admin panel popup
            if (adminPanelPopup) {
                adminPanelPopup.classList.add('open');
                
                // Show overlay
                if (overlay) {
                    overlay.classList.add('active');
                }
                
                // Reset the auth form
                if (adminPassword) {
                    adminPassword.value = '';
                }
                
                // Show auth section, hide stats section
                if (adminAuthSection && adminStatsSection) {
                    adminAuthSection.style.display = 'block';
                    adminStatsSection.style.display = 'none';
                }
            }
        });
    }
    
    // Close button event listener
    if (closeAdminPanelPopup) {
        closeAdminPanelPopup.addEventListener('click', closeAdminPanel);
    }
    
    // Close when clicking on overlay
    if (overlay) {
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                closeAdminPanel();
            }
        });
    }
    
    // Admin login button
    if (adminLoginBtn) {
        adminLoginBtn.addEventListener('click', function() {
            // Check password
            if (adminPassword && adminPassword.value === ADMIN_PASSWORD) {
                // Hide auth section, show stats section
                adminAuthSection.style.display = 'none';
                adminStatsSection.style.display = 'block';
                
                // Load statistics
                loadAllStats();
            } else {
                // Show error
                Swal.fire({
                    icon: 'error',
                    title: 'Access Denied',
                    text: 'Incorrect admin password',
                    confirmButtonText: 'Try Again'
                });
            }
        });
    }
    
    // Tab switching
    const tabs = document.querySelectorAll('.stats-tab');
    if (tabs) {
        tabs.forEach(tab => {
            tab.addEventListener('click', function() {
                // Remove active class from all tabs
                tabs.forEach(t => t.classList.remove('active'));
                
                // Add active class to clicked tab
                this.classList.add('active');
                
                // Hide all panels
                document.querySelectorAll('.stats-panel').forEach(panel => {
                    panel.classList.remove('active');
                });
                
                // Show the selected panel
                const tabId = this.getAttribute('data-tab');
                const panel = document.getElementById(tabId);
                if (panel) {
                    panel.classList.add('active');
                    
                    // Resize charts if they exist
                    if (charts[tabId]) {
                        charts[tabId].resize();
                    }
                    
                    // If users tab is selected, load user list
                    if (tabId === 'registeredUsers' && !panel.querySelector('.user-list-loaded')) {
                        loadRegisteredUsers();
                        panel.classList.add('user-list-loaded');
                    }
                }
            });
        });
    }
    
    // Close admin panel function
    function closeAdminPanel() {
        if (adminPanelPopup) {
            adminPanelPopup.classList.remove('open');
        }
        
        if (overlay) {
            overlay.classList.remove('active');
        }
        
        // Destroy charts
        Object.values(charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        charts = {};
    }
    
    // Load all statistics
    function loadAllStats() {
        loadUserStats();
        loadActivityStats();
        loadMessageStats();
    }
    
    // Load user statistics from API
    function loadUserStats() {
        // Show loading state
        document.getElementById('totalUsersCount').textContent = '...';
        document.getElementById('newUsersToday').textContent = '...';
        document.getElementById('newUsersWeek').textContent = '...';
        document.getElementById('newUsersMonth').textContent = '...';
        
        // Fetch data from API
        fetch('/api/admin/stats/users')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    // Update statistics with real data
                    document.getElementById('totalUsersCount').textContent = data.data.total_users.toLocaleString();
                    document.getElementById('newUsersToday').textContent = data.data.new_users_today.toLocaleString();
                    document.getElementById('newUsersWeek').textContent = data.data.new_users_week.toLocaleString();
                    document.getElementById('newUsersMonth').textContent = data.data.new_users_month.toLocaleString();
                    
                    // Update most active user
                    updateMostActiveUser(data.data.most_active_user);
                    
                    // Create chart with real data
                    createUserRegistrationChart(data.data.monthly_registrations);
                } else {
                    console.error('Failed to load user statistics:', data.error);
                    showErrorState('userStats');
                }
            })
            .catch(error => {
                console.error('Error fetching user statistics:', error);
                showErrorState('userStats');
            });
    }
    
    // Update most active user card
    function updateMostActiveUser(userData) {
        const mostActiveUserCard = document.getElementById('mostActiveUser');
        if (mostActiveUserCard) {
            mostActiveUserCard.innerHTML = `
                <div class="most-active-user-avatar">
                    <img src="${userData.avatar}" alt="${userData.username}">
                </div>
                <div class="most-active-user-info">
                    <div class="most-active-user-name">${userData.username}</div>
                    <div class="most-active-user-stats">${userData.message_count} messages today</div>
                </div>
            `;
        }
    }
    
    // Create user registration chart
    function createUserRegistrationChart(monthlyData) {
        const ctx = document.getElementById('userRegistrationChart').getContext('2d');
        
        // Extract labels and data from API response
        const labels = monthlyData.map(item => item.month);
        const values = monthlyData.map(item => item.count);
        
        // Destroy existing chart if it exists
        if (charts.userStats) {
            charts.userStats.destroy();
        }
        
        // Create new chart
        charts.userStats = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'User Registrations',
                    data: values,
                    borderColor: '#7BAE37',
                    backgroundColor: 'rgba(123, 174, 55, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.parsed.y} new users`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                }
            }
        });
    }
    
    // Load activity statistics
    function loadActivityStats() {
        // Show loading state
        document.getElementById('activeUsersNow').textContent = '...';
        document.getElementById('activeUsersToday').textContent = '...';
        document.getElementById('avgDailyActiveUsers').textContent = '...';
        document.getElementById('peakActivityTime').textContent = '...';
        
        // Fetch data from API
        fetch('/api/admin/stats/activity')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    // Update statistics with real data
                    document.getElementById('activeUsersNow').textContent = data.data.active_users_now.toLocaleString();
                    document.getElementById('activeUsersToday').textContent = data.data.active_users_today.toLocaleString();
                    document.getElementById('avgDailyActiveUsers').textContent = data.data.avg_daily_active.toLocaleString();
                    document.getElementById('peakActivityTime').textContent = data.data.peak_activity_time;
                    
                    // Create chart with real data
                    createActivityChart(data.data.weekday_activity);
                } else {
                    console.error('Failed to load activity statistics:', data.error);
                    showErrorState('activityStats');
                }
            })
            .catch(error => {
                console.error('Error fetching activity statistics:', error);
                showErrorState('activityStats');
            });
    }
    
    // Create activity chart
    function createActivityChart(weekdayData) {
        const ctx = document.getElementById('userActivityChart').getContext('2d');
        
        // Extract labels and data from API response
        const labels = weekdayData.map(item => item.day);
        const activeUsers = weekdayData.map(item => item.active_users);
        const messageCount = weekdayData.map(item => item.message_count);
        
        // Destroy existing chart if it exists
        if (charts.activityStats) {
            charts.activityStats.destroy();
        }
        
        // Create new chart
        charts.activityStats = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Active Users',
                        data: activeUsers,
                        backgroundColor: 'rgba(123, 174, 55, 0.7)',
                        borderRadius: 4,
                        order: 2
                    },
                    {
                        label: 'Message Count',
                        data: messageCount,
                        backgroundColor: 'rgba(54, 162, 235, 0.5)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 2,
                        type: 'line',
                        tension: 0.4,
                        order: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                }
            }
        });
    }
    
    // Load message statistics
    function loadMessageStats() {
        // Show loading state
        document.getElementById('totalMessages').textContent = '...';
        document.getElementById('messagesToday').textContent = '...';
        document.getElementById('avgMessagesPerDay').textContent = '...';
        document.getElementById('mostActiveChat').textContent = '...';
        
        // Fetch data from API
        fetch('/api/admin/stats/messages')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    // Update statistics with real data
                    document.getElementById('totalMessages').textContent = data.data.total_messages.toLocaleString();
                    document.getElementById('messagesToday').textContent = data.data.messages_today.toLocaleString();
                    document.getElementById('avgMessagesPerDay').textContent = data.data.avg_messages_per_day.toLocaleString();
                    document.getElementById('mostActiveChat').textContent = data.data.most_active_chat;
                    
                    // Create chart with real data
                    createMessageVolumeChart(data.data.hourly_distribution);
                } else {
                    console.error('Failed to load message statistics:', data.error);
                    showErrorState('messageStats');
                }
            })
            .catch(error => {
                console.error('Error fetching message statistics:', error);
                showErrorState('messageStats');
            });
    }
    
    // Create message volume chart
    function createMessageVolumeChart(hourlyData) {
        const ctx = document.getElementById('messageVolumeChart').getContext('2d');
        
        // Extract labels and data from API response
        const labels = hourlyData.map(item => item.hour);
        const values = hourlyData.map(item => item.message_count);
        
        // Destroy existing chart if it exists
        if (charts.messageStats) {
            charts.messageStats.destroy();
        }
        
        // Create new chart
        charts.messageStats = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Messages',
                    data: values,
                    borderColor: '#7BAE37',
                    backgroundColor: 'rgba(123, 174, 55, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                }
            }
        });
    }
    
    // Load registered users list
    function loadRegisteredUsers(page = 1, limit = 10, search = '') {
        const userListContainer = document.getElementById('userListContainer');
        if (!userListContainer) return;
        
        // Show loading state
        userListContainer.innerHTML = '<div class="loading">Loading users...</div>';
        
        // Build the query parameters
        const params = new URLSearchParams({
            page: page,
            limit: limit
        });
        
        if (search) {
            params.append('search', search);
        }
        
        // Fetch user list from API
        fetch(`/api/admin/users/list?${params.toString()}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    renderUserList(data.data.users, data.data.pagination);
                } else {
                    userListContainer.innerHTML = `<div class="error">Error: ${data.error}</div>`;
                }
            })
            .catch(error => {
                userListContainer.innerHTML = `<div class="error">Error loading users: ${error.message}</div>`;
            });
    }
    
    // Render user list with pagination
    function renderUserList(users, pagination) {
        const userListContainer = document.getElementById('userListContainer');
        if (!userListContainer) return;
        
        // Create user list table
        let html = '';
        
        if (users.length === 0) {
            html = '<div class="no-results">No users found</div>';
        } else {
            html = `
                <table class="users-table">
                    <thead>
                        <tr>
                            <th>Avatar</th>
                            <th>Username</th>
                            <th>Email</th>
                            <th>Country</th>
                            <th>Status</th>
                            <th>Date Registered</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            users.forEach(user => {
                // Format date as DD.MM.YYYY
                const registeredDate = user.registered_date 
                    ? new Date(user.registered_date).toLocaleDateString('en-GB', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit'
                      }).replace(/\//g, '.')
                    : 'Unknown';
                
                html += `
                    <tr>
                        <td>
                            <div class="user-avatar">
                                <img src="${user.avatar}" alt="${user.username}">
                            </div>
                        </td>
                        <td>${user.username}</td>
                        <td>${user.email}</td>
                        <td>${user.country || '-'}</td>
                        <td>
                            <span class="status-badge ${user.is_online ? 'online' : 'offline'}">
                                ${user.is_online ? 'Online' : 'Offline'}
                            </span>
                        </td>
                        <td>${registeredDate}</td>
                        <td>
                            <button class="delete-user-btn" data-id="${user.id}" data-username="${user.username}">Delete</button>
                        </td>
                    </tr>
                `;
            });
            
            html += '</tbody></table>';
            
            // Add pagination controls
            if (pagination.pages > 1) {
                html += '<div class="pagination">';
                
                // Previous button
                if (pagination.page > 1) {
                    html += `<button class="pagination-btn" data-page="${pagination.page - 1}">Previous</button>`;
                }
                
                // Page numbers
                for (let i = 1; i <= pagination.pages; i++) {
                    if (
                        i === 1 || 
                        i === pagination.pages || 
                        (i >= pagination.page - 1 && i <= pagination.page + 1)
                    ) {
                        html += `<button class="pagination-btn ${i === pagination.page ? 'active' : ''}" data-page="${i}">${i}</button>`;
                    } else if (
                        i === pagination.page - 2 || 
                        i === pagination.page + 2
                    ) {
                        html += '<span class="pagination-ellipsis">...</span>';
                    }
                }
                
                // Next button
                if (pagination.page < pagination.pages) {
                    html += `<button class="pagination-btn" data-page="${pagination.page + 1}">Next</button>`;
                }
                
                html += '</div>';
            }
        }
        
        userListContainer.innerHTML = html;
        
        // Add event listeners for pagination buttons
        const paginationButtons = userListContainer.querySelectorAll('.pagination-btn');
        paginationButtons.forEach(button => {
            button.addEventListener('click', function() {
                const page = parseInt(this.getAttribute('data-page'));
                loadRegisteredUsers(page, pagination.limit);
            });
        });
        
        // Add event listeners for delete buttons
        const deleteButtons = userListContainer.querySelectorAll('.delete-user-btn');
        deleteButtons.forEach(button => {
            button.addEventListener('click', function() {
                const userId = this.getAttribute('data-id');
                const username = this.getAttribute('data-username');
                confirmDeleteUser(userId, username);
            });
        });
    }
    
    // Confirm user deletion
    function confirmDeleteUser(userId, username) {
        Swal.fire({
            title: 'Delete user?',
            html: `Are you sure you want to delete <strong>${username}</strong>?<br>This action cannot be undone.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete user',
            cancelButtonText: 'Cancel'
        }).then((result) => {
            if (result.isConfirmed) {
                deleteUser(userId, username);
            }
        });
    }
    
    // Delete user function
    function deleteUser(userId, username) {
        // Show loading state
        Swal.fire({
            title: 'Deleting user...',
            html: `Deleting ${username}...`,
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        
        // Call the API to delete the user
        fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                Swal.fire({
                    title: 'User deleted!',
                    html: data.message,
                    icon: 'success'
                }).then(() => {
                    // Reload the user list
                    loadRegisteredUsers();
                    // Also reload the user stats as counts have changed
                    loadUserStats();
                });
            } else {
                Swal.fire({
                    title: 'Error',
                    html: data.error || 'An error occurred while deleting the user',
                    icon: 'error'
                });
            }
        })
        .catch(error => {
            Swal.fire({
                title: 'Error',
                html: `Failed to delete user: ${error.message}`,
                icon: 'error'
            });
        });
    }
    
    // Set up search functionality for user list
    const userSearchInput = document.getElementById('userSearchInput');
    const userSearchButton = document.getElementById('userSearchButton');
    
    if (userSearchInput && userSearchButton) {
        userSearchButton.addEventListener('click', function() {
            const search = userSearchInput.value.trim();
            loadRegisteredUsers(1, 10, search);
        });
        
        userSearchInput.addEventListener('keyup', function(event) {
            if (event.key === 'Enter') {
                userSearchButton.click();
            }
        });
    }
    
    // Show error state for a panel
    function showErrorState(panelId) {
        const panel = document.getElementById(panelId);
        if (panel) {
            const statValues = panel.querySelectorAll('.stats-value');
            statValues.forEach(element => {
                if (element.textContent === '...') {
                    element.textContent = 'Error';
                    element.style.color = '#f44336';
                }
            });
        }
    }
    
    // Listen for Enter key in password field
    if (adminPassword) {
        adminPassword.addEventListener('keyup', function(event) {
            if (event.key === "Enter") {
                adminLoginBtn.click();
            }
        });
    }
});