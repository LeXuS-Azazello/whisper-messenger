/** @jsxImportSource preact */
import { render } from 'preact-render-to-string';
import { Env } from './types';

import adminCss from './admin.css';

type HealthChecks = {
    VERIFY_TOKEN: boolean;
    META_PAGE_TOKEN: boolean;
    META_APP_SECRET: boolean;
    WHATSAPP_TOKEN: boolean;
    META_API_VERSION: boolean;
    WHATSAPP_PHONE_NUMBER_ID: boolean;
    TELEGRAM_BOT_TOKEN: boolean;
    TELEGRAM_CHAT_ID: boolean;
    AUDIO_QUEUE: boolean;
    AI: boolean;
};

const ConfigItem = ({ label, active }: { label: string; active: boolean }) => (
    <div class="config-item">
        <span class="config-label">{label}</span>
        <span class={`config-value ${active ? 'configured' : 'missing'}`}>
            {active ? 'ACTIVE' : 'MISSING'}
        </span>
    </div>
);

export const renderAdminDashboard = (checks: HealthChecks, env: Env, origin: string, stats: any) => {
    return "<!DOCTYPE html>" + render(
        <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>Whisper Messenger Admin</title>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />
                <style dangerouslySetInnerHTML={{ __html: adminCss }} />
            </head>
            <body>
                <div class="container">
                    <header>
                        <div class="logo">
                            <div class="logo-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                                </svg>
                            </div>
                            WHISPER ADMIN
                        </div>
                        <div class="status-badge" title="Click to logout" dangerouslySetInnerHTML={{ __html: `<div class="status-dot"></div>SYSTEM ONLINE (LOGOUT)` }} />
                    </header>

                    <div class="grid">
                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">Meta Configuration</h3>
                            </div>
                            <div class="config-list">
                                <ConfigItem label="VERIFY_TOKEN" active={checks.VERIFY_TOKEN} />
                                <ConfigItem label="PAGE_TOKEN" active={checks.META_PAGE_TOKEN} />
                                <ConfigItem label="APP_SECRET" active={checks.META_APP_SECRET} />
                                <ConfigItem label="API_VER" active={checks.META_API_VERSION} />
                            </div>
                        </div>

                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">Platform Status</h3>
                            </div>
                            <div class="config-list">
                                <ConfigItem label="MESSENGER" active={checks.META_PAGE_TOKEN} />
                                <ConfigItem label="INSTAGRAM" active={checks.META_PAGE_TOKEN} />
                                <ConfigItem label="WHATSAPP" active={checks.WHATSAPP_TOKEN && checks.WHATSAPP_PHONE_NUMBER_ID} />
                                <ConfigItem label="TELEGRAM" active={checks.TELEGRAM_BOT_TOKEN} />
                            </div>
                        </div>

                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">System Runtime</h3>
                            </div>
                            <div class="config-list">
                                <ConfigItem label="AI_MODEL" active={checks.AI} />
                                <ConfigItem label="QUEUE" active={checks.AUDIO_QUEUE} />
                            </div>
                            <button class="btn" id="refresh-btn">Refresh Stats</button>
                        </div>

                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">Transcription Stats</h3>
                                <div style={{ fontSize: '12px', background: 'var(--primary)', padding: '2px 8px', borderRadius: '4px' }}>
                                    Total: {Object.values(stats).reduce((a: any, b: any) => a + b, 0)}
                                </div>
                            </div>
                            <div class="stats-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div class="stat-box" style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '12px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '4px' }}>MESSENGER</div>
                                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#00B2FF' }}>{stats.messenger}</div>
                                </div>
                                <div class="stat-box" style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '12px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '4px' }}>INSTAGRAM</div>
                                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#FF0072' }}>{stats.instagram}</div>
                                </div>
                                <div class="stat-box" style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '12px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '4px' }}>WHATSAPP</div>
                                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#25D366' }}>{stats.whatsapp}</div>
                                </div>
                                <div class="stat-box" style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '12px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '4px' }}>TELEGRAM</div>
                                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#24A1DE' }}>{stats.telegram}</div>
                                </div>
                            </div>
                        </div>

                        <div class="card" style={{ gridColumn: '1 / -1' }}>
                            <div class="card-header">
                                <h3 class="card-title">Easy Setup Guide</h3>
                            </div>
                            <div class="config-list">
                                <p style={{ fontSize: '14px', marginBottom: '10px' }}>
                                    <strong>Webhook Callback URL:</strong> <br/><code style={{ userSelect: 'all', background: '#222', padding: '4px 8px', borderRadius: '4px', display: 'inline-block', marginTop: '4px' }}>{origin}</code>
                                </p>
                                <p style={{ fontSize: '14px', marginBottom: '10px' }}>
                                    <strong>Verify Token (VERIFY_TOKEN):</strong> <br/><code style={{ userSelect: 'all', background: '#222', padding: '4px 8px', borderRadius: '4px', display: 'inline-block', marginTop: '4px' }}>{env.VERIFY_TOKEN || 'Not Configured'}</code>
                                </p>
                                <p style={{ fontSize: '14px', marginBottom: '20px' }}>
                                    <strong>App Secret (META_APP_SECRET):</strong> <br/><code style={{ userSelect: 'all', background: '#222', padding: '4px 8px', borderRadius: '4px', display: 'inline-block', marginTop: '4px' }}>{env.META_APP_SECRET || 'Not Configured'}</code>
                                </p>
                                
                                <h4 style={{ marginTop: '10px', marginBottom: '8px' }}>1. Telegram Setup</h4>
                                <div style={{ fontSize: '14px', marginBottom: '10px', lineHeight: '1.5', background: 'rgba(15, 23, 42, 0.5)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                                    <strong>Get Keys:</strong> Open Telegram, search for <code>@BotFather</code>. Send <code>/newbot</code>, follow the steps, and copy the generated HTTP API token into the <code>TELEGRAM_BOT_TOKEN</code> secret.
                                </div>
                                {checks.TELEGRAM_BOT_TOKEN ? (
                                    <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                                        <button class="btn" id="setup-telegram-btn" style={{ margin: 0, width: 'auto' }}>Set Webhook</button>
                                        <input type="text" id="test-telegram-id" class="input-field" placeholder="Chat ID" value={env.TELEGRAM_CHAT_ID || ''} style={{ width: '150px', padding: '0.6rem', margin: 0, borderRadius: '8px' }} />
                                        <button class="btn" id="test-telegram-btn" style={{ margin: 0, width: 'auto', background: '#3B82F6' }}>Test Msg</button>
                                    </div>
                                ) : (
                                    <p style={{ fontSize: '14px', color: '#888', marginBottom: '20px' }}>Provide TELEGRAM_BOT_TOKEN in secrets to setup.</p>
                                )}

                                <h4 style={{ marginBottom: '8px' }}>2. Instagram & Messenger Setup</h4>
                                <div style={{ fontSize: '14px', marginBottom: '10px', lineHeight: '1.5', background: 'rgba(15, 23, 42, 0.5)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                                    <div style={{ marginBottom: '8px' }}><strong>Get Keys:</strong></div>
                                    <ul style={{ margin: '0 0 10px 0', paddingLeft: '20px' }}>
                                        <li>Go to Meta App Dashboard &gt; Add Messenger and/or Instagram product.</li>
                                        <li>Generate a Page Access Token and save it as <code>META_PAGE_TOKEN</code> secret.</li>
                                        <li>Get your App Secret from App Settings &gt; Basic and save as <code>META_APP_SECRET</code>.</li>
                                        <li>Set a custom verify token string in <code>VERIFY_TOKEN</code>.</li>
                                    </ul>
                                    <strong>Webhook Setup:</strong> Configure Webhook in Meta App using the Callback URL and Verify Token (above). Subscribe to "messages" and "messaging_postbacks". Then click below to link your page.
                                </div>
                                {checks.META_PAGE_TOKEN ? (
                                    <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                                        <button class="btn" id="setup-meta-btn" style={{ margin: 0, width: 'auto' }}>Subscribe Page</button>
                                        <input type="text" id="test-meta-id" class="input-field" placeholder="PSID/IGSID" style={{ width: '150px', padding: '0.6rem', margin: 0, borderRadius: '8px' }} />
                                        <button class="btn" id="test-meta-btn" style={{ margin: 0, width: 'auto', background: '#3B82F6' }}>Test Msg</button>
                                    </div>
                                ) : (
                                    <p style={{ fontSize: '14px', color: '#888', marginBottom: '20px' }}>Provide META_PAGE_TOKEN in secrets to subscribe.</p>
                                )}

                                <h4 style={{ marginBottom: '8px' }}>3. WhatsApp Setup</h4>
                                <div style={{ fontSize: '14px', marginBottom: '10px', lineHeight: '1.5', background: 'rgba(15, 23, 42, 0.5)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                                    <div style={{ marginBottom: '8px' }}><strong>Get Keys:</strong></div>
                                    <ul style={{ margin: '0 0 10px 0', paddingLeft: '20px' }}>
                                        <li>In Meta App Dashboard, add WhatsApp product &gt; API Setup.</li>
                                        <li>Copy the Phone Number ID into <code>WHATSAPP_PHONE_NUMBER_ID</code>.</li>
                                        <li>Create a System User in Meta Business Settings, assign your app and WhatsApp assets, and generate a permanent token for <code>WHATSAPP_TOKEN</code>.</li>
                                    </ul>
                                    <strong>Webhook Setup:</strong> Navigate to WhatsApp &gt; Configuration. Edit the Webhook and paste the Callback URL and Verify Token. Manage webhook fields and subscribe to "messages".
                                </div>
                                {checks.WHATSAPP_TOKEN && checks.WHATSAPP_PHONE_NUMBER_ID ? (
                                    <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                                        <input type="text" id="test-whatsapp-id" class="input-field" placeholder="Phone Number (e.g. 15551234567)" style={{ width: '250px', padding: '0.6rem', margin: 0, borderRadius: '8px' }} />
                                        <button class="btn" id="test-whatsapp-btn" style={{ margin: 0, width: 'auto', background: '#3B82F6' }}>Test Msg</button>
                                    </div>
                                ) : (
                                    <p style={{ fontSize: '14px', color: '#888', marginBottom: '20px' }}>Provide WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID in secrets to test.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                <script dangerouslySetInnerHTML={{
                    __html: `
                    document.querySelector('.status-badge').addEventListener('click', function() {
                        fetch('/admin/logout', { method: 'POST' }).then(function() { location.reload(); });
                    });
                    document.getElementById('refresh-btn').addEventListener('click', function() {
                        location.reload();
                    });
                    var tgBtn = document.getElementById('setup-telegram-btn');
                    if (tgBtn) {
                        tgBtn.addEventListener('click', function() {
                            tgBtn.innerText = 'Setting...';
                            fetch('/admin/setup-telegram', { method: 'POST' })
                                .then(function(res) { return res.json(); })
                                .then(function(data) { 
                                    alert('Telegram Webhook: ' + (data.ok ? 'Success' : 'Failed - ' + data.description)); 
                                    tgBtn.innerText = 'Setup Telegram Webhook'; 
                                })
                                .catch(function(err) { 
                                    alert('Error: ' + err); 
                                    tgBtn.innerText = 'Set Telegram Webhook Automatically'; 
                                });
                        });
                    }
                    var metaBtn = document.getElementById('setup-meta-btn');
                    if (metaBtn) {
                        metaBtn.addEventListener('click', function() {
                            metaBtn.innerText = 'Subscribing...';
                            fetch('/admin/setup-meta', { method: 'POST' })
                                .then(function(res) { return res.json(); })
                                .then(function(data) { 
                                    alert('Meta Subscribed: ' + (data.success ? 'Success' : JSON.stringify(data))); 
                                    metaBtn.innerText = 'Subscribe Page to App (Meta API)'; 
                                })
                                .catch(function(err) { 
                                    alert('Error: ' + err); 
                                    metaBtn.innerText = 'Subscribe Page'; 
                                });
                        });
                    }
                    function createTestHandler(btnId, inputId, endpoint) {
                        var btn = document.getElementById(btnId);
                        if (btn) {
                            btn.addEventListener('click', function() {
                                var id = document.getElementById(inputId).value;
                                if (!id) return alert('Please enter an ID first.');
                                btn.innerText = 'Sending...';
                                fetch(endpoint, { 
                                    method: 'POST', 
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ recipientId: id })
                                })
                                .then(function(res) { return res.json(); })
                                .then(function(data) {
                                    alert('Status: ' + (data.success ? 'Success' : 'Error: ' + JSON.stringify(data)));
                                    btn.innerText = 'Test Msg';
                                })
                                .catch(function(err) {
                                    alert('Error: ' + err);
                                    btn.innerText = 'Test Msg';
                                });
                            });
                        }
                    }
                    createTestHandler('test-telegram-btn', 'test-telegram-id', '/admin/test-telegram');
                    createTestHandler('test-meta-btn', 'test-meta-id', '/admin/test-meta');
                    createTestHandler('test-whatsapp-btn', 'test-whatsapp-id', '/admin/test-whatsapp');
                    `
                }} />
            </body>
        </html>
    );
};

export const renderAdminLogin = (error?: string) => {
    return "<!DOCTYPE html>" + render(
        <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>Admin Login</title>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />
                <style dangerouslySetInnerHTML={{ __html: adminCss }} />
            </head>
            <body>
                <div class="login-container">
                    <div class="card login-card">
                        <h1>Whisper Admin</h1>
                        {error && <div class="error-msg">{error}</div>}
                        <form method="POST" action="/admin/login">
                            <div class="input-group">
                                <label class="input-label" for="password">Admin Password</label>
                                <input class="input-field" type="password" id="password" name="password" required autoFocus />
                            </div>
                            <button type="submit" class="btn">Login</button>
                        </form>
                    </div>
                </div>
            </body>
        </html>
    );
};
