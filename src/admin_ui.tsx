/** @jsxImportSource preact */
import { render } from 'preact-render-to-string';
import { Env, UserSession } from './types';
import { ErrorLog } from './logger';

import adminCss from './admin.css';

type HealthChecks = {
    VERIFY_TOKEN: boolean;
    META_PAGE_TOKEN: boolean;
    META_APP_SECRET: boolean;
    WHATSAPP_TOKEN: boolean;
    META_API_VERSION: boolean;
    WHATSAPP_PHONE_NUMBER_ID: boolean;
    TELEGRAM_APP_ID: boolean;
    TELEGRAM_APP_HASH: boolean;
    AUDIO_QUEUE: boolean;
    AI: boolean;
};

const ConfigItem = ({ label, active }: { label: string; active: boolean }) => (
    <div class="config-item">
        <span class="config-label">{label}</span>
        <span class={`config-value ${active ? 'configured' : 'missing'}`}>
            {active ? 'ACTIVE' : 'MISSING'}
        </span>
    </div>
);

const UserRow = ({ user }: { user: UserSession }) => (
    <tr class="user-row">
        <td>
            <div style={{ fontWeight: '600' }}>{user.firstName}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>@{user.username || 'n/a'}</div>
        </td>
        <td><code style={{ fontSize: '11px', color: '#888' }}>{user.userId}</code></td>
        <td>{user.phone || 'n/a'}</td>
        <td style={{ textAlign: 'center' }}>
            <span class={`status-tag ${user.isActive ? 'active' : 'inactive'}`} style={{ fontSize: '10px', padding: '2px 6px' }}>
                {user.isActive ? 'RUNNING' : 'STOPPED'}
            </span>
        </td>
        <td style={{ textAlign: 'center', fontWeight: '700', color: '#24A1DE' }}>{user.transcriptionCount || 0}</td>
        <td>{new Date(user.createdAt).toLocaleDateString()}</td>
        <td style={{ textAlign: 'right' }}>
            <button class="btn btn-sm btn-danger deactivate-btn" data-userid={user.userId} style={{ padding: '4px 8px', fontSize: '10px', margin: 0, background: user.isActive ? '#ef4444' : '#6B7280' }}>
                {user.isActive ? 'Stop Pod' : 'Delete'}
            </button>
        </td>
    </tr>
);

const ErrorLogItem = ({ error }: { error: ErrorLog }) => (
    <div class="error-log-item">
        <div class="error-log-meta">
            <span class={`platform-tag ${error.platform}`}>{error.platform.toUpperCase()}</span>
            <span class="error-log-time">{new Date(error.timestamp).toLocaleString()}</span>
        </div>
        <div class="error-log-message">{error.message}</div>
    </div>
);

export const renderAdminDashboard = (checks: HealthChecks, env: Env, origin: string, stats: any, errors: ErrorLog[], users: UserSession[] = []) => {
    return "<!DOCTYPE html>" + render(
        <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>Whisper Messenger Admin</title>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />
                <style dangerouslySetInnerHTML={{ __html: adminCss }} />
            </head>
            <body>
                <div class="container">
                    <header>
                        <div class="logo">
                            <div class="logo-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                                </svg>
                            </div>
                            WHISPER ADMIN
                        </div>
                        <div class="status-badge" title="Click to logout" dangerouslySetInnerHTML={{ __html: `<div class="status-dot"></div>SYSTEM ONLINE (LOGOUT)` }} />
                    </header>

                    <div class="grid">
                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">
                                    <span style={{ color: '#24A1DE' }}>✦</span> Telegram
                                </h3>
                                <span class={`status-tag ${checks.TELEGRAM_APP_ID && checks.TELEGRAM_APP_HASH ? 'active' : 'inactive'}`}>
                                    {checks.TELEGRAM_APP_ID && checks.TELEGRAM_APP_HASH ? 'CONNECTED' : 'NOT SETUP'}
                                </span>
                            </div>
                            <div class="config-list">
                                <ConfigItem label="APP_ID" active={checks.TELEGRAM_APP_ID} />
                                <ConfigItem label="APP_HASH" active={checks.TELEGRAM_APP_HASH} />
                            </div>
                            <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                <div id="tg-auth-status-container" style={{ display: 'none', marginBottom: '15px', padding: '12px', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontSize: '14px', color: '#22c55e', fontWeight: '600' }}>Authenticated</div>
                                            <div id="tg-auth-details" style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}></div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button class="btn" id="tg-test-btn" style={{ margin: 0, width: 'auto', background: '#3B82F6', fontSize: '12px', padding: '6px 12px' }}>Test</button>
                                            <button class="btn" id="tg-logout-btn" style={{ margin: 0, width: 'auto', background: '#ef4444', fontSize: '12px', padding: '6px 12px' }}>Logout</button>
                                        </div>
                                    </div>
                                </div>
                                <div id="tg-auth-form">
                                    <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                                        <input type="tel" id="tg-phone-input" class="input-field" placeholder="+1234567890" style={{ width: '180px', padding: '0.6rem', margin: 0, borderRadius: '8px' }} />
                                        <button class="btn" id="tg-send-code-btn" style={{ margin: 0, width: 'auto', background: '#8B5CF6' }}>Send Code</button>
                                    </div>
                                    <div id="tg-code-section" style={{ display: 'none', marginTop: '10px' }}>
                                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                                            <input type="text" id="tg-code-input" class="input-field" placeholder="Enter code" style={{ width: '130px', padding: '0.6rem', margin: 0, borderRadius: '8px' }} />
                                            <button class="btn" id="tg-verify-btn" style={{ margin: 0, width: 'auto', background: '#22c55e' }}>Verify</button>
                                        </div>
                                    </div>
                                    <div style={{ marginTop: '10px' }}>
                                        <button class="btn" id="tg-show-qr-btn" style={{ margin: 0, width: 'auto', background: '#6B7280', fontSize: '11px', padding: '5px 10px' }}>QR Code Login</button>
                                    </div>
                                    <div id="tg-qr-section" style={{ display: 'none', marginTop: '10px', textAlign: 'center' }}>
                                        <div id="qr-code-container" style={{ background: 'white', padding: '10px', borderRadius: '8px', display: 'inline-block', marginBottom: '8px' }}>
                                            <img id="qr-code-img" src="" alt="QR Code" style={{ width: '180px', height: '180px' }} />
                                        </div>
                                        <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>Telegram → Settings → Devices → Scan QR</p>
                                        <p id="qr-status" style={{ fontSize: '11px', color: '#8B5CF6', minHeight: '16px' }}>Waiting...</p>
                                    </div>
                                    <div id="tg-auth-message" style={{ fontSize: '11px', marginTop: '8px', minHeight: '16px' }}></div>
                                </div>
                            </div>
                        </div>

                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">
                                    <span style={{ color: '#0081FB' }}>◉</span> Facebook Messenger
                                </h3>
                                <span class={`status-tag ${checks.META_PAGE_TOKEN ? 'active' : 'inactive'}`}>
                                    {checks.META_PAGE_TOKEN ? 'CONNECTED' : 'NOT SETUP'}
                                </span>
                            </div>
                            <div class="config-list">
                                <ConfigItem label="VERIFY_TOKEN" active={checks.VERIFY_TOKEN} />
                                <ConfigItem label="PAGE_TOKEN" active={checks.META_PAGE_TOKEN} />
                                <ConfigItem label="APP_SECRET" active={checks.META_APP_SECRET} />
                            </div>
                            {checks.META_PAGE_TOKEN && (
                                <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                        <button class="btn" id="setup-meta-btn" style={{ margin: 0, width: 'auto', fontSize: '12px' }}>Subscribe Page</button>
                                        <input type="text" id="test-meta-id" class="input-field" placeholder="PSID" style={{ width: '120px', padding: '0.5rem', margin: 0, borderRadius: '8px' }} />
                                        <button class="btn" id="test-meta-btn" style={{ margin: 0, width: 'auto', background: '#3B82F6', fontSize: '12px' }}>Test</button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">
                                    <span style={{ color: '#FF0072' }}>✦</span> Instagram
                                </h3>
                                <span class={`status-tag ${checks.META_PAGE_TOKEN ? 'active' : 'inactive'}`}>
                                    {checks.META_PAGE_TOKEN ? 'CONNECTED' : 'NOT SETUP'}
                                </span>
                            </div>
                            <div class="config-list">
                                <ConfigItem label="VERIFY_TOKEN" active={checks.VERIFY_TOKEN} />
                                <ConfigItem label="PAGE_TOKEN" active={checks.META_PAGE_TOKEN} />
                                <ConfigItem label="APP_SECRET" active={checks.META_APP_SECRET} />
                            </div>
                            <div style={{ marginTop: '15px', fontSize: '12px', color: 'var(--text-dim)' }}>
                                Uses same credentials as Messenger. Webhook subscription shared.
                            </div>
                        </div>

                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">
                                    <span style={{ color: '#25D366' }}>◉</span> WhatsApp
                                </h3>
                                <span class={`status-tag ${checks.WHATSAPP_TOKEN && checks.WHATSAPP_PHONE_NUMBER_ID ? 'active' : 'inactive'}`}>
                                    {checks.WHATSAPP_TOKEN && checks.WHATSAPP_PHONE_NUMBER_ID ? 'CONNECTED' : 'NOT SETUP'}
                                </span>
                            </div>
                            <div class="config-list">
                                <ConfigItem label="PHONE_ID" active={checks.WHATSAPP_PHONE_NUMBER_ID} />
                                <ConfigItem label="API_TOKEN" active={checks.WHATSAPP_TOKEN} />
                            </div>
                            {checks.WHATSAPP_TOKEN && checks.WHATSAPP_PHONE_NUMBER_ID && (
                                <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                        <input type="text" id="test-whatsapp-id" class="input-field" placeholder="15551234567" style={{ width: '150px', padding: '0.5rem', margin: 0, borderRadius: '8px' }} />
                                        <button class="btn" id="test-whatsapp-btn" style={{ margin: 0, width: 'auto', background: '#3B82F6', fontSize: '12px' }}>Test</button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">System Runtime</h3>
                            </div>
                            <div class="config-list">
                                <ConfigItem label="AI_MODEL" active={checks.AI} />
                                <ConfigItem label="QUEUE" active={checks.AUDIO_QUEUE} />
                            </div>
                            <button class="btn" id="refresh-btn">Refresh Stats</button>
                        </div>

                        <div class="card" style={{ gridColumn: '1 / -1' }}>
                            <div class="card-header">
                                <h3 class="card-title">User Management (Telegram Pods)</h3>
                                <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                                    {users.length} registered users
                                </div>
                            </div>
                            <div class="user-table-container" style={{ overflowX: 'auto', marginTop: '10px' }}>
                                <table class="user-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-dim)' }}>
                                            <th style={{ padding: '10px 5px' }}>User</th>
                                            <th style={{ padding: '10px 5px' }}>UID</th>
                                            <th style={{ padding: '10px 5px' }}>Phone</th>
                                            <th style={{ padding: '10px 5px', textAlign: 'center' }}>Pod Status</th>
                                            <th style={{ padding: '10px 5px', textAlign: 'center' }}>Voice Stats</th>
                                            <th style={{ padding: '10px 5px' }}>Joined</th>
                                            <th style={{ padding: '10px 5px', textAlign: 'right' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.length > 0 ? (
                                            users.map(u => <UserRow key={u.userId} user={u} />)
                                        ) : (
                                            <tr>
                                                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>
                                                    No users registered yet. Send visitors to <strong>/auth</strong>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">Transcription Stats</h3>
                                <div style={{ fontSize: '12px', background: 'var(--primary)', padding: '2px 8px', borderRadius: '4px' }}>
                                    Total: {Object.values(stats).reduce((a: any, b: any) => a + b, 0)}
                                </div>
                            </div>
                            <div class="stats-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div class="stat-box" style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '12px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '4px' }}>MESSENGER</div>
                                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#00B2FF' }}>{stats.messenger}</div>
                                </div>
                                <div class="stat-box" style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '12px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '4px' }}>INSTAGRAM</div>
                                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#FF0072' }}>{stats.instagram}</div>
                                </div>
                                <div class="stat-box" style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '12px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '4px' }}>WHATSAPP</div>
                                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#25D366' }}>{stats.whatsapp}</div>
                                </div>
                                <div class="stat-box" style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '12px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '4px' }}>TELEGRAM</div>
                                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#24A1DE' }}>{stats.telegram}</div>
                                </div>
                            </div>
                        </div>

                        <div class="card" style={{ gridColumn: '1 / -1' }}>
                            <div class="card-header">
                                <h3 class="card-title">Easy Setup Guide</h3>
                            </div>
                            <div class="config-list">
                                <p style={{ fontSize: '14px', marginBottom: '10px' }}>
                                    <strong>Webhook Callback URL:</strong> <br/><code style={{ userSelect: 'all', background: '#222', padding: '4px 8px', borderRadius: '4px', display: 'inline-block', marginTop: '4px' }}>{origin}</code>
                                </p>
                                <p style={{ fontSize: '14px', marginBottom: '10px' }}>
                                    <strong>Verify Token (VERIFY_TOKEN):</strong> <br/><code style={{ userSelect: 'all', background: '#222', padding: '4px 8px', borderRadius: '4px', display: 'inline-block', marginTop: '4px' }}>{env.VERIFY_TOKEN || 'Not Configured'}</code>
                                </p>
                                <p style={{ fontSize: '14px', marginBottom: '20px' }}>
                                    <strong>App Secret (META_APP_SECRET):</strong> <br/><code style={{ userSelect: 'all', background: '#222', padding: '4px 8px', borderRadius: '4px', display: 'inline-block', marginTop: '4px' }}>{env.META_APP_SECRET || 'Not Configured'}</code>
                                </p>
                                
                                <h4 style={{ marginTop: '10px', marginBottom: '8px' }}>1. Telegram Personal Setup</h4>
                                <div style={{ fontSize: '14px', marginBottom: '10px', lineHeight: '1.5', background: 'rgba(15, 23, 42, 0.5)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                                    <strong>Auth Methods:</strong> Use phone number + code verification, or scan QR code from Telegram Settings → Devices.
                                </div>
                                <div style={{ marginBottom: '20px' }}>
                                    <div id="tg-auth-status-container" style={{ display: 'none', marginBottom: '15px', padding: '12px', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '8px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontSize: '14px', color: '#22c55e', fontWeight: '600' }}>Authenticated</div>
                                                <div id="tg-auth-details" style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}></div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button class="btn" id="tg-test-btn" style={{ margin: 0, width: 'auto', background: '#3B82F6', fontSize: '12px', padding: '6px 12px' }}>Test Message</button>
                                                <button class="btn" id="tg-logout-btn" style={{ margin: 0, width: 'auto', background: '#ef4444', fontSize: '12px', padding: '6px 12px' }}>Logout</button>
                                            </div>
                                        </div>
                                    </div>
                                    <div id="tg-auth-form">
                                        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                                            <input type="tel" id="tg-phone-input" class="input-field" placeholder="+1234567890" style={{ width: '200px', padding: '0.6rem', margin: 0, borderRadius: '8px' }} />
                                            <button class="btn" id="tg-send-code-btn" style={{ margin: 0, width: 'auto', background: '#8B5CF6' }}>Send Code</button>
                                        </div>
                                        <div id="tg-code-section" style={{ display: 'none', marginTop: '10px' }}>
                                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                <input type="text" id="tg-code-input" class="input-field" placeholder="Enter code" style={{ width: '150px', padding: '0.6rem', margin: 0, borderRadius: '8px' }} />
                                                <button class="btn" id="tg-verify-btn" style={{ margin: 0, width: 'auto', background: '#22c55e' }}>Verify</button>
                                            </div>
                                        </div>
                                        <div style={{ marginTop: '15px' }}>
                                            <button class="btn" id="tg-show-qr-btn" style={{ margin: 0, width: 'auto', background: '#6B7280', fontSize: '12px', padding: '6px 12px' }}>Or use QR Code</button>
                                        </div>
                                        <div id="tg-qr-section" style={{ display: 'none', marginTop: '15px', textAlign: 'center' }}>
                                            <div id="qr-code-container" style={{ background: 'white', padding: '15px', borderRadius: '12px', display: 'inline-block', marginBottom: '10px' }}>
                                                <img id="qr-code-img" src="" alt="QR Code" style={{ width: '250px', height: '250px' }} />
                                            </div>
                                            <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '5px' }}>Open Telegram → Settings → Devices → Scan QR</p>
                                            <p id="qr-status" style={{ fontSize: '12px', color: '#8B5CF6', minHeight: '18px' }}>Waiting for scan...</p>
                                        </div>
                                        <div id="tg-auth-message" style={{ fontSize: '12px', marginTop: '8px', minHeight: '18px' }}></div>
                                    </div>
                                </div>

                                <h4 style={{ marginBottom: '8px' }}>2. Instagram & Messenger Setup</h4>
                                <div style={{ fontSize: '14px', marginBottom: '10px', lineHeight: '1.5', background: 'rgba(15, 23, 42, 0.5)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                                    <div style={{ marginBottom: '8px' }}><strong>Get Keys:</strong></div>
                                    <ul style={{ margin: '0 0 10px 0', paddingLeft: '20px' }}>
                                        <li>Go to Meta App Dashboard &gt; Add Messenger and/or Instagram product.</li>
                                        <li>Generate a Page Access Token and save it as <code>META_PAGE_TOKEN</code> secret.</li>
                                        <li>Get your App Secret from App Settings &gt; Basic and save as <code>META_APP_SECRET</code>.</li>
                                        <li>Set a custom verify token string in <code>VERIFY_TOKEN</code>.</li>
                                    </ul>
                                    <strong>Webhook Setup:</strong> Configure Webhook in Meta App using the Callback URL and Verify Token (above). Subscribe to "messages" and "messaging_postbacks". Then click below to link your page.
                                </div>
                                {checks.META_PAGE_TOKEN ? (
                                    <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                                        <button class="btn" id="setup-meta-btn" style={{ margin: 0, width: 'auto' }}>Subscribe Page</button>
                                        <input type="text" id="test-meta-id" class="input-field" placeholder="PSID/IGSID" style={{ width: '150px', padding: '0.6rem', margin: 0, borderRadius: '8px' }} />
                                        <button class="btn" id="test-meta-btn" style={{ margin: 0, width: 'auto', background: '#3B82F6' }}>Test Msg</button>
                                    </div>
                                ) : (
                                    <p style={{ fontSize: '14px', color: '#888', marginBottom: '20px' }}>Provide META_PAGE_TOKEN in secrets to subscribe.</p>
                                )}

                                <h4 style={{ marginBottom: '8px' }}>3. WhatsApp Setup</h4>
                                <div style={{ fontSize: '14px', marginBottom: '10px', lineHeight: '1.5', background: 'rgba(15, 23, 42, 0.5)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                                    <div style={{ marginBottom: '8px' }}><strong>Get Keys:</strong></div>
                                    <ul style={{ margin: '0 0 10px 0', paddingLeft: '20px' }}>
                                        <li>In Meta App Dashboard, add WhatsApp product &gt; API Setup.</li>
                                        <li>Copy the Phone Number ID into <code>WHATSAPP_PHONE_NUMBER_ID</code>.</li>
                                        <li>Create a System User in Meta Business Settings, assign your app and WhatsApp assets, and generate a permanent token for <code>WHATSAPP_TOKEN</code>.</li>
                                    </ul>
                                    <strong>Webhook Setup:</strong> Navigate to WhatsApp &gt; Configuration. Edit the Webhook and paste the Callback URL and Verify Token. Manage webhook fields and subscribe to "messages".
                                </div>
                                {checks.WHATSAPP_TOKEN && checks.WHATSAPP_PHONE_NUMBER_ID ? (
                                    <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                                        <input type="text" id="test-whatsapp-id" class="input-field" placeholder="Phone Number (e.g. 15551234567)" style={{ width: '250px', padding: '0.6rem', margin: 0, borderRadius: '8px' }} />
                                        <button class="btn" id="test-whatsapp-btn" style={{ margin: 0, width: 'auto', background: '#3B82F6' }}>Test Msg</button>
                                    </div>
                                ) : (
                                    <p style={{ fontSize: '14px', color: '#888', marginBottom: '20px' }}>Provide WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID in secrets to test.</p>
                                )}
                            </div>
                        </div>

                        <div class="card error-logs-card" style={{ gridColumn: '1 / -1' }}>
                            <div class="card-header">
                                <h3 class="card-title">System Error Logs</h3>
                                <div style={{ fontSize: '12px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '2px 8px', borderRadius: '4px' }}>
                                    Recent Issues
                                </div>
                            </div>
                            <div class="error-list">
                                {errors.length > 0 ? (
                                    errors.map((err, i) => <ErrorLogItem key={i} error={err} />)
                                ) : (
                                    <div class="no-errors">No recent errors detected. System is healthy.</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                <script dangerouslySetInnerHTML={{
                    __html: `
                    document.querySelector('.status-badge').addEventListener('click', function() {
                        fetch('/admin/logout', { method: 'POST' }).then(function() { location.reload(); });
                    });
                    document.getElementById('refresh-btn').addEventListener('click', function() {
                        location.reload();
                    });
                    var tgPhoneInput = document.getElementById('tg-phone-input');
                    var tgCodeInput = document.getElementById('tg-code-input');
                    var tgSendCodeBtn = document.getElementById('tg-send-code-btn');
                    var tgVerifyBtn = document.getElementById('tg-verify-btn');
                    var tgCodeSection = document.getElementById('tg-code-section');
                    var tgQrSection = document.getElementById('tg-qr-section');
                    var tgShowQrBtn = document.getElementById('tg-show-qr-btn');
                    var tgAuthMessage = document.getElementById('tg-auth-message');
                    var tgAuthStatusContainer = document.getElementById('tg-auth-status-container');
                    var tgAuthForm = document.getElementById('tg-auth-form');
                    var tgAuthDetails = document.getElementById('tg-auth-details');
                    var tgLogoutBtn = document.getElementById('tg-logout-btn');
                    var tgTestBtn = document.getElementById('tg-test-btn');
                    var qrCodeImg = document.getElementById('qr-code-img');
                    var qrStatus = document.getElementById('qr-status');
                    var currentPhone = '';
                    var qrPollInterval = null;
                    function showTgMessage(msg, isError) {
                        tgAuthMessage.style.color = isError ? '#ef4444' : '#22c55e';
                        tgAuthMessage.innerText = msg;
                    }
                    function checkTgAuthStatus() {
                        fetch('/admin/tg-auth-status')
                            .then(function(r) { return r.json(); })
                            .then(function(data) {
                                if (data.authenticated) {
                                    tgAuthStatusContainer.style.display = 'block';
                                    tgAuthForm.style.display = 'none';
                                    tgAuthDetails.innerText = data.firstName + ' (ID: ' + data.userId + ') - ' + data.phone;
                                } else {
                                    tgAuthStatusContainer.style.display = 'none';
                                    tgAuthForm.style.display = 'block';
                                }
                            });
                    }
                    checkTgAuthStatus();
                    if (tgShowQrBtn) {
                        tgShowQrBtn.addEventListener('click', function() {
                            tgQrSection.style.display = tgQrSection.style.display === 'none' ? 'block' : 'none';
                            if (tgQrSection.style.display === 'block' && !qrCodeImg.src) {
                                tgShowQrBtn.innerText = 'Hide QR Code';
                                fetch('/admin/tg-qr-login', { method: 'POST' })
                                    .then(function(res) { return res.json(); })
                                    .then(function(data) {
                                        if (data.success) {
                                            qrCodeImg.src = data.qrUrl;
                                            qrStatus.innerText = 'Waiting for scan...';
                                            qrPollInterval = setInterval(function() {
                                                fetch('/admin/tg-qr-check?token=' + data.token)
                                                    .then(function(r) { return r.json(); })
                                                    .then(function(status) {
                                                        if (status.authenticated) {
                                                            clearInterval(qrPollInterval);
                                                            qrStatus.innerText = 'Success!';
                                                            setTimeout(function() { location.reload(); }, 1000);
                                                        }
                                                    });
                                            }, 2000);
                                        }
                                    });
                            } else {
                                tgShowQrBtn.innerText = 'Or use QR Code';
                                if (qrPollInterval) clearInterval(qrPollInterval);
                            }
                        });
                    }
                    if (tgSendCodeBtn) {
                        tgSendCodeBtn.addEventListener('click', function() {
                            var phone = tgPhoneInput.value.trim();
                            if (!phone) return showTgMessage('Please enter a phone number', true);
                            if (!phone.startsWith('+')) return showTgMessage('Phone must start with +', true);
                            currentPhone = phone;
                            tgSendCodeBtn.innerText = 'Sending...';
                            showTgMessage('', false);
                            fetch('/admin/tg-send-code', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ phoneNumber: phone })
                            })
                            .then(function(res) { return res.json(); })
                            .then(function(data) {
                                if (data.success) {
                                    tgCodeSection.style.display = 'block';
                                    tgSendCodeBtn.innerText = 'Resend Code';
                                    tgPhoneInput.disabled = true;
                                    showTgMessage('Code sent! Check your Telegram app.', false);
                                    tgCodeInput.focus();
                                } else {
                                    showTgMessage('Error: ' + (data.description || 'Unknown error'), true);
                                    tgSendCodeBtn.innerText = 'Send Code';
                                }
                            })
                            .catch(function(err) {
                                showTgMessage('Error: ' + err, true);
                                tgSendCodeBtn.innerText = 'Send Code';
                            });
                        });
                    }
                    if (tgVerifyBtn) {
                        tgVerifyBtn.addEventListener('click', function() {
                            var code = tgCodeInput.value.trim();
                            if (!code) return showTgMessage('Please enter the code', true);
                            tgVerifyBtn.innerText = 'Verifying...';
                            showTgMessage('', false);
                            fetch('/admin/tg-verify-code', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ phoneNumber: currentPhone, code: code })
                            })
                            .then(function(res) { return res.json(); })
                            .then(function(data) {
                                if (data.success) {
                                    showTgMessage('Authentication successful! Welcome ' + (data.firstName || data.userId), false);
                                    setTimeout(function() { location.reload(); }, 1500);
                                } else {
                                    showTgMessage('Error: ' + (data.description || 'Invalid code'), true);
                                    tgVerifyBtn.innerText = 'Verify';
                                }
                            })
                            .catch(function(err) {
                                showTgMessage('Error: ' + err, true);
                                tgVerifyBtn.innerText = 'Verify';
                            });
                        });
                    }
                    if (tgLogoutBtn) {
                        tgLogoutBtn.addEventListener('click', function() {
                            if (!confirm('Logout from Telegram?')) return;
                            tgLogoutBtn.innerText = '...';
                            fetch('/admin/tg-logout', { method: 'POST' })
                                .then(function(r) { return r.json(); })
                                .then(function(data) {
                                    if (data.success) { location.reload(); }
                                })
                                .catch(function(err) { location.reload(); });
                        });
                    }
                    if (tgTestBtn) {
                        tgTestBtn.addEventListener('click', function() {
                            tgTestBtn.innerText = 'Sending...';
                            fetch('/admin/test-telegram', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ recipientId: 'me' })
                            })
                            .then(function(res) { return res.json(); })
                            .then(function(data) {
                                if (data.success) {
                                    alert('Test message sent successfully!');
                                } else {
                                    alert('Error: ' + (data.description || 'Unknown error'));
                                }
                                tgTestBtn.innerText = 'Test Message';
                            })
                            .catch(function(err) {
                                alert('Error: ' + err);
                                tgTestBtn.innerText = 'Test Message';
                            });
                        });
                    }
                    if (tgTestBtn) {
                        tgTestBtn.addEventListener('click', function() {
                            tgTestBtn.innerText = 'Sending...';
                            fetch('/admin/test-telegram', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ recipientId: 'me' })
                            })
                            .then(function(res) { return res.json(); })
                            .then(function(data) {
                                if (data.success) {
                                    alert('Test message sent successfully!');
                                } else {
                                    alert('Error: ' + (data.description || 'Unknown error'));
                                }
                                tgTestBtn.innerText = 'Test Message';
                            })
                            .catch(function(err) {
                                alert('Error: ' + err);
                                tgTestBtn.innerText = 'Test Message';
                            });
                        });
                    }
                    var metaBtn = document.getElementById('setup-meta-btn');
                    if (metaBtn) {
                        metaBtn.addEventListener('click', function() {
                            metaBtn.innerText = 'Subscribing...';
                            fetch('/admin/setup-meta', { method: 'POST' })
                                .then(function(res) { return res.json(); })
                                .then(function(data) { 
                                    alert('Meta Subscribed: ' + (data.success ? 'Success' : JSON.stringify(data))); 
                                    metaBtn.innerText = 'Subscribe Page to App (Meta API)'; 
                                })
                                .catch(function(err) { 
                                    alert('Error: ' + err); 
                                    metaBtn.innerText = 'Subscribe Page'; 
                                });
                        });
                    }
                    function createTestHandler(btnId, inputId, endpoint) {
                        var btn = document.getElementById(btnId);
                        if (btn) {
                            btn.addEventListener('click', function() {
                                var id = document.getElementById(inputId).value;
                                if (!id) return alert('Please enter an ID first.');
                                btn.innerText = 'Sending...';
                                fetch(endpoint, { 
                                    method: 'POST', 
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ recipientId: id })
                                })
                                .then(function(res) { return res.json(); })
                                .then(function(data) {
                                    alert('Status: ' + (data.success ? 'Success' : 'Error: ' + JSON.stringify(data)));
                                    btn.innerText = 'Test Msg';
                                })
                                .catch(function(err) {
                                    alert('Error: ' + err);
                                    btn.innerText = 'Test Msg';
                                });
                            });
                        }
                    }
                    createTestHandler('test-telegram-btn', 'test-telegram-id', '/admin/test-telegram');
                    createTestHandler('test-meta-btn', 'test-meta-id', '/admin/test-meta');
                    createTestHandler('test-whatsapp-btn', 'test-whatsapp-id', '/admin/test-whatsapp');

                    document.querySelectorAll('.deactivate-btn').forEach(function(btn) {
                        btn.addEventListener('click', function() {
                            var uid = btn.getAttribute('data-userid');
                            var action = btn.innerText.includes('Stop') ? 'stop' : 'delete';
                            if (!confirm('Are you sure you want to ' + action + ' user ' + uid + '?')) return;
                            
                            btn.innerText = '...';
                            fetch('/admin/user-action', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ userId: uid, action: action })
                            })
                            .then(function(r) { return r.json(); })
                            .then(function(data) {
                                if (data.success) { location.reload(); }
                                else { alert('Error: ' + data.error); btn.innerText = action; }
                            })
                            .catch(function(err) { alert('Error: ' + err); });
                        });
                    });
                    `
                }} />
            </body>
        </html>
    );
};

export const renderAdminLogin = (error?: string) => {
    return "<!DOCTYPE html>" + render(
        <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>Admin Login</title>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />
                <style dangerouslySetInnerHTML={{ __html: adminCss }} />
            </head>
            <body>
                <div class="login-container">
                    <div class="card login-card">
                        <h1>Whisper Admin</h1>
                        {error && <div class="error-msg">{error}</div>}
                        <form method="POST" action="/admin/login">
                            <div class="input-group">
                                <label class="input-label" for="password">Admin Password</label>
                                <input class="input-field" type="password" id="password" name="password" required autoFocus />
                            </div>
                            <button type="submit" class="btn">Login</button>
                        </form>
                    </div>
                </div>
            </body>
        </html>
    );
};
