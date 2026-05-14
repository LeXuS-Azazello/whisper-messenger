/** @jsxImportSource preact */
import React from 'preact/compat';
import { render } from 'preact-render-to-string';

interface Message {
    type: 'error' | 'success' | 'warning' | 'info';
    text: string;
}

export const renderAuthPage = (error?: string, isAuthenticated?: boolean, origin?: string, successMessage?: string) => {
    if (isAuthenticated) {
        return "<!DOCTYPE html>" + render(
            <html lang="en">
                <head>
                    <meta charSet="UTF-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                    <title>Redirecting...</title>
                    <script dangerouslySetInnerHTML={{ __html: 'window.location.href = "/dashboard";' }} />
                </head>
                <body />
            </html>
        );
    }

    // Email verification success page
    if (successMessage === 'verified') {
        return "<!DOCTYPE html>" + render(
            <html lang="en">
                <head>
                    <meta charSet="UTF-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                    <title>Email Verified - Echo Messenger</title>
                    <link rel="preconnect" href="https://fonts.googleapis.com" />
                    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet" />
                    <link rel="stylesheet" href="/assets/css/auth.css" />
                </head>
                <body class="auth-page">
                    <div class="login-container">
                        <div class="card" style={{ maxWidth: '480px', textAlign: 'center' }}>
                            <div class="success-icon">
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                            </div>
                            <h2 style={{ marginBottom: '1rem', fontSize: '1.75rem' }}>Email Verified!</h2>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: '1.6' }}>
                                Your email has been successfully verified. You can now log in to your account and start using Echo Messenger.
                            </p>
                            <a href="/auth" class="btn" style={{ maxWidth: '280px', margin: '0 auto' }}>
                                Continue to Login
                            </a>
                        </div>
                    </div>
                </body>
            </html>
        );
    }

    // Registration success page
    if (successMessage === 'registered') {
        return "<!DOCTYPE html>" + render(
            <html lang="en">
                <head>
                    <meta charSet="UTF-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                    <title>Registration Successful - Echo Messenger</title>
                    <link rel="preconnect" href="https://fonts.googleapis.com" />
                    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet" />
                    <link rel="stylesheet" href="/assets/css/auth.css" />
                </head>
                <body class="auth-page">
                    <div class="login-container">
                        <div class="card" style={{ maxWidth: '480px', textAlign: 'center' }}>
                            <div class="success-icon">
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                            </div>
                            <h2 style={{ marginBottom: '1rem', fontSize: '1.75rem' }}>Registration Successful!</h2>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: '1.6' }}>
                                Your account has been created. Please check your email inbox and verify your email address to activate your account.
                            </p>
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                                <a href="/auth" class="btn" style={{ maxWidth: '200px' }}>
                                    Go to Login
                                </a>
                                <button onclick="window.location.reload()" class="btn btn-secondary" style={{ maxWidth: '200px' }}>
                                    Check Email Again
                                </button>
                            </div>
                        </div>
                    </div>
                </body>
            </html>
        );
    }

    // Reset password success page
    if (successMessage === 'reset') {
        return "<!DOCTYPE html>" + render(
            <html lang="en">
                <head>
                    <meta charSet="UTF-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                    <title>Password Reset - Echo Messenger</title>
                    <link rel="preconnect" href="https://fonts.googleapis.com" />
                    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet" />
                    <link rel="stylesheet" href="/assets/css/auth.css" />
                </head>
                <body class="auth-page">
                    <div class="login-container">
                        <div class="card" style={{ maxWidth: '480px', textAlign: 'center' }}>
                            <div class="success-icon">
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                            </div>
                            <h2 style={{ marginBottom: '1rem', fontSize: '1.75rem' }}>Password Reset Complete</h2>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: '1.6' }}>
                                Your password has been successfully reset. You can now log in with your new password.
                            </p>
                            <a href="/auth" class="btn" style={{ maxWidth: '280px', margin: '0 auto' }}>
                                Sign In
                            </a>
                        </div>
                    </div>
                </body>
            </html>
        );
    }

    const displayError = error || '';

    return "<!DOCTYPE html>" + render(
        <html lang="en">
            <head>
                <meta charSet="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>Connect Telegram - Echo Messenger</title>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet" />
                <link rel="stylesheet" href="/assets/css/auth.css" />
                <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
            </head>
            <body class="auth-page">
                <div class="login-container">
                    <div class="card">
                        <div class="logo">
                            <div class="logo-icon">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                    <line x1="12" y1="19" x2="12" y2="23" />
                                    <line x1="8" y1="23" x2="16" y2="23" />
                                </svg>
                            </div>
                            ECHO
                        </div>

                        <h2>Connect Your Account</h2>
                        <p>Transcribe voice messages automatically in your personal Telegram chats.</p>

                        {displayError && (
                            <div class="message error" id="error-message">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="15" y1="9" x2="9" y2="15"></line>
                                    <line x1="9" y1="9" x2="15" y2="15"></line>
                                </svg>
                                {displayError}
                            </div>
                        )}

                        <div id="auth-flow">
                            {/* Step 1: Simple Telegram Connection */}
                            <div id="simple-start-section" class="auth-section active">
                                <div style={{ fontSize: '48px', marginBottom: '1rem', textAlign: 'center' }}>🚀</div>
                                <h3 style={{ textAlign: 'center', marginBottom: '0.75rem', fontSize: '1.25rem' }}>One-Click Connection</h3>
                                <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.938rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                                    We'll open your Telegram app to authorize the connection securely.
                                </p>
                                <button class="btn btn-telegram" id="tg-simple-connect-btn" style={{ height: '56px', fontSize: '1.125rem', fontWeight: '700' }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                                    </svg>
                                    Connect Telegram Now
                                </button>

                                <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                                    <button id="show-manual-btn" style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '0.875rem', cursor: 'pointer', textDecoration: 'underline' }}>
                                        Use phone number or QR code instead
                                    </button>
                                </div>
                            </div>

                            {/* Phone Number Section */}
                            <div id="phone-section" class="auth-section">
                                <div class="input-group">
                                    <label class="input-label">Phone Number</label>
                                    <input type="tel" id="tg-phone-input" class="input-field" placeholder="+66 85 093 2800" autoComplete="tel" />
                                </div>
                                <button class="btn btn-telegram" id="tg-send-code-btn">
                                    <span class="btn-text">Send Verification Code</span>
                                </button>
                                <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                                    <button id="back-to-simple-btn" class="btn-secondary" style={{ background: 'none', border: 'none', padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
                                        ← Back
                                    </button>
                                </div>
                            </div>

                            {/* Verification Code Section */}
                            <div id="code-section" class="auth-section">
                                <div class="input-group">
                                    <label class="input-label">Verification Code</label>
                                    <input type="text" id="tg-code-input" class="input-field" placeholder="Enter 5-digit code" autoComplete="one-time-code" maxLength="5" />
                                </div>
                                <button class="btn btn-success" id="tg-verify-btn">
                                    <span class="btn-text">Confirm & Connect</span>
                                </button>
                                <p style={{ fontSize: '0.813rem', marginTop: '0.75rem', color: 'var(--text-dim)', textAlign: 'center' }}>
                                    Check your Telegram app for the verification code.
                                </p>
                                <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                                    <button id="back-to-phone-btn" class="btn-secondary" style={{ background: 'none', border: 'none', padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
                                        ← Use different number
                                    </button>
                                </div>
                            </div>

                            {/* Password Section (2FA) */}
                            <div id="password-section" class="auth-section">
                                <div class="input-group">
                                    <label class="input-label">Two-Factor Authentication</label>
                                    <div class="input-wrapper">
                                        <input type="password" id="tg-password-input" class="input-field" placeholder="Your 2FA password" autoComplete="current-password" />
                                    </div>
                                </div>
                                <button class="btn" id="tg-password-btn">
                                    <span class="btn-text">Unlock Account</span>
                                </button>
                                <p style={{ fontSize: '0.813rem', marginTop: '0.75rem', color: 'var(--text-dim)', textAlign: 'center' }}>
                                    Your account is protected with Two-Factor Authentication.
                                </p>
                            </div>

                            {/* QR Code Section */}
                            <div id="qr-section" class="auth-section" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                                <div class="qr-container">
                                    <div id="qr-code-container" style={{ marginBottom: '1rem' }}></div>
                                    <p style={{ fontSize: '0.813rem', color: 'var(--text-dim)', marginBottom: '0.75rem' }}>
                                        Scan with Telegram app: Settings → Devices → Scan QR
                                    </p>
                                    <a id="tg-app-link" href="#" target="_blank" rel="noopener" class="tg-app-link" style={{ display: 'none' }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M22 2L11 13"></path>
                                            <path d="M22 2l-7 20-4-9-9-4 20-7z"></path>
                                        </svg>
                                        Open Telegram App
                                    </a>
                                </div>
                                <p id="qr-status" style={{ fontSize: '0.938rem', fontWeight: '500', color: 'var(--primary)' }}>Initializing QR code...</p>
                            </div>

                            {/* Divider */}
                            <div class="section-divider">OR</div>

                            {/* Google Authentication Section */}
                            <div id="google-auth-section" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                                <a href="/auth/google/callback" class="btn btn-secondary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', background: 'white', color: '#1f2937', border: '1px solid #e5e7eb' }}>
                                    <svg width="20" height="20" viewBox="0 0 48 48">
                                        <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
                                        <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
                                        <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
                                        <path fill="#1976D2" d="M43.611,20.083L43.611,20.083L42,20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
                                    </svg>
                                    Continue with Google
                                </a>
                            </div>

                            {/* Email Authentication Section */}
                            <div id="email-auth-section" class="auth-section active" style={{ textAlign: 'center' }}>
                                <button class="btn btn-secondary" id="show-email-auth-btn" style={{ width: '100%', padding: '1rem' }}>
                                    Login with Email & Password
                                </button>
                            </div>

                            {/* Email Login Section */}
                            <div id="email-login-section" class="auth-section">
                                <div class="input-group">
                                    <label class="input-label">Email Address</label>
                                    <input type="email" id="email-input" class="input-field" placeholder="your@email.com" autoComplete="email" />
                                </div>
                                <div class="input-group">
                                    <label class="input-label">Password</label>
                                    <div class="input-wrapper">
                                        <input type="password" id="password-input" class="input-field" placeholder="Your password" autoComplete="current-password" />
                                    </div>
                                </div>
                                <button class="btn btn-success" id="email-login-btn">
                                    <span class="btn-text">Sign In</span>
                                </button>
                                <div class="form-options" style={{ flexDirection: 'column', gap: '0.75rem' }}>
                                    <label style={{ cursor: 'pointer' }}>
                                        <input type="checkbox" id="remember-me" style={{ marginRight: '0.5rem' }} /> Keep me signed in
                                    </label>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', fontSize: '0.875rem' }}>
                                    <button id="show-forgot-password-btn" style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', textDecoration: 'underline' }}>
                                        Forgot password?
                                    </button>
                                    <button id="show-register-btn" style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline', fontWeight: '600' }}>
                                        Create account
                                    </button>
                                </div>
                            </div>

                            {/* Email Register Section */}
                            <div id="email-register-section" class="auth-section">
                                <div class="input-group">
                                    <label class="input-label">First Name</label>
                                    <input type="text" id="register-firstname-input" class="input-field" placeholder="Your first name" autoComplete="given-name" />
                                </div>
                                <div class="input-group">
                                    <label class="input-label">Email Address</label>
                                    <input type="email" id="register-email-input" class="input-field" placeholder="your@email.com" autoComplete="email" />
                                </div>
                                <div class="input-group">
                                    <label class="input-label">Password</label>
                                    <div class="input-wrapper">
                                        <input type="password" id="register-password-input" class="input-field" placeholder="Min 6 characters" autoComplete="new-password" />
                                    </div>
                                    <div class="password-strength" id="password-strength" style={{ display: 'none' }}>
                                        <div class="password-strength-bar" id="strength-bar"></div>
                                    </div>
                                    <div class="password-strength-text" id="strength-text"></div>
                                </div>
                                <button class="btn btn-primary" id="email-register-btn" style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)' }}>
                                    <span class="btn-text">Create Account</span>
                                </button>
                                <div class="form-footer">
                                    Already have an account?{" "}
                                    <button id="back-to-login-btn" style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline', fontWeight: '600', fontSize: 'inherit' }}>
                                        Sign in
                                    </button>
                                </div>
                            </div>

                            {/* Forgot Password Section */}
                            <div id="forgot-password-section" class="auth-section">
                                <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.938rem' }}>
                                    Enter your email address and we'll send you a link to reset your password.
                                </p>
                                <div class="input-group">
                                    <label class="input-label">Email Address</label>
                                    <input type="email" id="forgot-email-input" class="input-field" placeholder="your@email.com" autoComplete="email" />
                                </div>
                                <button class="btn btn-warning" id="forgot-password-btn">
                                    <span class="btn-text">Send Reset Link</span>
                                </button>
                                <div class="form-footer">
                                    <button id="back-to-login-from-forgot-btn" style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline', fontWeight: '600', fontSize: 'inherit' }}>
                                        ← Back to login
                                    </button>
                                </div>
                            </div>

                            {/* Reset Password Section */}
                            <div id="reset-password-section" class="auth-section">
                                <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.938rem' }}>
                                    Enter your new password below.
                                </p>
                                <div class="input-group">
                                    <label class="input-label">New Password</label>
                                    <div class="input-wrapper">
                                        <input type="password" id="reset-password-input" class="input-field" placeholder="Min 6 characters" autoComplete="new-password" />
                                    </div>
                                </div>
                                <button class="btn btn-success" id="reset-password-btn">
                                    <span class="btn-text">Reset Password</span>
                                </button>
                            </div>

                            {/* QR Button (from manual flow) */}
                            <div style={{ marginTop: '1.5rem' }}>
                                <button class="btn btn-secondary" id="tg-show-qr-btn" style={{ width: '100%' }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                                        <rect x="3" y="3" width="7" height="7"></rect>
                                        <rect x="14" y="3" width="7" height="7"></rect>
                                        <rect x="14" y="14" width="7" height="7"></rect>
                                        <rect x="3" y="14" width="7" height="7"></rect>
                                    </svg>
                                    Login with QR Code
                                </button>
                            </div>

                        </div>

                        {/* Success Message (for Telegram connection) */}
                        <div id="success-message" style={{ display: 'none' }}>
                            <div class="success-view">
                                <div class="success-icon">
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                </div>
                                <h3>Successfully Connected!</h3>
                                <p>Your account is now connected. You'll be redirected to your dashboard shortly.</p>
                            </div>
                        </div>
                    </div>
                </div>
                <script src="/assets/js/auth.js"></script>
            </body>
        </html>
    );
};
