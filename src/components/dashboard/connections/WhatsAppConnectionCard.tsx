/** @jsxImportSource preact */
import type { UserSession } from '../../../types';
export function WhatsAppConnectionCard({ user, env }: { user: UserSession; env: any }) {
    return (
        <div class="card wa-web-card">
            <div class="card-header">
                <h3 class="card-title">
                    <span class="icon-wa-web">◉</span> WhatsApp
                </h3>
                <span id="wa-web-status" class="status-tag inactive">
                    NOT CONNECTED
                </span>
            </div>
            <div class="card-content">
                <p class="card-description">
                    Connect your personal WhatsApp account. Choose the method that suits you best.
                </p>

                {/* Method selectors — now real <button> for semantics + keyboard + beauty */}
                <div class="wa-methods-grid">
                    <button type="button" class="wa-method-card" data-method="qr" id="wa-method-qr"
                        {...{ onclick: "window.setWaMethod && window.setWaMethod('qr')" } as any}>
                        <div class="wa-method-icon">📱</div>
                        <div class="wa-method-content">
                            <div class="wa-method-title">
                                QR Code <span class="badge recommended">Recommended</span>
                            </div>
                            <div class="wa-method-subtitle">Scan with phone camera — fastest for new connections</div>
                        </div>
                    </button>

                    <button type="button" class="wa-method-card" data-method="phone" id="wa-method-phone"
                        {...{ onclick: "window.setWaMethod && window.setWaMethod('phone')" } as any}>
                        <div class="wa-method-icon">📞</div>
                        <div class="wa-method-content">
                            <div class="wa-method-title">Phone Pairing Code</div>
                            <div class="wa-method-subtitle">Link as additional device using your phone number</div>
                        </div>
                    </button>

                </div>

                {/* Panels - always in DOM, visibility toggled by dashboard.js */}
                <div class="wa-panel" id="wa-qr-panel" style={{ display: 'none' }}>
                    <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                        <button class="btn btn-primary" id="connect-wa-web-btn">Generate QR Code</button>
                    </div>

                    <div id="wa-web-qr-container" style={{ textAlign: 'center', display: 'none' }}>
                        <div class="qr-wrapper" style={{ background: 'white', padding: '14px', display: 'inline-block', borderRadius: '14px', boxShadow: '0 6px 20px rgba(0,0,0,0.12)' }}>
                            <img id="wa-web-qr-img" src="" style={{ width: '240px', height: '240px', borderRadius: '8px' }} />
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginTop: '12px' }}>
                            Open WhatsApp → <strong>Linked Devices</strong> → <strong>Link a Device</strong>
                        </p>
                    </div>

                    <div id="wa-web-info-box" style={{ margin: '16px 0', padding: '14px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '10px', fontSize: '13.5px', color: '#b45309', display: 'none' }}>
                        <strong>Important:</strong> <span id="wa-web-info-text"></span>
                    </div>

                    <div style={{ textAlign: 'center' }}>
                        <button class="btn btn-danger" id="disconnect-wa-web-btn" style={{ display: 'none' }}>Disconnect WhatsApp</button>
                    </div>
                </div>

                <div class="wa-panel" id="wa-phone-panel" style={{ display: 'none' }}>
                    <div class="input-group">
                        <label class="input-label">Phone Number (with country code, e.g. +79991234567)</label>
                        <input type="text" id="wa-phone-number" class="input-field" placeholder="+7 999 123-45-67" />
                    </div>

                    <div id="wa-pairing-code-display" style={{ textAlign: 'center', margin: '16px 0', display: 'none' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '8px' }}>Your Pairing Code</div>
                        <div class="pairing-code-box" style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '4px', color: '#a78bfa', background: 'rgba(167, 139, 250, 0.08)', padding: '14px 28px', borderRadius: '12px', display: 'inline-block', border: '1px solid rgba(167, 139, 250, 0.2)' }}>
                            <span id="wa-pairing-code-text">— — — — —</span>
                        </div>
                        <p style={{ fontSize: '12.5px', color: 'var(--text-dim)', marginTop: '10px' }}>
                            Enter this code in WhatsApp → Linked Devices → "Link with phone number"
                        </p>
                    </div>

                    <div style={{ textAlign: 'center' }}>
                        <button class="btn btn-primary" id="wa-get-code-btn">Get Pairing Code</button>
                        <button class="btn btn-danger" id="disconnect-wa-web-code-btn" style={{ marginLeft: '8px', display: 'none' }}>Disconnect</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
