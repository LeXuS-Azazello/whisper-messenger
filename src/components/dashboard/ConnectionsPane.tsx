/** @jsxImportSource preact */
import type { PaneProps } from './Dashboard.types';
import { WhatsAppConnectionCard, FacebookConnectionCard, InstagramConnectionCard, TelegramAppConnectionCard } from './connections';
import { LineConnectionCard } from './connections/LineConnectionCard';

export function ConnectionsPane({ user, env }: PaneProps) {
    return (
        <div class="tab-pane active" id="pane-connections">
            <div class="grid">
                {/* Telegram Account */}
                <TelegramAppConnectionCard user={user} env={env} />

                {/* WhatsApp (Baileys) */}
                <WhatsAppConnectionCard user={user} env={env} />

                {/* Facebook Messenger (FCA) */}
                <FacebookConnectionCard user={user} env={env} />

                {/* Instagram (FCA) */}
                <InstagramConnectionCard user={user} env={env} />

                    {/* LINE Integration */}
                <LineConnectionCard user={user} env={env} />

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

            {/* Telegram Connection Modal — now lives inside Connections like WA/FB/IG cards */}
            <div class="modal-overlay" id="tg-modal-overlay">
                <div class="modal-content">
                    <button class="modal-close" id="tg-modal-close">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                    <div class="modal-title">Connect Telegram</div>

                    <div class="auth-step active" id="tg-step-1">
                        <p class="modal-description">Choose your preferred method to link your account</p>
                        <div class="auth-choice">
                            <div class="choice-card" id="choose-qr-btn">
                                <div class="choice-icon">📱</div>
                                <div class="choice-text">
                                    <h4>QR Code</h4>
                                    <p>Fastest way using Telegram App</p>
                                </div>
                            </div>
                            <div class="choice-card" id="choose-phone-btn">
                                <div class="choice-icon">📞</div>
                                <div class="choice-text">
                                    <h4>Phone Number</h4>
                                    <p>Receive a code on your device</p>
                                </div>
                            </div>
                            <div class="choice-card" id="choose-email-btn">
                                <div class="choice-icon">📧</div>
                                <div class="choice-text">
                                    <h4>Email Login</h4>
                                    <p>Use email for authentication</p>
                                </div>
                            </div>
                            <div class="choice-card" id="choose-restore-btn">
                                <div class="choice-icon">🔄</div>
                                <div class="choice-text">
                                    <h4>Restore Session</h4>
                                    <p>Resume existing session</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="auth-step" id="tg-step-qr">
                        <div class="modal-body-center">
                            <div class="qr-frame">
                                <div id="modal-qr-container"></div>
                                <div class="qr-scan-line"></div>
                            </div>
                            <p class="qr-instruction">Scan with Telegram</p>
                            <p class="qr-sub-instruction">Settings → Devices → Link Desktop Device</p>
                            <button class="btn btn-secondary btn-auto" id="back-to-choice-1">Back</button>
                        </div>
                    </div>

                    <div class="auth-step" id="tg-step-phone">
                        <div class="input-group">
                            <label class="input-label">Phone Number</label>
                            <input type="tel" id="modal-tg-phone" class="input-field" placeholder="+1234567890" />
                        </div>
                        <button class="btn btn-primary" id="modal-send-code-btn">Send Verification Code</button>
                        <button class="btn btn-secondary" id="back-to-choice-2">Back</button>
                    </div>

                    <div class="auth-step" id="tg-step-email">
                        <div class="input-group">
                            <label class="input-label">Email Address</label>
                            <input type="email" id="modal-tg-email" class="input-field" placeholder="your@email.com" />
                        </div>
                        <button class="btn btn-primary" id="modal-send-email-btn">Continue</button>
                        <button class="btn btn-secondary" id="back-to-choice-3">Back</button>
                    </div>

                    <div class="auth-step" id="tg-step-code">
                        <p class="modal-description">Enter the 5-digit code sent to your Telegram app</p>
                        <div class="code-input-wrap">
                            <input type="text" id="modal-tg-code" class="input-field code-field" placeholder="00000" maxLength={6} />
                        </div>
                        <button class="btn btn-primary" id="modal-verify-code-btn">Verify & Link</button>
                    </div>

                    <div class="auth-step" id="tg-step-password">
                        <p class="modal-description">Two-Step Verification enabled. Enter your cloud password.</p>
                        <div class="input-group">
                            <input type="password" id="modal-tg-password" class="input-field" placeholder="Your Password" />
                        </div>
                        <button class="btn btn-primary" id="modal-verify-password-btn">Submit Password</button>
                    </div>

                    <div class="auth-step" id="tg-step-success">
                        <div class="modal-body-center">
                            <div class="success-icon">✓</div>
                            <h3 class="success-title">Connected!</h3>
                            <p class="modal-description">Your account has been successfully linked.</p>
                            <button class="btn btn-primary" onClick={() => location.reload()}>Great!</button>
                        </div>
                    </div>

                    <div class="auth-step" id="tg-step-loading">
                        <div class="modal-body-center loading-pad">
                            <div class="shimmer-loader"></div>
                            <p id="loading-text">Connecting to Telegram...</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
