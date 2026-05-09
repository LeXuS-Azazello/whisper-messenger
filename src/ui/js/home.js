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

    var forgotPassBtn = document.getElementById('forgot-pass-btn');
    if (forgotPassBtn) {
        forgotPassBtn.onclick = (e) => {
            e.preventDefault();
            if (emailInput) emailInput.focus();
            if (statusMsg) {
                statusMsg.innerText = "Enter your email to receive a recovery link.";
                statusMsg.style.color = "#8B5CF6";
            }
        };
    }

    if (sendBtn) {
        sendBtn.onclick = () => {
            var email = emailInput ? emailInput.value.trim() : '';
            if (!email || !email.includes('@')) return alert('Please enter a valid email address');
            
            sendBtn.disabled = true;
            sendBtn.innerText = 'Sending...';
            
            fetch('/auth/email/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email })
            })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    if (authView) authView.style.display = 'none';
                    if (successView) successView.style.display = 'block';
                } else {
                    sendBtn.disabled = false;
                    sendBtn.innerText = 'Send Magic Link';
                    if (statusMsg) {
                        statusMsg.innerText = 'Error: ' + data.error;
                        statusMsg.style.color = '#ef4444';
                    }
                }
            });
        };
    }
});
