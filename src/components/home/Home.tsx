/** @jsxImportSource preact */
import React from 'preact/compat';
import { render } from 'preact-render-to-string';
import { SparklesIcon, MailIcon, CheckCircleIcon, ArrowLeftIcon, LockIcon } from './Home.utils';

export const renderHome = (googleClientId: string, origin: string) => {
    return "<!DOCTYPE html>" + render(
        <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>Echo Messenger - Multi-Platform Voice Transcripts</title>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Inter:wght@400;600&display=swap" rel="stylesheet" />
                <link rel="stylesheet" href="/assets/css/home.css" />
                <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
                <script src="https://accounts.google.com/gsi/client" async defer></script>
                <script type="importmap" dangerouslySetInnerHTML={{
                  __html: JSON.stringify({
                    imports: {
                      "tdweb": "https://unpkg.com/tdweb@1.8.0/dist/tdweb.js"
                    }
                  })
                }} />
            </head>
            <body>
                <div class="bg-glow"></div>
                <div class="landing-card" id="main-card">
                    <div id="auth-view">
                        <div class="logo-section">
                            <div class="logo-icon">
                                <SparklesIcon size={32} color="white" strokeWidth={2.5} />
                            </div>
                            <h1 class="title">Echo Messenger</h1>
                            <p class="subtitle">Personalized voice message transcription for Telegram, WhatsApp & Meta.</p>
                        </div>

                        <div class="auth-section">
                            <div class="email-input-wrapper">
                                <MailIcon size={18} color="rgba(255,255,255,0.4)" />
                                <input type="email" id="email-input" class="styled-input" placeholder="Email address" />
                            </div>
                            
                            <div class="email-input-wrapper" id="password-wrapper" style={{ marginTop: '12px' }}>
                                <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}>
                                    <LockIcon size={18} color="rgba(255,255,255,0.4)" />
                                </div>
                                <input type="password" id="password-input" class="styled-input" placeholder="Password" />
                            </div>

                            <button class="btn-primary" id="login-btn" style={{ marginTop: '16px' }}>
                                Sign In
                            </button>
                            
                            <div id="status-msg" class="status-msg"></div>

                            <div class="divider">
                                <span>OR CONTINUE WITH</span>
                            </div>

                            <div class="google-btn-wrapper" style={{ flexDirection: 'column', gap: '15px' }}>
                                <div id="g_id_onload"
                                    data-client_id={googleClientId}
                                    data-context="signin"
                                    data-ux_mode="redirect"
                                    data-login_uri={`${origin}/auth/google/callback`}
                                    data-auto_prompt="false">
                                </div>
                                <div class="g_id_signin" data-type="standard" data-shape="pill" data-theme="filled_black" data-size="large"></div>

                                {/* Telegram QR Login - pure tdweb */}
                                <button id="qr-login-btn" class="btn-telegram" style={{ marginTop: '8px', background: '#229ED9', color: 'white', width: '100%' }}>
                                    Login with Telegram QR Code
                                </button>

                                {/* Restore existing session (same device) */}
                                <button id="restore-session-btn" class="btn-telegram" style={{ marginTop: '8px', background: '#0f766e', color: 'white', width: '100%', fontSize: '14px' }}>
                                    Restore Session (already logged in)
                                </button>

                                <div id="qr-container" style={{ display: 'none', textAlign: 'center', marginTop: '16px' }}>
                                    <img id="qr-img" alt="Telegram QR" style={{ width: '220px', height: '220px', borderRadius: '12px' }} />
                                </div>
                            </div>
                        </div>

                        <div class="footer-links" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
                            <a href="/auth?action=forgot" class="link" id="forgot-pass-btn">Forgot password?</a>
                            <a href="/auth?action=register" class="link" id="register-btn" style={{ fontWeight: '600', color: 'var(--primary)' }}>Create account</a>
                        </div>
                    </div>

                    <div id="success-view" style="display:none; text-align:center; padding: 20px 0;">
                        <CheckCircleIcon size={56} color="#22c55e" />
                        <h2 class="title">Check your inbox</h2>
                        <p class="subtitle" style="margin-top:16px;">We've sent a secure login link to your email address. It expires in 15 minutes.</p>
                        <button class="btn-primary" style="margin-top:32px; background: rgba(255,255,255,0.05); color: white; border: 1px solid rgba(255,255,255,0.1);" onClick={"location.reload()" as any}>
                            <ArrowLeftIcon size={16} /> Back to Login
                        </button>
                    </div>
                </div>

                <script type="module" src="/assets/js/home.js"></script>
            </body>
        </html>
    );
};
