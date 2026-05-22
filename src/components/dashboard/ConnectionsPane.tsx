/** @jsxImportSource preact */
import type { PaneProps } from './Dashboard.types';

export function ConnectionsPane({ user, env }: PaneProps) {
    const isTgConnected = !!user.session;

    return (
        <div class="tab-pane active" id="pane-connections">
            <div class="grid">
                {/* Telegram Control */}
                <div class="card tg-card">
                    <div class="card-header">
                        <h3 class="card-title">
                            <span class="icon-tg">📱</span> Telegram Account
                        </h3>
                        <span class={`status-tag ${isTgConnected ? 'active' : 'inactive'}`}>
                            {isTgConnected ? 'CONNECTED' : 'DISCONNECTED'}
                        </span>
                    </div>

                    <div id="tg-status-container" class="card-content" style={{ display: isTgConnected ? 'block' : 'none' }}>
                        <div class="status-box">
                            <div class="bridge-info">
                                <div class="avatar-icon tg-gradient">📱</div>
                                <div class="bridge-details">
                                    <div class="bridge-label">Active Bridge</div>
                                    <div class="bridge-name">{user.username ? `@${user.username}` : user.firstName}</div>
                                    <div class="bridge-status">
                                        Status: <span class={user.isActive ? 'text-success' : 'text-danger'}>
                                            {user.isActive ? 'ONLINE' : 'OFFLINE'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <p class="card-description">
                                Your Telegram account is currently linked. Any voice or video message you receive will be automatically transcribed.
                            </p>
                            <div class="button-group-2">
                                <button class="btn btn-secondary" id="test-tg-btn">Test</button>
                                <button class="btn btn-secondary" id="restart-tg-btn">Restart</button>
                                <button class="btn btn-danger btn-full" id="disconnect-tg-btn">Disconnect Account</button>
                            </div>
                        </div>
                    </div>

                    <div id="tg-connect-prompt" class="card-content" style={{ display: isTgConnected ? 'none' : 'block' }}>
                        <div class="prompt-box">
                            <div class="prompt-icon">🛰️</div>
                            <h4>No Account Linked</h4>
                            <p class="card-description">
                                Connect your personal Telegram account to start transcribing voice messages in real-time.
                            </p>
                            <div class="button-grid">
                                <button class="btn btn-primary btn-full" id="open-tg-modal-btn">Link Account</button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Meta Integration */}
                <div class="card meta-card">
                    <div class="card-header">
                        <h3 class="card-title">
                            <span class="icon-ms">◉</span> Messenger / Insta
                        </h3>
                        <span class={`status-tag ${user.metaToken ? 'active' : 'inactive'}`}>
                            {user.metaToken ? 'CONNECTED' : 'NOT SETUP'}
                        </span>
                    </div>
                    <div class="card-content">
                        <p class="card-description">
                            Connect your Facebook Page or Instagram Business account to transcribe incoming voice messages automatically.
                        </p>

                        <div class="button-group-2">
                            <a href="https://developers.facebook.com/apps/" target="_blank" class="btn btn-secondary btn-xs">📱 Developers</a>
                            <a href="https://business.facebook.com/" target="_blank" class="btn btn-secondary btn-xs">💼 Business</a>
                        </div>

                        <div class="guide-toggle" onClick={(e) => { e.currentTarget.nextElementSibling?.classList.toggle('active'); e.currentTarget.classList.toggle('active'); }}>
                            <span>⚙️ Setup Instructions</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </div>
                        <div class="setup-guide meta">
                            <h4 class="guide-title">⚙️ Required App Settings:</h4>
                            <div class="guide-content">
                                <div class="guide-item">
                                    <strong>App Domains:</strong>
                                    <div class="copy-box">
                                        <code onClick={() => navigator.clipboard.writeText(env.DOMAIN || '')}>{env.DOMAIN}</code>
                                        <button class="copy-btn" onClick={() => navigator.clipboard.writeText(env.DOMAIN || '')}>📋</button>
                                    </div>
                                </div>
                                <div class="guide-item">
                                    <strong>Privacy Policy URL:</strong>
                                    <div class="copy-box">
                                        <code onClick={() => navigator.clipboard.writeText(`https://${env.DOMAIN || ''}/privacy`)}>{env.DOMAIN}/privacy</code>
                                        <button class="copy-btn" onClick={() => navigator.clipboard.writeText(`https://${env.DOMAIN || ''}/privacy`)}>📋</button>
                                    </div>
                                </div>
                                <div class="guide-item">
                                    <strong>OAuth Redirect URI:</strong>
                                    <div class="copy-box">
                                        <code onClick={() => navigator.clipboard.writeText(`https://${env.DOMAIN || ''}/auth/meta/callback`)}>.../auth/meta/callback</code>
                                        <button class="copy-btn" onClick={() => navigator.clipboard.writeText(`https://${env.DOMAIN || ''}/auth/meta/callback`)}>📋</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button class="btn btn-primary" id="connect-meta-btn">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                            Connect with Facebook
                        </button>
                        {user.metaToken && (
                            <div class="status-verified">✓ Linked to active Page</div>
                        )}

                        {/* WhatsApp Web Integration */}
                        <div class="card wa-web-card">
                            <div class="card-header">
                                <h3 class="card-title">
                                    <span class="icon-wa-web">◉</span> WhatsApp Web
                                </h3>
                                <span id="wa-web-status" class="status-tag inactive">
                                    NOT CONNECTED
                                </span>
                            </div>
                            <div class="card-content">
                                <p class="card-description">
                                    Connect your personal WhatsApp account instantly using a QR code (recommended) or a Phone Pairing Code.
                                </p>

                                <div class="sub-tabs-container">
                                    <button class="sub-tab-btn active" id="wa-tab-qr" type="button">QR Code</button>
                                    <button class="sub-tab-btn" id="wa-tab-code" type="button">Phone Pairing Code</button>
                                </div>

                                {/* Tab 1: QR Code */}
                                <div id="wa-qr-container-tab" class="sub-tab-pane">
                                    <div id="wa-web-qr-container" style={{ display: 'none', textAlign: 'center', marginBottom: '1rem' }}>
                                        <div class="qr-wrapper" style={{ background: 'white', padding: '10px', display: 'inline-block', borderRadius: '8px' }}>
                                            <img id="wa-web-qr-img" src="" style={{ width: '200px', height: '200px' }} />
                                        </div>
                                        <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '8px' }}>Scan this QR code with WhatsApp</p>
                                    </div>
                                    <div class="button-group-2">
                                        <button class="btn btn-primary" id="connect-wa-web-btn">
                                            Generate QR Code
                                        </button>
                                        <button class="btn btn-danger btn-xs" id="disconnect-wa-web-btn" style={{ display: 'none' }}>
                                            Disconnect
                                        </button>
                                    </div>
                                </div>

                                {/* Tab 2: Phone Pairing Code */}
                                <div id="wa-code-container-tab" class="sub-tab-pane" style={{ display: 'none' }}>
                                    <div class="input-group">
                                        <label class="input-label">Phone Number (with country code, e.g. +79991234567)</label>
                                        <input type="text" id="wa-phone-number" class="input-field" placeholder="+7 (999) 123-45-67" />
                                    </div>

                                    <div id="wa-pairing-code-display" style={{ display: 'none', textAlign: 'center', margin: '1rem 0' }}>
                                        <span style={{ fontSize: '12px', color: 'var(--text-dim)', display: 'block', marginBottom: '8px' }}>Your Pairing Code:</span>
                                        <div class="pairing-code-box" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '1rem', borderRadius: '12px', display: 'inline-block', fontFamily: 'monospace', fontSize: '24px', fontWeight: 'bold', color: '#a78bfa', letterSpacing: '2px' }}>
                                            <span id="wa-pairing-code-text">-</span>
                                        </div>
                                        <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '8px' }}>Enter this code on your phone in WhatsApp Web - Link with Phone Number</p>
                                    </div>

                                    <div class="button-group-2" style={{ marginTop: '1rem' }}>
                                        <button class="btn btn-primary" id="wa-get-code-btn">
                                            Get Pairing Code
                                        </button>
                                        <button class="btn btn-danger btn-xs" id="disconnect-wa-web-code-btn" style={{ display: 'none' }}>
                                            Disconnect
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Facebook Messenger (FCA) Integration */}
                        <div class="card fb-fca-card">
                            <div class="card-header">
                                <h3 class="card-title">
                                    <span class="icon-fb-fca">◉</span> Facebook Messenger (FCA)
                                </h3>
                                <span id="fb-fca-status" class="status-tag inactive">
                                    NOT CONNECTED
                                </span>
                            </div>
                            <div class="card-content">
                                <p class="card-description">
                                    Connect your Facebook Messenger account using AppState JSON (recommended) or your login credentials.
                                </p>

                                <div class="sub-tabs-container">
                                    <button class="sub-tab-btn active" id="fb-tab-appstate" type="button">AppState JSON</button>
                                    <button class="sub-tab-btn" id="fb-tab-creds" type="button">Login Credentials</button>
                                </div>

                                <div id="fb-appstate-container" class="sub-tab-pane">
                                    <div class="input-group">
                                        <label class="input-label">AppState JSON (Recommended)</label>
                                        <textarea id="fb-appstate" class="input-field" rows={4} placeholder='[{"key": "c_user", "value": "..."}]' style={{ fontFamily: 'monospace', fontSize: '12px' }} />
                                    </div>
                                </div>

                                <div id="fb-creds-container" class="sub-tab-pane" style={{ display: 'none' }}>
                                    <div class="input-group">
                                        <label class="input-label">Email / Username</label>
                                        <input type="text" id="fb-email" class="input-field" placeholder="email@example.com" />
                                    </div>
                                    <div class="input-group">
                                        <label class="input-label">Password</label>
                                        <input type="password" id="fb-password" class="input-field" placeholder="••••••••" />
                                    </div>
                                </div>

                                <div class="button-group-2" style={{ marginTop: '1rem' }}>
                                    <button class="btn btn-primary" id="connect-fb-fca-btn">
                                        Connect Account
                                    </button>
                                    <button class="btn btn-danger btn-xs" id="disconnect-fb-fca-btn" style={{ display: 'none' }}>
                                        Disconnect
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Instagram FCA Integration */}
                        <div class="card insta-fca-card">
                            <div class="card-header">
                                <h3 class="card-title">
                                    <span class="icon-insta-fca">◉</span> Instagram Direct (FCA)
                                </h3>
                                <span id="insta-fca-status" class="status-tag inactive">
                                    NOT CONNECTED
                                </span>
                            </div>
                            <div class="card-content">
                                <p class="card-description">
                                    Connect your Instagram account to transcribe voice messages from Direct Messages automatically.
                                </p>

                                <div class="input-group">
                                    <label class="input-label">Instagram Username</label>
                                    <input type="text" id="insta-username" class="input-field" placeholder="username" />
                                </div>
                                <div class="input-group">
                                    <label class="input-label">Password</label>
                                    <input type="password" id="insta-password" class="input-field" placeholder="••••••••" />
                                </div>

                                <div class="button-group-2" style={{ marginTop: '1rem' }}>
                                    <button class="btn btn-primary" id="connect-insta-fca-btn">
                                        Connect Account
                                    </button>
                                    <button class="btn btn-danger btn-xs" id="disconnect-insta-fca-btn" style={{ display: 'none' }}>
                                        Disconnect
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* LINE Integration */}
                        <div class="card line-card">
                            <div class="card-header">
                                <h3 class="card-title">
                                    <span class="icon-line">◉</span> LINE
                                </h3>
                                <span class={`status-tag ${user.lineToken ? 'active' : 'inactive'}`}>
                                    {user.lineToken ? 'SETUP' : 'NOT SETUP'}
                                </span>
                            </div>
                            <div class="card-content">
                                <p class="card-description">
                                    Connect to LINE Developer Console to capture and transcribe user voice files in personal messages.
                                </p>
                                <div class="button-group">
                                    <a href="https://developers.line.biz/console/" target="_blank" class="btn btn-secondary btn-xs">📱 Developers Console</a>
                                </div>
                                <div class="guide-toggle" onClick={(e) => { e.currentTarget.nextElementSibling?.classList.toggle('active'); e.currentTarget.classList.toggle('active'); }}>
                                    <span>⚙️ Webhook Setup</span>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                </div>
                                <div class="setup-guide line">
                                    <h4 class="guide-title">⚙️ Webhook Setup:</h4>
                                    <div class="guide-content">
                                        <div class="guide-item">
                                            <strong>Webhook URL:</strong>
                                            <div class="copy-box">
                                                <code onClick={() => navigator.clipboard.writeText(`https://${env.DOMAIN}/webhooks/line/${user.userId}`)}>.../webhooks/line/{user.userId.substring(0, 8)}...</code>
                                                <button class="copy-btn" onClick={() => navigator.clipboard.writeText(`https://${env.DOMAIN}/webhooks/line/${user.userId}`)}>📋</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="input-group">
                                    <label class="input-label">Channel Access Token</label>
                                    <input type="password" id="line-token" class="input-field" value={user.lineToken || ''} placeholder="ey..." />
                                </div>
                                <button class="btn btn-primary" id="save-line-btn">Save Settings</button>
                            </div>
                        </div>

                        {/* Threads Integration DISABLED FOR NOW*/}
                        <div style={{ display: 'none' }} class="card threads-card">
                            <div class="card-header">
                                <h3 class="card-title">@ Threads</h3>
                                <span class={`status-tag ${user.threadsToken ? 'active' : 'inactive'}`}>
                                    {user.threadsToken ? 'CONNECTED' : 'NOT SETUP'}
                                </span>
                            </div>
                            <div class="card-content">
                                <p class="card-description">
                                    Transcribe voice messages and replies from your personal Threads account automatically.
                                </p>
                                <button class="btn btn-primary btn-threads" id="connect-threads-btn">
                                    Connect with Threads
                                </button>
                                {user.threadsToken && (
                                    <div class="verified-footer">User ID: {user.threadsUserId}</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
