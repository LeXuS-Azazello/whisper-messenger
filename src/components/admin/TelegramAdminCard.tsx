/** @jsxImportSource preact */
import type { HealthChecks } from '../../types';
import { ConfigItem } from './Admin.utils';

interface TelegramAdminCardProps {
    checks: HealthChecks;
    tgAuthenticated: boolean;
}

export function TelegramAdminCard({ checks, tgAuthenticated }: TelegramAdminCardProps) {
    return (
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
    );
}
