document.addEventListener('DOMContentLoaded', function() {
    var sendBtn = document.getElementById('send-link-btn');
    var emailInput = document.getElementById('email-input');
    var statusMsg = document.getElementById('status-msg');
    var authView = document.getElementById('auth-view');
    var successView = document.getElementById('success-view');

    // Check for existing session
    var sessionMatch = document.cookie.match(/session=([^;]+)/);
    if (sessionMatch) {
        window.location.href = '/dashboard';
        return;
    }

    // The forgot password and register buttons are now links to /auth with action params

    var loginBtn = document.getElementById('login-btn');
    var passwordInput = document.getElementById('password-input');

    if (loginBtn) {
        loginBtn.onclick = () => {
            var email = emailInput ? emailInput.value.trim() : '';
            var password = passwordInput ? passwordInput.value.trim() : '';
            
            if (!email || !email.includes('@')) return alert('Please enter a valid email address');
            if (!password) return alert('Please enter your password');
            
            loginBtn.disabled = true;
            loginBtn.innerText = 'Signing in...';
            
            fetch('/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email, password: password })
            })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    window.location.href = '/dashboard';
                } else {
                    loginBtn.disabled = false;
                    loginBtn.innerText = 'Sign In';
                    if (statusMsg) {
                        statusMsg.innerText = 'Error: ' + data.error;
                        statusMsg.style.color = '#ef4444';
                    }
                }
            })
            .catch(err => {
                loginBtn.disabled = false;
                loginBtn.innerText = 'Sign In';
                if (statusMsg) {
                    statusMsg.innerText = 'Network error. Please try again.';
                    statusMsg.style.color = '#ef4444';
                }
            });
        };
    }
});
