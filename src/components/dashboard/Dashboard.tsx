/** @jsxImportSource preact */
import { render } from 'preact-render-to-string';
import type { Env, UserSession } from '../../types';
import { Sidebar } from './Sidebar';
import { MobileHeader } from './MobileHeader';
import { TopBar } from './TopBar';
import { ConnectionsPane } from './ConnectionsPane';
import { StatisticsPane } from './StatisticsPane';
import { ProfilePane } from './ProfilePane';
import { ReferralsPane } from './ReferralsPane';
import { BillingPane } from './BillingPane';

export const renderDashboard = (user: UserSession, env: Env, billingConfig: any = {}) => {
    return "<!DOCTYPE html>" + render(
        <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>My Dashboard - Whisper Messenger</title>
                <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
                <link rel="stylesheet" href="/assets/css/dashboard.css" />
                <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
            </head>
            <body class="dashboard-page">
                <div id="progress-bar"></div>

                <div class="dashboard-layout">
                    <Sidebar user={user} />
                    <MobileHeader />

                    <main class="main-content">
                        <TopBar user={user} />

                        <div class="tab-contents">
                            <ConnectionsPane user={user} env={env} />
                            <StatisticsPane user={user} env={env} />
                            <ProfilePane user={user} env={env} />
                            <ReferralsPane user={user} env={env} />
                            <BillingPane user={user} env={env} billingConfig={billingConfig} />
                        </div>
                    </main>
                </div>

                {/* Glassmorphic Bottom Nav Bar for Mobile Screens */}
                <nav class="bottom-nav">
                    <a href="/dashboard" class="bottom-nav-item tab-btn active" data-tab="connections">
                        <span class="bottom-nav-icon">🔌</span>
                        <span class="bottom-nav-label">Connect</span>
                    </a>
                    <a href="/dashboard/stats" class="bottom-nav-item tab-btn" data-tab="stats">
                        <span class="bottom-nav-icon">📊</span>
                        <span class="bottom-nav-label">Stats</span>
                    </a>
                    <a href="/dashboard/profile" class="bottom-nav-item tab-btn" data-tab="profile">
                        <span class="bottom-nav-icon">👤</span>
                        <span class="bottom-nav-label">Profile</span>
                    </a>
                    <a href="/dashboard/referrals" class="bottom-nav-item tab-btn" data-tab="referrals">
                        <span class="bottom-nav-icon">🎁</span>
                        <span class="bottom-nav-label">Refs</span>
                    </a>
                    <a href="/dashboard/billing" class="bottom-nav-item tab-btn" data-tab="billing">
                        <span class="bottom-nav-icon">💳</span>
                        <span class="bottom-nav-label">Billing</span>
                    </a>
                </nav>

                {/* Telegram Connection Modal (global overlay — must live outside tab-panes) */}
                <div class="modal-overlay" id="tg-modal-overlay">
                    <div class="modal-content">
                        <button class="modal-close" id="tg-modal-close">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                        <div class="modal-title">Connect Telegram</div>

                        <div class="auth-step active" id="tg-step-1">
                            <p class="modal-description">Choose your preferred method to link your account</p>
                            <div class="auth-choice">
                                <div class="choice-card" id="choose-qr-btn">
                                    <div class="choice-icon">📱</div>
                                    <div class="choice-text">
                                        <h4>QR Code</h4>
                                        <p>Fastest way using Telegram App</p>
                                    </div>
                                </div>
                                <div class="choice-card" id="choose-phone-btn">
                                    <div class="choice-icon">📞</div>
                                    <div class="choice-text">
                                        <h4>Phone Number</h4>
                                        <p>Receive a code on your device</p>
                                    </div>
                                </div>
                                <div class="choice-card" id="choose-email-btn">
                                    <div class="choice-icon">📧</div>
                                    <div class="choice-text">
                                        <h4>Email Login</h4>
                                        <p>Use email for authentication</p>
                                    </div>
                                </div>
                                <div class="choice-card" id="choose-restore-btn">
                                    <div class="choice-icon">🔄</div>
                                    <div class="choice-text">
                                        <h4>Restore Session</h4>
                                        <p>Resume existing session</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="auth-step" id="tg-step-qr">
                            <div class="modal-body-center">
                                <div class="qr-frame">
                                    <div id="modal-qr-container"></div>
                                    <div class="qr-scan-line"></div>
                                </div>
                                <p class="qr-instruction">Scan with Telegram</p>
                                <p class="qr-sub-instruction">Settings → Devices → Link Desktop Device</p>
                                <button class="btn btn-secondary btn-auto" id="back-to-choice-1">Back</button>
                            </div>
                        </div>

                        <div class="auth-step" id="tg-step-phone">
                            <div class="input-group">
                                <label class="input-label">Phone Number</label>
                                <input type="tel" id="modal-tg-phone" class="input-field" placeholder="+1234567890" />
                            </div>
                            <button class="btn btn-primary" id="modal-send-code-btn">Send Verification Code</button>
                            <button class="btn btn-secondary" id="back-to-choice-2">Back</button>
                        </div>

                        <div class="auth-step" id="tg-step-email">
                            <div class="input-group">
                                <label class="input-label">Email Address</label>
                                <input type="email" id="modal-tg-email" class="input-field" placeholder="your@email.com" />
                            </div>
                            <button class="btn btn-primary" id="modal-send-email-btn">Continue</button>
                            <button class="btn btn-secondary" id="back-to-choice-3">Back</button>
                        </div>

                        <div class="auth-step" id="tg-step-code">
                            <p class="modal-description">Enter the 5-digit code sent to your Telegram app</p>
                            <div class="code-input-wrap">
                                <input type="text" id="modal-tg-code" class="input-field code-field" placeholder="00000" maxLength={6} />
                            </div>
                            <button class="btn btn-primary" id="modal-verify-code-btn">Verify & Link</button>
                        </div>

                        <div class="auth-step" id="tg-step-password">
                            <p class="modal-description">Two-Step Verification enabled. Enter your cloud password.</p>
                            <div class="input-group">
                                <input type="password" id="modal-tg-password" class="input-field" placeholder="Your Password" />
                            </div>
                            <button class="btn btn-primary" id="modal-verify-password-btn">Submit Password</button>
                        </div>

                        <div class="auth-step" id="tg-step-success">
                            <div class="modal-body-center">
                                <div class="success-icon">✓</div>
                                <h3 class="success-title">Connected!</h3>
                                <p class="modal-description">Your account has been successfully linked.</p>
                                <button class="btn btn-primary" onClick={() => location.reload()}>Great!</button>
                            </div>
                        </div>

                        <div class="auth-step" id="tg-step-loading">
                            <div class="modal-body-center loading-pad">
                                <div class="shimmer-loader"></div>
                                <p id="loading-text">Connecting to Telegram...</p>
                            </div>
                        </div>
                    </div>
                </div>

                <script type="module" src="/assets/js/dashboard.js"></script>
            </body>
        </html>
    );
};
