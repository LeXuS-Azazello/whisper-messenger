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

                {/* Preferred Translation Language */}
                <div class="card" style={{ marginTop: '1.25rem' }}>
                    <div class="card-header">
                        <h3 class="card-title">🌍 Preferred Translation Language</h3>
                    </div>
                    <div class="card-content">
                        <p class="card-description" style={{ marginBottom: '12px' }}>
                            Choose the language your voice messages will be translated to. This setting applies to all your connected messengers.
                        </p>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <select id="preferred-translation-lang" class="input-field" style={{ maxWidth: '320px' }} data-user-id={user.userId}>
                                <option value="">Follow Telegram language</option>
                                <option value="rus_Cyrl">Русский (Russian)</option>
                                <option value="eng_Latn">English</option>
                                <option value="tha_Thai">ไทย (Thai)</option>
                                <option value="zho_Hans">简体中文 (Chinese Simplified)</option>
                                <option value="zho_Hant">繁體中文 (Chinese Traditional)</option>
                                <option value="arb_Arab">العربية (Arabic)</option>
                                <option value="heb_Hebr">עברית (Hebrew)</option>
                                <option value="jpn_Jpan">日本語 (Japanese)</option>
                                <option value="kor_Hang">한국어 (Korean)</option>
                                <option value="hin_Deva">हिन्दी (Hindi)</option>
                                <option value="ben_Beng">বাংলা (Bengali)</option>
                                <option value="tam_Taml">தமிழ் (Tamil)</option>
                                <option value="vie_Latn">Tiếng Việt (Vietnamese)</option>
                                <option value="deu_Latn">Deutsch (German)</option>
                                <option value="fra_Latn">Français (French)</option>
                                <option value="spa_Latn">Español (Spanish)</option>
                            </select>
                            <button id="save-lang-btn" class="btn btn-primary">Save</button>
                        </div>
                        <p id="lang-save-status" style={{ fontSize: '12px', marginTop: '8px', color: '#64748b' }}></p>
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
                            <div id="change-pwd-form" class="form-container">
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
                            </div>
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
