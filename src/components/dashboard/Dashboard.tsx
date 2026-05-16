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
                        <div class="card" style={{ position: 'relative', overflow: 'hidden' }}>
                            <div class="card-header">
                                <h3 class="card-title"><span style={{ color: '#24A1DE' }}>✦</span> Telegram Account</h3>
                                <span class={`status-tag ${isTgConnected ? 'active' : 'inactive'}`}>
                                    {isTgConnected ? 'CONNECTED' : 'DISCONNECTED'}
                                </span>
                            </div>

                            <div id="tg-status-container" style={{ display: isTgConnected ? 'block' : 'none', marginTop: '15px' }}>
                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px' }}>
                                        <div style={{ width: '48px', height: '48px', borderRadius: '15px', background: 'linear-gradient(135deg, #24A1DE, #1C92D2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                                            📱
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '15px', fontWeight: '700' }}>Active Bridge</div>
                                            <div style={{ fontSize: '13px', color: 'white', fontWeight: '600', marginTop: '2px' }}>
                                                {user.firstName} {user.username ? `@${user.username}` : ''}
                                            </div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>
                                                Status: <span style={{ color: user.isActive ? 'var(--success)' : 'var(--danger)', fontWeight: 'bold' }}>
                                                    {user.isActive ? 'ONLINE' : 'OFFLINE'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '20px', lineHeight: '1.5' }}>
                                        Your Telegram account is currently linked. Any voice or video message you receive will be automatically transcribed.
                                    </p>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        <button class="btn btn-sm" id="test-tg-btn" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3B82F6', border: '1px solid rgba(59, 130, 246, 0.2)', margin: 0 }}>Test</button>
                                        <button class="btn btn-sm" id="restart-tg-btn" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B', border: '1px solid rgba(245, 158, 11, 0.2)', margin: 0 }}>Restart</button>
                                        <button class="btn btn-sm" id="disconnect-tg-btn" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', margin: 0, gridColumn: 'span 2' }}>Disconnect Account</button>
                                    </div>
                                </div>
                            </div>

                            <div id="tg-connect-prompt" style={{ display: isTgConnected ? 'none' : 'block', marginTop: '15px', textAlign: 'center' }}>
                                <div style={{ padding: '20px 10px' }}>
                                    <div style={{ fontSize: '40px', marginBottom: '15px' }}>🛰️</div>
                                    <h4 style={{ marginBottom: '10px' }}>No Account Linked</h4>
                                    <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '25px' }}>
                                        Connect your personal Telegram account to start transcribing voice messages in real-time.
                                    </p>
                                    <button class="btn" id="open-tg-modal-btn" style={{ background: 'linear-gradient(135deg, #24A1DE, #1C92D2)', boxShadow: '0 10px 20px rgba(36, 161, 222, 0.3)', margin: 0 }}>
                                        Connect Telegram
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Meta Integration */}
                        {/* ... rest of the cards ... */}


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
                {/* Telegram Connection Modal */}
                <div class="modal-overlay" id="tg-modal-overlay">
                    <div class="modal-content">
                        <button class="modal-close" id="tg-modal-close">&times;</button>
                        <div class="modal-title">Connect Telegram</div>

                        {/* Step 1: Choice */}
                        <div class="auth-step active" id="tg-step-1">
                            <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px', marginBottom: '20px' }}>
                                Choose your preferred method to link your account
                            </p>
                            <div class="auth-choice">
                                <div class="choice-card" id="choose-qr-btn">
                                    <div class="choice-icon">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
                                    </div>
                                    <div class="choice-text">
                                        <h4>QR Code</h4>
                                        <p>Fastest way using Telegram App</p>
                                    </div>
                                </div>
                                <div class="choice-card" id="choose-phone-btn">
                                    <div class="choice-icon">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                                    </div>
                                    <div class="choice-text">
                                        <h4>Phone Number</h4>
                                        <p>Receive a code on your device</p>
                                    </div>
                                </div>
                                <div class="choice-card" id="choose-email-btn">
                                    <div class="choice-icon">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                                    </div>
                                    <div class="choice-text">
                                        <h4>Email Login</h4>
                                        <p>Use email for authentication</p>
                                    </div>
                                </div>
                                <div class="choice-card" id="choose-bot-btn">
                                    <div class="choice-icon">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4" /><line x1="8" y1="16" x2="8" y2="16" /><line x1="16" y1="16" x2="16" y2="16" /></svg>
                                    </div>
                                    <div class="choice-text">
                                        <h4>Bot Token</h4>
                                        <p>Connect a bot instead</p>
                                    </div>
                                </div>
                                <div class="choice-card" id="choose-restore-btn">
                                    <div class="choice-icon">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                                    </div>
                                    <div class="choice-text">
                                        <h4>Restore Session</h4>
                                        <p>Resume existing session</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Step 2: QR Code */}
                        <div class="auth-step" id="tg-step-qr">
                            <div style={{ textAlign: 'center' }}>
                                <div class="qr-frame">
                                    <div id="modal-qr-container"></div>
                                    <div class="qr-scan-line"></div>
                                </div>
                                <p style={{ fontSize: '14px', fontWeight: '600', marginBottom: '10px' }}>Scan with Telegram</p>
                                <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '20px' }}>
                                    Settings → Devices → Link Desktop Device
                                </p>
                                <button class="btn btn-sm" id="back-to-choice-1" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-dim)', width: 'auto' }}>Back</button>
                            </div>
                        </div>

                        {/* Step 2: Phone Input */}
                        <div class="auth-step" id="tg-step-phone">
                            <div class="input-group">
                                <label class="input-label">Phone Number</label>
                                <input type="tel" id="modal-tg-phone" class="input-field" placeholder="+1234567890" />
                            </div>
                            <button class="btn" id="modal-send-code-btn">Send Verification Code</button>
                            <button class="btn btn-sm" id="back-to-choice-2" style={{ background: 'none', color: 'var(--text-dim)', marginTop: '10px' }}>Back</button>
                        </div>

                        {/* Step 2: Email Input */}
                        <div class="auth-step" id="tg-step-email">
                            <div class="input-group">
                                <label class="input-label">Email Address</label>
                                <input type="email" id="modal-tg-email" class="input-field" placeholder="your@email.com" />
                            </div>
                            <button class="btn" id="modal-send-email-btn">Continue</button>
                            <button class="btn btn-sm" id="back-to-choice-3" style={{ background: 'none', color: 'var(--text-dim)', marginTop: '10px' }}>Back</button>
                        </div>

                        {/* Step 2: Bot Token Input */}
                        <div class="auth-step" id="tg-step-bot">
                            <div class="input-group">
                                <label class="input-label">Bot Token</label>
                                <input type="text" id="modal-tg-bot-token" class="input-field" placeholder="123456789:ABC..." />
                            </div>
                            <button class="btn" id="modal-verify-bot-btn">Link Bot</button>
                            <button class="btn btn-sm" id="back-to-choice-4" style={{ background: 'none', color: 'var(--text-dim)', marginTop: '10px' }}>Back</button>
                        </div>

                        {/* Step 3: Code Input */}
                        <div class="auth-step" id="tg-step-code">
                            <p style={{ textAlign: 'center', marginBottom: '20px', fontSize: '14px' }}>
                                Enter the 5-digit code sent to your Telegram app
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
                                <input type="text" id="modal-tg-code" class="input-field" placeholder="00000" style={{ textAlign: 'center', fontSize: '24px', letterSpacing: '8px', maxWidth: '200px' }} maxLength={6} />
                            </div>
                            <button class="btn" id="modal-verify-code-btn">Verify & Link</button>
                        </div>

                        {/* Step 4: Password Input */}
                        <div class="auth-step" id="tg-step-password">
                            <p style={{ textAlign: 'center', marginBottom: '20px', fontSize: '14px' }}>
                                Two-Step Verification is enabled. Please enter your cloud password.
                            </p>
                            <div class="input-group">
                                <input type="password" id="modal-tg-password" class="input-field" placeholder="Your Password" />
                            </div>
                            <button class="btn" id="modal-verify-password-btn">Submit Password</button>
                        </div>

                        {/* Step: Success */}
                        <div class="auth-step" id="tg-step-success">
                            <div style={{ textAlign: 'center' }}>
                                <div class="success-icon">✓</div>
                                <h3 style={{ marginBottom: '10px' }}>Connected!</h3>
                                <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '20px' }}>
                                    Your account has been successfully linked to Whisper Messenger.
                                </p>
                                <button class="btn" onclick="location.reload()">Great!</button>
                            </div>
                        </div>

                        {/* Step: Loading */}
                        <div class="auth-step" id="tg-step-loading">
                            <div style={{ textAlign: 'center', padding: '40px 0' }}>
                                <div class="shimmer" style={{ width: '60px', height: '60px', borderRadius: '50%', margin: '0 auto 20px', background: 'rgba(139, 92, 246, 0.2)' }}></div>
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
