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
                    Подключите Instagram Direct для транскрипции голосовых в ЛС.
                </p>

                <div style={{
                    background: '#fff3cd',
                    border: '1px solid #ffc107',
                    borderRadius: '6px',
                    padding: '6px 8px',
                    marginBottom: '10px',
                    fontSize: '11px',
                    color: '#664d03'
                }}>
                    AppState (cookies) — самый стабильный способ. Username/password часто требует 2FA/капчу.
                </div>

                <div id="insta-appstate-area">
                    <div class="input-group">
                        <label class="input-label">AppState JSON (cookies) — рекомендуется</label>
                        <textarea
                            id="insta-appstate"
                            class="input-field"
                            rows={4}
                            placeholder='[{"key":"sessionid","value":"...","domain":"instagram.com"}, ...]'
                            style={{ fontFamily: 'monospace', fontSize: '11px' }}
                        />
                    </div>
                </div>

                <details style={{ marginTop: '8px', fontSize: '12px' }}>
                    <summary style={{ cursor: 'pointer', color: '#0d6efd' }}>Или используйте логин/пароль (менее надёжно)</summary>
                    <div id="insta-creds-area" style={{ marginTop: '6px' }}>
                        <div class="input-group">
                            <label class="input-label">Instagram Username</label>
                            <input type="text" id="insta-username" class="input-field" placeholder="username" />
                        </div>
                        <div class="input-group">
                            <label class="input-label">Password</label>
                            <input type="password" id="insta-password" class="input-field" placeholder="••••••••" />
                        </div>
                    </div>
                </details>

                <div class="button-group-2" style={{ marginTop: '10px' }}>
                    <button class="btn btn-primary" id="connect-insta-fca-btn">Подключить</button>
                    <button class="btn btn-danger btn-xs" id="disconnect-insta-fca-btn" style={{ display: 'none' }}>Отключить</button>
                </div>

                <div style={{ fontSize: '10px', color: '#888', marginTop: '6px' }}>
                    Для AppState: экспорт cookies через EditThisCookie / C3C UFC / браузер.<br />
                    <strong>Админам:</strong> используйте <code>scripts/generate-instagram-appstate.js</code> — он делает credential login один раз на вашем компьютере и выдаёт готовый JSON для дашборда.
                </div>
            </div>
        </div>
    );
}
