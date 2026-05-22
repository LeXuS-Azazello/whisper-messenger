/** @jsxImportSource preact */
import { render } from 'preact-render-to-string';
import type { HealthChecks, UserSession, Env } from '../../types';
import type { ErrorLog } from '../../logger';

import { formatUptime, UserRow, ErrorLogItem } from './Admin.utils';
import { AdminHeader } from './AdminHeader';
import { TelegramAdminCard } from './TelegramAdminCard';
import { PlatformConfigCard } from './PlatformConfigCard';
import { LineAdminCard } from './LineAdminCard';

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
                    <AdminHeader tgAuthenticated={tgAuthenticated} />

                    <div class="grid">
                        <TelegramAdminCard checks={checks} tgAuthenticated={tgAuthenticated} />

                        <PlatformConfigCard
                            title="Facebook Messenger"
                            iconColor="#0081FB"
                            icon="◉"
                            statusActive={!!checks.META_PAGE_TOKEN}
                            statusText={checks.META_PAGE_TOKEN ? 'CONNECTED' : 'NOT SETUP'}
                            items={[
                                { label: 'VERIFY_TOKEN', active: !!checks.VERIFY_TOKEN },
                                { label: 'PAGE_TOKEN', active: !!checks.META_PAGE_TOKEN },
                                { label: 'APP_SECRET', active: !!checks.META_APP_SECRET },
                            ]}
                        />

                        <PlatformConfigCard
                            title="Instagram"
                            iconColor="#FF0072"
                            icon="✦"
                            statusActive={!!checks.META_PAGE_TOKEN}
                            statusText={checks.META_PAGE_TOKEN ? 'CONNECTED' : 'NOT SETUP'}
                            items={[
                                { label: 'VERIFY_TOKEN', active: !!checks.VERIFY_TOKEN },
                                { label: 'PAGE_TOKEN', active: !!checks.META_PAGE_TOKEN },
                                { label: 'APP_SECRET', active: !!checks.META_APP_SECRET },
                            ]}
                        />

                        <PlatformConfigCard
                            title="WhatsApp"
                            iconColor="#25D366"
                            icon="◉"
                            statusActive={!!(checks.WHATSAPP_TOKEN && checks.WHATSAPP_PHONE_NUMBER_ID)}
                            statusText={(checks.WHATSAPP_TOKEN && checks.WHATSAPP_PHONE_NUMBER_ID) ? 'CONNECTED' : 'NOT SETUP'}
                            items={[
                                { label: 'PHONE_ID', active: !!checks.WHATSAPP_PHONE_NUMBER_ID },
                                { label: 'API_TOKEN', active: !!checks.WHATSAPP_TOKEN },
                            ]}
                        />

                        <LineAdminCard />

                        {/* AI Provider UI temporarily disabled (was duplicated and broken) */}

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
                                           .slice()
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
                            <div class="card-header" style={{ marginBottom: '20px' }}>
                                <div>
                                    <h3 class="card-title" style={{ color: '#fff', fontSize: '1.25rem', marginBottom: '4px' }}>User Management (Telegram Pods)</h3>
                                    <div id="last-updated-info" style={{ fontSize: '10px', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <div class="status-dot" style={{ width: '6px', height: '6px', animation: 'pulse 2s infinite' }}></div>
                                        Polling active (1m) • Last updated: {new Date().toLocaleTimeString()}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Total</div>
                                        <div style={{ fontSize: '18px', fontWeight: '800', color: '#fff' }}>{users.length}</div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Active</div>
                                        <div style={{ fontSize: '18px', fontWeight: '800', color: '#10B981' }}>{users.filter(u => u.isActive).length}</div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Need Auth</div>
                                        <div style={{ fontSize: '18px', fontWeight: '800', color: '#EF4444' }}>{users.filter(u => !u.tgAuthenticated).length}</div>
                                    </div>
                                    <button class="btn btn-sm" id="force-refresh-btn" style={{ width: 'auto', background: 'rgba(255,255,255,0.05)', fontSize: '11px', padding: '6px 12px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', margin: 0 }}>Refresh</button>
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
                                <h3 class="card-title">System Diagnostics & Connectivity Tests</h3>
                                <button class="btn btn-sm" id="run-diag-btn" style={{ width: 'auto', background: '#3B82F6', margin: 0 }}>Run All Tests</button>
                            </div>
                            <div class="diagnostic-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginTop: '10px' }}>
                                <div class="diag-item" data-service="redis">
                                    <div class="diag-label">Redis (KV Store)</div>
                                    <div class="diag-status"><span>—</span></div>
                                    <div class="diag-msg">Waiting for test...</div>
                                </div>
                                <div class="diag-item" data-service="mongodb">
                                    <div class="diag-label">MongoDB (Persistence)</div>
                                    <div class="diag-status"><span>—</span></div>
                                    <div class="diag-msg">Waiting for test...</div>
                                </div>
                                <div class="diag-item" data-service="manager">
                                    <div class="diag-label">Telegram Manager (Orchestrator)</div>
                                    <div class="diag-status"><span>—</span></div>
                                    <div class="diag-msg">Waiting for test...</div>
                                </div>
                                <div class="diag-item" data-service="k8s">
                                    <div class="diag-label">K8s API Permissions</div>
                                    <div class="diag-status"><span>—</span></div>
                                    <div class="diag-msg">Waiting for test...</div>
                                </div>
                                <div class="diag-item" data-service="asr">
                                    <div class="diag-label">Transcription (ASR)</div>
                                    <div class="diag-status"><span>—</span></div>
                                    <div class="diag-msg">Waiting for test...</div>
                                </div>
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



