/**
 * Form validation for login and registration pages
 */

document.addEventListener('DOMContentLoaded', function() {
    // Login form validation
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        // Check if there's no error message, which means we're viewing a fresh form
        const errorMessage = document.getElementById('errorMessage');
        
        // If there's no error message and not coming back from failed login,
        // clear the form fields for a fresh start
        if (errorMessage && !errorMessage.textContent.trim()) {
            document.getElementById('username').value = '';
            document.getElementById('password').value = '';
        }
        
        loginForm.addEventListener('submit', function(e) {
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value.trim();
            
            if (username === '' || password === '') {
                e.preventDefault();
                errorMessage.textContent = 'Пожалуйста, заполните все поля';
                return false;
            }
            
            // On successful submission - we'll let the form submit normally
            // and the backend will handle the redirect
            return true;
        });
    }
    
    // Registration form validation
    const registerForm = document.getElementById('registrationForm');
    if (registerForm) {
        registerForm.addEventListener('submit', function(e) {
            const username = document.getElementById('username').value.trim();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value.trim();
            const confirmPassword = document.getElementById('confirmPassword').value.trim();
            const errorMessage = document.getElementById('errorMessage');
            
            if (username === '' || email === '' || password === '' || confirmPassword === '') {
                e.preventDefault();
                errorMessage.textContent = 'Пожалуйста, заполните все поля';
                return false;
            }
            
            if (!validateEmail(email)) {
                e.preventDefault();
                errorMessage.textContent = 'Пожалуйста, введите корректный адрес электронной почты';
                return false;
            }
            
            if (password !== confirmPassword) {
                e.preventDefault();
                errorMessage.textContent = 'Пароли не совпадают';
                return false;
            }
            
            if (password.length < 6) {
                e.preventDefault();
                errorMessage.textContent = 'Пароль должен содержать не менее 6 символов';
                return false;
            }
            
            return true;
        });
    }
    
    // Email validation helper function
    function validateEmail(email) {
        const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(String(email).toLowerCase());
    }
});