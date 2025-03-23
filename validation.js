document.addEventListener('DOMContentLoaded', function() {
    // Check which form is present on the page
    const registrationForm = document.getElementById('registrationForm');
    const loginForm = document.getElementById('loginForm');
    
    // Registration form validation
    if (registrationForm) {
        const errorMessage = document.getElementById('errorMessage');
        
        registrationForm.addEventListener('submit', function(e) {
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
            
            // If all validations pass, submit the form (in a real app, you'd send this to a server)
            alert('Регистрация успешна!');
            registrationForm.reset();
        });
    }
    
    // Login form validation
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            // Simple validation to ensure fields are not empty
            if (!username || !password) {
                alert('Пожалуйста, заполните все поля');
                return;
            }
            
            // If validation passes, submit the form (in a real app, you'd send this to a server)
            alert('Вход выполнен!');
            loginForm.reset();
        });
    }
});
