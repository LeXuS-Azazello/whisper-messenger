/** @jsxImportSource preact */
import type { UserSession } from '../../../types';
export function LineConnectionCard({ user,  env }: { user: UserSession; env: any }) {
    return (
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
                <button type="button" class="guide-toggle"
                    {...{ onclick: "this.classList.toggle('active'); this.nextElementSibling?.classList.toggle('active')" } as any}>
                    <span>⚙️ Webhook Setup</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
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
    );
}
