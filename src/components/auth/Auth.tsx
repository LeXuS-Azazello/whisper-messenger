/** @jsxImportSource preact */
import React from 'preact/compat';
import { render } from 'preact-render-to-string';

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

    // Success State Layout
    if (successMessage === 'verified' || successMessage === 'registered' || successMessage === 'reset') {
        const config = {
            verified: {
                title: "Email Verified!",
                text: "Your email has been successfully verified. You can now log in and start using Whisper Messenger.",
                btnText: "Continue to Login",
                btnUrl: "/auth"
            },
            registered: {
                title: "Welcome Aboard!",
                text: "Your account has been created. Please check your email inbox and verify your address to activate your account.",
                btnText: "Go to Login",
                btnUrl: "/auth"
            },
            reset: {
                title: "Password Reset Complete",
                text: "Your password has been successfully reset. You can now log in with your new credentials.",
                btnText: "Sign In",
                btnUrl: "/auth"
            }
        }[successMessage];

        return "<!DOCTYPE html>" + render(
            <html lang="en">
                <head>
                    <meta charSet="UTF-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                    <title>{config.title} - Whisper Messenger</title>
                    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
                    <link rel="preconnect" href="https://fonts.googleapis.com" />
                    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet" />
                    <link rel="stylesheet" href="/assets/css/auth.css" />
                </head>
                <body class="auth-page">
                    <div class="auth-wrapper">
                        <div class="auth-card success-card">
                            <div class="success-icon-wrap">
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                            </div>
                            <h2 class="auth-title">{config.title}</h2>
                            <p class="auth-description">{config.text}</p>
                            <div class="auth-actions">
                                <a href={config.btnUrl} class="btn btn-primary">{config.btnText}</a>
                                {successMessage === 'registered' && (
                                    <button onclick="window.location.reload()" class="btn btn-secondary">Check Again</button>
                                )}
                            </div>
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
                <title>Authentication - Whisper Messenger</title>
                <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
                <link rel="stylesheet" href="/assets/css/auth.css" />
                <script src="https://accounts.google.com/gsi/client" async defer></script>
            </head>
            <body class="auth-page">
                <div id="progress-bar"></div>
                <div class="auth-wrapper">
                    <div class="auth-card">
                        <div class="auth-header">
                            <div class="logo">
                                <div class="logo-icon">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                        <line x1="12" y1="19" x2="12" y2="23" />
                                        <line x1="8" y1="23" x2="16" y2="23" />
                                    </svg>
                                </div>
                                <span class="logo-text">WHISPER</span>
                            </div>
                            <h2 class="auth-title">Connect Account</h2>
                            <p class="auth-subtitle">Secure access to your transcription dashboard</p>
                        </div>

                        {displayError && (
                            <div class="auth-alert error" id="error-message">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="8" x2="12" y2="12"></line>
                                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                </svg>
                                <span>{displayError}</span>
                            </div>
                        )}

                        <div id="auth-flow">
                            {/* Google Auth */}
                            <div id="google-auth-section" class="google-section">
                                <div id="g_id_onload"
                                    data-client_id={googleClientId}
                                    data-context="signin"
                                    data-ux_mode="redirect"
                                    data-login_uri={`${origin}/auth/google/callback`}
                                    data-auto_prompt="false">
                                </div>
                                <div class="g_id_signin" data-type="standard" data-shape="pill" data-theme="outline" data-size="large" data-logo_alignment="left" data-width="100%"></div>
                            </div>

                            <div class="auth-divider">
                                <span>OR</span>
                            </div>

                            {/* Main Auth Toggle (Hidden) */}
                            <div id="email-auth-section" class="auth-section" style="display: none;">
                                <button class="btn btn-secondary btn-full" id="show-email-auth-btn">
                                    Continue with Email
                                </button>
                            </div>

                            {/* Login Form */}
                            <div id="email-login-section" class="auth-section active" style="display: block;">
                                <div class="form-group">
                                    <label class="form-label">Email Address</label>
                                    <div class="input-wrapper">
                                        <input type="email" id="email-input" class="form-input" placeholder="name@company.com" autoComplete="email" />
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Password</label>
                                    <div class="input-wrapper">
                                        <input type="password" id="password-input" class="form-input" placeholder="••••••••" autoComplete="current-password" />
                                    </div>
                                </div>
                                <div class="form-utils">
                                    <label class="checkbox-label">
                                        <input type="checkbox" id="remember-me" />
                                        <span>Remember me</span>
                                    </label>
                                    <button id="show-forgot-password-btn" class="link-btn">Forgot password?</button>
                                </div>
                                <button class="btn btn-primary btn-full" id="email-login-btn">Sign In</button>
                                <p class="form-footer">
                                    New here? <button id="show-register-btn" class="link-btn highlight">Create an account</button>
                                </p>
                            </div>

                            {/* Register Form */}
                            <div id="email-register-section" class="auth-section">
                                <div class="form-group">
                                    <label class="form-label">First Name</label>
                                    <input type="text" id="register-firstname-input" class="form-input" placeholder="Your name" autoComplete="given-name" />
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Email Address</label>
                                    <input type="email" id="register-email-input" class="form-input" placeholder="name@company.com" autoComplete="email" />
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Password</label>
                                    <input type="password" id="register-password-input" class="form-input" placeholder="At least 6 characters" autoComplete="new-password" />
                                    <div class="strength-meter" id="password-strength" style={{ display: 'none' }}>
                                        <div class="strength-bar" id="strength-bar"></div>
                                    </div>
                                    <div class="strength-text" id="strength-text"></div>
                                </div>
                                <button class="btn btn-primary btn-full" id="email-register-btn">Create Account</button>
                                <p class="form-footer">
                                    Already have an account? <button id="back-to-login-btn" class="link-btn highlight">Sign in</button>
                                </p>
                            </div>

                            {/* Forgot Password Form */}
                            <div id="forgot-password-section" class="auth-section">
                                <p class="section-description">
                                    We'll send you a recovery link to your email.
                                </p>
                                <div class="form-group">
                                    <label class="form-label">Email Address</label>
                                    <input type="email" id="forgot-email-input" class="form-input" placeholder="name@company.com" autoComplete="email" />
                                </div>
                                <button class="btn btn-primary btn-full" id="forgot-password-btn">Send Recovery Link</button>
                                <div class="form-footer">
                                    <button id="back-to-login-from-forgot-btn" class="link-btn">← Back to login</button>
                                </div>
                            </div>

                            {/* Reset Password Form */}
                            <div id="reset-password-section" class="auth-section">
                                <p class="section-description">Enter your new password below.</p>
                                <div class="form-group">
                                    <label class="form-label">New Password</label>
                                    <input type="password" id="reset-password-input" class="form-input" placeholder="Min 6 characters" autoComplete="new-password" />
                                </div>
                                <button class="btn btn-primary btn-full" id="reset-password-btn">Update Password</button>
                            </div>
                        </div>
                    </div>
                </div>
                <script src="/assets/js/auth.js"></script>
            </body>
        </html>
    );
};
