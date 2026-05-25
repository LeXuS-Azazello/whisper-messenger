/** @jsxImportSource preact */
import React from 'preact/compat';
import { render } from 'preact-render-to-string';
import { SparklesIcon, MailIcon, CheckCircleIcon, ArrowLeftIcon, LockIcon, UserIcon } from '../home/Home.utils';

export const renderAuthPage = (
    error?: string,
    isAuthenticated?: boolean,
    origin?: string,
    successMessage?: string,
    googleClientId?: string,
    activeView: 'login' | 'register' | 'forgot' | 'reset' | 'success' = 'login'
) => {
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

    let view = activeView;
    if (successMessage === 'verified' || successMessage === 'registered' || successMessage === 'reset') {
        view = 'success';
    }

    const displayError = error || '';

    // Success State Configurations
    const successConfig = successMessage ? {
        verified: {
            title: "Email Verified!",
            text: "Your email has been successfully verified. You can now log in and start using Echo Messenger.",
            btnText: "Continue to Login",
            btnUrl: "/login"
        },
        registered: {
            title: "Welcome Aboard!",
            text: "Your account has been created. Please check your email inbox and verify your address to activate your account.",
            btnText: "Go to Login",
            btnUrl: "/login"
        },
        reset: {
            title: "Password Reset Complete",
            text: "Your password has been successfully reset. You can now log in with your new credentials.",
            btnText: "Sign In",
            btnUrl: "/login"
        }
    }[successMessage as 'verified' | 'registered' | 'reset'] : null;

    return "<!DOCTYPE html>" + render(
        <html lang="en">
            <head>
                <meta charSet="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>Echo Messenger - Secure Authentication</title>
                <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
                <link rel="stylesheet" href="/assets/css/home.css" />
                <script src="https://accounts.google.com/gsi/client" async defer></script>
            </head>
            <body>
                <div class="bg-glow"></div>
                <div class="landing-card" id="main-card">
                    
                    {/* Success View */}
                    {view === 'success' && successConfig ? (
                        <div id="success-view" style={{ textAlign: 'center', padding: '20px 0' }}>
                            <div style={{ marginBottom: '24px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                <CheckCircleIcon size={56} color="#22c55e" />
                            </div>
                            <h2 class="title">{successConfig.title}</h2>
                            <p class="subtitle" style={{ marginTop: '16px', marginInline: 'auto' }}>{successConfig.text}</p>
                            <a href={successConfig.btnUrl} class="btn-primary" style={{ marginTop: '32px', textDecoration: 'none' }}>
                                {successConfig.btnText}
                            </a>
                            {successMessage === 'registered' && (
                                <button onClick={() => window.location.reload()} class="btn-primary" style={{ marginTop: '12px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    Check Again
                                </button>
                            )}
                        </div>
                    ) : (
                        /* Authentication Flow (Forms) */
                        <div id="auth-view">
                            <div class="logo-section">
                                <a href="/" style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <div class="logo-icon">
                                        <SparklesIcon size={32} color="white" strokeWidth={2.5} />
                                    </div>
                                    <h1 class="title">Echo Messenger</h1>
                                </a>
                                <p class="subtitle" id="auth-subtitle">
                                    {view === 'login' && "Personalized voice message transcription for Telegram, WhatsApp & Meta."}
                                    {view === 'register' && "Create an account to start transcribing your voice messages."}
                                    {view === 'forgot' && "We'll send you a secure link to recover and reset your password."}
                                    {view === 'reset' && "Enter a secure new password for your account below."}
                                </p>
                            </div>

                            <div class="auth-section-wrapper">
                                {/* Alert message container */}
                                <div id="status-msg" class={`status-msg ${displayError ? 'error' : ''}`} style={{ display: displayError ? 'block' : 'none', marginBottom: '16px' }}>
                                    {displayError}
                                </div>

                                {/* Login Section */}
                                <div id="login-section" class="auth-flow-section" style={{ display: view === 'login' ? 'block' : 'none' }}>
                                    <div class="email-input-wrapper">
                                        <MailIcon size={18} color="rgba(255,255,255,0.4)" />
                                        <input type="email" id="email-input" class="styled-input" placeholder="Email address" autoComplete="email" />
                                    </div>
                                    <div class="email-input-wrapper" id="password-wrapper">
                                        <LockIcon size={18} color="rgba(255,255,255,0.4)" />
                                        <input type="password" id="password-input" class="styled-input" placeholder="Password" autoComplete="current-password" />
                                    </div>
                                    
                                    <button class="btn-primary" id="login-btn">
                                        Sign In
                                    </button>

                                    <div class="divider">
                                        <span>OR CONTINUE WITH</span>
                                    </div>

                                    <div class="google-btn-wrapper">
                                        <div id="g_id_onload"
                                            data-client_id={googleClientId}
                                            data-context="signin"
                                            data-ux_mode="redirect"
                                            data-login_uri={`${origin}/auth/google/callback`}
                                            data-auto_prompt="false">
                                        </div>
                                        <div class="g_id_signin" data-type="standard" data-shape="pill" data-theme="filled_black" data-size="large" data-width="364"></div>
                                    </div>

                                    <div class="footer-links">
                                        <a href="/forgot-password" class="link" id="forgot-pass-link">Forgot password?</a>
                                        <a href="/register" class="link" id="register-link" style={{ fontWeight: '600' }}>Create account</a>
                                    </div>
                                </div>

                                {/* Register Section */}
                                <div id="register-section" class="auth-flow-section" style={{ display: view === 'register' ? 'block' : 'none' }}>
                                    <div class="email-input-wrapper">
                                        <UserIcon size={18} color="rgba(255,255,255,0.4)" />
                                        <input type="text" id="register-firstname-input" class="styled-input" placeholder="First Name" autoComplete="given-name" />
                                    </div>
                                    <div class="email-input-wrapper">
                                        <MailIcon size={18} color="rgba(255,255,255,0.4)" />
                                        <input type="email" id="register-email-input" class="styled-input" placeholder="Email address" autoComplete="email" />
                                    </div>
                                    <div class="email-input-wrapper">
                                        <LockIcon size={18} color="rgba(255,255,255,0.4)" />
                                        <input type="password" id="register-password-input" class="styled-input" placeholder="Password (min 6 chars)" autoComplete="new-password" />
                                    </div>

                                    {/* Password strength meter */}
                                    <div class="password-strength" id="password-strength" style={{ display: 'none', marginBlock: '8px 16px' }}>
                                        <div class="password-strength-bar" id="strength-bar"></div>
                                        <div class="password-strength-text" id="strength-text"></div>
                                    </div>

                                    <button class="btn-primary" id="register-btn">
                                        Create Account
                                    </button>

                                    <div class="divider">
                                        <span>OR REGISTER WITH</span>
                                    </div>

                                    <div class="google-btn-wrapper">
                                        <div class="g_id_signin" data-type="standard" data-shape="pill" data-theme="filled_black" data-size="large" data-width="364"></div>
                                    </div>

                                    <div class="footer-links" style={{ justifyContent: 'center' }}>
                                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginRight: '6px' }}>Already have an account?</span>
                                        <a href="/login" class="link" id="login-link" style={{ fontWeight: '600' }}>Sign In</a>
                                    </div>
                                </div>

                                {/* Forgot Password Section */}
                                <div id="forgot-section" class="auth-flow-section" style={{ display: view === 'forgot' ? 'block' : 'none' }}>
                                    <div class="email-input-wrapper">
                                        <MailIcon size={18} color="rgba(255,255,255,0.4)" />
                                        <input type="email" id="forgot-email-input" class="styled-input" placeholder="Email address" autoComplete="email" />
                                    </div>

                                    <button class="btn-primary" id="forgot-btn">
                                        Send Recovery Link
                                    </button>

                                    <div class="footer-links" style={{ justifyContent: 'center' }}>
                                        <a href="/login" class="link" id="back-to-login-link">← Back to Sign In</a>
                                    </div>
                                </div>

                                {/* Reset Password Section */}
                                <div id="reset-section" class="auth-flow-section" style={{ display: view === 'reset' ? 'block' : 'none' }}>
                                    <div class="email-input-wrapper">
                                        <LockIcon size={18} color="rgba(255,255,255,0.4)" />
                                        <input type="password" id="reset-password-input" class="styled-input" placeholder="New Password (min 6 chars)" autoComplete="new-password" />
                                    </div>

                                    <button class="btn-primary" id="reset-btn">
                                        Update Password
                                    </button>

                                    <div class="footer-links" style={{ justifyContent: 'center' }}>
                                        <a href="/login" class="link" id="reset-back-link">Back to Sign In</a>
                                    </div>
                                </div>

                            </div>
                        </div>
                    )}

                </div>
                <script type="module" src="/assets/js/auth.js"></script>
            </body>
        </html>
    );
};
