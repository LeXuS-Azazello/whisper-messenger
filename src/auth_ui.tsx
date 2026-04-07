/** @jsxImportSource preact */
import { render } from 'preact-render-to-string';
import adminCss from './admin.css';

export const renderAuthPage = (error?: string) => {
    return "<!DOCTYPE html>" + render(
        <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>Connect Telegram - Whisper Messenger</title>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet" />
                <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
                <style dangerouslySetInnerHTML={{ __html: adminCss }} />
            </head>
            <body class="auth-page">
                <div class="login-container">
                    <div class="card login-card" style={{ maxWidth: '450px' }}>
                        <div class="logo" style={{ justifyContent: 'center', marginBottom: '20px' }}>
                            <div class="logo-icon">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                                </svg>
                            </div>
                            WHISPER
                        </div>
                        
                        <h2 style={{ textAlign: 'center', marginBottom: '10px' }}>Connect Your account</h2>
                        <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '14px', marginBottom: '30px' }}>
                            Transcribe voice messages automatically in your personal Telegram chats.
                        </p>

                        {error && <div class="error-msg" style={{ marginBottom: '20px' }}>{error}</div>}

                        <div id="auth-flow">
                            <div id="phone-section">
                                <div class="input-group">
                                    <label class="input-label">Phone Number</label>
                                    <input type="tel" id="tg-phone-input" class="input-field" placeholder="+66 85 093 2800" />
                                </div>
                                <button class="btn" id="tg-send-code-btn" style={{ background: '#8B5CF6' }}>Send Verification Code</button>
                            </div>

                            <div id="code-section" style={{ display: 'none', marginTop: '20px' }}>
                                <div class="input-group">
                                    <label class="input-label">Verification Code</label>
                                    <input type="text" id="tg-code-input" class="input-field" placeholder="12345" />
                                </div>
                                <button class="btn" id="tg-verify-btn" style={{ background: '#22c55e' }}>Confirm & Connect</button>
                                <p style={{ fontSize: '12px', marginTop: '10px', color: 'var(--text-dim)', textAlign: 'center' }}>
                                    Check your Telegram app for the code.
                                </p>
                            </div>

                            <div style={{ margin: '30px 0', display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                                <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>OR</span>
                                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                            </div>

                            <button class="btn" id="tg-show-qr-btn" style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}>
                                Login with QR Code
                            </button>

                            <div id="qr-section" style={{ display: 'none', marginTop: '25px', textAlign: 'center' }}>
                                <div id="qr-code-container" style={{ background: 'white', padding: '15px', borderRadius: '12px', display: 'inline-block', marginBottom: '15px' }}></div>
                                <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '5px' }}>Open Telegram &gt; Settings &gt; Devices &gt; Scan QR</p>
                                <p id="qr-status" style={{ fontSize: '14px', color: '#8B5CF6', fontWeight: '600' }}>Waiting for scan...</p>
                            </div>
                        </div>

                        <div id="success-message" style={{ display: 'none', textAlign: 'center', padding: '20px 0' }}>
                            <div style={{ width: '60px', height: '60px', background: '#22c55e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                            </div>
                            <h3>Successfully Connected!</h3>
                            <p style={{ color: 'var(--text-dim)', marginTop: '10px' }}>Ваш аккаунт подключен. Теперь бот будет автоматически расшифровывать голосовые сообщения.</p>
                        </div>
                    </div>
                </div>

                <script dangerouslySetInnerHTML={{
                    __html: `
                    var tgPhoneInput = document.getElementById('tg-phone-input');
                    var tgCodeInput = document.getElementById('tg-code-input');
                    var tgSendCodeBtn = document.getElementById('tg-send-code-btn');
                    var tgVerifyBtn = document.getElementById('tg-verify-btn');
                    var phoneSection = document.getElementById('phone-section');
                    var codeSection = document.getElementById('code-section');
                    var qrSection = document.getElementById('qr-section');
                    var tgShowQrBtn = document.getElementById('tg-show-qr-btn');
                    var authFlow = document.getElementById('auth-flow');
                    var successMessage = document.getElementById('success-message');
                    var qrCodeContainer = document.getElementById('qr-code-container');
                    var qrStatus = document.getElementById('qr-status');
                    var currentPhone = '';
                    var qrPollInterval = null;

                    tgSendCodeBtn.addEventListener('click', function() {
                        var phone = tgPhoneInput.value.trim();
                        if (!phone) return alert('Enter phone number');
                        tgSendCodeBtn.innerText = 'Sending...';
                        fetch('/auth/send-code', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ phone: phone })
                        })
                        .then(r => r.json())
                        .then(data => {
                            if (data.success) {
                                currentPhone = phone;
                                phoneSection.style.display = 'none';
                                codeSection.style.display = 'block';
                            } else {
                                alert('Error: ' + data.error);
                                tgSendCodeBtn.innerText = 'Send Verification Code';
                            }
                        })
                        .catch(err => alert('Network error'));
                    });

                    tgVerifyBtn.addEventListener('click', function() {
                        var code = tgCodeInput.value.trim();
                        if (!code) return alert('Enter code');
                        tgVerifyBtn.innerText = 'Verifying...';
                        fetch('/auth/verify-code', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ phone: currentPhone, code: code })
                        })
                        .then(r => r.json())
                        .then(data => {
                            if (data.success) {
                                authFlow.style.display = 'none';
                                successMessage.style.display = 'block';
                                setTimeout(() => window.location.href = '/dashboard', 1500);
                            } else {
                                alert('Invalid code: ' + (data.error || 'Check the logs'));
                                tgVerifyBtn.innerText = 'Confirm & Connect';
                            }
                        })
                        .catch(err => alert('Network error'));
                    });

                    tgShowQrBtn.addEventListener('click', function() {
                        qrSection.style.display = 'block';
                        tgShowQrBtn.style.display = 'none';
                        fetch('/auth/qr-start', { method: 'POST' })
                            .then(r => r.json())
                            .then(data => {
                                if (data.token) {
                                    qrCodeContainer.innerHTML = '';
                                    new QRCode(qrCodeContainer, {
                                        text: data.qrUrl,
                                        width: 220,
                                        height: 220,
                                        colorDark : "#000000",
                                        colorLight : "#ffffff",
                                        correctLevel : QRCode.CorrectLevel.H
                                    });

                                    qrPollInterval = setInterval(() => {
                                        fetch('/auth/qr-check?token=' + data.token)
                                            .then(r => r.json())
                                            .then(status => {
                                                if (status.done) {
                                                    clearInterval(qrPollInterval);
                                                    authFlow.style.display = 'none';
                                                    successMessage.style.display = 'block';
                                                    setTimeout(() => window.location.href = '/dashboard', 1500);
                                                }
                                            })
                                            .catch(() => {});
                                    }, 2500);
                                } else {
                                    alert('Failed to get QR token');
                                }
                            })
                            .catch(err => alert('Bridge connection error'));
                    });
                    `
                }} />
            </body>
        </html>
    );
};
