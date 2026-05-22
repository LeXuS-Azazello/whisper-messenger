/** @jsxImportSource preact */
import { render } from 'preact-render-to-string';
import type { HealthChecks, UserSession, Env } from '../../types';
import type { ErrorLog } from '../../logger';

import { UserRow, ErrorLogItem } from './Admin.utils';
import { AdminHeader } from './AdminHeader';
import { TelegramAdminCard } from './TelegramAdminCard';
import { PlatformConfigCard } from './PlatformConfigCard';
import { LineAdminCard } from './LineAdminCard';
import { TranscriptionStatsCard } from './TranscriptionStatsCard';
import { UserManagementCard } from './UserManagementCard';

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

                        <TranscriptionStatsCard stats={stats} users={users} />

                        <UserManagementCard users={users} />

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



