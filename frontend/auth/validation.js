document.addEventListener('DOMContentLoaded', function() {
    // Check which form is present on the page
    const registrationForm = document.getElementById('registrationForm');
    const loginForm = document.getElementById('loginForm');
    
    // Backend API URL
    const API_URL = 'http://localhost:8000/api';
    
    // Registration form validation
    if (registrationForm) {
        const errorMessage = document.getElementById('errorMessage');
        
        registrationForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            
            // Reset error message
            errorMessage.textContent = '';
            
            // Validate empty fields
            if (!username || !email || !password || !confirmPassword) {
                errorMessage.textContent = 'Пожалуйста, заполните все поля';
                return;
            }
            
            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                errorMessage.textContent = 'Пожалуйста, введите корректный email';
                return;
            }
            
            // Validate password match
            if (password !== confirmPassword) {
                errorMessage.textContent = 'Пароли не совпадают';
                return;
            }
            
            // If validation passes, submit to backend
            try {
                const response = await fetch(`${API_URL}/auth/register`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        username,
                        email,
                        password
                    })
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    // Handle server validation errors
                    errorMessage.textContent = data.detail || 'Ошибка при регистрации';
                    return;
                }
                
                // Registration successful
                alert('Регистрация успешна! Теперь вы можете войти.');
                window.location.href = 'login.html';
            } catch (error) {
                console.error('Error during registration:', error);
                errorMessage.textContent = 'Произошла ошибка при подключении к серверу';
            }
        });
    }
    
    // Login form validation
    if (loginForm) {
        const errorMessage = document.getElementById('loginErrorMessage');
        
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            // Reset error message
            errorMessage.textContent = '';
            
            // Simple validation to ensure fields are not empty
            if (!username || !password) {
                errorMessage.textContent = 'Пожалуйста, заполните все поля';
                return;
            }
            
            // Send login request to backend
            try {
                // Create FormData for the login endpoint (OAuth2 format)
                const formData = new FormData();
                formData.append('username', username);
                formData.append('password', password);
                
                const response = await fetch(`${API_URL}/auth/login`, {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    errorMessage.textContent = data.detail || 'Неверное имя пользователя или пароль';
                    return;
                }
                
                // Store the token and user info in localStorage
                localStorage.setItem('token', data.access_token);
                localStorage.setItem('user', JSON.stringify(data.user));
                
                // Redirect to chat page
                window.location.href = '../chat.html';
            } catch (error) {
                console.error('Error during login:', error);
                errorMessage.textContent = 'Произошла ошибка при подключении к серверу';
            }
        });
    }
});
