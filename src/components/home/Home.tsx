/** @jsxImportSource preact */
import React from 'preact/compat';
import { render } from 'preact-render-to-string';
import { SparklesIcon, MailIcon, CheckCircleIcon, ArrowLeftIcon } from './Home.utils';

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
                <script src="https://accounts.google.com/gsi/client" async defer></script>
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
                            <div class="email-input-wrapper" style={{ display: 'none' }}>
                                <MailIcon size={18} color="rgba(255,255,255,0.4)" />
                                <input type="email" id="email-input" class="styled-input" placeholder="name@company.com" />
                            </div>
                            <button class="btn-primary" id="send-link-btn" style={{ display: 'none' }}>
                                Send Magic Link
                            </button>
                            <div id="status-msg" class="status-msg"></div>

                            <div class="divider" style={{ display: 'none' }}>
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
                                {/* Using MTProto flow instead of Bot Widget */}
                            </div>
                        </div>

                        <div class="footer-links">
                            <a href="#" class="link" id="forgot-pass-btn">Forgot password / Help?</a>
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

                <script src="/assets/js/home.js"></script>
            </body>
        </html>
    );
};
