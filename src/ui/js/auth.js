document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const tgPhoneInput = document.getElementById('tg-phone-input');
    const tgCodeInput = document.getElementById('tg-code-input');
    const tgPasswordInput = document.getElementById('tg-password-input');
    const tgSendCodeBtn = document.getElementById('tg-send-code-btn');
    const tgVerifyBtn = document.getElementById('tg-verify-btn');
    const tgPasswordBtn = document.getElementById('tg-password-btn');
    const phoneSection = document.getElementById('phone-section');
    const codeSection = document.getElementById('code-section');
    const passwordSection = document.getElementById('password-section');
    const qrSection = document.getElementById('qr-section');
    const tgShowQrBtn = document.getElementById('tg-show-qr-btn');
    const authFlow = document.getElementById('auth-flow');
    const successMessage = document.getElementById('success-message');
    const qrCodeContainer = document.getElementById('qr-code-container');
    const qrStatus = document.getElementById('qr-status');

    // Email auth elements
    const showEmailAuthBtn = document.getElementById('show-email-auth-btn');
    const emailLoginSection = document.getElementById('email-login-section');
    const emailRegisterSection = document.getElementById('email-register-section');
    const forgotPasswordSection = document.getElementById('forgot-password-section');
    const resetPasswordSection = document.getElementById('reset-password-section');
    const emailAuthSection = document.getElementById('email-auth-section');

    // Email form elements
    const emailInput = document.getElementById('email-input');
    const passwordInput = document.getElementById('password-input');
    const emailLoginBtn = document.getElementById('email-login-btn');

    const registerFirstNameInput = document.getElementById('register-firstname-input');
    const registerEmailInput = document.getElementById('register-email-input');
    const registerPasswordInput = document.getElementById('register-password-input');
    const emailRegisterBtn = document.getElementById('email-register-btn');

    const forgotEmailInput = document.getElementById('forgot-email-input');
    const forgotPasswordBtn = document.getElementById('forgot-password-btn');

    const resetPasswordInput = document.getElementById('reset-password-input');
    const resetPasswordBtn = document.getElementById('reset-password-btn');

    // Navigation buttons
    const manualBtn = document.getElementById('show-manual-btn');
    const simpleConnectBtn = document.getElementById('tg-simple-connect-btn');
    const simpleStartSection = document.getElementById('simple-start-section');
    const showRegisterBtn = document.getElementById('show-register-btn');
    const backToLoginBtn = document.getElementById('back-to-login-btn');
    const showForgotPassBtn = document.getElementById('show-forgot-password-btn');
    const backToLoginFromForgotBtn = document.getElementById('back-to-login-from-forgot-btn');
    const backToPhoneBtn = document.getElementById('back-to-phone-btn');
    const backToSimpleBtn = document.getElementById('back-to-simple-btn');

    // State
    let currentPhone = '';
    let currentQrToken = '';
    let qrPollInterval = null;
    let qrTimeoutId = null;

    // Utility functions
    function showMessage(type, text, containerId = 'auth-flow', prepend = false) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const messageHtml = `
            <div class="message ${type}" style="${prepend ? 'margin-bottom: 1rem;' : ''}">
                ${type === 'error' ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>' : ''}
                ${type === 'success' ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                ${type === 'warning' ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>' : ''}
                ${text}
            </div>
        `;

        if (prepend) {
            container.insertAdjacentHTML('afterbegin', messageHtml);
        } else {
            // Remove existing messages
            container.querySelectorAll('.message').forEach(el => el.remove());
            container.insertAdjacentHTML('afterbegin', messageHtml);
        }
    }

    function clearMessages(containerId = 'auth-flow') {
        const container = document.getElementById(containerId);
        if (container) {
            container.querySelectorAll('.message').forEach(el => el.remove());
        }
    }

    function setButtonLoading(btn, loading, defaultText = '') {
        if (!btn) return;
        const textSpan = btn.querySelector('.btn-text');
        if (loading) {
            btn.disabled = true;
            if (textSpan) {
                textSpan.innerHTML = '<span class="loading-spinner"></span> Please wait...';
            } else {
                btn.dataset.originalText = btn.innerText;
                btn.innerText = 'Please wait...';
            }
        } else {
            btn.disabled = false;
            if (textSpan) {
                textSpan.innerText = defaultText || btn.dataset.originalText || 'Submit';
            } else {
                btn.innerText = defaultText || btn.dataset.originalText || 'Submit';
            }
        }
    }

    function showSection(sectionId) {
        document.querySelectorAll('.auth-section').forEach(el => {
            el.style.display = 'none';
        });
        const target = document.getElementById(sectionId);
        if (target) {
            target.style.display = 'block';
        }
    }

    function calculatePasswordStrength(password) {
        let score = 0;
        if (password.length >= 8) score++;
        if (password.length >= 12) score++;
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
        if (/\d/.test(password)) score++;
        if (/[^a-zA-Z0-9]/.test(password)) score++;

        if (score <= 2) return { level: 'weak', text: 'Weak' };
        if (score <= 3) return { level: 'medium', text: 'Medium' };
        return { level: 'strong', text: 'Strong' };
    }

    // Telegram auth is now handled via tdweb QR code on the main landing page (/).
    // This page is only for email/password and other platform linking.

    // All Telegram authentication (QR code, phone, 2FA) has been moved to pure tdweb.
    // It is now performed on the main landing page using TdClient from tdweb.
    // This page (/auth) is only for email/password accounts and linking other platforms.
});
    }

    if (backToSimpleBtn) {
        backToSimpleBtn.addEventListener('click', () => {
            showSection('simple-start-section');
            phoneSection.style.display = 'none';
            clearMessages();
        });
    }

    if (backToPhoneBtn) {
        backToPhoneBtn.addEventListener('click', () => {
            showSection('phone-section');
            codeSection.style.display = 'none';
            clearMessages();
        });
    }

    // Send code
    if (tgSendCodeBtn) {
        tgSendCodeBtn.addEventListener('click', function() {
            const phone = tgPhoneInput.value.trim();
            if (!phone) {
                showMessage('error', 'Please enter your phone number', 'auth-flow');
                tgPhoneInput.classList.add('error');
                return;
            }
            tgPhoneInput.classList.remove('error');

            setButtonLoading(this, true);
            clearMessages();

            fetch('/auth/send-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: phone })
            })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    currentPhone = phone;
                    showSection('code-section');
                    showMessage('success', 'Verification code sent! Check your Telegram app.', 'auth-flow');
                } else {
                    showMessage('error', data.error || 'Failed to send code', 'auth-flow');
                }
            })
            .catch(err => {
                showMessage('error', 'Network error. Please try again.', 'auth-flow');
            })
            .finally(() => {
                setButtonLoading(this, false, 'Send Verification Code');
            });
        });
    }

    // Verify code
    if (tgVerifyBtn) {
        tgVerifyBtn.addEventListener('click', function() {
            const code = tgCodeInput.value.trim();
            if (!code) {
                showMessage('error', 'Please enter the verification code', 'auth-flow');
                tgCodeInput.classList.add('error');
                return;
            }
            tgCodeInput.classList.remove('error');

            setButtonLoading(this, true);
            clearMessages();

            fetch('/auth/verify-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: currentPhone, code: code })
            })
            .then(r => {
                if (r.status === 302 || r.redirected) {
                    window.location.href = '/dashboard';
                    return;
                }
                return r.json().then(data => {
                    if (data.success) {
                        showMessage('success', 'Successfully connected! Redirecting...', 'auth-flow');
                        setTimeout(() => window.location.href = '/dashboard', 1500);
                    } else if (data.requiresPassword) {
                        showSection('password-section');
                        showMessage('warning', 'Two-factor authentication is enabled. Please enter your password.', 'auth-flow');
                    } else {
                        showMessage('error', data.error || 'Verification failed. Please try again.', 'auth-flow');
                    }
                });
            })
            .catch(err => {
                showMessage('error', 'Network error. Please try again.', 'auth-flow');
            })
            .finally(() => {
                setButtonLoading(this, false, 'Confirm & Connect');
            });
        });
    }

    // Verify password (2FA)
    if (tgPasswordBtn) {
        tgPasswordBtn.addEventListener('click', function() {
            const pwd = tgPasswordInput.value.trim();
            if (!pwd) {
                showMessage('error', 'Please enter your password', 'auth-flow');
                tgPasswordInput.classList.add('error');
                return;
            }
            tgPasswordInput.classList.remove('error');

            setButtonLoading(this, true);
            clearMessages();

            const body = { password: pwd };
            if (currentPhone) body.phone = currentPhone;
            if (currentQrToken) body.token = currentQrToken;

            fetch('/auth/verify-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })
            .then(r => {
                if (r.status === 302 || r.redirected) {
                    window.location.href = '/dashboard';
                    return;
                }
                return r.json().then(data => {
                    if (data.success) {
                        showMessage('success', 'Successfully connected! Redirecting...', 'auth-flow');
                        setTimeout(() => window.location.href = '/dashboard', 1500);
                    } else {
                        showMessage('error', data.error || 'Invalid password', 'auth-flow');
                        tgPasswordInput.classList.add('error');
                    }
                });
            })
            .catch(err => {
                showMessage('error', 'Network error. Please try again.', 'auth-flow');
            })
            .finally(() => {
                setButtonLoading(this, false, 'Unlock Account');
            });
        });
    }

    // QR Code flow
    function startQrPolling(token) {
        clearTimeout(qrTimeoutId);
        clearInterval(qrPollInterval);

        qrTimeoutId = setTimeout(() => {
            clearInterval(qrPollInterval);
            qrSection.style.display = 'none';
            showMessage('warning', 'QR code expired. Please try again.', 'auth-flow');
            if (simpleConnectBtn) {
                simpleConnectBtn.disabled = false;
                simpleConnectBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 8px;"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg> Connect Telegram Now';
            }
        }, 120000);

        qrPollInterval = setInterval(() => {
            fetch('/auth/qr-check?token=' + token)
                .then(r => r.json())
                .then(status => {
                    if (status.done) {
                        clearInterval(qrPollInterval);
                        clearTimeout(qrTimeoutId);
                        authFlow.style.display = 'none';
                        successMessage.style.display = 'block';
                        setTimeout(() => window.location.href = '/dashboard', 1500);
                    } else if (status.requiresPassword) {
                        clearInterval(qrPollInterval);
                        clearTimeout(qrTimeoutId);
                        currentQrToken = token;
                        qrSection.style.display = 'none';
                        simpleStartSection.style.display = 'none';
                        showSection('password-section');
                        showMessage('warning', 'Two-factor authentication required. Please enter your password.', 'auth-flow');
                    } else if (status.expired) {
                        clearInterval(qrPollInterval);
                        clearTimeout(qrTimeoutId);
                        showMessage('warning', 'QR code expired. Please try again.', 'auth-flow');
                        if (simpleConnectBtn) {
                            simpleConnectBtn.disabled = false;
                            simpleConnectBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 8px;"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg> Connect Telegram Now';
                        }
                    }
                })
                .catch(err => {
                    console.error('QR check failed:', err);
                    clearInterval(qrPollInterval);
                    clearTimeout(qrTimeoutId);
                    showMessage('error', 'Connection lost. Please refresh and try again.', 'auth-flow');
                    if (simpleConnectBtn) {
                        simpleConnectBtn.disabled = false;
                        simpleConnectBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 8px;"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg> Connect Telegram Now';
                    }
                });
        }, 2500);
    }

    if (tgShowQrBtn) {
        tgShowQrBtn.addEventListener('click', function() {
            qrSection.style.display = 'block';
            tgShowQrBtn.style.display = 'none';
            simpleStartSection.style.display = 'none';

            setButtonLoading(this, true);

            fetch('/auth/qr-start', { method: 'POST' })
                .then(r => r.json())
                .then(data => {
                    if (data.token) {
                        qrCodeContainer.innerHTML = '';
                        if (data.qrDataUrl) {
                            qrCodeContainer.innerHTML = `<img src="${data.qrDataUrl}" width="220" height="220" />`;
                        } else if (window.QRCode) {
                            new QRCode(qrCodeContainer, {
                                text: data.qrUrl,
                                width: 220,
                                height: 220,
                                colorDark: "#000000",
                                colorLight: "#ffffff",
                                correctLevel: QRCode.CorrectLevel.H
                            });
                        }

                        const tgAppLink = document.getElementById('tg-app-link');
                        if (tgAppLink) {
                            tgAppLink.href = data.qrUrl;
                            tgAppLink.style.display = 'inline-flex';
                        }

                        startQrPolling(data.token);
                    } else {
                        showMessage('error', 'Failed to generate QR code', 'auth-flow');
                        tgShowQrBtn.style.display = 'block';
                    }
                })
                .catch(err => {
                    showMessage('error', 'Bridge connection error', 'auth-flow');
                    tgShowQrBtn.style.display = 'block';
                })
                .finally(() => {
                    setButtonLoading(tgShowQrBtn, false, 'Login with QR Code');
                });
        });
    }

    // Email authentication sections navigation
    if (showEmailAuthBtn) {
        showEmailAuthBtn.addEventListener('click', () => {
            emailAuthSection.style.display = 'none';
            showSection('email-login-section');
            clearMessages();
        });
    }

    if (showRegisterBtn) {
        showRegisterBtn.addEventListener('click', () => {
            showSection('email-register-section');
            clearMessages();
        });
    }

    if (backToLoginBtn) {
        backToLoginBtn.addEventListener('click', () => {
            showSection('email-login-section');
            clearMessages();
        });
    }

    if (showForgotPassBtn) {
        showForgotPassBtn.addEventListener('click', () => {
            showSection('forgot-password-section');
            clearMessages();
        });
    }

    if (backToLoginFromForgotBtn) {
        backToLoginFromForgotBtn.addEventListener('click', () => {
            showSection('email-login-section');
            clearMessages();
        });
    }

    // Password strength indicator
    if (registerPasswordInput) {
        registerPasswordInput.addEventListener('input', function() {
            const strength = calculatePasswordStrength(this.value);
            const strengthBar = document.getElementById('strength-bar');
            const strengthText = document.getElementById('strength-text');
            const strengthContainer = document.getElementById('password-strength');

            if (this.value.length === 0) {
                strengthContainer.style.display = 'none';
                return;
            }

            strengthContainer.style.display = 'block';
            strengthBar.className = 'password-strength-bar ' + strength.level;
            strengthText.innerText = strength.text;
            strengthText.style.color = strength.level === 'weak' ? 'var(--danger)' :
                                       strength.level === 'medium' ? 'var(--warning)' : 'var(--success)';
        });
    }

    // Email login
    if (emailLoginBtn) {
        emailLoginBtn.addEventListener('click', function() {
            const email = emailInput.value.trim();
            const password = passwordInput.value.trim();

            if (!email || !password) {
                showMessage('error', 'Please enter both email and password', 'email-login-section');
                return;
            }

            if (!email.includes('@')) {
                showMessage('error', 'Please enter a valid email address', 'email-login-section');
                emailInput.classList.add('error');
                return;
            }

            setButtonLoading(this, true);
            clearMessages();

            fetch('/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email, password: password })
            })
            .then(r => {
                if (r.status === 302 || r.redirected) {
                    window.location.href = '/dashboard';
                    return;
                }
                return r.json().then(data => {
                    if (data.success) {
                        showMessage('success', 'Login successful! Redirecting...', 'email-login-section');
                        setTimeout(() => window.location.href = '/dashboard', 1000);
                    } else {
                        showMessage('error', data.error || 'Invalid credentials', 'email-login-section');
                        passwordInput.classList.add('error');
                    }
                });
            })
            .catch(err => {
                showMessage('error', 'Network error. Please try again.', 'email-login-section');
            })
            .finally(() => {
                setButtonLoading(this, false, 'Sign In');
            });
        });
    }

    // Email registration
    if (emailRegisterBtn) {
        emailRegisterBtn.addEventListener('click', function() {
            const firstName = registerFirstNameInput.value.trim();
            const email = registerEmailInput.value.trim();
            const password = registerPasswordInput.value.trim();

            if (!firstName || !email || !password) {
                showMessage('error', 'Please fill in all fields', 'email-register-section');
                return;
            }

            if (!email.includes('@')) {
                showMessage('error', 'Please enter a valid email address', 'email-register-section');
                return;
            }

            if (password.length < 6) {
                showMessage('error', 'Password must be at least 6 characters', 'email-register-section');
                return;
            }

            setButtonLoading(this, true);
            clearMessages();

            fetch('/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ firstName: firstName, email: email, password: password })
            })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    showMessage('success', 'Registration successful! Please check your email to verify your account.', 'email-register-section');
                    setTimeout(() => {
                        showSection('email-login-section');
                    }, 2500);
                } else {
                    showMessage('error', data.error || 'Registration failed', 'email-register-section');
                }
            })
            .catch(err => {
                showMessage('error', 'Network error. Please try again.', 'email-register-section');
            })
            .finally(() => {
                setButtonLoading(this, false, 'Create Account');
            });
        });
    }

    // Forgot password
    if (forgotPasswordBtn) {
        forgotPasswordBtn.addEventListener('click', function() {
            const email = forgotEmailInput.value.trim();

            if (!email || !email.includes('@')) {
                showMessage('error', 'Please enter a valid email address', 'forgot-password-section');
                return;
            }

            setButtonLoading(this, true);
            clearMessages();

            fetch('/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email })
            })
            .then(r => r.json())
            .then(data => {
                showMessage('success', data.message || 'If the email exists, a reset link has been sent.', 'forgot-password-section');
                setTimeout(() => {
                    showSection('email-login-section');
                    emailInput.value = email;
                }, 2000);
            })
            .catch(err => {
                showMessage('error', 'Network error. Please try again.', 'forgot-password-section');
            })
            .finally(() => {
                setButtonLoading(this, false, 'Send Reset Link');
            });
        });
    }

    // Reset password (from email link)
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    if (action === 'register') {
        emailAuthSection.style.display = 'none';
        showSection('email-register-section');
    } else if (action === 'forgot') {
        emailAuthSection.style.display = 'none';
        showSection('forgot-password-section');
    }

    const resetToken = urlParams.get('token');
    if (resetToken && window.location.pathname === '/auth/reset-password') {
        if (emailAuthSection) emailAuthSection.style.display = 'none';
        if (resetPasswordSection) resetPasswordSection.style.display = 'block';

        if (resetPasswordBtn) {
            resetPasswordBtn.addEventListener('click', function() {
                const password = resetPasswordInput.value.trim();

                if (!password || password.length < 6) {
                    showMessage('error', 'Password must be at least 6 characters', 'reset-password-section');
                    return;
                }

                setButtonLoading(this, true);
                clearMessages();

                fetch('/auth/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: resetToken, password: password })
                })
                .then(r => r.json())
                .then(data => {
                    if (data.success) {
                        showMessage('success', 'Password reset successful! Redirecting to login...', 'reset-password-section');
                        setTimeout(() => {
                            window.location.href = '/auth?reset=success';
                        }, 1500);
                    } else {
                        showMessage('error', data.error || 'Reset failed', 'reset-password-section');
                    }
                })
                .catch(err => {
                    showMessage('error', 'Network error. Please try again.', 'reset-password-section');
                })
                .finally(() => {
                    setButtonLoading(this, false, 'Reset Password');
                });
            });
        }
    }

    // Auto-focus first input on section show
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.target.style.display === 'block') {
                const firstInput = mutation.target.querySelector('input');
                if (firstInput) firstInput.focus();
            }
        });
    });

    document.querySelectorAll('.auth-section').forEach(section => {
        observer.observe(section, { attributes: true, attributeFilter: ['style'] });
    });

    // Clear error on input
    document.querySelectorAll('.input-field').forEach(input => {
        input.addEventListener('input', () => input.classList.remove('error'));
    });
});
