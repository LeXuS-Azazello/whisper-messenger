/** @jsxImportSource preact */
import React from 'preact/compat';
import { render } from 'preact-render-to-string';
import type { Env, UserSession } from '../../types';

export const renderDashboard = (user: UserSession, env: Env) => {
    const isTgConnected = !!user.session;

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
                <div class="container">
                    <header>
                        <div class="logo">
                            <div class="logo-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                                </svg>
                            </div>
                            <span class="logo-text">WHISPER MESSENGER</span>
                        </div>
                        <div class="user-profile">
                            <div class="user-info">
                                <span class="greeting">Welcome,</span>
                                <span class="name">{user.firstName}</span>
                            </div>
                            <button id="logout-btn" class="logout-link">Logout</button>
                        </div>
                    </header>

                    <div class="grid">
                        {/* Telegram Control */}
                        <div class="card tg-card">
                            <div class="card-header">
                                <h3 class="card-title">
                                    <span class="icon-tg">📱</span> Telegram Account
                                </h3>
                                <span class={`status-tag ${isTgConnected ? 'active' : 'inactive'}`}>
                                    {isTgConnected ? 'CONNECTED' : 'DISCONNECTED'}
                                </span>
                            </div>

                            <div id="tg-status-container" class="card-content" style={{ display: isTgConnected ? 'block' : 'none' }}>
                                <div class="status-box">
                                    <div class="bridge-info">
                                        <div class="avatar-icon tg-gradient">📱</div>
                                        <div class="bridge-details">
                                            <div class="bridge-label">Active Bridge</div>
                                            <div class="bridge-name">{user.firstName} {user.username ? `@${user.username}` : ''}</div>
                                            <div class="bridge-status">
                                                Status: <span class={user.isActive ? 'text-success' : 'text-danger'}>
                                                    {user.isActive ? 'ONLINE' : 'OFFLINE'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <p class="card-description">
                                        Your Telegram account is currently linked. Any voice or video message you receive will be automatically transcribed.
                                    </p>
                                    <div class="button-group-2">
                                        <button class="btn btn-secondary" id="test-tg-btn">Test</button>
                                        <button class="btn btn-secondary" id="restart-tg-btn">Restart</button>
                                        <button class="btn btn-danger btn-full" id="disconnect-tg-btn">Disconnect Account</button>
                                    </div>
                                </div>
                            </div>

                            <div id="tg-connect-prompt" class="card-content" style={{ display: isTgConnected ? 'none' : 'block' }}>
                                <div class="prompt-box">
                                    <div class="prompt-icon">🛰️</div>
                                    <h4>No Account Linked</h4>
                                    <p class="card-description">
                                        Connect your personal Telegram account to start transcribing voice messages in real-time.
                                    </p>
                                    <div class="button-grid">
                                        <button class="btn btn-primary btn-full" id="open-tg-modal-btn">Link Account</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Meta Integration */}
                        <div class="card meta-card">
                            <div class="card-header">
                                <h3 class="card-title">
                                    <span class="icon-ms">◉</span> Messenger / Insta
                                </h3>
                                <span class={`status-tag ${user.metaToken ? 'active' : 'inactive'}`}>
                                    {user.metaToken ? 'CONNECTED' : 'NOT SETUP'}
                                </span>
                            </div>
                            <div class="card-content">
                                <p class="card-description">
                                    Connect your Facebook Page or Instagram Business account to transcribe incoming voice messages automatically.
                                </p>

                                <div class="button-group-2">
                                    <a href="https://developers.facebook.com/apps/" target="_blank" class="btn btn-secondary btn-xs">📱 Developers</a>
                                    <a href="https://business.facebook.com/" target="_blank" class="btn btn-secondary btn-xs">💼 Business</a>
                                </div>

                                <div class="guide-toggle" onclick="this.nextElementSibling.classList.toggle('active'); this.classList.toggle('active')">
                                    <span>⚙️ Setup Instructions</span>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                </div>
                                <div class="setup-guide meta">
                                    <h4 class="guide-title">⚙️ Required App Settings:</h4>
                                    <div class="guide-content">
                                        <div class="guide-item">
                                            <strong>App Domains:</strong>
                                            <div class="copy-box">
                                                 <code onclick={`navigator.clipboard.writeText('${env.DOMAIN}')`}>{env.DOMAIN}</code>
                                                 <button class="copy-btn" onclick={`navigator.clipboard.writeText('${env.DOMAIN}')`}>📋</button>
                                            </div>
                                        </div>
                                        <div class="guide-item">
                                            <strong>Privacy Policy URL:</strong>
                                            <div class="copy-box">
                                                 <code onclick={`navigator.clipboard.writeText('https://${env.DOMAIN}/privacy')`}>{env.DOMAIN}/privacy</code>
                                                 <button class="copy-btn" onclick={`navigator.clipboard.writeText('https://${env.DOMAIN}/privacy')`}>📋</button>
                                            </div>
                                        </div>
                                        <div class="guide-item">
                                            <strong>OAuth Redirect URI:</strong>
                                            <div class="copy-box">
                                                 <code onclick={`navigator.clipboard.writeText('https://${env.DOMAIN}/auth/meta/callback')`}>.../auth/meta/callback</code>
                                                 <button class="copy-btn" onclick={`navigator.clipboard.writeText('https://${env.DOMAIN}/auth/meta/callback')`}>📋</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <button class="btn btn-primary" id="connect-meta-btn">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                                    Connect with Facebook
                                </button>
                                {user.metaToken && (
                                    <div class="status-verified">✓ Linked to active Page</div>
                                )}
                            </div>
                        </div>

                        {/* WhatsApp Integration */}
                        <div class="card wa-card">
                            <div class="card-header">
                                <h3 class="card-title">
                                    <span class="icon-wa">◉</span> WhatsApp
                                </h3>
                                <span class={`status-tag ${user.whatsappToken ? 'active' : 'inactive'}`}>
                                    {user.whatsappToken ? 'SETUP' : 'NOT SETUP'}
                                </span>
                            </div>
                            <div class="card-content">
                                <div class="button-group-2">
                                    <a href="https://business.facebook.com/wa/manage/phone-numbers/" target="_blank" class="btn btn-secondary btn-xs">📱 Manager</a>
                                    <a href="https://developers.facebook.com/apps/" target="_blank" class="btn btn-secondary btn-xs">⚙️ Developers</a>
                                </div>
                                <div class="guide-toggle" onclick="this.nextElementSibling.classList.toggle('active'); this.classList.toggle('active')">
                                    <span>⚙️ Webhook Setup</span>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                </div>
                                <div class="setup-guide wa">
                                    <h4 class="guide-title">⚙️ Webhook Setup:</h4>
                                    <div class="guide-content">
                                        <div class="guide-item">
                                            <strong>Callback URL:</strong>
                                            <div class="copy-box">
                                                 <code onclick={`navigator.clipboard.writeText('https://${env.DOMAIN}/webhooks/whatsapp')`}>.../webhooks/whatsapp</code>
                                                 <button class="copy-btn" onclick={`navigator.clipboard.writeText('https://${env.DOMAIN}/webhooks/whatsapp')`}>📋</button>
                                            </div>
                                        </div>
                                        <div class="guide-item">
                                            <strong>Verify Token:</strong>
                                            <div class="copy-box">
                                                <code class="dimmed">(Check Admin Panel)</code>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="input-group">
                                    <label class="input-label">Phone Number ID</label>
                                    <input type="text" id="wa-phone-id" class="input-field" value={user.whatsappPhoneId || ''} placeholder="1029384..." />
                                </div>
                                <div class="input-group">
                                    <label class="input-label">Access Token</label>
                                    <input type="password" id="wa-token" class="input-field" value={user.whatsappToken || ''} placeholder="EAANH..." />
                                </div>
                                <div class="button-group-2">
                                    <button class="btn btn-primary" id="save-wa-btn">Save Settings</button>
                                    {user.whatsappToken && <button class="btn btn-secondary" id="test-wa-btn">Test</button>}
                                </div>
                            </div>
                        </div>

                        {/* LINE Integration */}
                        <div class="card line-card">
                            <div class="card-header">
                                <h3 class="card-title">
                                    <span class="icon-line">◉</span> LINE
                                </h3>
                                <span class={`status-tag ${user.lineToken ? 'active' : 'inactive'}`}>
                                    {user.lineToken ? 'SETUP' : 'NOT SETUP'}
                                </span>
                            </div>
                            <div class="card-content">
                                <div class="button-group">
                                    <a href="https://developers.line.biz/console/" target="_blank" class="btn btn-secondary btn-xs">📱 Developers Console</a>
                                </div>
                                <div class="guide-toggle" onclick="this.nextElementSibling.classList.toggle('active'); this.classList.toggle('active')">
                                    <span>⚙️ Webhook Setup</span>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                </div>
                                <div class="setup-guide line">
                                    <h4 class="guide-title">⚙️ Webhook Setup:</h4>
                                    <div class="guide-content">
                                        <div class="guide-item">
                                            <strong>Webhook URL:</strong>
                                            <div class="copy-box">
                                                 <code onclick={`navigator.clipboard.writeText('https://${env.DOMAIN}/webhooks/line/${user.userId}')`}>.../webhooks/line/{user.userId.substring(0, 8)}...</code>
                                                 <button class="copy-btn" onclick={`navigator.clipboard.writeText('https://${env.DOMAIN}/webhooks/line/${user.userId}')`}>📋</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="input-group">
                                    <label class="input-label">Channel Access Token</label>
                                    <input type="password" id="line-token" class="input-field" value={user.lineToken || ''} placeholder="ey..." />
                                </div>
                                <button class="btn btn-primary" id="save-line-btn">Save Settings</button>
                            </div>
                        </div>

                        {/* Stats Box */}
                        <div class="card stats-card">
                            <div class="card-header">
                                <h3 class="card-title">My Stats</h3>
                            </div>
                            <div class="stats-content">
                                <div class="stat-highlight">
                                    <div class="stat-label">Total Transcriptions</div>
                                    <div class="stat-value">{user.transcriptionCount || 0}</div>
                                </div>
                                {user.lastActiveAt && (
                                    <div class="stat-footer">
                                        Last active: {new Date(user.lastActiveAt).toLocaleString()}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Threads Integration */}
                        <div class="card threads-card">
                            <div class="card-header">
                                <h3 class="card-title">@ Threads</h3>
                                <span class={`status-tag ${user.threadsToken ? 'active' : 'inactive'}`}>
                                    {user.threadsToken ? 'CONNECTED' : 'NOT SETUP'}
                                </span>
                            </div>
                            <div class="card-content">
                                <p class="card-description">
                                    Transcribe voice messages and replies from your personal Threads account.
                                </p>
                                <button class="btn btn-primary btn-threads" id="connect-threads-btn">
                                    Connect with Threads
                                </button>
                                {user.threadsToken && (
                                    <div class="verified-footer">User ID: {user.threadsUserId}</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Telegram Connection Modal */}
                <div class="modal-overlay" id="tg-modal-overlay">
                    <div class="modal-content">
                        <button class="modal-close" id="tg-modal-close">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                        <div class="modal-title">Connect Telegram</div>

                        {/* Step 1: Choice */}
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

                        {/* Step 2: QR Code */}
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

                        {/* Step 2: Phone Input */}
                        <div class="auth-step" id="tg-step-phone">
                            <div class="input-group">
                                <label class="input-label">Phone Number</label>
                                <input type="tel" id="modal-tg-phone" class="input-field" placeholder="+1234567890" />
                            </div>
                            <button class="btn btn-primary" id="modal-send-code-btn">Send Verification Code</button>
                            <button class="btn btn-secondary" id="back-to-choice-2">Back</button>
                        </div>

                        {/* Step 2: Email Input */}
                        <div class="auth-step" id="tg-step-email">
                            <div class="input-group">
                                <label class="input-label">Email Address</label>
                                <input type="email" id="modal-tg-email" class="input-field" placeholder="your@email.com" />
                            </div>
                            <button class="btn btn-primary" id="modal-send-email-btn">Continue</button>
                            <button class="btn btn-secondary" id="back-to-choice-3">Back</button>
                        </div>


                        {/* Step 3: Code Input */}
                        <div class="auth-step" id="tg-step-code">
                            <p class="modal-description">Enter the 5-digit code sent to your Telegram app</p>
                            <div class="code-input-wrap">
                                <input type="text" id="modal-tg-code" class="input-field code-field" placeholder="00000" maxLength={6} />
                            </div>
                            <button class="btn btn-primary" id="modal-verify-code-btn">Verify & Link</button>
                        </div>

                        {/* Step 4: Password Input */}
                        <div class="auth-step" id="tg-step-password">
                            <p class="modal-description">Two-Step Verification enabled. Enter your cloud password.</p>
                            <div class="input-group">
                                <input type="password" id="modal-tg-password" class="input-field" placeholder="Your Password" />
                            </div>
                            <button class="btn btn-primary" id="modal-verify-password-btn">Submit Password</button>
                        </div>

                        {/* Step: Success */}
                        <div class="auth-step" id="tg-step-success">
                            <div class="modal-body-center">
                                <div class="success-icon">✓</div>
                                <h3 class="success-title">Connected!</h3>
                                <p class="modal-description">Your account has been successfully linked.</p>
                                <button class="btn btn-primary" onclick="location.reload()">Great!</button>
                            </div>
                        </div>

                        {/* Step: Loading */}
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
