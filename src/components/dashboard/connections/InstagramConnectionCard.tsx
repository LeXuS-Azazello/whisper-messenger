/** @jsxImportSource preact */
import type { UserSession } from '../../../types';
export function InstagramConnectionCard({ user, env }: { user: UserSession; env: any }) {
    return (
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

                <div id="insta-creds-area">
                    <div class="input-group">
                        <label class="input-label">Instagram Username</label>
                        <input type="text" id="insta-username" class="input-field" placeholder="username" />
                    </div>
                    <div class="input-group">
                        <label class="input-label">Password</label>
                        <input type="password" id="insta-password" class="input-field" placeholder="••••••••" />
                    </div>
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
    );
}
