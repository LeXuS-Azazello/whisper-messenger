/** @jsxImportSource preact */
import React from 'preact/compat';
import { render } from 'preact-render-to-string';
import type { Env, UserSession } from '../../types';

export const renderDashboard = (user: UserSession, env: Env) => {
    const isTgConnected = !!user.session;
    const hasPassword = !!user.passwordHash;

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
                    {/* Sidebar Navigation */}
                    <aside class="sidebar">
                        <div class="sidebar-header">
                            <div class="logo">
                                <div class="logo-icon">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
                                    </svg>
                                </div>
                                <span class="logo-text">VOICEmsg.NET</span>
                            </div>
                        </div>

                        <nav class="sidebar-nav">
                            <button type="button" class="nav-item tab-btn active" data-tab="connections">
                                <span class="nav-icon">🔌</span>
                                <span class="nav-label">Connections</span>
                            </button>
                            <button type="button" class="nav-item tab-btn" data-tab="stats">
                                <span class="nav-icon">📊</span>
                                <span class="nav-label">Statistics</span>
                            </button>
                            <button type="button" class="nav-item tab-btn" data-tab="profile">
                                <span class="nav-icon">👤</span>
                                <span class="nav-label">Profile</span>
                            </button>
                            <button type="button" class="nav-item tab-btn" data-tab="referrals">
                                <span class="nav-icon">🎁</span>
                                <span class="nav-label">Referrals</span>
                            </button>
                            <button type="button" class="nav-item tab-btn" data-tab="billing">
                                <span class="nav-icon">💳</span>
                                <span class="nav-label">Billing</span>
                            </button>
                        </nav>

                        <div class="sidebar-footer">
                            <div class="user-avatar-wrap">
                                <div class="user-avatar">{user.firstName ? user.firstName.charAt(0).toUpperCase() : 'U'}</div>
                                <div class="user-details">
                                    <div class="user-name">{user.firstName}</div>
                                    <div class="user-role">{user.email || 'Free Tier Account'}</div>
                                </div>
                            </div>
                            <button type="button" id="logout-btn" class="sidebar-logout-btn">
                                <span>Logout</span> ➔
                            </button>
                        </div>
                    </aside>

                    {/* Mobile Header */}
                    <header class="mobile-header">
                        <div class="logo">
                            <div class="logo-icon">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
                                </svg>
                            </div>
                            <span class="logo-text">WHISPER</span>
                        </div>
                        <button type="button" id="mobile-logout-btn" class="logout-link">Logout</button>
                    </header>

                    {/* Main Content Area */}
                    <main class="main-content">
                        {/* Top Bar / Heading */}
                        <div class="top-bar">
                            <div class="top-bar-heading">
                                <h1 class="section-title" id="current-section-title">Connections</h1>
                                <p class="section-subtitle" id="current-section-subtitle">Manage your linked accounts and messaging channels</p>
                            </div>
                            <div class="top-bar-actions">
                                <div class="stat-badge-mini">
                                    <span class="badge-dot"></span>
                                    <span class="badge-text" id="stat-count-badge">{user.transcriptionCount || 0} Transcribed</span>
                                </div>
                            </div>
                        </div>

                        {/* Tab Content Panes */}
                        <div class="tab-contents">

                            {/* Pane 1: Connections */}
                            <div class="tab-pane active" id="pane-connections">
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
                                                        <div class="bridge-name">{user.username ? `@${user.username}` : user.firstName}</div>
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

                                            <div class="guide-toggle" onClick={(e) => { e.currentTarget.nextElementSibling?.classList.toggle('active'); e.currentTarget.classList.toggle('active'); }}>
                                                <span>⚙️ Setup Instructions</span>
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                            </div>
                                            <div class="setup-guide meta">
                                                <h4 class="guide-title">⚙️ Required App Settings:</h4>
                                                <div class="guide-content">
                                                    <div class="guide-item">
                                                        <strong>App Domains:</strong>
                                                        <div class="copy-box">
                                                            <code onClick={() => navigator.clipboard.writeText(env.DOMAIN || '')}>{env.DOMAIN}</code>
                                                            <button class="copy-btn" onClick={() => navigator.clipboard.writeText(env.DOMAIN || '')}>📋</button>
                                                        </div>
                                                    </div>
                                                    <div class="guide-item">
                                                        <strong>Privacy Policy URL:</strong>
                                                        <div class="copy-box">
                                                            <code onClick={() => navigator.clipboard.writeText(`https://${env.DOMAIN || ''}/privacy`)}>{env.DOMAIN}/privacy</code>
                                                            <button class="copy-btn" onClick={() => navigator.clipboard.writeText(`https://${env.DOMAIN || ''}/privacy`)}>📋</button>
                                                        </div>
                                                    </div>
                                                    <div class="guide-item">
                                                        <strong>OAuth Redirect URI:</strong>
                                                        <div class="copy-box">
                                                            <code onClick={() => navigator.clipboard.writeText(`https://${env.DOMAIN || ''}/auth/meta/callback`)}>.../auth/meta/callback</code>
                                                            <button class="copy-btn" onClick={() => navigator.clipboard.writeText(`https://${env.DOMAIN || ''}/auth/meta/callback`)}>📋</button>
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
                                            {/* WhatsApp Web Integration */}
                                            <div class="card wa-web-card">
                                                <div class="card-header">
                                                    <h3 class="card-title">
                                                        <span class="icon-wa-web">◉</span> WhatsApp Web
                                                    </h3>
                                                    <span id="wa-web-status" class="status-tag inactive">
                                                        NOT CONNECTED
                                                    </span>
                                                </div>
                                                <div class="card-content">
                                                    <p class="card-description">
                                                        Connect your personal WhatsApp account instantly using a QR code (recommended) or a Phone Pairing Code.
                                                    </p>

                                                    <div class="sub-tabs-container">
                                                        <button class="sub-tab-btn active" id="wa-tab-qr" type="button">QR Code</button>
                                                        <button class="sub-tab-btn" id="wa-tab-code" type="button">Phone Pairing Code</button>
                                                    </div>

                                                    {/* Tab 1: QR Code */}
                                                    <div id="wa-qr-container-tab" class="sub-tab-pane">
                                                        <div id="wa-web-qr-container" style={{ display: 'none', textAlign: 'center', marginBottom: '1rem' }}>
                                                            <div class="qr-wrapper" style={{ background: 'white', padding: '10px', display: 'inline-block', borderRadius: '8px' }}>
                                                                <img id="wa-web-qr-img" src="" style={{ width: '200px', height: '200px' }} />
                                                            </div>
                                                            <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '8px' }}>Scan this QR code with WhatsApp</p>
                                                        </div>
                                                        <div class="button-group-2">
                                                            <button class="btn btn-primary" id="connect-wa-web-btn">
                                                                Generate QR Code
                                                            </button>
                                                            <button class="btn btn-danger btn-xs" id="disconnect-wa-web-btn" style={{ display: 'none' }}>
                                                                Disconnect
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Tab 2: Phone Pairing Code */}
                                                    <div id="wa-code-container-tab" class="sub-tab-pane" style={{ display: 'none' }}>
                                                        <div class="input-group">
                                                            <label class="input-label">Phone Number (with country code, e.g. +79991234567)</label>
                                                            <input type="text" id="wa-phone-number" class="input-field" placeholder="+7 (999) 123-45-67" />
                                                        </div>

                                                        <div id="wa-pairing-code-display" style={{ display: 'none', textAlign: 'center', margin: '1rem 0' }}>
                                                            <span style={{ fontSize: '12px', color: 'var(--text-dim)', display: 'block', marginBottom: '8px' }}>Your Pairing Code:</span>
                                                            <div class="pairing-code-box" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '1rem', borderRadius: '12px', display: 'inline-block', fontFamily: 'monospace', fontSize: '24px', fontWeight: 'bold', color: '#a78bfa', letterSpacing: '2px' }}>
                                                                <span id="wa-pairing-code-text">-</span>
                                                            </div>
                                                            <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '8px' }}>Enter this code on your phone in WhatsApp Web - Link with Phone Number</p>
                                                        </div>

                                                        <div class="button-group-2" style={{ marginTop: '1rem' }}>
                                                            <button class="btn btn-primary" id="wa-get-code-btn">
                                                                Get Pairing Code
                                                            </button>
                                                            <button class="btn btn-danger btn-xs" id="disconnect-wa-web-code-btn" style={{ display: 'none' }}>
                                                                Disconnect
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Facebook Messenger (FCA) Integration */}
                                            <div class="card fb-fca-card">
                                                <div class="card-header">
                                                    <h3 class="card-title">
                                                        <span class="icon-fb-fca">◉</span> Facebook Messenger (FCA)
                                                    </h3>
                                                    <span id="fb-fca-status" class="status-tag inactive">
                                                        NOT CONNECTED
                                                    </span>
                                                </div>
                                                <div class="card-content">
                                                    <p class="card-description">
                                                        Connect your Facebook Messenger account using AppState JSON (recommended) or your login credentials.
                                                    </p>

                                                    <div class="sub-tabs-container">
                                                        <button class="sub-tab-btn active" id="fb-tab-appstate" type="button">AppState JSON</button>
                                                        <button class="sub-tab-btn" id="fb-tab-creds" type="button">Login Credentials</button>
                                                    </div>

                                                    <div id="fb-appstate-container" class="sub-tab-pane">
                                                        <div class="input-group">
                                                            <label class="input-label">AppState JSON (Recommended)</label>
                                                            <textarea id="fb-appstate" class="input-field" rows={4} placeholder='[{"key": "c_user", "value": "..."}]' style={{ fontFamily: 'monospace', fontSize: '12px' }} />
                                                        </div>
                                                    </div>

                                                    <div id="fb-creds-container" class="sub-tab-pane" style={{ display: 'none' }}>
                                                        <div class="input-group">
                                                            <label class="input-label">Email / Username</label>
                                                            <input type="text" id="fb-email" class="input-field" placeholder="email@example.com" />
                                                        </div>
                                                        <div class="input-group">
                                                            <label class="input-label">Password</label>
                                                            <input type="password" id="fb-password" class="input-field" placeholder="••••••••" />
                                                        </div>
                                                    </div>

                                                    <div class="button-group-2" style={{ marginTop: '1rem' }}>
                                                        <button class="btn btn-primary" id="connect-fb-fca-btn">
                                                            Connect Account
                                                        </button>
                                                        <button class="btn btn-danger btn-xs" id="disconnect-fb-fca-btn" style={{ display: 'none' }}>
                                                            Disconnect
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Instagram FCA Integration */}
                                            <div class="card insta-fca-card">
                                                <div class="card-header">
                                                    <h3 class="card-title">
                                                        <span class="icon-insta-fca">◉</span> Instagram Direct (FCA)
                                                    </h3>
                                                    <span id="insta-fca-status" class="status-tag inactive">
                                                        NOT CONNECTED
                                                    </span>
                                                </div>
                                                <div class="card-content">
                                                    <p class="card-description">
                                                        Connect your Instagram account to transcribe voice messages from Direct Messages automatically.
                                                    </p>

                                                    <div class="input-group">
                                                        <label class="input-label">Instagram Username</label>
                                                        <input type="text" id="insta-username" class="input-field" placeholder="username" />
                                                    </div>
                                                    <div class="input-group">
                                                        <label class="input-label">Password</label>
                                                        <input type="password" id="insta-password" class="input-field" placeholder="••••••••" />
                                                    </div>

                                                    <div class="button-group-2" style={{ marginTop: '1rem' }}>
                                                        <button class="btn btn-primary" id="connect-insta-fca-btn">
                                                            Connect Account
                                                        </button>
                                                        <button class="btn btn-danger btn-xs" id="disconnect-insta-fca-btn" style={{ display: 'none' }}>
                                                            Disconnect
                                                        </button>
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
                                                    <p class="card-description">
                                                        Connect to LINE Developer Console to capture and transcribe user voice files in personal messages.
                                                    </p>
                                                    <div class="button-group">
                                                        <a href="https://developers.line.biz/console/" target="_blank" class="btn btn-secondary btn-xs">📱 Developers Console</a>
                                                    </div>
                                                    <div class="guide-toggle" onClick={(e) => { e.currentTarget.nextElementSibling?.classList.toggle('active'); e.currentTarget.classList.toggle('active'); }}>
                                                        <span>⚙️ Webhook Setup</span>
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                                    </div>
                                                    <div class="setup-guide line">
                                                        <h4 class="guide-title">⚙️ Webhook Setup:</h4>
                                                        <div class="guide-content">
                                                            <div class="guide-item">
                                                                <strong>Webhook URL:</strong>
                                                                <div class="copy-box">
                                                                    <code onClick={() => navigator.clipboard.writeText(`https://${env.DOMAIN}/webhooks/line/${user.userId}`)}>.../webhooks/line/{user.userId.substring(0, 8)}...</code>
                                                                    <button class="copy-btn" onClick={() => navigator.clipboard.writeText(`https://${env.DOMAIN}/webhooks/line/${user.userId}`)}>📋</button>
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

                                            {/* Threads Integration DISABLED FOR NOW*/}
                                            <div style={{ display: 'none' }} class="card threads-card">
                                                <div class="card-header">
                                                    <h3 class="card-title">@ Threads</h3>
                                                    <span class={`status-tag ${user.threadsToken ? 'active' : 'inactive'}`}>
                                                        {user.threadsToken ? 'CONNECTED' : 'NOT SETUP'}
                                                    </span>
                                                </div>
                                                <div class="card-content">
                                                    <p class="card-description">
                                                        Transcribe voice messages and replies from your personal Threads account automatically.
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

                                    {/* Pane 2: Statistics */}
                                    <div class="tab-pane" id="pane-stats">
                                        <div class="grid stats-grid-top">
                                            <div class="card stats-primary-card">
                                                <div class="card-header">
                                                    <h3 class="card-title">📈 Overall Statistics</h3>
                                                </div>
                                                <div class="stats-content">
                                                    <div class="stat-highlight">
                                                        <div class="stat-label">Total Transcriptions</div>
                                                        <div class="stat-value">{user.transcriptionCount || 0}</div>
                                                    </div>
                                                    {user.lastActiveAt && (
                                                        <div class="stat-footer">
                                                            Last active session: {new Date(user.lastActiveAt).toLocaleString()}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div class="card usage-tier-card">
                                                <div class="card-header">
                                                    <h3 class="card-title">⚙️ Quota & Usage</h3>
                                                </div>
                                                <div class="card-content">
                                                    <div class="quota-box">
                                                        <div class="quota-progress-header">
                                                            <span class="quota-title">Monthly Allotment</span>
                                                            <span class="quota-stats">{user.transcriptionCount || 0} / 1,000 Transcriptions</span>
                                                        </div>
                                                        <div class="quota-bar-bg">
                                                            <div class="quota-bar-fill" style={{ width: `${Math.min(((user.transcriptionCount || 0) / 1000) * 100, 100)}%` }}></div>
                                                        </div>
                                                        <div class="quota-info-meta">
                                                            <span>Tier: Silver Member Plan</span>
                                                            <span>Resets in: 12 days</span>
                                                        </div>
                                                    </div>
                                                    <div class="platform-breakdown">
                                                        <h4 class="breakdown-title">Platform Statuses</h4>
                                                        <div class="breakdown-list">
                                                            <div class="breakdown-item">
                                                                <span>Telegram Bridge</span>
                                                                <span class={`status-dot-mini ${isTgConnected ? 'active' : 'inactive'}`}></span>
                                                            </div>
                                                            <div class="breakdown-item" style={{ display: 'none' }}>
                                                                <span>Facebook Messenger</span>
                                                                <span class={`status-dot-mini ${user.metaToken ? 'active' : 'inactive'}`}></span>
                                                            </div>
                                                            <div class="breakdown-item">
                                                                <span>WhatsApp Gateway</span>
                                                                <span class={`status-dot-mini ${user.whatsappToken ? 'active' : 'inactive'}`}></span>
                                                            </div>
                                                            <div style={{ display: 'none' }} class="breakdown-item">
                                                                <span>Threads Listener</span>
                                                                <span class={`status-dot-mini ${user.threadsToken ? 'active' : 'inactive'}`}></span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div class="grid stats-grid-bottom" style={{ marginTop: '1.5rem' }}>
                                            {/* SVG-drawn modern bar chart */}
                                            <div class="card chart-card">
                                                <div class="card-header">
                                                    <h3 class="card-title">📊 Daily Transcription Frequency (Last 7 Days)</h3>
                                                </div>
                                                <div class="card-content">
                                                    <div class="bar-chart">
                                                        <div class="bar-item">
                                                            <div class="bar-value" style="height: 45px;"><span class="bar-text">9</span></div>
                                                            <div class="bar-label">Mon</div>
                                                        </div>
                                                        <div class="bar-item">
                                                            <div class="bar-value" style="height: 70px;"><span class="bar-text">14</span></div>
                                                            <div class="bar-label">Tue</div>
                                                        </div>
                                                        <div class="bar-item">
                                                            <div class="bar-value" style="height: 110px;"><span class="bar-text">22</span></div>
                                                            <div class="bar-label">Wed</div>
                                                        </div>
                                                        <div class="bar-item">
                                                            <div class="bar-value" style="height: 55px;"><span class="bar-text">11</span></div>
                                                            <div class="bar-label">Thu</div>
                                                        </div>
                                                        <div class="bar-item">
                                                            <div class="bar-value active" style="height: 160px;"><span class="bar-text">32</span></div>
                                                            <div class="bar-label">Fri</div>
                                                        </div>
                                                        <div class="bar-item">
                                                            <div class="bar-value" style="height: 35px;"><span class="bar-text">7</span></div>
                                                            <div class="bar-label">Sat</div>
                                                        </div>
                                                        <div class="bar-item">
                                                            <div class="bar-value" style="height: 25px;"><span class="bar-text">4</span></div>
                                                            <div class="bar-label">Sun</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Pane 3: Profile */}
                                    <div class="tab-pane" id="pane-profile">
                                        <div class="grid profile-grid">
                                            {/* Account information details */}
                                            <div class="card profile-info-card">
                                                <div class="card-header">
                                                    <h3 class="card-title">👤 Account Settings</h3>
                                                </div>
                                                <div class="card-content">
                                                    <div class="profile-details-list">
                                                        <div class="profile-detail-item">
                                                            <span class="detail-lbl">User identifier</span>
                                                            <span class="detail-val select-all">{user.userId}</span>
                                                        </div>
                                                        <div class="profile-detail-item">
                                                            <span class="detail-lbl">First Name</span>
                                                            <span class="detail-val">{user.firstName}</span>
                                                        </div>
                                                        <div class="profile-detail-item">
                                                            <span class="detail-lbl">Primary Email</span>
                                                            <span class="detail-val">{user.email || 'Google Account Linked'}</span>
                                                        </div>
                                                        <div class="profile-detail-item">
                                                            <span class="detail-lbl">Registered Date</span>
                                                            <span class="detail-val">{new Date(user.createdAt).toLocaleDateString()}</span>
                                                        </div>
                                                        <div class="profile-detail-item">
                                                            <span class="detail-lbl">OAuth Authentication</span>
                                                            <span class="detail-val text-success">{hasPassword ? 'Password Set' : 'Google OAuth'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Change Password Form / Google Info */}
                                            <div class="card password-change-card">
                                                <div class="card-header">
                                                    <h3 class="card-title">🔑 Change Password</h3>
                                                </div>
                                                <div class="card-content">
                                                    {hasPassword ? (
                                                        <div id="change-pwd-form" class="form-container">
                                                            <div class="input-group">
                                                                <label class="input-label">Old Password</label>
                                                                <input type="password" id="profile-old-pwd" class="input-field" placeholder="••••••••" required />
                                                            </div>
                                                            <div class="input-group">
                                                                <label class="input-label">New Password</label>
                                                                <input type="password" id="profile-new-pwd" class="input-field" placeholder="Min 6 characters" required />
                                                            </div>
                                                            <div class="input-group">
                                                                <label class="input-label">Confirm New Password</label>
                                                                <input type="password" id="profile-confirm-pwd" class="input-field" placeholder="••••••••" required />
                                                            </div>
                                                            <button class="btn btn-primary" id="save-pwd-btn">Update Password</button>
                                                        </div>
                                                    ) : (
                                                        <div class="oauth-info-box">
                                                            <div class="oauth-icon">🛡️</div>
                                                            <h4>Google OAuth Login Active</h4>
                                                            <p class="card-description">
                                                                Your account is linked and authenticated directly via Google. No database password is set or required.
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div class="grid profile-delete-grid" style={{ marginTop: '1.5rem' }}>
                                            {/* Delete Account */}
                                            <div class="card delete-account-card">
                                                <div class="card-header">
                                                    <h3 class="card-title text-danger">⚠️ Danger Zone</h3>
                                                </div>
                                                <div class="card-content">
                                                    <p class="card-description">
                                                        Deleting your account is permanent. It will instantly stop all transcription listeners, shut down your Telegram integration pods, wipe your active access tokens, and permanently delete your database user credentials.
                                                    </p>
                                                    <div class="delete-confirmation-wrap">
                                                        <label class="checkbox-container">
                                                            <input type="checkbox" id="profile-delete-agree" />
                                                            <span class="checkmark"></span>
                                                            <span class="checkbox-label">I explicitly consent to permanently and irreversibly delete my account and integrations.</span>
                                                        </label>
                                                        <button class="btn btn-danger btn-full" id="profile-delete-btn" disabled>
                                                            Delete My Entire Account
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Pane 4: Referrals */}
                                    <div class="tab-pane" id="pane-referrals">
                                        <div class="card referrals-welcome-card">
                                            <div class="referrals-banner-content">
                                                <h2>🎁 Refer a Friend & Get 20% Recurring Commission!</h2>
                                                <p>Share your personalized referral code. If your referrals upgrade to the Pro plan, you will continuously earn 20% of their subscription value paid out monthly.</p>
                                            </div>
                                        </div>

                                        <div class="grid referrals-stats-grid" style={{ marginTop: '1.5rem' }}>
                                            <div class="card ref-link-card">
                                                <div class="card-header">
                                                    <h3 class="card-title">Share Your Referral Link</h3>
                                                </div>
                                                <div class="card-content">
                                                    <p class="card-description">Copy this link and send it to your friends or share on social media.</p>
                                                    <div class="copy-box ref-copy-box">
                                                        <code id="ref-link-text" onClick={() => navigator.clipboard.writeText(`https://voicemsg.net/ref/${user.userId.substring(0, 8)}`)}>
                                                            https://voicemsg.net/ref/{user.userId.substring(0, 8)}
                                                        </code>
                                                        <button class="copy-btn" id="ref-copy-btn" onClick={() => navigator.clipboard.writeText(`https://voicemsg.net/ref/${user.userId.substring(0, 8)}`)}>📋</button>
                                                    </div>
                                                    <div class="referral-social-share" style={{ marginTop: '1.25rem' }}>
                                                        <span class="social-share-title">Quick Share:</span>
                                                        <div class="social-buttons">
                                                            <button class="btn btn-secondary btn-xs">Telegram</button>
                                                            <button class="btn btn-secondary btn-xs">Twitter</button>
                                                            <button class="btn btn-secondary btn-xs">WhatsApp</button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div class="card ref-metrics-card">
                                                <div class="card-header">
                                                    <h3 class="card-title">Earnings & Statistics</h3>
                                                </div>
                                                <div class="card-content">
                                                    <div class="metrics-grid">
                                                        <div class="metric-item">
                                                            <span class="metric-val">12</span>
                                                            <span class="metric-lbl">Total Invited</span>
                                                        </div>
                                                        <div class="metric-item">
                                                            <span class="metric-val">3</span>
                                                            <span class="metric-lbl">Pro Referrals</span>
                                                        </div>
                                                        <div class="metric-item">
                                                            <span class="metric-val">$14.50</span>
                                                            <span class="metric-lbl">Earned Balance</span>
                                                        </div>
                                                    </div>
                                                    <button class="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => alert('Withdrawals are processed automatically once the balance exceeds $50.00 USD.')}>
                                                        Request Payout (Min $50)
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <div class="card ref-list-card" style={{ marginTop: '1.5rem' }}>
                                            <div class="card-header">
                                                <h3 class="card-title">Recent Referrals List</h3>
                                            </div>
                                            <div class="card-content">
                                                <div class="user-table-container">
                                                    <table class="user-table">
                                                        <thead>
                                                            <tr>
                                                                <th>User Name</th>
                                                                <th>Date Joined</th>
                                                                <th>Referral Plan</th>
                                                                <th>Monthly Pay</th>
                                                                <th>Status</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            <tr>
                                                                <td>alex_k****@gmail.com</td>
                                                                <td>May 14, 2026</td>
                                                                <td>Pro Tier</td>
                                                                <td>$2.00 / mo</td>
                                                                <td><span class="status-tag active">ACTIVE</span></td>
                                                            </tr>
                                                            <tr>
                                                                <td>natasha_****@mail.ru</td>
                                                                <td>May 10, 2026</td>
                                                                <td>Free Tier</td>
                                                                <td>$0.00</td>
                                                                <td><span class="status-tag active">ACTIVE</span></td>
                                                            </tr>
                                                            <tr>
                                                                <td>dmitry_p****@yandex.ru</td>
                                                                <td>April 28, 2026</td>
                                                                <td>Pro Tier</td>
                                                                <td>$2.00 / mo</td>
                                                                <td><span class="status-tag active">ACTIVE</span></td>
                                                            </tr>
                                                            <tr>
                                                                <td>serg****@outlook.com</td>
                                                                <td>April 15, 2026</td>
                                                                <td>Free Tier</td>
                                                                <td>$0.00</td>
                                                                <td><span class="status-tag inactive">EXPIRED</span></td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Pane 5: Billing */}
                                    <div class="tab-pane" id="pane-billing">
                                        <div class="grid billing-overview-grid">
                                            <div class="card billing-plan-card">
                                                <div class="card-header">
                                                    <h3 class="card-title">💳 Subscription Plan</h3>
                                                    <span class="status-tag active">Active</span>
                                                </div>
                                                <div class="card-content">
                                                    <div class="billing-details-summary">
                                                        <div class="plan-hero">
                                                            <span class="plan-hero-subtitle">CURRENT SUBSCRIPTION</span>
                                                            <span class="plan-hero-title">Silver Dev Plan</span>
                                                            <span class="plan-hero-desc">Free early-bird preview access with up to 1,000 monthly voice message transcriptions.</span>
                                                        </div>
                                                        <div class="plan-meta-stats">
                                                            <div class="plan-meta-item">
                                                                <span>Price</span>
                                                                <strong>$0.00 USD / mo</strong>
                                                            </div>
                                                            <div class="plan-meta-item">
                                                                <span>Billing Cycle</span>
                                                                <strong>Monthly Recurring</strong>
                                                            </div>
                                                            <div class="plan-meta-item">
                                                                <span>Renewal Date</span>
                                                                <strong>June 1, 2026</strong>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div class="card billing-limits-card">
                                                <div class="card-header">
                                                    <h3 class="card-title">💎 Features Included</h3>
                                                </div>
                                                <div class="card-content">
                                                    <ul class="billing-features-list">
                                                        <li>✓ High-fidelity large-v3-turbo Whisper model</li>
                                                        <li>✓ Automate Telegram personal chats transcription</li>
                                                        <li>✓ Automate Facebook Pages & Instagram Direct</li>
                                                        <li>✓ WhatsApp Business cloud webhook replies</li>
                                                        <li>✓ Real-time direct Redis queue processing</li>
                                                        <li>✓ Up to 1,000 operations monthly</li>
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>

                                        <div class="card billing-pricing-card" style={{ marginTop: '1.5rem' }}>
                                            <div class="card-header">
                                                <h3 class="card-title">⚡ Plan Upgrades</h3>
                                            </div>
                                            <div class="card-content">
                                                <div class="grid pricing-tiers-grid">
                                                    <div class="pricing-card">
                                                        <div class="price-header">
                                                            <span class="tier-name">Free Plan</span>
                                                            <div class="tier-price">$0 <span>/ mo</span></div>
                                                        </div>
                                                        <ul class="tier-features">
                                                            <li>Up to 50 transcriptions/mo</li>
                                                            <li>1 Telegram bridge active</li>
                                                            <li>Standard transcription queue</li>
                                                        </ul>
                                                        <button class="btn btn-secondary btn-full" disabled>Active Tier</button>
                                                    </div>

                                                    <div class="pricing-card active">
                                                        <div class="price-header">
                                                            <span class="tier-name">Pro Member Plan</span>
                                                            <div class="tier-price">$9.99 <span>/ mo</span></div>
                                                            <span class="pricing-badge-popular">POPULAR</span>
                                                        </div>
                                                        <ul class="tier-features">
                                                            <li>Unlimited transcriptions/mo</li>
                                                            <li>5 Telegram bridges active</li>
                                                            <li>Priority transcription queue</li>
                                                            <li>WhatsApp advanced replies</li>
                                                            <li>Priority chat support</li>
                                                        </ul>
                                                        <button class="btn btn-primary btn-full" onClick={() => alert('Payment gateway integration will be launched soon! Stay tuned.')}>Upgrade to Pro</button>
                                                    </div>

                                                    <div class="pricing-card">
                                                        <div class="price-header">
                                                            <span class="tier-name">Enterprise Dev</span>
                                                            <div class="tier-price">$49.99 <span>/ mo</span></div>
                                                        </div>
                                                        <ul class="tier-features">
                                                            <li>Unlimited Telegram bridges</li>
                                                            <li>Custom LLM prompt overrides</li>
                                                            <li>Full Webhook delivery log access</li>
                                                            <li>Direct server API keys</li>
                                                            <li>24/7 dedicated support manager</li>
                                                        </ul>
                                                        <button class="btn btn-secondary btn-full" onClick={() => alert('Please contact enterprise sales: sales@voicemsg.net')}>Contact Sales</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div class="card invoice-history-card" style={{ marginTop: '1.5rem' }}>
                                            <div class="card-header">
                                                <h3 class="card-title">🧾 Payment & Invoice History</h3>
                                            </div>
                                            <div class="card-content">
                                                <div class="user-table-container">
                                                    <table class="user-table">
                                                        <thead>
                                                            <tr>
                                                                <th>Invoice ID</th>
                                                                <th>Date Generated</th>
                                                                <th>Subscription Plan</th>
                                                                <th>Charged Amount</th>
                                                                <th>Payment Method</th>
                                                                <th>Status</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            <tr>
                                                                <td>INV-2026-003</td>
                                                                <td>May 1, 2026</td>
                                                                <td>Silver Dev Plan</td>
                                                                <td>$0.00 USD</td>
                                                                <td>Subscription Promotion</td>
                                                                <td><span class="status-tag active">PAID</span></td>
                                                            </tr>
                                                            <tr>
                                                                <td>INV-2026-002</td>
                                                                <td>April 1, 2026</td>
                                                                <td>Silver Dev Plan</td>
                                                                <td>$0.00 USD</td>
                                                                <td>Subscription Promotion</td>
                                                                <td><span class="status-tag active">PAID</span></td>
                                                            </tr>
                                                            <tr>
                                                                <td>INV-2026-001</td>
                                                                <td>March 1, 2026</td>
                                                                <td>Silver Dev Plan</td>
                                                                <td>$0.00 USD</td>
                                                                <td>Subscription Promotion</td>
                                                                <td><span class="status-tag active">PAID</span></td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            </div>

                            {/* Glassmorphic Bottom Nav Bar for Mobile Screens */}
                            <nav class="bottom-nav">
                                <button type="button" class="bottom-nav-item tab-btn active" data-tab="connections">
                                    <span class="bottom-nav-icon">🔌</span>
                                    <span class="bottom-nav-label">Connect</span>
                                </button>
                                <button type="button" class="bottom-nav-item tab-btn" data-tab="stats">
                                    <span class="bottom-nav-icon">📊</span>
                                    <span class="bottom-nav-label">Stats</span>
                                </button>
                                <button type="button" class="bottom-nav-item tab-btn" data-tab="profile">
                                    <span class="bottom-nav-icon">👤</span>
                                    <span class="bottom-nav-label">Profile</span>
                                </button>
                                <button type="button" class="bottom-nav-item tab-btn" data-tab="referrals">
                                    <span class="bottom-nav-icon">🎁</span>
                                    <span class="bottom-nav-label">Refs</span>
                                </button>
                                <button type="button" class="bottom-nav-item tab-btn" data-tab="billing">
                                    <span class="bottom-nav-icon">💳</span>
                                    <span class="bottom-nav-label">Billing</span>
                                </button>
                            </nav>

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
                                            <button class="btn btn-primary" onClick={() => location.reload()}>Great!</button>
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
                        </div>
                    </main>
                </div>
                <script type="module" src="/assets/js/dashboard.js"></script>
            </body>
        </html>
    );
};