/** @jsxImportSource preact */
import { render } from 'preact-render-to-string';
import adminCss from './admin.css';

export const renderHomePage = (googleClientId: string) => {
    return "<!DOCTYPE html>" + render(
        <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>Whisper Messenger - Voice to Text via Personal Bot</title>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet" />
                <script src="https://accounts.google.com/gsi/client" async defer></script>
                <style dangerouslySetInnerHTML={{ __html: `
                    ${adminCss}
                    body {
                        background: radial-gradient(circle at top left, #1e1b4b, #020617);
                        height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin: 0;
                        overflow: hidden;
                    }
                    .hero-section {
                        text-align: center;
                        animation: fadeInUp 1s ease-out;
                    }
                    @keyframes fadeInUp {
                        from { opacity: 0; transform: translateY(20px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    .glow-text {
                        background: linear-gradient(to right, #8b5cf6, #d946ef);
                        -webkit-background-clip: text;
                        -webkit-text-fill-color: transparent;
                        font-weight: 800;
                        font-size: 64px;
                        margin-bottom: 20px;
                        letter-spacing: -2px;
                    }
                    .sub-text {
                        color: var(--text-dim);
                        font-size: 20px;
                        max-width: 600px;
                        margin: 0 auto 40px;
                        line-height: 1.6;
                    }
                    .glass-login {
                        background: rgba(255, 255, 255, 0.03);
                        backdrop-filter: blur(20px);
                        border: 1px solid rgba(255, 255, 255, 0.05);
                        padding: 40px;
                        border-radius: 32px;
                        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                        width: 100%;
                        max-width: 400px;
                    }
                    .google-btn-container {
                        display: flex;
                        justify-content: center;
                        margin-top: 20px;
                    }
                    .float-icon {
                        animation: float 6s infinite ease-in-out;
                        margin-bottom: 30px;
                    }
                    @keyframes float {
                        0%, 100% { transform: translateY(0); }
                        50% { transform: translateY(-20px); }
                    }
                ` }} />
            </head>
            <body>
                <div class="hero-section">
                    <div class="float-icon">
                        <div style={{ width: '100px', height: '100px', background: 'linear-gradient(135deg, #8B5CF6, #D946EF)', borderRadius: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', boxShadow: '0 0 40px rgba(139, 92, 246, 0.4)' }}>
                             <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                            </svg>
                        </div>
                    </div>
                    
                    <h1 class="glow-text">Whisper Messenger</h1>
                    <p class="sub-text">Transform your voice messages into text across Telegram, WhatsApp, and Instagram with your personal AI bridge.</p>
                    
                    <div class="glass-login" style={{ margin: '0 auto' }}>
                        <h3 style={{ marginBottom: '10px' }}>Get Started</h3>
                        <p style={{ fontSize: '14px', color: 'var(--text-dim)', marginBottom: '30px' }}>Sign in to access your personal dashboard</p>
                        
                        <div class="google-btn-container">
                            <div id="g_id_onload"
                                data-client_id={googleClientId}
                                data-context="signin"
                                data-ux_mode="popup"
                                data-login_uri="/auth/google/callback"
                                data-auto_prompt="false">
                            </div>

                            <div class="g_id_signin"
                                data-type="standard"
                                data-shape="pill"
                                data-theme="filled_black"
                                data-text="signin_with"
                                data-size="large"
                                data-logo_alignment="left">
                            </div>
                        </div>

                        <div style={{ marginTop: '30px', fontSize: '12px', color: 'var(--text-dim)' }}>
                            By signing in, you agree to our Terms and Privacy Policy.
                        </div>
                    </div>
                </div>

                <script dangerouslySetInnerHTML={{
                    __html: `
                    // Listener for Google Auth (handled by data-login_uri mostly, but we can add more logic here)
                    `
                }} />
            </body>
        </html>
    );
};
