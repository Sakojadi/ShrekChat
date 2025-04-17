/**
 * Theme toggling between dark and light mode
 */

document.addEventListener('DOMContentLoaded', function() {
    const themeToggle = document.getElementById('themeToggle');
    const toggleThemeBtn = document.getElementById('toggleThemeBtn');
    const body = document.body;
    
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        body.classList.add('dark-theme');
        if (themeToggle) themeToggle.checked = true;
    }
    
    // Toggle theme via checkbox in profile sidebar
    if (themeToggle) {
        themeToggle.addEventListener('change', function() {
            if (this.checked) {
                body.classList.add('dark-theme');
                localStorage.setItem('theme', 'dark');
            } else {
                body.classList.remove('dark-theme');
                localStorage.setItem('theme', 'light');
            }
        });
    }
    
    // Toggle theme via button in header
    if (toggleThemeBtn) {
        toggleThemeBtn.addEventListener('click', function() {
            const isDarkTheme = body.classList.toggle('dark-theme');
            
            if (isDarkTheme) {
                localStorage.setItem('theme', 'dark');
                if (themeToggle) themeToggle.checked = true;
            } else {
                localStorage.setItem('theme', 'light');
                if (themeToggle) themeToggle.checked = false;
            }
        });
    }
});