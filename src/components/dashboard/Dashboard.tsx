/** @jsxImportSource preact */
import React from 'preact/compat';
import { render } from 'preact-render-to-string';
import type { UserSession } from '../../types';

export const renderDashboard = (user: UserSession) => {
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
                <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet" />
                <link rel="stylesheet" href="/assets/css/dashboard.css" />
                <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
            </head>
            <body class="dashboard-page">
                <div class="container">
                    <header>
                        <div class="logo">
                            <img src="/favicon.svg" alt="Logo" style={{ width: '32px', height: '32px', borderRadius: '8px' }} />
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
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></svg>
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
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
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
                <script src="/assets/js/dashboard.js"></script>
            </body>
        </html>
    );
};
