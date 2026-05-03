/** @jsxImportSource preact */
import { render } from 'preact-render-to-string';

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

export const renderAuthPage = (error?: string, isAuthenticated: boolean = false, origin: string = "") => {
    // If user is already authenticated, redirect them immediately
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
                <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
                <style dangerouslySetInnerHTML={{ __html: adminCss }} />
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

                            <button class="btn" id="tg-show-qr-btn" style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}>
                                Login with QR Code
                            </button>

                            {/* Removed redundant Telegram Widget that caused "Bot domain invalid" error. Using MTProto login above instead. */}

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

                <script dangerouslySetInnerHTML={{
                    __html: `
                    var tgPhoneInput = document.getElementById('tg-phone-input');
                    var tgCodeInput = document.getElementById('tg-code-input');
                    var tgPasswordInput = document.getElementById('tg-password-input');
                    var tgSendCodeBtn = document.getElementById('tg-send-code-btn');
                    var tgVerifyBtn = document.getElementById('tg-verify-btn');
                    var tgPasswordBtn = document.getElementById('tg-password-btn');
                    var phoneSection = document.getElementById('phone-section');
                    var codeSection = document.getElementById('code-section');
                    var passwordSection = document.getElementById('password-section');
                    var qrSection = document.getElementById('qr-section');
                    var tgShowQrBtn = document.getElementById('tg-show-qr-btn');
                    var authFlow = document.getElementById('auth-flow');
                    var successMessage = document.getElementById('success-message');
                    var qrCodeContainer = document.getElementById('qr-code-container');
                    var qrStatus = document.getElementById('qr-status');
                    var currentPhone = '';
                    var currentQrToken = '';
                    var qrPollInterval = null;

                    tgSendCodeBtn.addEventListener('click', function() {
                        var phone = tgPhoneInput.value.trim();
                        if (!phone) return alert('Enter phone number');
                        tgSendCodeBtn.innerText = 'Sending...';
                        fetch('/auth/send-code', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ phone: phone })
                        })
                        .then(r => r.json())
                        .then(data => {
                            if (data.success) {
                                currentPhone = phone;
                                phoneSection.style.display = 'none';
                                codeSection.style.display = 'block';
                            } else {
                                alert('Error: ' + data.error);
                                tgSendCodeBtn.innerText = 'Send Verification Code';
                            }
                        })
                        .catch(err => alert('Network error'));
                    });

                    tgVerifyBtn.addEventListener('click', function() {
                        var code = tgCodeInput.value.trim();
                        if (!code) return alert('Enter code');
                        tgVerifyBtn.innerText = 'Verifying...';
                        fetch('/auth/verify-code', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ phone: currentPhone, code: code })
                        }).then(r => {
                            if (r.status === 302 || r.redirected) {
                                window.location.href = '/dashboard';
                            } else {
                                return r.json().then(data => {
                                    if (data.success) {
                                        window.location.href = '/dashboard';
                                    } else if (data.requiresPassword) {
                                        codeSection.style.display = 'none';
                                        passwordSection.style.display = 'block';
                                    } else {
                                        alert('Error: ' + (data.error || 'Check the logs'));
                                        tgVerifyBtn.innerText = 'Confirm & Connect';
                                    }
                                });
                            }
                        }).catch(err => alert('Network error'));
                    });

                    tgPasswordBtn.addEventListener('click', function() {
                        var pwd = tgPasswordInput.value.trim();
                        if (!pwd) return alert('Enter password');
                        tgPasswordBtn.innerText = 'Unlocking...';
                        
                        var body = { password: pwd };
                        if (currentPhone) body.phone = currentPhone;
                        if (currentQrToken) body.token = currentQrToken;

                        fetch('/auth/verify-password', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(body)
                        }).then(r => {
                            if (r.status === 302 || r.redirected) {
                                window.location.href = '/dashboard';
                            } else {
                                return r.json().then(data => {
                                    if (data.success) {
                                        window.location.href = '/dashboard';
                                    } else {
                                        alert('Login failed: ' + (data.error || 'Invalid password'));
                                        tgPasswordBtn.innerText = 'Unlock Account';
                                    }
                                });
                            }
                        }).catch(err => alert('Network error'));
                    });

                    var simpleConnectBtn = document.getElementById('tg-simple-connect-btn');
                    var manualBtn = document.getElementById('show-manual-btn');
                    var simpleStartSection = document.getElementById('simple-start-section');

                    manualBtn.addEventListener('click', function() {
                        simpleStartSection.style.display = 'none';
                        phoneSection.style.display = 'block';
                        tgShowQrBtn.style.display = 'block';
                    });

                    function initiateAutoLogin() {
                        simpleConnectBtn.innerText = 'Initializing...';
                        fetch('/auth/qr-start', { method: 'POST' })
                            .then(r => r.json())
                            .then(data => {
                                if (data.qrUrl) {
                                    // Start polling first
                                    startQrPolling(data.token);
                                    // Then open app
                                    window.location.href = data.qrUrl;
                                    simpleConnectBtn.innerText = 'Check your Telegram App';
                                    
                                    // Also show QR as backup if they didn't have app or it failed
                                    setTimeout(() => {
                                        qrSection.style.display = 'block';
                                        qrCodeContainer.innerHTML = '';
                                        new QRCode(qrCodeContainer, {
                                            text: data.qrUrl,
                                            width: 200, height: 200
                                        });
                                    }, 2000);
                                }
                            });
                    }

                    simpleConnectBtn.addEventListener('click', initiateAutoLogin);
                    
                    // Auto-initiate if requested via URL
                    if (new URLSearchParams(window.location.search).get('auto') === 'true') {
                        setTimeout(initiateAutoLogin, 500);
                    }

                     function startQrPolling(token) {
                         var timeoutId = setTimeout(function() {
                             clearInterval(qrPollInterval);
                             qrSection.style.display = 'none';
                             alert('QR code expired. Please try again.');
                             simpleConnectBtn.innerText = 'Connect Telegram';
                         }, 120000); // 2 minute timeout
                         
                         qrPollInterval = setInterval(() => {
                             fetch('/auth/qr-check?token=' + token)
                                 .then(r => r.json())
                                 .then(status => {
                                     if (status.done) {
                                         clearInterval(qrPollInterval);
                                         clearTimeout(timeoutId);
                                         authFlow.style.display = 'none';
                                         successMessage.style.display = 'block';
                                         setTimeout(() => window.location.href = '/dashboard', 1500);
                                     } else if (status.requiresPassword) {
                                         clearInterval(qrPollInterval);
                                         clearTimeout(timeoutId);
                                         currentQrToken = token;
                                         qrSection.style.display = 'none';
                                         simpleStartSection.style.display = 'none';
                                         passwordSection.style.display = 'block';
                                     } else if (status.expired) {
                                         clearInterval(qrPollInterval);
                                         clearTimeout(timeoutId);
                                         alert('QR code expired. Please try again.');
                                         simpleConnectBtn.innerText = 'Connect Telegram';
                                     }
                                 })
                                 .catch(err => {
                                     console.error('QR check failed:', err);
                                     clearInterval(qrPollInterval);
                                     clearTimeout(timeoutId);
                                     alert('Bridge connection lost. Please refresh and try again.');
                                     simpleConnectBtn.innerText = 'Connect Telegram';
                                 });
                         }, 2500);
                     }

                    tgShowQrBtn.addEventListener('click', function() {
                        qrSection.style.display = 'block';
                        tgShowQrBtn.style.display = 'none';
                        fetch('/auth/qr-start', { method: 'POST' })
                            .then(r => r.json())
                            .then(data => {
                                if (data.token) {
                                    qrCodeContainer.innerHTML = '';
                                    new QRCode(qrCodeContainer, {
                                        text: data.qrUrl,
                                        width: 220,
                                        height: 220,
                                        colorDark : "#000000",
                                        colorLight : "#ffffff",
                                        correctLevel : QRCode.CorrectLevel.H
                                    });
                                    
                                    var tgAppLink = document.getElementById('tg-app-link');
                                    if (tgAppLink) {
                                        tgAppLink.href = data.qrUrl;
                                        tgAppLink.style.display = 'inline-flex';
                                    }

                                    startQrPolling(data.token);
                                } else {
                                    alert('Failed to get QR token');
                                }
                            })
                            .catch(err => alert('Bridge connection error'));
                    });
                    `
                }} />
            </body>
        </html>
    );
};
