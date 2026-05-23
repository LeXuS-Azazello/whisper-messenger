/** @jsxImportSource preact */
import type { UserSession } from '../../../types';

export function TelegramAppConnectionCard({ user, env }: { user: UserSession; env: any }) {
    const isTgConnected = !!user.session;

    return (
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
    );
}
