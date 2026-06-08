/** @jsxImportSource preact */
import type { PaneProps } from './Dashboard.types';

export function ProfilePane({ user }: PaneProps) {
    const hasPassword = !!user.passwordHash;

    return (
        <div class="tab-pane" id="pane-profile">
            <div class="grid profile-grid">
                {/* Account information details */}
                <div class="card profile-info-card">
                    <div class="card-header">
                        <h3 class="card-title">👤 Account Settings</h3>
                    </div>
                    <div class="card-content">
                        <div class="profile-details-list">
                            <div class="profile-detail-item">
                                <span class="detail-lbl">User identifier</span>
                                <span class="detail-val select-all">{user.userId}</span>
                            </div>
                            <div class="profile-detail-item">
                                <span class="detail-lbl">First Name</span>
                                <span class="detail-val">{user.firstName}</span>
                            </div>
                            <div class="profile-detail-item">
                                <span class="detail-lbl">Primary Email</span>
                                <span class="detail-val">{user.email || 'Google Account Linked'}</span>
                            </div>
                            <div class="profile-detail-item">
                                <span class="detail-lbl">Registered Date</span>
                                <span class="detail-val">{new Date(user.createdAt).toLocaleDateString()}</span>
                            </div>
                            <div class="profile-detail-item">
                                <span class="detail-lbl">OAuth Authentication</span>
                                <span class="detail-val text-success">{hasPassword ? 'Password Set' : 'Google OAuth'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Transcription Settings */}
                <div class="card" style={{ marginTop: '1.25rem' }}>
                    <div class="card-header">
                        <h3 class="card-title">📝 Transcription Settings</h3>
                    </div>
                    <div class="card-content">
                        <p class="card-description" style={{ marginBottom: '16px' }}>
                            By default, transcription always works for incoming voice and video messages. Configure your translation and language preferences here.
                        </p>
                        <div id="voice-settings-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div class="input-group">
                                <label class="input-label" style={{ display: 'block', marginBottom: '8px' }}>🗣️ Forced Transcription Language (ASR)</label>
                                <select id="asr-lang-select" class="input-field" style={{ maxWidth: '400px' }} data-user-id={user.userId}>
                                    <option value="auto">🤖 Auto-Detect (Default)</option>
                                    <option value="ru">🇷🇺 Русский (Russian)</option>
                                    <option value="en">🇬🇧 English</option>
                                    <option value="uk">🇺🇦 Ukrainian</option>
                                </select>
                            </div>

                            <div class="input-group">
                                <label class="input-label" style={{ display: 'block', marginBottom: '8px' }}>🌍 Preferred Translation Language</label>
                                <select id="translation-lang-select" class="input-field" style={{ maxWidth: '400px' }} data-user-id={user.userId}>
                                    <option value="translate_off">🚫 Disabled (default)</option>
                                    <option value="ru">Русский (Russian)</option>
                                    <option value="en">English</option>
                                    <option value="th">ไทย (Thai)</option>
                                    <option value="zh">简体中文 (Chinese Simplified)</option>
                                    <option value="zh-TW">繁體中文 (Chinese Traditional)</option>
                                    <option value="ar">العربية (Arabic)</option>
                                    <option value="he">עברית (Hebrew)</option>
                                    <option value="ja">日本語 (Japanese)</option>
                                    <option value="ko">한국어 (Korean)</option>
                                    <option value="hi">हिन्दी (Hindi)</option>
                                    <option value="de">Deutsch (German)</option>
                                    <option value="fr">Français (French)</option>
                                    <option value="es">Español (Spanish)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Voice Cloning Settings */}
                <div class="card" style={{ marginTop: '1.25rem' }}>
                    <div class="card-header">
                        <h3 class="card-title">🎙️ Voice Cloning Settings</h3>
                    </div>
                    <div class="card-content">
                        <p class="card-description" style={{ marginBottom: '16px' }}>
                            Voice cloning is triggered manually by replying to a voice message with the keyword <code>!SAMESAME!</code>.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div class="input-group">
                                <label class="input-label" style={{ display: 'block', marginBottom: '8px' }}>🤖 Voice Cloning Strategy</label>
                                <select id="clone-strategy-select" class="input-field" style={{ maxWidth: '400px' }} data-user-id={user.userId}>
                                    <option value="zero_shot">✨ Best Quality (Zero-Shot) - Recommended</option>
                                    <option value="cross_lingual">⚡ Fast Mode (Cross-Lingual)</option>
                                    <option value="off">🚫 Disable Voice Cloning (Text Only)</option>
                                </select>
                            </div>

                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '8px' }}>
                                <button id="voice-settings-save-btn" class="btn btn-primary">Save All Settings</button>
                                <span id="voice-settings-status-badge" class="status-tag inactive">NOT SAVED</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Change Password Form / Google Info */}
            <div class="grid profile-grid" style={{ marginTop: '1.25rem' }}>
                <div class="card password-change-card">
                    <div class="card-header">
                        <h3 class="card-title">🔑 Change Password</h3>
                    </div>
                    <div class="card-content">
                        {hasPassword ? (
                            <form id="change-pwd-form" class="form-container" onSubmit={(e) => e.preventDefault()}>
                                <div class="input-group">
                                    <label class="input-label">Old Password</label>
                                    <input type="password" id="profile-old-pwd" class="input-field" placeholder="••••••••" required />
                                </div>
                                <div class="input-group">
                                    <label class="input-label">New Password</label>
                                    <input type="password" id="profile-new-pwd" class="input-field" placeholder="Min 6 characters" required />
                                </div>
                                <div class="input-group">
                                    <label class="input-label">Confirm New Password</label>
                                    <input type="password" id="profile-confirm-pwd" class="input-field" placeholder="••••••••" required />
                                </div>
                                <button class="btn btn-primary" id="save-pwd-btn">Update Password</button>
                            </form>
                        ) : (
                            <div class="oauth-info-box">
                                <div class="oauth-icon">🛡️</div>
                                <h4>Google OAuth Login Active</h4>
                                <p class="card-description">
                                    Your account is linked and authenticated directly via Google. No database password is set or required.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div class="grid profile-delete-grid" style={{ marginTop: '1.5rem' }}>
                {/* Delete Account */}
                <div class="card delete-account-card">
                    <div class="card-header">
                        <h3 class="card-title text-danger">⚠️ Danger Zone</h3>
                    </div>
                    <div class="card-content">
                        <p class="card-description">
                            Deleting your account is permanent. It will instantly stop all transcription listeners, shut down your Telegram integration pods, wipe your active access tokens, and permanently delete your database user credentials.
                        </p>
                        <div class="delete-confirmation-wrap">
                            <label class="checkbox-container">
                                <input type="checkbox" id="profile-delete-agree" />
                                <span class="checkmark"></span>
                                <span class="checkbox-label">I explicitly consent to permanently and irreversibly delete my account and integrations.</span>
                            </label>
                            <button class="btn btn-danger btn-full" id="profile-delete-btn" disabled>
                                Delete My Entire Account
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
