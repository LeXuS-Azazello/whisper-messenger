/** @jsxImportSource preact */
import React from 'preact/compat';
import { render } from 'preact-render-to-string';

interface Message {
    type: 'error' | 'success' | 'warning' | 'info';
    text: string;
}

export const renderAuthPage = (error?: string, isAuthenticated?: boolean, origin?: string, successMessage?: string, googleClientId?: string) => {
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
                <script src="https://accounts.google.com/gsi/client" async defer></script>
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
                            {/* Google Authentication Section */}
                            <div id="google-auth-section" style={{ textAlign: 'center', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div id="g_id_onload"
                                    data-client_id={googleClientId}
                                    data-context="signin"
                                    data-ux_mode="redirect"
                                    data-login_uri={`${origin}/auth/google/callback`}
                                    data-auto_prompt="false">
                                </div>
                                <div class="g_id_signin" data-type="standard" data-shape="pill" data-theme="outline" data-size="large" data-logo_alignment="left" style={{ width: '100%' }}></div>
                            </div>

                            {/* Divider */}
                            <div class="section-divider">OR</div>

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
                        </div>
                    </div>
                </div>
                <script src="/assets/js/auth.js"></script>
            </body>
        </html>
    );
};
