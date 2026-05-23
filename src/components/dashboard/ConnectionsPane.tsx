/** @jsxImportSource preact */
import type { PaneProps } from './Dashboard.types';
import { WhatsAppConnectionCard, FacebookConnectionCard, InstagramConnectionCard } from './connections';

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


                

                {/* WhatsApp (Baileys) */}
                <WhatsAppConnectionCard />

                {/* Facebook Messenger (FCA) */}
                <FacebookConnectionCard />

                {/* Instagram (FCA) */}
                <InstagramConnectionCard />

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
    );
}
