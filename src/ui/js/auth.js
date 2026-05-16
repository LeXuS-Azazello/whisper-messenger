document.addEventListener('DOMContentLoaded', function () {
    // Elements
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
    const showRegisterBtn = document.getElementById('show-register-btn');
    const backToLoginBtn = document.getElementById('back-to-login-btn');
    const showForgotPassBtn = document.getElementById('show-forgot-password-btn');
    const backToLoginFromForgotBtn = document.getElementById('back-to-login-from-forgot-btn');

    // State
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

    // Telegram auth removed from this page.
    // It is now performed in the dashboard after email/google login.

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
    registerPasswordInput.addEventListener('input', function () {
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
    emailLoginBtn.addEventListener('click', function () {
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
    emailRegisterBtn.addEventListener('click', function () {
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
    forgotPasswordBtn.addEventListener('click', function () {
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
        resetPasswordBtn.addEventListener('click', function () {
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

document.querySelectorAll('.input-field').forEach(input => {
    input.addEventListener('input', () => input.classList.remove('error'));
});

}); // End of DOMContentLoaded
