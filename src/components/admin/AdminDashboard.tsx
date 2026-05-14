/** @jsxImportSource preact */
import React from 'preact/compat';
import fs from 'fs';
import { render } from 'preact-render-to-string';
import type { HealthChecks, UserSession, Env } from '../../types';
import type { ErrorLog } from '../../logger';

import { ConfigItem, formatUptime, UserRow, ErrorLogItem } from './Admin.utils';

export const renderAdminDashboard = (checks: HealthChecks, env: Env, origin: string, stats: any, errors: ErrorLog[], users: UserSession[] = [], tgAuthenticated: boolean = false) => {
    return "<!DOCTYPE html>" + render(
        <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>Echo Messenger Admin</title>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />
                <link rel="stylesheet" href="/assets/css/admin.css" />
                <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
            </head>
            <body>
                <div id="progress-bar"></div>
                <div class="container">
                    <header>
                        <div class="logo">
                            <div class="logo-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                                </svg>
                            </div>
                            ECHO ADMIN
                        </div>
                        <div class="status-badge" title="Click to logout" dangerouslySetInnerHTML={{ __html: `<div class="status-dot"></div>SYSTEM ONLINE (LOGOUT)` }} />
                    </header>

                    <div class="grid">
                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">
                                    <span style={{ color: '#24A1DE' }}>✦</span> Telegram
                                </h3>
                                <span class={`status-tag ${tgAuthenticated ? 'active' : 'inactive'}`}>
                                    {tgAuthenticated ? 'CONNECTED' : 'NOT SETUP'}
                                </span>
                            </div>
                            <div class="config-list">
                                <ConfigItem label="APP_ID" active={checks.TELEGRAM_APP_ID} />
                                <ConfigItem label="APP_HASH" active={checks.TELEGRAM_APP_HASH} />
                            </div>
                            <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                <div id="tg-auth-status-container" style={{ display: tgAuthenticated ? 'block' : 'none', marginBottom: '15px', padding: '12px', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontSize: '14px', color: '#22c55e', fontWeight: '600' }}>Authenticated</div>
                                            <div id="tg-auth-details" style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}></div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button class="btn" id="tg-test-btn" title="Send simple text" style={{ margin: 0, width: 'auto', background: '#3B82F6', fontSize: '12px', padding: '6px 12px' }}>Test</button>
                                            <button class="btn" id="tg-test-voice-btn" title="Send sample voice msg" style={{ margin: 0, width: 'auto', background: '#F59E0B', fontSize: '12px', padding: '6px 12px' }}>Test Voice</button>
                                            <button class="btn" id="tg-logout-btn" style={{ margin: 0, width: 'auto', background: '#ef4444', fontSize: '12px', padding: '6px 12px' }}>Disconnect</button>
                                        </div>
                                    </div>
                                </div>
                                <div id="tg-auth-form" style={{ display: tgAuthenticated ? 'none' : 'block' }}>
                                    <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                                        <div class="input-group" style={{ margin: 0, flex: 1 }}>
                                            <input type="tel" id="tg-phone-input" class="input-field" placeholder="+1234567890" style={{ padding: '0.6rem', borderRadius: '8px' }} />
                                        </div>
                                        <button class="btn" id="tg-send-code-btn" style={{ margin: 0, width: 'auto', background: '#8B5CF6', padding: '0.6rem 1.2rem' }}>Send Code</button>
                                    </div>
                                    <div id="tg-code-section" style={{ display: 'none', marginTop: '10px' }}>
                                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                                            <div class="input-group" style={{ margin: 0, flex: 1 }}>
                                                <input type="text" id="tg-code-input" class="input-field" placeholder="Enter code" style={{ padding: '0.6rem', borderRadius: '8px' }} />
                                            </div>
                                            <button class="btn" id="tg-verify-btn" style={{ margin: 0, width: 'auto', background: '#22c55e', padding: '0.6rem 1.2rem' }}>Verify</button>
                                        </div>
                                    </div>
                                    <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
                                        <button class="btn" id="tg-show-qr-btn" style={{ margin: 0, width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '12px', padding: '8px' }}>QR Code Login</button>
                                    </div>
                                    <div id="tg-qr-section" style={{ display: 'none', marginTop: '15px', textAlign: 'center', background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '12px' }}>
                                        <div id="qr-code-container" style={{ background: 'white', padding: '10px', borderRadius: '8px', display: 'inline-block', marginBottom: '8px', boxShadow: '0 0 20px rgba(139, 92, 246, 0.3)' }}></div>
                                        <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>Scan from Telegram App</p>
                                        <p id="qr-status" style={{ fontSize: '11px', color: '#8B5CF6', minHeight: '16px', fontWeight: 'bold' }}>Waiting for scan...</p>
                                    </div>
                                    <div id="tg-auth-message" style={{ fontSize: '11px', marginTop: '8px', minHeight: '16px', textAlign: 'center' }}></div>
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
                        </div>

                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">
                                    <span style={{ color: '#00C300' }}>◉</span> LINE
                                </h3>
                            </div>
                            <div style={{ marginTop: '15px' }}>
                                <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
                                    LINE is configured directly by users in their Dashboard by entering Channel Access Token and Secret. Admin doesn't need global LINE tokens.
                                </p>
                            </div>
                        </div>

                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">
                                    <span style={{ color: '#8B5CF6' }}>✦</span> Echo AI Provider
                                </h3>
                                <span id="whisper-status-tag" class="status-tag active">LOADING...</span>
                            </div>
                            <div style={{ marginTop: '10px' }}>
                                <div style={{ display: 'flex', gap: '15px', marginBottom: '15px', flexWrap: 'wrap' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                                        <input type="radio" name="whisper_provider" value="qwen3-asr" id="provider-qwen3-asr" checked readOnly />
                                        <span style={{ fontSize: '14px' }}>Qwen3-ASR</span>
                                    </label>
                                </div>



                                <button class="btn" id="save-whisper-btn" style={{ marginTop: '15px', background: '#8B5CF6', width: '100%', borderRadius: '12px', padding: '10px', fontWeight: '600' }}>Save AI Config</button>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                                    <button class="btn" id="test-s2t-btn" style={{ margin: 0, background: 'rgba(139, 92, 246, 0.1)', color: '#8B5CF6', border: '1px solid #8B5CF6', borderRadius: '12px', padding: '10px', fontWeight: '600', fontSize: '12px' }}>Test Sample</button>
                                    <button class="btn" id="record-test-btn" style={{ margin: 0, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '12px', padding: '10px', fontWeight: '600', fontSize: '12px' }}>Record 5s & Test</button>
                                </div>
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
                                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#24A1DE' }}>{stats.telegram || 0}</div>
                                </div>
                                <div class="stat-box" style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '12px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '4px' }}>LINE</div>
                                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#00C300' }}>{stats.line || 0}</div>
                                </div>
                            </div>
                            
                            <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px' }}>
                                <h4 style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '700' }}>Active Users Stats</h4>
                                <div class="user-stats-list">
                                    {users.filter(u => (u.transcriptionCount || 0) > 0)
                                          .sort((a, b) => (b.transcriptionCount || 0) - (a.transcriptionCount || 0))
                                          .map(u => (
                                        <div class="user-stat-item" key={u.userId} style={{ marginBottom: '8px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                     <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: u.isActive ? '#22c55e' : '#6B7280', boxShadow: u.isActive ? '0 0 8px #22c55e' : 'none' }}></div>
                                                     <div>
                                                        <div style={{ fontSize: '14px', fontWeight: '600' }}>{u.firstName}</div>
                                                        <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>@{u.username || 'n/a'}</div>
                                                     </div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontSize: '16px', fontWeight: '800', color: '#24A1DE' }}>{u.transcriptionCount}</div>
                                                        <div style={{ fontSize: '9px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>msgs</div>
                                                    </div>
                                                    <button class="expand-user-info" data-userid={u.userId} title="Expand Info" style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)', color: '#8B5CF6', borderRadius: '8px', padding: '4px 8px', fontSize: '10px', cursor: 'pointer', fontWeight: '700' }}>
                                                        INFO
                                                    </button>
                                                </div>
                                            </div>
                                            <div id={`info-box-${u.userId}`} class="user-info-detail" style={{ display: 'none', marginTop: '10px', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px', fontSize: '11px' }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                                    <div><span style={{ color: 'var(--text-dim)' }}>UID:</span> <code style={{ color: '#fff' }}>{u.userId}</code></div>
                                                    <div><span style={{ color: 'var(--text-dim)' }}>Pod:</span> <span style={{ color: '#8B5CF6', fontWeight: 'bold' }}>{u.podName || 'n/a'}</span></div>
                                                    <div><span style={{ color: 'var(--text-dim)' }}>Phone:</span> <span style={{ color: '#fff' }}>{u.phone || 'n/a'}</span></div>
                                                    <div><span style={{ color: 'var(--text-dim)' }}>Status:</span> <span style={{ color: u.isActive ? '#22c55e' : '#ef4444' }}>{u.currentStatus || (u.isActive ? 'Running' : 'Stopped')}</span></div>
                                                    <div><span style={{ color: 'var(--text-dim)' }}>Created:</span> <span style={{ color: '#fff' }}>{new Date(u.createdAt).toLocaleDateString()}</span></div>
                                                </div>
                                                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <span style={{ color: 'var(--text-dim)' }}>Last Activity:</span> <span style={{ color: '#fff' }}>{u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleString() : 'Never'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {users.filter(u => (u.transcriptionCount || 0) > 0).length === 0 && (
                                        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-dim)', fontSize: '12px', fontStyle: 'italic' }}>
                                            No transcription data yet
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div class="card" style={{ gridColumn: '1 / -1' }}>
                            <div class="card-header">
                                <div>
                                    <h3 class="card-title">User Management (Telegram Pods)</h3>
                                    <div id="last-updated-info" style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>Polling active (5s)</div>
                                </div>
                                <button class="btn btn-sm" id="force-refresh-btn" style={{ width: 'auto', background: 'rgba(255,255,255,0.05)', fontSize: '10px', padding: '4px 8px' }}>Refresh Now</button>
                                <div id="total-users" style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{users.length} users</div>
                            </div>
                            <div class="user-table-container" style={{ overflowX: 'auto', marginTop: '10px' }}>
                                <table class="user-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-dim)' }}>
                                            <th style={{ padding: '10px 5px' }}>User</th>
                                            <th style={{ padding: '10px 5px' }}>UID</th>
                                            <th style={{ padding: '10px 5px' }}>Phone</th>
                                            <th style={{ padding: '10px 5px', textAlign: 'center' }}>Pod Status</th>
                                            <th style={{ padding: '10px 5px', textAlign: 'center' }}>Uptime</th>
                                            <th style={{ padding: '10px 5px', textAlign: 'center' }}>Voice Stats</th>
                                            <th style={{ padding: '10px 5px' }}>Last online</th>
                                            <th style={{ padding: '10px 5px', textAlign: 'right' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody id="user-table-body">
                                        {users.length > 0 ? (
                                            users.map(u => <UserRow key={u.userId} user={u} />)
                                        ) : (
                                            <tr>
                                                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>
                                                    No users registered yet. Visitors: /auth
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div class="card error-logs-card" style={{ gridColumn: '1 / -1' }}>
                            <div class="card-header">
                                <h3 class="card-title">System Error Logs</h3>
                            </div>
                            <div class="error-list">
                                {errors.length > 0 ? (
                                    errors.map((err, i) => <ErrorLogItem key={i} error={err} />)
                                ) : (
                                    <div class="no-errors">No recent errors detected.</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                <script src="/assets/js/admin.js"></script>
            </body>
        </html>
    );
};



