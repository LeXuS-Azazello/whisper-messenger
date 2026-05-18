document.addEventListener('DOMContentLoaded', function () {
    const sessionMatch = document.cookie.match(/(?:^|;)\s*session=([^;]+)/);
    if (sessionMatch) {
        window.location.href = '/dashboard';
        return;
    }

    const loginBtn = document.getElementById('login-btn');
    const emailInput = document.getElementById('email-input');
    const passwordInput = document.getElementById('password-input');
    const statusMsg = document.getElementById('status-msg');

    if (loginBtn) {
        loginBtn.onclick = async () => {
            const email = emailInput.value.trim();
            const password = passwordInput.value.trim();

            if (!email || !password) {
                if (statusMsg) statusMsg.innerText = 'Please enter both email and password';
                return;
            }

            loginBtn.disabled = true;
            const originalText = loginBtn.innerText;
            loginBtn.innerText = 'Signing in...';

            try {
                const res = await fetch('/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await res.json();
                if (data.success || res.status === 302 || res.redirected) {
                    if (statusMsg) statusMsg.innerText = 'Login successful! Redirecting...';
                    setTimeout(() => window.location.href = '/dashboard', 600);
                } else {
                    if (statusMsg) statusMsg.innerText = 'Error: ' + (data.error || 'Login failed');
                    loginBtn.disabled = false;
                    loginBtn.innerText = originalText;
                }
            } catch (e) {
                if (statusMsg) statusMsg.innerText = 'Network error: ' + e.message;
                loginBtn.disabled = false;
                loginBtn.innerText = originalText;
            }
        };
    }
});