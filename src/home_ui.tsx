/** @jsxImportSource preact */
import { render } from 'preact-render-to-string';

const adminCss = `:root {
    --primary: #8B5CF6;
    --primary-glow: rgba(139, 92, 246, 0.4);
    --bg-dark: #0F172A;
    --card-bg: rgba(30, 41, 59, 0.7);
    --text-main: #F1F5F9;
    --text-dim: #94A3B8;
    --success: #10B981;
    --danger: #EF4444;
    --warning: #F59E0B;
}

/* Progress Bar */
#progress-bar {
    position: fixed;
    top: 0;
    left: 0;
    height: 3px;
    background: var(--primary);
    box-shadow: 0 0 10px var(--primary-glow);
    z-index: 9999;
    width: 0;
    transition: width 0.3s ease;
    display: none;
}


* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Outfit', sans-serif;
    background-color: var(--bg-dark);
    background-image: 
        radial-gradient(at 0% 0%, rgba(139, 92, 246, 0.15) 0px, transparent 50%),
        radial-gradient(at 100% 100%, rgba(59, 130, 246, 0.1) 0px, transparent 50%);
    color: var(--text-main);
    min-height: 100vh;
    overflow-x: hidden;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
}

.card {
    background: var(--card-bg);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 24px;
    padding: 1.5rem;
    transition: all 0.3s ease;
}

.btn {
    background: var(--primary);
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    width: 100%;
    margin-top: 1rem;
}

.btn:hover {
    background: #7C3AED;
    transform: scale(1.02);
    box-shadow: 0 0 20px var(--primary-glow);
}

.btn-xs {
    padding: 0.25rem 0.5rem;
    font-size: 10px;
    border-radius: 6px;
    width: auto;
    margin: 0;
    transform: none;
}

.btn-xs:hover {
    transform: none;
}

header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 3rem;
    animation: fadeInDown 0.8s ease-out;
}

.logo {
    font-size: 1.5rem;
    font-weight: 800;
    background: linear-gradient(135deg, #fff 0%, var(--primary) 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.logo-icon {
    width: 32px;
    height: 32px;
    background: var(--primary);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 20px var(--primary-glow);
}

.status-badge {
    background: rgba(16, 185, 129, 0.1);
    color: var(--success);
    padding: 0.5rem 1rem;
    border-radius: 99px;
    font-size: 0.875rem;
    font-weight: 600;
    border: 1px solid rgba(16, 185, 129, 0.2);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    transition: transform 0.2s;
}

.status-badge:hover {
    transform: scale(1.05);
}

.status-dot {
    width: 8px;
    height: 8px;
    background: var(--success);
    border-radius: 50%;
    box-shadow: 0 0 10px var(--success);
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.4); opacity: 0.6; }
    100% { transform: scale(1); opacity: 1; }
}

.grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
    animation: fadeInUp 0.8s ease-out;
}

.card:hover {
    transform: translateY(-5px);
    border-color: rgba(139, 92, 246, 0.3);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
}

.card-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-dim);
}

.config-list { list-style: none; }
.config-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.config-item:last-child { border-bottom: none; }

.config-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    color: var(--text-dim);
}

.config-value { font-weight: 600; font-size: 0.875rem; }
.configured { color: var(--success); }
.missing { color: var(--danger); }

.status-tag {
    font-size: 10px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
.status-tag.active {
    background: rgba(16, 185, 129, 0.15);
    color: var(--success);
    border: 1px solid rgba(16, 185, 129, 0.3);
}
.status-tag.inactive {
    background: rgba(239, 68, 68, 0.1);
    color: var(--danger);
    border: 1px solid rgba(239, 68, 68, 0.2);
}

@keyframes fadeInUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
}

@keyframes fadeInDown {
    from { opacity: 0; transform: translateY(-20px); }
    to { opacity: 1; transform: translateY(0); }
}

h2 { margin-bottom: 1rem; }

.login-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
}

.login-card {
    width: 100%;
    max-width: 400px;
    text-align: center;
}

.input-group {
    text-align: left;
    margin-bottom: 1rem;
}

.input-label {
    display: block;
    margin-bottom: 0.5rem;
    color: var(--text-dim);
}

.input-field {
    width: 100%;
    padding: 0.75rem;
    border-radius: 12px;
    background: rgba(15, 23, 42, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: white;
    font-family: inherit;
    outline: none;
    transition: border 0.3s;
}

.input-field:focus {
    border-color: var(--primary);
}

.error-msg {
    color: var(--danger);
    margin-bottom: 1rem;
    font-size: 0.875rem;
}

h1 {
    margin-bottom: 2rem;
}

/* Error Logs Styles */
.error-logs-card {
    background: rgba(15, 23, 42, 0.4) !important;
    border-color: rgba(239, 68, 68, 0.1) !important;
}

.error-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.error-log-item {
    background: rgba(255, 255, 255, 0.03);
    border-radius: 12px;
    padding: 12px 16px;
    border: 1px solid rgba(255, 255, 255, 0.05);
}

.error-log-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
}

.platform-tag {
    font-size: 10px;
    font-weight: 800;
    padding: 2px 8px;
    border-radius: 4px;
}

.platform-tag.telegram { background: rgba(36, 161, 222, 0.2); color: #24A1DE; }
.platform-tag.whatsapp { background: rgba(37, 211, 102, 0.2); color: #25D366; }
.platform-tag.messenger { background: rgba(0, 178, 255, 0.2); color: #00B2FF; }
.platform-tag.instagram { background: rgba(255, 0, 114, 0.2); color: #FF0072; }

.error-log-time {
    font-size: 11px;
    color: var(--text-dim);
    font-family: 'JetBrains Mono', monospace;
}

.error-log-message {
    font-size: 13px;
    color: #f87171;
    line-height: 1.5;
    word-break: break-all;
}

.no-errors {
    text-align: center;
    padding: 30px;
    color: var(--text-dim);
    font-size: 14px;
    font-style: italic;
}

/* Responsive table */
@media (max-width: 768px) {
    .user-table th, .user-table td {
        padding: 5px;
        font-size: 12px;
    }
    .user-table th:nth-child(2), .user-table td:nth-child(2),
    .user-table th:nth-child(3), .user-table td:nth-child(3),
    .user-table th:nth-child(6), .user-table td:nth-child(6) {
        display: none;
    }
    .user-table th:nth-child(7), .user-table td:nth-child(7) {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 80px;
    }
    .user-table-container {
        overflow-x: auto;
    }
}

/* User Stats in Transcription Card */
.user-stats-list {
    max-height: 250px;
    overflow-y: auto;
    padding-right: 5px;
}

.user-stats-list::-webkit-scrollbar {
    width: 4px;
}

.user-stats-list::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 10px;
}

.user-stat-item {
    padding: 8px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.02);
    transition: all 0.2s;
}

.user-stat-item:hover {
    background: rgba(255, 255, 255, 0.05);
}

.user-info-detail {
    border-left: 2px solid var(--primary);
    animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
    from { opacity: 0; transform: translateY(-5px); }
    to { opacity: 1; transform: translateY(0); }
}`;

const SparklesIcon = ({ size = 24, color = "currentColor", strokeWidth = 2 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} stroke-width={strokeWidth} stroke-linecap="round" stroke-linejoin="round">
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
        <path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>
    </svg>
);

const MailIcon = ({ size = 24, color = "currentColor" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
);

const CheckCircleIcon = ({ size = 24, color = "currentColor" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
);

const ArrowLeftIcon = ({ size = 24, color = "currentColor" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>
    </svg>
);

export const renderHome = (googleClientId: string, origin: string) => {
    return "<!DOCTYPE html>" + render(
        <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>Echo Messenger - Multi-Platform Voice Transcripts</title>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Inter:wght@400;600&display=swap" rel="stylesheet" />
                <script src="https://accounts.google.com/gsi/client" async defer></script>
                <style dangerouslySetInnerHTML={{ __html: adminCss }} />
                <style>{`
                    body { font-family: 'Outfit', sans-serif; background: #0a0a0c; color: white; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; overflow-x: hidden; }
                    .bg-glow { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: -1; background: radial-gradient(circle at 20% 30%, rgba(139, 92, 246, 0.15) 0%, transparent 40%), radial-gradient(circle at 80% 70%, rgba(59, 130, 246, 0.15) 0%, transparent 40%); }
                    .landing-card { background: rgba(23, 23, 26, 0.7); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 24px; padding: 40px; width: 100%; max-width: 440px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); position: relative; overflow: hidden; }
                    .landing-card::before { content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 2px; background: linear-gradient(90deg, transparent, #8B5CF6, #3B82F6, transparent); opacity: 0.5; }
                    .logo-section { display: flex; flex-direction: column; align-items: center; margin-bottom: 30px; text-align: center; }
                    .logo-icon { width: 56px; height: 56px; background: linear-gradient(135deg, #8B5CF6, #3B82F6); border-radius: 16px; display: flex; align-items: center; justify-content: center; margin-bottom: 16px; box-shadow: 0 8px 16px rgba(139, 92, 246, 0.3); }
                    .title { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; margin: 0; background: linear-gradient(to right, #fff, #a1a1aa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
                    .subtitle { color: #8e8e93; font-size: 15px; margin-top: 8px; font-weight: 400; line-height: 1.6; }
                    .auth-section { margin-top: 32px; }
                    .email-input-wrapper { position: relative; margin-bottom: 12px; }
                    .email-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: rgba(255, 255, 255, 0.4); }
                    .styled-input { width: 100%; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 12px 12px 12px 42px; color: white; font-family: 'Inter', sans-serif; font-size: 14px; transition: all 0.2s; box-sizing: border-box; }
                    .styled-input:focus { outline: none; border-color: #8B5CF6; background: rgba(255, 255, 255, 0.08); box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.1); }
                    .btn-primary { width: 100%; background: #fff; color: #000; border: none; border-radius: 12px; padding: 12px; font-weight: 600; font-size: 14px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px; }
                    .btn-primary:hover { transform: translateY(-1px); background: #f4f4f5; box-shadow: 0 5px 15px rgba(255, 255, 255, 0.1); }
                    .btn-primary:active { transform: translateY(0); }
                    .divider { display: flex; align-items: center; margin: 24px 0; color: rgba(255, 255, 255, 0.2); font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
                    .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: rgba(255, 255, 255, 0.08); }
                    .divider span { padding: 0 12px; }
                    .google-btn-wrapper { display: flex; justify-content: center; }
                    .footer-links { margin-top: 32px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: 24px; }
                    .link { color: rgba(255, 255, 255, 0.4); text-decoration: none; font-size: 13px; transition: color 0.2s; }
                    .link:hover { color: #8B5CF6; }
                    .status-msg { margin-top: 12px; font-size: 12px; text-align: center; font-family: 'Inter', sans-serif; }
                    .check-icon { display: none; margin-bottom: 20px; color: #22c55e; width: 48px; height: 48px; }
                `}</style>
            </head>
            <body>
                <div class="bg-glow"></div>
                <div class="landing-card" id="main-card">
                    <div id="auth-view">
                        <div class="logo-section">
                            <div class="logo-icon">
                                <SparklesIcon size={32} color="white" strokeWidth={2.5} />
                            </div>
                            <h1 class="title">Echo Messenger</h1>
                            <p class="subtitle">Personalized voice message transcription for Telegram, WhatsApp & Meta.</p>
                        </div>

                        <div class="auth-section">
                            <div class="email-input-wrapper" style={{ display: 'none' }}>
                                <MailIcon size={18} color="rgba(255,255,255,0.4)" />
                                <input type="email" id="email-input" class="styled-input" placeholder="name@company.com" />
                            </div>
                            <button class="btn-primary" id="send-link-btn" style={{ display: 'none' }}>
                                Send Magic Link
                            </button>
                            <div id="status-msg" class="status-msg"></div>

                            <div class="divider" style={{ display: 'none' }}>
                                <span>OR CONTINUE WITH</span>
                            </div>

                            <div class="google-btn-wrapper" style={{ flexDirection: 'column', gap: '15px' }}>
                                <div id="g_id_onload"
                                    data-client_id={googleClientId}
                                    data-context="signin"
                                    data-ux_mode="redirect"
                                    data-login_uri={`${origin}/auth/google/callback`}
                                    data-auto_prompt="false">
                                </div>
                                <div class="g_id_signin" data-type="standard" data-shape="pill" data-theme="filled_black" data-size="large"></div>
                                {/* Using MTProto flow instead of Bot Widget */}
                            </div>
                        </div>

                        <div class="footer-links">
                            <a href="#" class="link" id="forgot-pass-btn">Forgot password / Help?</a>
                        </div>
                    </div>

                    <div id="success-view" style="display:none; text-align:center; padding: 20px 0;">
                        <CheckCircleIcon size={56} color="#22c55e" />
                        <h2 class="title">Check your inbox</h2>
                        <p class="subtitle" style="margin-top:16px;">We've sent a secure login link to your email address. It expires in 15 minutes.</p>
                        <button class="btn-primary" style="margin-top:32px; background: rgba(255,255,255,0.05); color: white; border: 1px solid rgba(255,255,255,0.1);" onClick={"location.reload()" as any}>
                            <ArrowLeftIcon size={16} /> Back to Login
                        </button>
                    </div>
                </div>

                <script dangerouslySetInnerHTML={{
                    __html: `
                    var sendBtn = document.getElementById('send-link-btn');
                    var emailInput = document.getElementById('email-input');
                    var statusMsg = document.getElementById('status-msg');
                    var authView = document.getElementById('auth-view');
                    var successView = document.getElementById('success-view');

                    // Check for existing session
                    var sessionMatch = document.cookie.match(/session=([^;]+)/);
                    if (sessionMatch) {
                        window.location.href = '/dashboard';
                        throw new Error('Redirecting to dashboard');
                    }

                    document.getElementById('forgot-pass-btn').onclick = (e) => {
                        e.preventDefault();
                        emailInput.focus();
                        statusMsg.innerText = "Enter your email to receive a recovery link.";
                        statusMsg.style.color = "#8B5CF6";
                    };

                    sendBtn.onclick = () => {
                        var email = emailInput.value.trim();
                        if (!email || !email.includes('@')) return alert('Please enter a valid email address');
                        
                        sendBtn.disabled = true;
                        sendBtn.innerText = 'Sending...';
                        
                        fetch('/auth/email/send', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email: email })
                        })
                        .then(r => r.json())
                        .then(data => {
                            if (data.success) {
                                authView.style.display = 'none';
                                successView.style.display = 'block';
                            } else {
                                sendBtn.disabled = false;
                                sendBtn.innerText = 'Send Magic Link';
                                statusMsg.innerText = 'Error: ' + data.error;
                                statusMsg.style.color = '#ef4444';
                            }
                        });
                    };
                    `
                }} />
            </body>
        </html>
    );
};
