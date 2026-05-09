document.addEventListener('DOMContentLoaded', function() {
    var tgPhoneInput = document.getElementById('tg-phone-input');
    var tgCodeInput = document.getElementById('tg-code-input');
    var tgPasswordInput = document.getElementById('tg-password-input');
    var tgSendCodeBtn = document.getElementById('tg-send-code-btn');
    var tgVerifyBtn = document.getElementById('tg-verify-btn');
    var tgPasswordBtn = document.getElementById('tg-password-btn');
    var phoneSection = document.getElementById('phone-section');
    var codeSection = document.getElementById('code-section');
    var passwordSection = document.getElementById('password-section');
    var qrSection = document.getElementById('qr-section');
    var tgShowQrBtn = document.getElementById('tg-show-qr-btn');
    var authFlow = document.getElementById('auth-flow');
    var successMessage = document.getElementById('success-message');
    var qrCodeContainer = document.getElementById('qr-code-container');
    var qrStatus = document.getElementById('qr-status');
    var currentPhone = '';
    var currentQrToken = '';
    var qrPollInterval = null;

    if (tgSendCodeBtn) {
        tgSendCodeBtn.addEventListener('click', function() {
            var phone = tgPhoneInput.value.trim();
            if (!phone) return alert('Enter phone number');
            tgSendCodeBtn.innerText = 'Sending...';
            fetch('/auth/send-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: phone })
            })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    currentPhone = phone;
                    phoneSection.style.display = 'none';
                    codeSection.style.display = 'block';
                } else {
                    alert('Error: ' + data.error);
                    tgSendCodeBtn.innerText = 'Send Verification Code';
                }
            })
            .catch(err => alert('Network error'));
        });
    }

    if (tgVerifyBtn) {
        tgVerifyBtn.addEventListener('click', function() {
            var code = tgCodeInput.value.trim();
            if (!code) return alert('Enter code');
            tgVerifyBtn.innerText = 'Verifying...';
            fetch('/auth/verify-code', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: currentPhone, code: code })
            }).then(r => {
                if (r.status === 302 || r.redirected) {
                    window.location.href = '/dashboard';
                } else {
                    return r.json().then(data => {
                        if (data.success) {
                            window.location.href = '/dashboard';
                        } else if (data.requiresPassword) {
                            codeSection.style.display = 'none';
                            passwordSection.style.display = 'block';
                        } else {
                            alert('Error: ' + (data.error || 'Check the logs'));
                            tgVerifyBtn.innerText = 'Confirm & Connect';
                        }
                    });
                }
            }).catch(err => alert('Network error'));
        });
    }

    if (tgPasswordBtn) {
        tgPasswordBtn.addEventListener('click', function() {
            var pwd = tgPasswordInput.value.trim();
            if (!pwd) return alert('Enter password');
            tgPasswordBtn.innerText = 'Unlocking...';
            
            var body = { password: pwd };
            if (currentPhone) body.phone = currentPhone;
            if (currentQrToken) body.token = currentQrToken;

            fetch('/auth/verify-password', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            }).then(r => {
                if (r.status === 302 || r.redirected) {
                    window.location.href = '/dashboard';
                } else {
                    return r.json().then(data => {
                        if (data.success) {
                            window.location.href = '/dashboard';
                        } else {
                            alert('Login failed: ' + (data.error || 'Invalid password'));
                            tgPasswordBtn.innerText = 'Unlock Account';
                        }
                    });
                }
            }).catch(err => alert('Network error'));
        });
    }

    var simpleConnectBtn = document.getElementById('tg-simple-connect-btn');
    var manualBtn = document.getElementById('show-manual-btn');
    var simpleStartSection = document.getElementById('simple-start-section');

    if (manualBtn) {
        manualBtn.addEventListener('click', function() {
            simpleStartSection.style.display = 'none';
            phoneSection.style.display = 'block';
            tgShowQrBtn.style.display = 'block';
        });
    }

    function startQrPolling(token) {
        var timeoutId = setTimeout(function() {
            clearInterval(qrPollInterval);
            qrSection.style.display = 'none';
            alert('QR code expired. Please try again.');
            if (simpleConnectBtn) simpleConnectBtn.innerText = 'Connect Telegram';
        }, 120000); // 2 minute timeout
        
        qrPollInterval = setInterval(() => {
            fetch('/auth/qr-check?token=' + token)
                .then(r => r.json())
                .then(status => {
                    if (status.done) {
                        clearInterval(qrPollInterval);
                        clearTimeout(timeoutId);
                        authFlow.style.display = 'none';
                        successMessage.style.display = 'block';
                        setTimeout(() => window.location.href = '/dashboard', 1500);
                    } else if (status.requiresPassword) {
                        clearInterval(qrPollInterval);
                        clearTimeout(timeoutId);
                        currentQrToken = token;
                        qrSection.style.display = 'none';
                        simpleStartSection.style.display = 'none';
                        passwordSection.style.display = 'block';
                    } else if (status.expired) {
                        clearInterval(qrPollInterval);
                        clearTimeout(timeoutId);
                        alert('QR code expired. Please try again.');
                        if (simpleConnectBtn) simpleConnectBtn.innerText = 'Connect Telegram';
                    }
                })
                .catch(err => {
                    console.error('QR check failed:', err);
                    clearInterval(qrPollInterval);
                    clearTimeout(timeoutId);
                    alert('Bridge connection lost. Please refresh and try again.');
                    if (simpleConnectBtn) simpleConnectBtn.innerText = 'Connect Telegram';
                });
        }, 2500);
    }

    function initiateAutoLogin() {
        if (!simpleConnectBtn) return;
        simpleConnectBtn.innerText = 'Initializing...';
        fetch('/auth/qr-start', { method: 'POST' })
            .then(r => r.json())
            .then(data => {
                if (data.qrUrl) {
                    startQrPolling(data.token);
                    window.location.href = data.qrUrl;
                    simpleConnectBtn.innerText = 'Check your Telegram App';
                    
                    setTimeout(() => {
                        qrSection.style.display = 'block';
                        qrCodeContainer.innerHTML = '';
                        new QRCode(qrCodeContainer, {
                            text: data.qrUrl,
                            width: 200, height: 200
                        });
                    }, 2000);
                }
            });
    }

    if (simpleConnectBtn) {
        simpleConnectBtn.addEventListener('click', initiateAutoLogin);
    }
    
    if (new URLSearchParams(window.location.search).get('auto') === 'true') {
        setTimeout(initiateAutoLogin, 500);
    }

    if (tgShowQrBtn) {
        tgShowQrBtn.addEventListener('click', function() {
            qrSection.style.display = 'block';
            tgShowQrBtn.style.display = 'none';
            fetch('/auth/qr-start', { method: 'POST' })
                .then(r => r.json())
                .then(data => {
                    if (data.token) {
                        qrCodeContainer.innerHTML = '';
                        new QRCode(qrCodeContainer, {
                            text: data.qrUrl,
                            width: 220,
                            height: 220,
                            colorDark : "#000000",
                            colorLight : "#ffffff",
                            correctLevel : QRCode.CorrectLevel.H
                        });

                        var tgAppLink = document.getElementById('tg-app-link');
                        if (tgAppLink) {
                            tgAppLink.href = data.qrUrl;
                            tgAppLink.style.display = 'inline-flex';
                        }

                        startQrPolling(data.token);
                    } else {
                        alert('Failed to get QR token');
                    }
                })
                .catch(err => alert('Bridge connection error'));
        });
    }

    // Email Authentication Handlers
    var showEmailAuthBtn = document.getElementById('show-email-auth-btn');
    var emailLoginSection = document.getElementById('email-login-section');
    var emailRegisterSection = document.getElementById('email-register-section');
    var forgotPasswordSection = document.getElementById('forgot-password-section');
    var resetPasswordSection = document.getElementById('reset-password-section');
    var emailAuthSection = document.getElementById('email-auth-section');

    if (showEmailAuthBtn) {
        showEmailAuthBtn.addEventListener('click', function() {
            emailAuthSection.style.display = 'none';
            emailLoginSection.style.display = 'block';
        });
    }

    var showRegisterBtn = document.getElementById('show-register-btn');
    if (showRegisterBtn) {
        showRegisterBtn.addEventListener('click', function() {
            emailLoginSection.style.display = 'none';
            emailRegisterSection.style.display = 'block';
        });
    }

    var backToLoginBtn = document.getElementById('back-to-login-btn');
    if (backToLoginBtn) {
        backToLoginBtn.addEventListener('click', function() {
            emailRegisterSection.style.display = 'none';
            emailLoginSection.style.display = 'block';
        });
    }

    var showForgotPassBtn = document.getElementById('show-forgot-password-btn');
    if (showForgotPassBtn) {
        showForgotPassBtn.addEventListener('click', function() {
            emailLoginSection.style.display = 'none';
            forgotPasswordSection.style.display = 'block';
        });
    }

    var backToLoginFromForgotBtn = document.getElementById('back-to-login-from-forgot-btn');
    if (backToLoginFromForgotBtn) {
        backToLoginFromForgotBtn.addEventListener('click', function() {
            forgotPasswordSection.style.display = 'none';
            emailLoginSection.style.display = 'block';
        });
    }

    var emailLoginBtn = document.getElementById('email-login-btn');
    if (emailLoginBtn) {
        emailLoginBtn.addEventListener('click', function() {
            var email = document.getElementById('email-input').value.trim();
            var password = document.getElementById('password-input').value.trim();
            if (!email || !password) return alert('Enter email and password');

            this.innerText = 'Logging in...';
            fetch('/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email, password: password })
            })
            .then(r => {
                if (r.status === 302 || r.redirected) {
                    window.location.href = '/dashboard';
                } else {
                    return r.json().then(data => {
                        if (data.success) {
                            window.location.href = '/dashboard';
                        } else {
                            alert('Login failed: ' + (data.error || 'Invalid credentials'));
                            this.innerText = 'Login';
                        }
                    });
                }
            })
            .catch(err => {
                alert('Network error');
                this.innerText = 'Login';
            });
        });
    }

    var emailRegisterBtn = document.getElementById('email-register-btn');
    if (emailRegisterBtn) {
        emailRegisterBtn.addEventListener('click', function() {
            var firstName = document.getElementById('register-firstname-input').value.trim();
            var email = document.getElementById('register-email-input').value.trim();
            var password = document.getElementById('register-password-input').value.trim();
            if (!firstName || !email || !password) return alert('Enter all fields');
            if (password.length < 6) return alert('Password must be at least 6 characters');

            this.innerText = 'Registering...';
            fetch('/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ firstName: firstName, email: email, password: password })
            })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    alert('Registration successful! Please check your email to verify your account.');
                    emailRegisterSection.style.display = 'none';
                    emailLoginSection.style.display = 'block';
                } else {
                    alert('Registration failed: ' + (data.error || 'Unknown error'));
                }
                this.innerText = 'Register';
            })
            .catch(err => {
                alert('Network error');
                this.innerText = 'Register';
            });
        });
    }

    var forgotPassBtn = document.getElementById('forgot-password-btn');
    if (forgotPassBtn) {
        forgotPassBtn.addEventListener('click', function() {
            var email = document.getElementById('forgot-email-input').value.trim();
            if (!email) return alert('Enter email');

            this.innerText = 'Sending...';
            fetch('/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email })
            })
            .then(r => r.json())
            .then(data => {
                alert(data.message || 'If the email exists, a reset link has been sent.');
                this.innerText = 'Send Reset Link';
            })
            .catch(err => {
                alert('Network error');
                this.innerText = 'Send Reset Link';
            });
        });
    }

    var urlParams = new URLSearchParams(window.location.search);
    var resetToken = urlParams.get('token');
    if (resetToken && window.location.pathname === '/auth/reset-password') {
        if (emailAuthSection) emailAuthSection.style.display = 'none';
        if (resetPasswordSection) resetPasswordSection.style.display = 'block';
        var resetPassBtn = document.getElementById('reset-password-btn');
        if (resetPassBtn) {
            resetPassBtn.addEventListener('click', function() {
                var password = document.getElementById('reset-password-input').value.trim();
                if (!password || password.length < 6) return alert('Password must be at least 6 characters');

                this.innerText = 'Resetting...';
                fetch('/auth/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: resetToken, password: password })
                })
                .then(r => r.json())
                .then(data => {
                    if (data.success) {
                        alert('Password reset successful! You can now log in with your new password.');
                        window.location.href = '/auth';
                    } else {
                        alert('Reset failed: ' + (data.error || 'Invalid token'));
                    }
                    this.innerText = 'Reset Password';
                })
                .catch(err => {
                    alert('Network error');
                    this.innerText = 'Reset Password';
                });
            });
        }
    }
});
