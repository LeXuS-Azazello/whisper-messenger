/** @jsxImportSource preact */
import { render } from 'preact-render-to-string';
import { UserSession } from './types';

const adminCss = `:root {
    --primary: #8B5CF6;
    --primary-glow: rgba(139, 92, 246, 0.4);
    --bg-dark: #0F172A;
    --card-bg: rgba(30, 41, 59, 0.7);
    --text-main: #F1F5F9;
    --text-dim: #94A3B8;
    --success: #10B981;
    --danger: #EF4444;
    --warning: #F59E0B;
}

/* Progress Bar */
#progress-bar {
    position: fixed;
    top: 0;
    left: 0;
    height: 3px;
    background: var(--primary);
    box-shadow: 0 0 10px var(--primary-glow);
    z-index: 9999;
    width: 0;
    transition: width 0.3s ease;
    display: none;
}


* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Outfit', sans-serif;
    background-color: var(--bg-dark);
    background-image: 
        radial-gradient(at 0% 0%, rgba(139, 92, 246, 0.15) 0px, transparent 50%),
        radial-gradient(at 100% 100%, rgba(59, 130, 246, 0.1) 0px, transparent 50%);
    color: var(--text-main);
    min-height: 100vh;
    overflow-x: hidden;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
}

.card {
    background: var(--card-bg);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 24px;
    padding: 1.5rem;
    transition: all 0.3s ease;
}

.btn {
    background: var(--primary);
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    width: 100%;
    margin-top: 1rem;
}

.btn:hover {
    background: #7C3AED;
    transform: scale(1.02);
    box-shadow: 0 0 20px var(--primary-glow);
}

.btn-xs {
    padding: 0.25rem 0.5rem;
    font-size: 10px;
    border-radius: 6px;
    width: auto;
    margin: 0;
    transform: none;
}

.btn-xs:hover {
    transform: none;
}

header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 3rem;
    animation: fadeInDown 0.8s ease-out;
}

.logo {
    font-size: 1.5rem;
    font-weight: 800;
    background: linear-gradient(135deg, #fff 0%, var(--primary) 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.logo-icon {
    width: 32px;
    height: 32px;
    background: var(--primary);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 20px var(--primary-glow);
}

.status-badge {
    background: rgba(16, 185, 129, 0.1);
    color: var(--success);
    padding: 0.5rem 1rem;
    border-radius: 99px;
    font-size: 0.875rem;
    font-weight: 600;
    border: 1px solid rgba(16, 185, 129, 0.2);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    transition: transform 0.2s;
}

.status-badge:hover {
    transform: scale(1.05);
}

.status-dot {
    width: 8px;
    height: 8px;
    background: var(--success);
    border-radius: 50%;
    box-shadow: 0 0 10px var(--success);
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.4); opacity: 0.6; }
    100% { transform: scale(1); opacity: 1; }
}

.grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
    animation: fadeInUp 0.8s ease-out;
}

.card:hover {
    transform: translateY(-5px);
    border-color: rgba(139, 92, 246, 0.3);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
}

.card-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-dim);
}

.config-list { list-style: none; }
.config-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.config-item:last-child { border-bottom: none; }

.config-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    color: var(--text-dim);
}

.config-value { font-weight: 600; font-size: 0.875rem; }
.configured { color: var(--success); }
.missing { color: var(--danger); }

.status-tag {
    font-size: 10px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
.status-tag.active {
    background: rgba(16, 185, 129, 0.15);
    color: var(--success);
    border: 1px solid rgba(16, 185, 129, 0.3);
}
.status-tag.inactive {
    background: rgba(239, 68, 68, 0.1);
    color: var(--danger);
    border: 1px solid rgba(239, 68, 68, 0.2);
}

@keyframes fadeInUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
}

@keyframes fadeInDown {
    from { opacity: 0; transform: translateY(-20px); }
    to { opacity: 1; transform: translateY(0); }
}

h2 { margin-bottom: 1rem; }

.login-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
}

.login-card {
    width: 100%;
    max-width: 400px;
    text-align: center;
}

.input-group {
    text-align: left;
    margin-bottom: 1rem;
}

.input-label {
    display: block;
    margin-bottom: 0.5rem;
    color: var(--text-dim);
}

.input-field {
    width: 100%;
    padding: 0.75rem;
    border-radius: 12px;
    background: rgba(15, 23, 42, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: white;
    font-family: inherit;
    outline: none;
    transition: border 0.3s;
}

.input-field:focus {
    border-color: var(--primary);
}

.error-msg {
    color: var(--danger);
    margin-bottom: 1rem;
    font-size: 0.875rem;
}

h1 {
    margin-bottom: 2rem;
}

/* Error Logs Styles */
.error-logs-card {
    background: rgba(15, 23, 42, 0.4) !important;
    border-color: rgba(239, 68, 68, 0.1) !important;
}

.error-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.error-log-item {
    background: rgba(255, 255, 255, 0.03);
    border-radius: 12px;
    padding: 12px 16px;
    border: 1px solid rgba(255, 255, 255, 0.05);
}

.error-log-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
}

.platform-tag {
    font-size: 10px;
    font-weight: 800;
    padding: 2px 8px;
    border-radius: 4px;
}

.platform-tag.telegram { background: rgba(36, 161, 222, 0.2); color: #24A1DE; }
.platform-tag.whatsapp { background: rgba(37, 211, 102, 0.2); color: #25D366; }
.platform-tag.messenger { background: rgba(0, 178, 255, 0.2); color: #00B2FF; }
.platform-tag.instagram { background: rgba(255, 0, 114, 0.2); color: #FF0072; }

.error-log-time {
    font-size: 11px;
    color: var(--text-dim);
    font-family: 'JetBrains Mono', monospace;
}

.error-log-message {
    font-size: 13px;
    color: #f87171;
    line-height: 1.5;
    word-break: break-all;
}

.no-errors {
    text-align: center;
    padding: 30px;
    color: var(--text-dim);
    font-size: 14px;
    font-style: italic;
}

/* Responsive table */
@media (max-width: 768px) {
    .user-table th, .user-table td {
        padding: 5px;
        font-size: 12px;
    }
    .user-table th:nth-child(2), .user-table td:nth-child(2),
    .user-table th:nth-child(3), .user-table td:nth-child(3),
    .user-table th:nth-child(6), .user-table td:nth-child(6) {
        display: none;
    }
    .user-table th:nth-child(7), .user-table td:nth-child(7) {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 80px;
    }
    .user-table-container {
        overflow-x: auto;
    }
}

/* User Stats in Transcription Card */
.user-stats-list {
    max-height: 250px;
    overflow-y: auto;
    padding-right: 5px;
}

.user-stats-list::-webkit-scrollbar {
    width: 4px;
}

.user-stats-list::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 10px;
}

.user-stat-item {
    padding: 8px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.02);
    transition: all 0.2s;
}

.user-stat-item:hover {
    background: rgba(255, 255, 255, 0.05);
}

.user-info-detail {
    border-left: 2px solid var(--primary);
    animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
    from { opacity: 0; transform: translateY(-5px); }
    to { opacity: 1; transform: translateY(0); }
}`;

export const renderDashboard = (user: UserSession) => {
    const isTgConnected = !!user.session;

    return "<!DOCTYPE html>" + render(
        <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>My Dashboard - Whisper Messenger</title>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet" />
                <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
                <style dangerouslySetInnerHTML={{ __html: adminCss }} />
            </head>
            <body class="dashboard-page">
                <div class="container">
                    <header>
                        <div class="logo">
                            <div class="logo-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                                </svg>
                            </div>
                            WHISPER DASHBOARD
                        </div>
                        <div class="user-greeting" style={{ fontSize: '14px', color: 'var(--text-dim)' }}>
                            Welcome, <span style={{ color: 'white', fontWeight: '600' }}>{user.firstName}</span>
                            <button id="logout-btn" style={{ marginLeft: '15px', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px' }}>Logout</button>
                        </div>
                    </header>

                    <div class="grid">
                        {/* Telegram Control */}
                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title"><span style={{ color: '#24A1DE' }}>✦</span> Telegram</h3>
                                <span class={`status-tag ${isTgConnected ? 'active' : 'inactive'}`}>
                                    {isTgConnected ? 'CONNECTED' : 'NOT SETUP'}
                                </span>
                            </div>
                            
                            <div id="tg-status-container" style={{ display: isTgConnected ? 'block' : 'none', marginTop: '15px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                    <span style={{ fontSize: '13px', color: 'var(--text-dim)' }}>Status:</span>
                                    <span class={`status-tag ${user.isActive ? 'active' : 'inactive'}`} style={{ fontSize: '11px', padding: '2px 8px' }}>
                                        {user.currentStatus || (user.isActive ? 'RUNNING' : 'STOPPED')}
                                    </span>
                                </div>
                                <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>Your personal Telegram account is bridged and ready to transcribe.</p>
                                <div style={{ marginTop: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                    <button class="btn btn-sm" id="test-tg-btn" style={{ background: '#3B82F6', margin: 0 }}>Send Test Message</button>
                                    <button class="btn btn-sm" id="restart-tg-btn" style={{ background: '#F59E0B', margin: 0, color: '#000' }}>Restart Bridge</button>
                                    <button class="btn btn-sm" id="disconnect-tg-btn" style={{ background: '#ef4444', margin: 0 }}>Disconnect</button>
                                </div>
                            </div>
                            <div id="tg-auth-container" style={{ display: isTgConnected ? 'none' : 'block', marginTop: '15px' }}>
                                 {/* Simple One-Click Connect */}
                                 <div id="tg-simple-connect-view" style={{ textAlign: 'center', padding: '10px 0' }}>
                                     <button class="btn" id="tg-simple-connect-btn" style={{ background: 'linear-gradient(135deg, #24A1DE, #1C92D2)', height: '48px', width: '100%', fontSize: '15px', fontWeight: '700', margin: '0 0 10px 0' }}>
                                         Connect My Telegram
                                     </button>
                                     <button id="show-manual-auth-btn" style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}>
                                         Use phone number or QR code
                                     </button>
                                 </div>

                                 <div id="tg-manual-auth-view" style={{ display: 'none' }}>
                                     <div style={{ display: 'flex', gap: '5px', marginBottom: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                         <input type="tel" id="tg-phone-input" class="input-field" placeholder="+123..." style={{ flex: 1, padding: '0.5rem', margin: 0, borderRadius: '8px', fontSize: '13px' }} />
                                         <button class="btn btn-sm" id="tg-send-code-btn" style={{ margin: 0, width: 'auto', background: '#8B5CF6' }}>Code</button>
                                     </div>
                                     <div id="tg-code-section" style={{ display: 'none', marginTop: '8px' }}>
                                         <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                                             <input type="text" id="tg-code-input" class="input-field" placeholder="Code" style={{ width: '80px', padding: '0.5rem', margin: 0, borderRadius: '8px', fontSize: '13px' }} />
                                             <button class="btn btn-sm" id="tg-verify-btn" style={{ margin: 0, width: 'auto', background: '#22c55e' }}>Link</button>
                                         </div>
                                     </div>
                                     <div style={{ marginTop: '10px' }}>
                                         <button class="btn btn-sm" id="tg-show-qr-btn" style={{ margin: 0, width: 'auto', background: '#6B7280', fontSize: '10px', padding: '4px 8px' }}>Show QR</button>
                                     </div>
                                     <div id="tg-qr-section" style={{ display: 'none', marginTop: '10px', textAlign: 'center' }}>
                                         <div id="qr-code-container" style={{ background: 'white', padding: '10px', borderRadius: '8px', display: 'inline-block', marginBottom: '8px' }}></div>
                                         <div style={{ marginBottom: '8px' }}>
                                             <a id="tg-app-link" href="#" class="btn btn-sm" style={{ background: '#24A1DE', display: 'none', alignItems: 'center', gap: '5px', width: 'auto', padding: '5px 12px', borderRadius: '15px', textDecoration: 'none', color: 'white', fontSize: '11px' }}>
                                                 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                                                 Open App
                                             </a>
                                         </div>
                                         <p id="qr-status" style={{ fontSize: '11px', color: '#8B5CF6' }}>Scan from Telegram App</p>
                                     </div>
                                 </div>
                             </div>
                        </div>

                         {/* Meta Integration */}
                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title"><span style={{ color: '#0081FB' }}>◉</span> Messenger / Instagram</h3>
                                <span class={`status-tag ${user.metaToken ? 'active' : 'inactive'}`}>
                                    {user.metaToken ? 'CONNECTED' : 'NOT SETUP'}
                                </span>
                            </div>
                            <div style={{ marginTop: '15px' }}>
                                <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '15px' }}>
                                    Connect your Facebook Page or Instagram Business account to transcribe incoming voice messages automatically.
                                </p>

                                <div style={{ marginBottom: '15px' }}>
                                    <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                                        <a href="https://developers.facebook.com/apps/" target="_blank" class="btn btn-sm" style={{ background: '#1877F2', margin: 0, flex: 1, fontSize: '11px', textAlign: 'center' }}>
                                            📱 Meta Developers
                                        </a>
                                        <a href="https://business.facebook.com/" target="_blank" class="btn btn-sm" style={{ background: '#1877F2', margin: 0, flex: 1, fontSize: '11px', textAlign: 'center' }}>
                                            💼 Business Manager
                                        </a>
                                    </div>
                                </div>

                                <div class="setup-guide" style={{ background: 'rgba(24, 119, 242, 0.1)', padding: '12px', borderRadius: '10px', marginBottom: '15px', borderLeft: '3px solid #1877F2' }}>
                                    <h4 style={{ fontSize: '12px', margin: '0 0 8px 0', color: '#1877F2' }}>⚙️ Required App Settings (click to copy):</h4>
                                    <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                                        <div style={{ marginBottom: '8px' }}>
                                            <strong>App Domains:</strong>
                                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                                <code id="meta-domain" style={{ color: 'white', background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', flex: 1 }} onclick="navigator.clipboard.writeText('voicemsg.net')">voicemsg.net</code>
                                                <button class="btn btn-xs" onclick="navigator.clipboard.writeText('voicemsg.net')" style={{ background: '#666', margin: 0, padding: '2px 8px', fontSize: '10px' }}>📋</button>
                                            </div>
                                        </div>
                                        <div style={{ marginBottom: '8px' }}>
                                            <strong>Privacy Policy URL:</strong>
                                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                                <code id="meta-privacy" style={{ color: 'white', background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', flex: 1 }} onclick="navigator.clipboard.writeText('https://voicemsg.net/privacy')">https://voicemsg.net/privacy</code>
                                                <button class="btn btn-xs" onclick="navigator.clipboard.writeText('https://voicemsg.net/privacy')" style={{ background: '#666', margin: 0, padding: '2px 8px', fontSize: '10px' }}>📋</button>
                                            </div>
                                        </div>
                                        <div style={{ marginBottom: '8px' }}>
                                            <strong>OAuth Redirect URI:</strong>
                                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                                <code id="meta-callback" style={{ color: 'white', background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', flex: 1 }} onclick="navigator.clipboard.writeText('https://voicemsg.net/auth/meta/callback')">https://voicemsg.net/auth/meta/callback</code>
                                                <button class="btn btn-xs" onclick="navigator.clipboard.writeText('https://voicemsg.net/auth/meta/callback')" style={{ background: '#666', margin: 0, padding: '2px 8px', fontSize: '10px' }}>📋</button>
                                            </div>
                                        </div>
                                        <div style={{ marginTop: '10px', fontSize: '10px', color: '#1877F2' }}>
                                            💡 Copy these URLs to your Meta App Settings → Basic → App Domains and Facebook Login → Settings
                                        </div>
                                    </div>
                                </div>

                                <button class="btn" id="connect-meta-btn" style={{ background: '#1877F2', margin: 0, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                                    Connect with Facebook
                                </button>
                                {user.metaToken && (
                                    <div style={{ marginTop: '15px', color: '#22c55e', fontSize: '12px', fontWeight: 'bold' }}>
                                        ✓ Linked to active Page
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* WhatsApp Integration */}
                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title"><span style={{ color: '#25D366' }}>◉</span> WhatsApp</h3>
                                <span class={`status-tag ${user.whatsappToken ? 'active' : 'inactive'}`}>
                                    {user.whatsappToken ? 'SETUP' : 'NOT SETUP'}
                                </span>
                            </div>
                            <div style={{ marginTop: '10px', marginBottom: '15px' }}>
                                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                                    <a href="https://business.facebook.com/wa/manage/phone-numbers/" target="_blank" class="btn btn-sm" style={{ background: '#25D366', margin: 0, flex: 1, fontSize: '11px', textAlign: 'center' }}>
                                        📱 WhatsApp Manager
                                    </a>
                                    <a href="https://developers.facebook.com/apps/" target="_blank" class="btn btn-sm" style={{ background: '#25D366', margin: 0, flex: 1, fontSize: '11px', textAlign: 'center' }}>
                                        ⚙️ Meta Developers
                                    </a>
                                </div>
                                <div class="setup-guide" style={{ background: 'rgba(37, 211, 102, 0.1)', padding: '12px', borderRadius: '10px', marginBottom: '15px', borderLeft: '3px solid #25D366' }}>
                                    <h4 style={{ fontSize: '12px', margin: '0 0 8px 0', color: '#25D366' }}>⚙️ Webhook Setup (click to copy):</h4>
                                    <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                                        <div style={{ marginBottom: '8px' }}>
                                            <strong>Callback URL:</strong>
                                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                                <code id="wa-callback" style={{ color: 'white', background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', flex: 1 }} onclick="navigator.clipboard.writeText('https://voicemsg.net/webhooks/whatsapp')">https://voicemsg.net/webhooks/whatsapp</code>
                                                <button class="btn btn-xs" onclick="navigator.clipboard.writeText('https://voicemsg.net/webhooks/whatsapp')" style={{ background: '#666', margin: 0, padding: '2px 8px', fontSize: '10px' }}>📋</button>
                                            </div>
                                        </div>
                                        <div style={{ marginBottom: '8px' }}>
                                            <strong>Verify Token:</strong>
                                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                                <code style={{ color: '#888', background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px', flex: 1 }}>(Check Admin Panel)</code>
                                                <button class="btn btn-xs" style={{ background: '#666', margin: 0, padding: '2px 8px', fontSize: '10px', opacity: 0.5, cursor: 'not-allowed' }} disabled>📋</button>
                                            </div>
                                        </div>
                                        <div style={{ marginBottom: '8px' }}>
                                            <strong>Webhooks Fields:</strong>
                                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                                <code id="wa-fields" style={{ color: 'white', background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', flex: 1 }} onclick="navigator.clipboard.writeText('messages')">messages</code>
                                                <button class="btn btn-xs" onclick="navigator.clipboard.writeText('messages')" style={{ background: '#666', margin: 0, padding: '2px 8px', fontSize: '10px' }}>📋</button>
                                            </div>
                                        </div>
                                        <div style={{ marginTop: '10px', fontSize: '10px', color: '#25D366' }}>
                                            💡 Set these in your WhatsApp App → Webhooks → Add or Edit Callback URL
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
                            <div class="input-group">
                                <label class="input-label">Test Recipient (Phone)</label>
                                <input type="text" id="wa-test-num" class="input-field" placeholder="15551234567" />
                            </div>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                                <button class="btn btn-sm" id="save-wa-btn" style={{ background: '#8B5CF6', margin: 0 }}>Save Settings</button>
                                {user.whatsappToken && <button class="btn btn-sm" id="test-wa-btn" style={{ background: '#3B82F6', margin: 0 }}>Test</button>}
                            </div>
                        </div>

                        {/* LINE Integration */}
                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title"><span style={{ color: '#00C300' }}>◉</span> LINE</h3>
                                <span class={`status-tag ${user.lineToken ? 'active' : 'inactive'}`}>
                                    {user.lineToken ? 'SETUP' : 'NOT SETUP'}
                                </span>
                            </div>
                            <div style={{ marginTop: '10px', marginBottom: '15px' }}>
                                <div style={{ marginBottom: '10px' }}>
                                    <a href="https://developers.line.biz/console/" target="_blank" class="btn btn-sm" style={{ background: '#00C300', margin: 0, width: '100%', fontSize: '11px', textAlign: 'center' }}>
                                        📱 LINE Developers Console
                                    </a>
                                </div>
                                <div class="setup-guide" style={{ background: 'rgba(0, 195, 0, 0.1)', padding: '12px', borderRadius: '10px', marginBottom: '15px', borderLeft: '3px solid #00C300' }}>
                                    <h4 style={{ fontSize: '12px', margin: '0 0 8px 0', color: '#00C300' }}>⚙️ Webhook Setup (click to copy):</h4>
                                    <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                                        <div style={{ marginBottom: '8px' }}>
                                            <strong>Webhook URL:</strong>
                                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                                <code id="line-webhook" style={{ color: 'white', background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', flex: 1 }} onclick={`navigator.clipboard.writeText('https://voicemsg.net/webhooks/line/${user.userId}')`}>{`https://voicemsg.net/webhooks/line/${user.userId}`}</code>
                                                <button class="btn btn-xs" onclick={`navigator.clipboard.writeText('https://voicemsg.net/webhooks/line/${user.userId}')`} style={{ background: '#666', margin: 0, padding: '2px 8px', fontSize: '10px' }}>📋</button>
                                            </div>
                                        </div>
                                        <div style={{ marginTop: '10px', fontSize: '10px', color: '#00C300' }}>
                                            💡 Set this URL in your LINE Channel → Messaging API → Webhook settings. LINE will automatically verify when you save your tokens below.
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="input-group">
                                <label class="input-label">Channel Access Token</label>
                                <input type="password" id="line-token" class="input-field" value={user.lineToken || ''} placeholder="ey..." />
                            </div>
                            <div class="input-group">
                                <label class="input-label">Channel Secret (Optional)</label>
                                <input type="password" id="line-secret" class="input-field" value={user.lineSecret || ''} placeholder="abc123..." />
                            </div>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                                <button class="btn btn-sm" id="save-line-btn" style={{ background: '#8B5CF6', margin: 0 }}>Save Settings</button>
                            </div>
                        </div>

                        {/* Stats Box */}
                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">My Stats</h3>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
                                <div style={{ background: 'rgba(34, 197, 94, 0.05)', border: '1px solid rgba(34, 197, 94, 0.2)', padding: '20px', borderRadius: '16px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Total Transcriptions</div>
                                    <div style={{ fontSize: '48px', fontWeight: '800', color: '#22c55e', lineHeight: '1' }}>{user.transcriptionCount || 0}</div>
                                </div>
                                {user.lastActiveAt && (
                                    <div style={{ padding: '0 10px', fontSize: '11px', color: 'var(--text-dim)', textAlign: 'center' }}>
                                        Last active: {new Date(user.lastActiveAt).toLocaleString()}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* General Settings */}
                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">⚙️ General Settings</h3>
                            </div>
                            <div class="input-group">
                                <label class="input-label" style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                    <input type="checkbox" id="translate-checkbox" checked={!!user.translateTo} style={{ width: '18px', height: '18px' }} />
                                    <span>Enable Translation</span>
                                </label>
                            </div>
                            <div id="translate-options" style={{ display: user.translateTo ? 'block' : 'none', marginTop: '10px' }}>
                                <div class="input-group">
                                    <label class="input-label">Translate To Language</label>
                                    <select id="translate-lang" class="input-field" style={{ width: '100%' }} value={user.translateTo || ''}>
                                        <option value="">Select language...</option>
                                        <option value="en">English 🇺🇸</option>
                                        <option value="uk">Ukrainian 🇺🇦</option>
                                        <option value="ru">Russian 🇷🇺</option>
                                        <option value="es">Spanish 🇪🇸</option>
                                        <option value="de">German 🇩🇪</option>
                                        <option value="fr">French 🇫🇷</option>
                                        <option value="zh">Chinese 🇨🇳</option>
                                        <option value="ja">Japanese 🇯🇵</option>
                                    </select>
                                </div>
                                <div class="input-group">
                                    <label class="input-label">Test Translation</label>
                                    <input type="text" id="test-translation-input" class="input-field" placeholder="Enter text to test translation..." style={{ width: '100%' }} />
                                </div>
                                <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                                    <button class="btn btn-sm" id="test-translate-btn" style={{ background: '#3B82F6', margin: 0, flex: 1 }}>Test Translation</button>
                                    <button class="btn btn-sm" id="save-settings-btn" style={{ background: '#8B5CF6', margin: 0, flex: 1 }}>Save Settings</button>
                                </div>
                                <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '5px' }}>
                                    Voice messages will be translated from their original language automatically.
                                </p>
                                <div id="translation-result" style={{ display: 'none', marginTop: '10px', padding: '10px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '8px', fontSize: '12px' }}></div>
                            </div>
                        </div>
                        
                        {/* Threads Integration */}
                        <div class="card" style={{ borderLeft: '4px solid #000' }}>
                            <div class="card-header">
                                <h3 class="card-title">@ Threads</h3>
                                <span class={`status-tag ${user.threadsToken ? 'active' : 'inactive'}`}>
                                    {user.threadsToken ? 'CONNECTED' : 'NOT SETUP'}
                                </span>
                            </div>
                            <div style={{ marginTop: '15px' }}>
                                <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '15px' }}>
                                    Transcribe voice messages and replies from your personal Threads account.
                                </p>
                                <button class="btn" id="connect-threads-btn" style={{ background: '#000', margin: 0, width: '100%' }}>
                                    Connect with Threads
                                </button>
                                {user.threadsToken && (
                                    <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
                                        User ID: {user.threadsUserId}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <script dangerouslySetInnerHTML={{
                    __html: `
                    document.getElementById('logout-btn').addEventListener('click', () => {
                        location.href = '/auth/logout';
                    });

                    // Telegram Auth JS
                    var tgPhoneInput = document.getElementById('tg-phone-input');
                    var tgCodeInput = document.getElementById('tg-code-input');
                    var tgSendCodeBtn = document.getElementById('tg-send-code-btn');
                    var tgVerifyBtn = document.getElementById('tg-verify-btn');
                    var tgCodeSection = document.getElementById('tg-code-section');
                    var tgShowQrBtn = document.getElementById('tg-show-qr-btn');
                    var tgQrSection = document.getElementById('tg-qr-section');
                    var qrCodeContainer = document.getElementById('qr-code-container');
                    var currentPhone = '';

                    tgSendCodeBtn.addEventListener('click', function() {
                        var phone = tgPhoneInput.value.trim();
                        if (!phone) return alert('Enter phone');
                        fetch('/auth/send-code', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ phone: phone })
                        }).then(r => r.json()).then(data => {
                            if (data.success) {
                                currentPhone = phone;
                                tgCodeSection.style.display = 'block';
                                alert('Code sent!');
                            } else { alert('Error: ' + data.error); }
                        });
                    });

                    tgVerifyBtn.addEventListener('click', function() {
                        var code = tgCodeInput.value.trim();
                        fetch('/auth/verify-code', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ phone: currentPhone, code: code })
                        }).then(r => r.json()).then(data => {
                            if (data.success) { location.reload(); } else { alert('Error: ' + data.error); }
                        });
                    });

                    // Simplified Dashboard Auth
                    var simpleConnectBtn = document.getElementById('tg-simple-connect-btn');
                    var manualBtn = document.getElementById('show-manual-auth-btn');
                    var simpleView = document.getElementById('tg-simple-connect-view');
                    var manualView = document.getElementById('tg-manual-auth-view');

                    if (manualBtn) {
                        manualBtn.onclick = () => {
                            simpleView.style.display = 'none';
                            manualView.style.display = 'block';
                        };
                    }

                    function startQrPolling(token) {
                        var interval = setInterval(() => {
                            fetch('/auth/qr-check?token=' + token).then(r => r.json()).then(s => {
                                if (s.done) { clearInterval(interval); location.reload(); }
                                else if (s.requiresPassword) {
                                    clearInterval(interval);
                                    alert('2FA Password required. Please use manual login or wait for update.');
                                }
                            });
                        }, 2500);
                    }

                    if (simpleConnectBtn) {
                        simpleConnectBtn.onclick = () => {
                            simpleConnectBtn.innerText = 'Connecting...';
                            fetch('/auth/qr-start', { method: 'POST' }).then(r => r.json()).then(data => {
                                if (data.qrUrl) {
                                    startQrPolling(data.token);
                                    window.location.href = data.qrUrl;
                                    setTimeout(() => {
                                        simpleView.style.display = 'none';
                                        manualView.style.display = 'block';
                                        tgQrSection.style.display = 'block';
                                        qrCodeContainer.innerHTML = '';
                                        new QRCode(qrCodeContainer, { text: data.qrUrl, width: 140, height: 140 });
                                    }, 2000);
                                }
                            });
                        };
                    }

                    tgShowQrBtn.addEventListener('click', function() {
                        tgQrSection.style.display = 'block';
                        tgShowQrBtn.style.display = 'none';
                        fetch('/auth/qr-start', { method: 'POST' }).then(r => r.json()).then(data => {
                            if (data.token) {
                                qrCodeContainer.innerHTML = '';
                                new QRCode(qrCodeContainer, { text: data.qrUrl, width: 180, height: 180 });
                                
                                var appBtn = document.getElementById('tg-app-link');
                                if (appBtn) { appBtn.href = data.qrUrl; appBtn.style.display = 'inline-flex'; }

                                startQrPolling(data.token);
                            }
                        });
                    });

                    document.getElementById('disconnect-tg-btn')?.addEventListener('click', () => {
                        if(!confirm('Disconnect Telegram?')) return;
                        fetch('/dashboard/disconnect-tg', { method: 'POST' }).then(() => location.reload());
                    });

                    document.getElementById('test-tg-btn')?.addEventListener('click', () => {
                        fetch('/dashboard/test-tg', { method: 'POST' })
                            .then(r => r.json())
                            .then(d => alert(d.success ? 'Success! Check your Telegram' : 'Error: ' + (d.error || 'Failed to send test message')));
                    });

                    document.getElementById('restart-tg-btn')?.addEventListener('click', () => {
                        const btn = document.getElementById('restart-tg-btn');
                        btn.disabled = true;
                        btn.innerText = 'Restarting...';
                        fetch('/dashboard/restart-tg', { method: 'POST' })
                            .then(r => r.json())
                            .then(d => {
                                if (d.success) {
                                    alert('Restart initiated. Please wait a few seconds for the pod to start.');
                                    location.reload();
                                } else {
                                    alert('Restart failed: ' + (d.error || 'Unknown error'));
                                    btn.disabled = false;
                                    btn.innerText = 'Restart Bridge';
                                }
                            });
                    });

                    // Meta / WA hooks
                    document.getElementById('connect-meta-btn').addEventListener('click', () => {
                        location.href = '/auth/meta/login';
                    });

                    document.getElementById('connect-threads-btn').addEventListener('click', () => {
                        location.href = '/auth/threads/login';
                    });

                    document.getElementById('save-wa-btn').addEventListener('click', () => {
                        fetch('/dashboard/save-wa', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ whatsappToken: document.getElementById('wa-token').value, whatsappPhoneId: document.getElementById('wa-phone-id').value })
                        }).then(() => location.reload());
                    });

                    document.getElementById('save-line-btn')?.addEventListener('click', () => {
                        fetch('/dashboard/save-line', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ lineToken: document.getElementById('line-token').value, lineSecret: document.getElementById('line-secret').value })
                        }).then(() => location.reload());
                    });

                    document.getElementById('test-wa-btn')?.addEventListener('click', () => {
                        const token = document.getElementById('wa-token').value;
                        const phoneId = document.getElementById('wa-phone-id').value;
                        const recipient = document.getElementById('wa-test-num').value;
                        
                        if (!recipient) return alert('Enter test recipient phone number (format: 15551234567)');
                        
                        const btn = document.getElementById('test-wa-btn');
                        btn.disabled = true;
                        btn.innerText = 'Testing...';
                        
                        fetch('/dashboard/test-wa', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ whatsappToken: token, whatsappPhoneId: phoneId, testRecipient: recipient })
                        }).then(r => r.json()).then(d => {
                            if (d.success) alert('Test message sent!');
                            else alert('Error: ' + d.error);
                            btn.disabled = false;
                            btn.innerText = 'Test';
                        });
                    });

                    // Translation settings
                     const translateCheckbox = document.getElementById('translate-checkbox');
                     const translateLang = document.getElementById('translate-lang');
                     const translateOptions = document.getElementById('translate-options');
                     const testTranslateBtn = document.getElementById('test-translate-btn');
                     const saveSettingsBtn = document.getElementById('save-settings-btn');
                     const testTranslationInput = document.getElementById('test-translation-input');
                     const translationResult = document.getElementById('translation-result');

                     if (translateCheckbox) {
                         translateCheckbox.addEventListener('change', () => {
                             if (translateOptions) translateOptions.style.display = translateCheckbox.checked ? 'block' : 'none';
                         });
                     }

                     if (testTranslateBtn && testTranslationInput) {
                         testTranslateBtn.addEventListener('click', async () => {
                             const text = testTranslationInput.value.trim();
                             const lang = translateLang?.value;

                             if (!text) return alert('Enter text to test translation');
                             if (!lang) return alert('Select target language first');

                             testTranslateBtn.disabled = true;
                             testTranslateBtn.innerText = 'Translating...';

                             try {
                                 const response = await fetch('/dashboard/test-translation', {
                                     method: 'POST',
                                     headers: { 'Content-Type': 'application/json' },
                                     body: JSON.stringify({ text, targetLang: lang })
                                 });
                                 const result = await response.json();

                                 if (translationResult) {
                                     translationResult.style.display = 'block';
                                     if (result.success) {
                                         translationResult.innerHTML = '<div style="color: #22c55e;"><strong>Original:</strong> ' + text.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div><div style="color: #8B5CF6; margin-top: 5px;"><strong>Translated:</strong> ' + result.translated.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>';
                                     } else {
                                         translationResult.innerHTML = '<div style="color: #ef4444;"><strong>Error:</strong> ' + result.error.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>';
                                     }
                                 }
                             } catch (e) {
                                 if (translationResult) {
                                     translationResult.style.display = 'block';
                                     translationResult.innerHTML = '<div style="color: #ef4444;"><strong>Error:</strong> Failed to test translation</div>';
                                 }
                             } finally {
                                 testTranslateBtn.disabled = false;
                                 testTranslateBtn.innerText = 'Test Translation';
                             }
                         });
                     }

                     if (saveSettingsBtn && translateCheckbox && translateLang) {
                         saveSettingsBtn.addEventListener('click', async () => {
                             const enabled = translateCheckbox.checked;
                             const lang = enabled ? translateLang.value : '';

                             saveSettingsBtn.disabled = true;
                             saveSettingsBtn.innerText = 'Saving...';

                             try {
                                 const response = await fetch('/dashboard/save-settings', {
                                     method: 'POST',
                                     headers: { 'Content-Type': 'application/json' },
                                     body: JSON.stringify({ translateTo: lang })
                                 });
                                 const result = await response.json();

                                 if (result.success) {
                                     alert('Settings saved successfully!');
                                 } else {
                                     alert('Error saving settings: ' + (result.error || 'Unknown error'));
                                 }
                             } catch (e) {
                                 alert('Error saving settings');
                             } finally {
                                 saveSettingsBtn.disabled = false;
                                 saveSettingsBtn.innerText = 'Save Settings';
                             }
                         });
                     }
                    `
                }} />
            </body>
        </html>
    );
};
