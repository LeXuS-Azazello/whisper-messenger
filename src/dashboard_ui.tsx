/** @jsxImportSource preact */
import { render } from 'preact-render-to-string';
import { UserSession } from './types';
import adminCss from './admin.css';

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
                                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                                    <input type="tel" id="tg-phone-input" class="input-field" placeholder="+1234567890" style={{ width: '180px', padding: '0.6rem', margin: 0, borderRadius: '8px' }} />
                                    <button class="btn btn-sm" id="tg-send-code-btn" style={{ margin: 0, width: 'auto', background: '#8B5CF6' }}>Send Code</button>
                                </div>
                                <div id="tg-code-section" style={{ display: 'none', marginTop: '10px' }}>
                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                                        <input type="text" id="tg-code-input" class="input-field" placeholder="Enter code" style={{ width: '130px', padding: '0.6rem', margin: 0, borderRadius: '8px' }} />
                                        <button class="btn btn-sm" id="tg-verify-btn" style={{ margin: 0, width: 'auto', background: '#22c55e' }}>Verify</button>
                                    </div>
                                </div>
                                <div style={{ marginTop: '10px' }}>
                                    <button class="btn btn-sm" id="tg-show-qr-btn" style={{ margin: 0, width: 'auto', background: '#6B7280', fontSize: '11px', padding: '5px 10px' }}>QR Code Login</button>
                                </div>
                                <div id="tg-qr-section" style={{ display: 'none', marginTop: '10px', textAlign: 'center' }}>
                                    <div id="qr-code-container" style={{ background: 'white', padding: '10px', borderRadius: '8px', display: 'inline-block', marginBottom: '8px' }}></div>
                                    <p id="qr-status" style={{ fontSize: '11px', color: '#8B5CF6' }}>Scan from Telegram App</p>
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
                                <a href="https://business.facebook.com/wa/manage/phone-numbers/" target="_blank" style={{ fontSize: '11px', color: '#8B5CF6', textDecoration: 'none' }}>
                                    👉 Find your WhatsApp IDs here
                                </a>
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
                            <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', justifyContent: 'center' }}>
                                    <input type="checkbox" id="translate-checkbox" checked={!!user.translateTo} />
                                    <span style={{ fontSize: '13px' }}>Translate to</span>
                                    <select id="translate-lang" class="input-field" style={{ width: 'auto', padding: '6px', margin: 0, fontSize: '12px' }} value={user.translateTo || ''}>
                                        <option value="">Select language</option>
                                        <option value="en">English</option>
                                        <option value="uk">Ukrainian</option>
                                        <option value="ru">Russian</option>
                                        <option value="es">Spanish</option>
                                        <option value="de">German</option>
                                        <option value="fr">French</option>
                                        <option value="zh">Chinese</option>
                                    </select>
                                </label>
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

                    tgShowQrBtn.addEventListener('click', function() {
                        tgQrSection.style.display = 'block';
                        tgShowQrBtn.style.display = 'none';
                        fetch('/auth/qr-start', { method: 'POST' }).then(r => r.json()).then(data => {
                            if (data.token) {
                                qrCodeContainer.innerHTML = '';
                                new QRCode(qrCodeContainer, { text: data.qrUrl, width: 180, height: 180 });
                                var interval = setInterval(() => {
                                    fetch('/auth/qr-check?token=' + data.token).then(r => r.json()).then(s => {
                                        if (s.done) { clearInterval(interval); location.reload(); }
                                    });
                                }, 2500);
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

                    // Translation settings
                    const translateCheckbox = document.getElementById('translate-checkbox');
                    const translateLang = document.getElementById('translate-lang');
                    if (translateCheckbox && translateLang) {
                        const saveTranslate = () => {
                            const enabled = translateCheckbox.checked;
                            const lang = enabled ? translateLang.value : '';
                            fetch('/dashboard/save-settings', {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ translateTo: lang })
                            });
                        };
                        translateCheckbox.addEventListener('change', saveTranslate);
                        translateLang.addEventListener('change', saveTranslate);
                    }
                    `
                }} />
            </body>
        </html>
    );
};
