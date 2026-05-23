/** @jsxImportSource preact */
export function FacebookConnectionCard() {
    return (
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
                    Connect your Facebook Messenger. AppState is strongly recommended.
                </p>

                {/* Method selectors - vanilla JS wiring in dashboard.js */}
                <div class="wa-methods-grid">
                    <div class="wa-method-card" id="fb-method-appstate" data-method="appstate">
                        <div class="wa-method-icon">🔑</div>
                        <div class="wa-method-content">
                            <div class="wa-method-title">AppState JSON <span class="badge recommended">Recommended</span></div>
                            <div class="wa-method-subtitle">Export from browser (most stable)</div>
                        </div>
                    </div>

                    <div class="wa-method-card" id="fb-method-creds" data-method="creds">
                        <div class="wa-method-icon">✉️</div>
                        <div class="wa-method-content">
                            <div class="wa-method-title">Email + Password</div>
                            <div class="wa-method-subtitle">Direct login (often blocked by Facebook)</div>
                        </div>
                    </div>
                </div>

                <div id="fb-appstate-area">
                    <div class="input-group">
                        <label class="input-label">AppState JSON</label>
                        <textarea id="fb-appstate" class="input-field" rows={4} placeholder='[{"key": "c_user", "value": "..."}]' style={{ fontFamily: 'monospace', fontSize: '12px' }} />
                    </div>
                </div>

                <form id="fb-creds-area" style={{ display: 'none' }} onSubmit={(e) => e.preventDefault()}>
                    <div class="input-group">
                        <label class="input-label">Email / Username</label>
                        <input type="text" id="fb-email" class="input-field" placeholder="email@example.com" autoComplete="username" />
                    </div>
                    <div class="input-group">
                        <label class="input-label">Password</label>
                        <input type="password" id="fb-password" class="input-field" placeholder="••••••••" autoComplete="current-password" />
                    </div>
                </form>

                <div class="button-group-2" style={{ marginTop: '12px' }}>
                    <button class="btn btn-primary" id="connect-fb-fca-btn">Connect Account</button>
                    <button class="btn btn-danger btn-xs" id="disconnect-fb-fca-btn" style={{ display: 'none' }}>Disconnect</button>
                </div>
            </div>
        </div>
    );
}
