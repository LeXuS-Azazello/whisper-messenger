/** @jsxImportSource preact */
import type { UserSession } from '../../../types';

export function FacebookConnectionCard({ user, env }: { user: UserSession; env: any }) {
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
                    Подключите Facebook Messenger для автоматической транскрипции голосовых сообщений.
                </p>

                {/* Security warning */}
                <div style={{
                    background: '#fff3cd',
                    border: '1px solid #ffc107',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    marginBottom: '12px',
                    fontSize: '12px',
                    color: '#664d03'
                }}>
                    ⚠️ <strong>Внимание:</strong> AppState даёт боту полный доступ к вашему Messenger.
                    Никому не передавайте этот JSON. После подключения вы можете в любой момент отключить аккаунт.
                </div>

                <div style={{ marginBottom: '10px', fontSize: '13px', lineHeight: '1.4' }}>
                    <strong>Как получить AppState (единственный рабочий способ):</strong>
                    <ol style={{ margin: '6px 0 0 18px', padding: 0 }}>
                        <li>
                            Установите расширение <strong>C3C UFC Utility</strong>:<br />
                            <a href="https://github.com/c3cbot/c3c-ufc-utility" target="_blank" style={{ color: '#0d6efd' }}>C3C UFC Utility (GitHub)</a> — там ссылки на Chrome Web Store и Firefox Add-ons
                        </li>
                        <li>Зайдите на <a href="https://www.facebook.com" target="_blank">facebook.com</a> или <a href="https://www.messenger.com" target="_blank">messenger.com</a> и войдите в аккаунт в <strong>том же браузере</strong>.</li>
                        <li>Нажмите на иконку расширения → <strong>Export</strong> → скопируйте JSON (это массив cookies).</li>
                        <li>Вставьте скопированный текст в поле ниже и нажмите «Подключить».</li>
                    </ol>
                    <div style={{ marginTop: '6px', fontSize: '11px', color: '#555' }}>
                        <strong>Админам:</strong> если нужно массово подключать аккаунты — используйте локальный скрипт{' '}
                        <code>scripts/generate-facebook-appstate.js</code> (запускайте на своём компьютере с хорошим IP).
                        Он делает ровно то, что рекомендуют в документации fca-unofficial: логинится по кредам один раз и сохраняет AppState.
                    </div>
                </div>

                <div id="fb-appstate-area">
                    <div class="input-group">
                        <label class="input-label">AppState JSON (массив cookies)</label>
                        <textarea
                            id="fb-appstate"
                            class="input-field"
                            rows={5}
                            placeholder='[{"key":"c_user","value":"123456789","domain":"facebook.com","path":"/"},{"key":"xs","value":"...","domain":"facebook.com","path":"/"}, ...]'
                            style={{ fontFamily: 'monospace', fontSize: '11px', lineHeight: '1.3' }}
                        />
                    </div>
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '-4px', marginBottom: '8px' }}>
                        Должен начинаться с <code>[{`{`}"key": "c_user"...</code> — это формат, который понимает библиотека fca-unofficial.
                    </div>
                </div>

                <div class="button-group-2" style={{ marginTop: '8px' }}>
                    <button class="btn btn-primary" id="connect-fb-fca-btn">Подключить аккаунт</button>
                    <button class="btn btn-danger btn-xs" id="disconnect-fb-fca-btn" style={{ display: 'none' }}>Отключить</button>
                </div>

                <div style={{ fontSize: '11px', color: '#888', marginTop: '8px' }}>
                    Email + Password больше не поддерживается — Facebook блокирует такие логины. Только AppState.
                </div>
            </div>
        </div>
    );
}
