/** @jsxImportSource preact */
import React from 'preact/compat';
import { render } from 'preact-render-to-string';

export const renderAuthPage = (error?: string, isAuthenticated?: boolean, origin?: string) => {
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
                    <div class="card login-card" style={{ maxWidth: '450px' }}>
                        <div class="logo" style={{ justifyContent: 'center', marginBottom: '20px' }}>
                            <div class="logo-icon">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                                    <line x1="12" y1="19" x2="12" y2="23"/>
                                    <line x1="8" y1="23" x2="16" y2="23"/>
                                </svg>
                            </div>
                            ECHO
                        </div>
                        
                        <h2 style={{ textAlign: 'center', marginBottom: '10px' }}>Connect Your account</h2>
                        <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '14px', marginBottom: '30px' }}>
                            Transcribe voice messages automatically in your personal Telegram chats.
                        </p>

                        {error && <div class="error-msg" style={{ marginBottom: '20px' }}>{error}</div>}

                        <div id="auth-flow">
                            {/* Simple Step 1: Initialize Connection */}
                            <div id="simple-start-section" style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '48px', marginBottom: '10px' }}>🚀</div>
                                <h3 style={{ marginBottom: '15px' }}>One-Click Connection</h3>
                                <p style={{ fontSize: '14px', color: 'var(--text-dim)', marginBottom: '25px' }}>
                                    We'll open your Telegram app to authorize the connection securelly.
                                </p>
                                <button class="btn" id="tg-simple-connect-btn" style={{ background: 'linear-gradient(135deg, #24A1DE, #1C92D2)', height: '56px', fontSize: '16px', fontWeight: '800' }}>
                                    Connect Telegram Now
                                </button>
                                
                                <div style={{ marginTop: '20px' }}>
                                    <button id="show-manual-btn" style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}>
                                        Alternative login (Phone number / QR)
                                    </button>
                                </div>
                            </div>

                            <div id="phone-section" style={{ display: 'none' }}>
                                <div class="input-group">
                                    <label class="input-label">Phone Number</label>
                                    <input type="tel" id="tg-phone-input" class="input-field" placeholder="+66 85 093 2800" />
                                </div>
                                <button class="btn" id="tg-send-code-btn" style={{ background: '#8B5CF6' }}>Send Verification Code</button>
                            </div>

                            <div id="code-section" style={{ display: 'none', marginTop: '20px' }}>
                                <div class="input-group">
                                    <label class="input-label">Verification Code</label>
                                    <input type="text" id="tg-code-input" class="input-field" placeholder="12345" />
                                </div>
                                <button class="btn" id="tg-verify-btn" style={{ background: '#22c55e' }}>Confirm & Connect</button>
                                <p style={{ fontSize: '12px', marginTop: '10px', color: 'var(--text-dim)', textAlign: 'center' }}>
                                    Check your Telegram app for the code.
                                </p>
                            </div>

                            <div id="password-section" style={{ display: 'none', marginTop: '20px' }}>
                                <div class="input-group">
                                    <label class="input-label">Cloud Password (2FA)</label>
                                    <input type="password" id="tg-password-input" class="input-field" placeholder="Your password" />
                                </div>
                                <button class="btn" id="tg-password-btn" style={{ background: '#8B5CF6' }}>Unlock Account</button>
                                <p style={{ fontSize: '12px', marginTop: '10px', color: 'var(--text-dim)', textAlign: 'center' }}>
                                    Your account is protected with Two-Factor Authentication.
                                </p>
                            </div>

                            <div style={{ margin: '30px 0', display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                                <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>OR</span>
                                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                            </div>

                            {/* Email Authentication Section */}
                            <div id="email-auth-section" style={{ textAlign: 'center', marginBottom: '20px' }}>
                                <button class="btn" id="show-email-auth-btn" style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', width: '100%', marginBottom: '15px' }}>
                                    Login with Email & Password
                                </button>
                            </div>

                            <div id="email-login-section" style={{ display: 'none' }}>
                                <div class="input-group">
                                    <label class="input-label">Email</label>
                                    <input type="email" id="email-input" class="input-field" placeholder="your@email.com" />
                                </div>
                                <div class="input-group">
                                    <label class="input-label">Password</label>
                                    <input type="password" id="password-input" class="input-field" placeholder="Your password" />
                                </div>
                                <button class="btn" id="email-login-btn" style={{ background: '#22c55e' }}>Login</button>
                                <div style={{ textAlign: 'center', marginTop: '10px' }}>
                                    <button id="show-forgot-password-btn" style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}>
                                        Forgot password?
                                    </button>
                                </div>
                                <div style={{ textAlign: 'center', marginTop: '15px' }}>
                                    <button id="show-register-btn" style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}>
                                        Don't have an account? Register
                                    </button>
                                </div>
                            </div>

                            <div id="email-register-section" style={{ display: 'none' }}>
                                <div class="input-group">
                                    <label class="input-label">First Name</label>
                                    <input type="text" id="register-firstname-input" class="input-field" placeholder="Your first name" />
                                </div>
                                <div class="input-group">
                                    <label class="input-label">Email</label>
                                    <input type="email" id="register-email-input" class="input-field" placeholder="your@email.com" />
                                </div>
                                <div class="input-group">
                                    <label class="input-label">Password</label>
                                    <input type="password" id="register-password-input" class="input-field" placeholder="Min 6 characters" />
                                </div>
                                <button class="btn" id="email-register-btn" style={{ background: '#8B5CF6' }}>Register</button>
                                <div style={{ textAlign: 'center', marginTop: '15px' }}>
                                    <button id="back-to-login-btn" style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}>
                                        Already have an account? Login
                                    </button>
                                </div>
                            </div>

                            <div id="forgot-password-section" style={{ display: 'none' }}>
                                <div class="input-group">
                                    <label class="input-label">Email</label>
                                    <input type="email" id="forgot-email-input" class="input-field" placeholder="your@email.com" />
                                </div>
                                <button class="btn" id="forgot-password-btn" style={{ background: '#f59e0b' }}>Send Reset Link</button>
                                <div style={{ textAlign: 'center', marginTop: '15px' }}>
                                    <button id="back-to-login-from-forgot-btn" style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}>
                                        Back to Login
                                    </button>
                                </div>
                            </div>

                            <div id="reset-password-section" style={{ display: 'none' }}>
                                <div class="input-group">
                                    <label class="input-label">New Password</label>
                                    <input type="password" id="reset-password-input" class="input-field" placeholder="Min 6 characters" />
                                </div>
                                <button class="btn" id="reset-password-btn" style={{ background: '#22c55e' }}>Reset Password</button>
                            </div>

                            <button class="btn" id="tg-show-qr-btn" style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}>
                                Login with QR Code
                            </button>

                            <div id="qr-section" style={{ display: 'none', marginTop: '25px', textAlign: 'center' }}>
                                <div id="qr-code-container" style={{ background: 'white', padding: '15px', borderRadius: '12px', display: 'inline-block', marginBottom: '15px' }}></div>
                                <div style={{ marginBottom: '15px' }}>
                                    <a id="tg-app-link" href="#" class="btn btn-sm" style={{ background: '#24A1DE', display: 'inline-flex', alignItems: 'center', gap: '8px', width: 'auto', padding: '8px 16px', borderRadius: '20px', textDecoration: 'none', color: 'white', fontWeight: '600' }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                                        Open in Telegram App
                                    </a>
                                </div>
                                <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '5px' }}>Open Telegram &gt; Settings &gt; Devices &gt; Scan QR</p>
                                <p id="qr-status" style={{ fontSize: '14px', color: '#8B5CF6', fontWeight: '600' }}>Waiting for scan...</p>
                            </div>
                        </div>

                        <div id="success-message" style={{ display: 'none', textAlign: 'center', padding: '20px 0' }}>
                            <div style={{ width: '60px', height: '60px', background: '#22c55e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                            </div>
                            <h3>Successfully Connected!</h3>
                            <p style={{ color: 'var(--text-dim)', marginTop: '10px' }}>Ваш аккаунт подключен. Теперь бот будет автоматически расшифровывать голосовые сообщения.</p>
                        </div>
                    </div>
                </div>
                <script src="/assets/js/auth.js"></script>
            </body>
        </html>
    );
};
            </body>
        </html>
    );
};
