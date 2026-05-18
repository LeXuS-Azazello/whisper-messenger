document.addEventListener('DOMContentLoaded', function () {
    // Check if session cookie already exists and redirect to dashboard
    const sessionMatch = document.cookie.match(/session=([^;]+)/);
    if (sessionMatch) {
        window.location.href = '/dashboard';
        return;
    }

    // Elements
    const statusMsg = document.getElementById('status-msg');
    const authSubtitle = document.getElementById('auth-subtitle');

    // Forms
    const loginSection = document.getElementById('login-section');
    const registerSection = document.getElementById('register-section');
    const forgotSection = document.getElementById('forgot-section');
    const resetSection = document.getElementById('reset-section');

    // Login Form Fields
    const emailInput = document.getElementById('email-input');
    const passwordInput = document.getElementById('password-input');
    const loginBtn = document.getElementById('login-btn');

    // Register Form Fields
    const registerFirstname = document.getElementById('register-firstname-input');
    const registerEmail = document.getElementById('register-email-input');
    const registerPassword = document.getElementById('register-password-input');
    const registerBtn = document.getElementById('register-btn');
    const passwordStrength = document.getElementById('password-strength');
    const strengthBar = document.getElementById('strength-bar');
    const strengthText = document.getElementById('strength-text');

    // Forgot Password Form Fields
    const forgotEmail = document.getElementById('forgot-email-input');
    const forgotBtn = document.getElementById('forgot-btn');

    // Reset Password Form Fields
    const resetPassword = document.getElementById('reset-password-input');
    const resetBtn = document.getElementById('reset-btn');

    // SPA Links
    const registerLink = document.getElementById('register-link');
    const loginLink = document.getElementById('login-link');
    const forgotPassLink = document.getElementById('forgot-pass-link');
    const backToLoginLink = document.getElementById('back-to-login-link');
    const resetBackLink = document.getElementById('reset-back-link');

    // Helper: Show alert message
    function showAlert(type, message) {
        if (!statusMsg) return;
        statusMsg.innerText = message;
        statusMsg.className = 'status-msg ' + type;
        statusMsg.style.display = 'block';
    }

    // Helper: Clear alert message
    function clearAlert() {
        if (!statusMsg) return;
        statusMsg.style.display = 'none';
        statusMsg.className = 'status-msg';
        statusMsg.innerText = '';
    }

    // Helper: Set button loading state
    function setButtonLoading(btn, loading, defaultText) {
        if (!btn) return;
        if (loading) {
            btn.disabled = true;
            btn.dataset.originalText = btn.innerText;
            btn.innerHTML = '<span class="loading-spinner" style="display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(0,0,0,0.2); border-top-color: #000; border-radius: 50%; animation: spin 0.8s linear infinite; margin-right: 8px; vertical-align: middle;"></span> Please wait...';
        } else {
            btn.disabled = false;
            btn.innerText = defaultText || btn.dataset.originalText || 'Submit';
        }
    }

    // Helper: Transition to active form section smoothly
    function transitionToSection(targetSectionName) {
        clearAlert();
        
        // Hide all form sections
        const sections = [loginSection, registerSection, forgotSection, resetSection];
        sections.forEach(sec => {
            if (sec) sec.style.display = 'none';
        });

        // Show the target section and update subtitle
        if (targetSectionName === 'login') {
            if (loginSection) loginSection.style.display = 'block';
            if (authSubtitle) authSubtitle.innerText = 'Personalized voice message transcription for Telegram, WhatsApp & Meta.';
        } else if (targetSectionName === 'register') {
            if (registerSection) registerSection.style.display = 'block';
            if (authSubtitle) authSubtitle.innerText = 'Create an account to start transcribing your voice messages.';
        } else if (targetSectionName === 'forgot') {
            if (forgotSection) forgotSection.style.display = 'block';
            if (authSubtitle) authSubtitle.innerText = "We'll send you a secure link to recover and reset your password.";
        } else if (targetSectionName === 'reset') {
            if (resetSection) resetSection.style.display = 'block';
            if (authSubtitle) authSubtitle.innerText = 'Enter a secure new password for your account below.';
        }
    }

    // SPA Router using pushState
    function navigateTo(path, viewName) {
        history.pushState({ view: viewName }, '', path);
        transitionToSection(viewName);
    }

    // Bind SPA link clicks
    if (registerLink) {
        registerLink.addEventListener('click', function(e) {
            e.preventDefault();
            navigateTo('/register', 'register');
        });
    }

    if (loginLink) {
        loginLink.addEventListener('click', function(e) {
            e.preventDefault();
            navigateTo('/login', 'login');
        });
    }

    if (forgotPassLink) {
        forgotPassLink.addEventListener('click', function(e) {
            e.preventDefault();
            navigateTo('/forgot-password', 'forgot');
        });
    }

    if (backToLoginLink) {
        backToLoginLink.addEventListener('click', function(e) {
            e.preventDefault();
            navigateTo('/login', 'login');
        });
    }

    if (resetBackLink) {
        resetBackLink.addEventListener('click', function(e) {
            e.preventDefault();
            navigateTo('/login', 'login');
        });
    }

    // Listen to browser Back/Forward navigation
    window.addEventListener('popstate', function(e) {
        const path = window.location.pathname;
        if (path === '/register' || path === '/signup') {
            transitionToSection('register');
        } else if (path === '/forgot-password') {
            transitionToSection('forgot');
        } else if (path === '/reset-password') {
            transitionToSection('reset');
        } else {
            transitionToSection('login');
        }
    });

    // Check for success URL parameters on load
    const urlParams = new URLSearchParams(window.location.search);
    const successType = urlParams.get('success');
    if (successType === 'reset') {
        showAlert('success', 'Password reset complete! Please sign in with your new password.');
    } else if (successType === 'verified') {
        showAlert('success', 'Email successfully verified! You can now log in.');
    } else if (successType === 'registered') {
        showAlert('success', 'Account created! Please check your email to verify your account.');
    }

    // Check action query param fallback for old URLs
    const actionParam = urlParams.get('action');
    if (actionParam === 'register') {
        transitionToSection('register');
    } else if (actionParam === 'forgot') {
        transitionToSection('forgot');
    }

    // Password strength estimation logic
    function estimatePasswordStrength(pwd) {
        let score = 0;
        if (pwd.length >= 8) score++;
        if (pwd.length >= 12) score++;
        if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
        if (/\d/.test(pwd)) score++;
        if (/[^a-zA-Z0-9]/.test(pwd)) score++;

        if (score <= 2) return { level: 'weak', text: 'Weak' };
        if (score <= 4) return { level: 'medium', text: 'Medium' };
        return { level: 'strong', text: 'Strong' };
    }

    if (registerPassword) {
        registerPassword.addEventListener('input', function () {
            const val = this.value;
            if (!val || val.length === 0) {
                if (passwordStrength) passwordStrength.style.display = 'none';
                return;
            }

            if (passwordStrength) passwordStrength.style.display = 'block';
            const strength = estimatePasswordStrength(val);

            if (strengthBar) {
                strengthBar.className = 'password-strength-bar ' + strength.level;
            }
            if (strengthText) {
                strengthText.innerText = strength.text;
                strengthText.style.color = strength.level === 'weak' ? '#ef4444' :
                                           strength.level === 'medium' ? '#f59e0b' : '#10b981';
            }
        });
    }

    // Submit: Email Login
    if (loginBtn) {
        loginBtn.addEventListener('click', async function () {
            const email = emailInput.value.trim();
            const password = passwordInput.value.trim();

            if (!email || !password) {
                showAlert('error', 'Please enter both your email and password.');
                return;
            }

            if (!email.includes('@')) {
                showAlert('error', 'Please enter a valid email address.');
                return;
            }

            setButtonLoading(loginBtn, true);
            clearAlert();

            try {
                const res = await fetch('/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await res.json();
                if (data.success || res.status === 302 || res.redirected) {
                    showAlert('success', 'Sign in successful! Redirecting...');
                    setTimeout(() => window.location.href = '/dashboard', 600);
                } else {
                    showAlert('error', data.error || 'Invalid email or password.');
                    setButtonLoading(loginBtn, false, 'Sign In');
                }
            } catch (err) {
                showAlert('error', 'Network error. Please check your connection.');
                setButtonLoading(loginBtn, false, 'Sign In');
            }
        });
    }

    // Submit: Email Registration
    if (registerBtn) {
        registerBtn.addEventListener('click', async function () {
            const firstName = registerFirstname.value.trim();
            const email = registerEmail.value.trim();
            const password = registerPassword.value.trim();

            if (!firstName || !email || !password) {
                showAlert('error', 'Please fill out all registration fields.');
                return;
            }

            if (!email.includes('@')) {
                showAlert('error', 'Please enter a valid email address.');
                return;
            }

            if (password.length < 6) {
                showAlert('error', 'Password must be at least 6 characters long.');
                return;
            }

            setButtonLoading(registerBtn, true);
            clearAlert();

            try {
                const res = await fetch('/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ firstName, email, password })
                });

                const data = await res.json();
                if (data.success) {
                    showAlert('success', 'Registration successful! Verification link sent to your email.');
                    registerFirstname.value = '';
                    registerEmail.value = '';
                    registerPassword.value = '';
                    if (passwordStrength) passwordStrength.style.display = 'none';
                    setTimeout(() => {
                        navigateTo('/login?success=registered', 'login');
                    }, 2500);
                } else {
                    showAlert('error', data.error || 'Registration failed. Please try again.');
                    setButtonLoading(registerBtn, false, 'Create Account');
                }
            } catch (err) {
                showAlert('error', 'Network error. Please try again.');
                setButtonLoading(registerBtn, false, 'Create Account');
            }
        });
    }

    // Submit: Forgot Password
    if (forgotBtn) {
        forgotBtn.addEventListener('click', async function () {
            const email = forgotEmail.value.trim();

            if (!email || !email.includes('@')) {
                showAlert('error', 'Please enter a valid email address.');
                return;
            }

            setButtonLoading(forgotBtn, true);
            clearAlert();

            try {
                const res = await fetch('/auth/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });

                const data = await res.json();
                showAlert('success', data.message || 'If the email exists, a reset link has been sent.');
                forgotEmail.value = '';
                setTimeout(() => {
                    navigateTo('/login', 'login');
                }, 3000);
            } catch (err) {
                showAlert('error', 'Network error. Please try again.');
                setButtonLoading(forgotBtn, false, 'Send Recovery Link');
            }
        });
    }

    // Submit: Reset Password
    if (resetBtn) {
        resetBtn.addEventListener('click', async function () {
            const password = resetPassword.value.trim();
            const token = urlParams.get('token');

            if (!token) {
                showAlert('error', 'Invalid or expired password reset link.');
                return;
            }

            if (!password || password.length < 6) {
                showAlert('error', 'Password must be at least 6 characters long.');
                return;
            }

            setButtonLoading(resetBtn, true);
            clearAlert();

            try {
                const res = await fetch('/auth/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, password })
                });

                const data = await res.json();
                if (data.success) {
                    showAlert('success', 'Password successfully reset! Redirecting...');
                    resetPassword.value = '';
                    setTimeout(() => {
                        window.location.href = '/login?success=reset';
                    }, 1500);
                } else {
                    showAlert('error', data.error || 'Reset failed. Token might be expired.');
                    setButtonLoading(resetBtn, false, 'Update Password');
                }
            } catch (err) {
                showAlert('error', 'Network error. Please try again.');
                setButtonLoading(resetBtn, false, 'Update Password');
            }
        });
    }
});
