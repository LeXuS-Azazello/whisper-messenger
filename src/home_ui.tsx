/** @jsxImportSource preact */
import { render } from 'preact-render-to-string';
import adminCss from './admin.css';

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

export const renderHome = (googleClientId: string) => {
    return "<!DOCTYPE html>" + render(
        <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>Whisper Messenger - Multi-Platform Voice Transcripts</title>
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
                            <h1 class="title">Whisper Messenger</h1>
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

                            <div class="google-btn-wrapper">
                                <div id="g_id_onload"
                                    data-client_id={googleClientId}
                                    data-context="signin"
                                    data-ux_mode="popup"
                                    data-login_uri="/auth/google/callback"
                                    data-auto_prompt="false">
                                </div>
                                <div class="g_id_signin" data-type="standard" data-shape="pill" data-theme="filled_black" data-size="large"></div>
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
