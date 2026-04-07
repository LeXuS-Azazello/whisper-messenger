document.addEventListener('DOMContentLoaded', function() {
    var tgPhoneInput = document.getElementById('tg-phone-input');
    var tgCodeInput = document.getElementById('tg-code-input');
    var tgSendCodeBtn = document.getElementById('tg-send-code-btn');
    var tgVerifyBtn = document.getElementById('tg-verify-btn');
    var tgCodeSection = document.getElementById('tg-code-section');
    var tgQrSection = document.getElementById('tg-qr-section');
    var tgShowQrBtn = document.getElementById('tg-show-qr-btn');
    var tgAuthMessage = document.getElementById('tg-auth-message');
    var tgAuthForm = document.getElementById('tg-auth-form');
    var tgAuthStatusContainer = document.getElementById('tg-auth-status-container');
    var tgAuthDetails = document.getElementById('tg-auth-details');
    var qrCodeContainer = document.getElementById('qr-code-container');
    var qrStatus = document.getElementById('qr-status');
    var progressBar = document.getElementById('progress-bar');
    var currentPhone = '';
    var qrPollInterval = null;

    // --- Loading UI ---
    function setLoading(isLoading) {
        if (!progressBar) return;
        if (isLoading) {
            progressBar.style.display = 'block';
            progressBar.style.width = '30%';
            setTimeout(() => { if (progressBar.style.width === '30%') progressBar.style.width = '70%'; }, 200);
        } else {
            progressBar.style.width = '100%';
            setTimeout(() => {
                progressBar.style.display = 'none';
                progressBar.style.width = '0';
            }, 300);
        }
    }

    // --- Original Fetch Wrapper with Loading ---
    const originalFetch = window.fetch;
    window.fetch = function() {
        setLoading(true);
        return originalFetch.apply(this, arguments).finally(() => setLoading(false));
    };

    function checkTgStatus() {
        fetch('/admin/tg-status').then(r => r.json()).then(data => {
            if (data.authenticated) {
                tgAuthForm.style.display = 'none';
                tgAuthStatusContainer.style.display = 'block';
                tgAuthDetails.innerText = 'Connected as User ID: ' + data.userId;
            } else {
                tgAuthForm.style.display = 'block';
                tgAuthStatusContainer.style.display = 'none';
            }
        });
    }
    checkTgStatus();

    function showTgStatus(msg, isError) {
        tgAuthMessage.innerText = msg;
        tgAuthMessage.style.color = isError ? '#ef4444' : '#22c55e';
    }

    if (tgSendCodeBtn) {
        tgSendCodeBtn.addEventListener('click', function() {
            var phone = tgPhoneInput.value.trim();
            if (!phone) return alert('Enter phone');
            tgSendCodeBtn.innerText = 'Sending...';
            fetch('/admin/tg-send-code', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phoneNumber: phone })
            })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    currentPhone = phone;
                    tgCodeSection.style.display = 'block';
                    showTgStatus('Code sent to Telegram', false);
                } else { alert('Error: ' + data.error); }
                tgSendCodeBtn.innerText = 'Send Code';
            });
        });
    }

    if (tgVerifyBtn) {
        tgVerifyBtn.addEventListener('click', function() {
            var code = tgCodeInput.value.trim();
            if (!code) return alert('Enter code');
            tgVerifyBtn.innerText = 'Verifying...';
            fetch('/admin/tg-verify-code', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phoneNumber: currentPhone, code: code })
            })
            .then(r => r.json())
            .then(data => {
                if (data.success) { checkTgStatus(); location.reload(); }
                else { alert('Error: ' + data.error); }
                tgVerifyBtn.innerText = 'Verify';
            });
        });
    }

    if (tgShowQrBtn) {
        tgShowQrBtn.addEventListener('click', function() {
            tgQrSection.style.display = 'block';
            tgShowQrBtn.style.display = 'none';
            fetch('/admin/tg-qr-login', { method: 'POST' })
            .then(r => r.json())
            .then(data => {
                if (data.token) {
                    qrCodeContainer.innerHTML = '';
                    new QRCode(qrCodeContainer, { text: data.qrUrl, width: 180, height: 180 });
                    qrStatus.innerText = 'Scan now...';
                    qrPollInterval = setInterval(() => {
                        fetch('/admin/tg-qr-check?token=' + data.token)
                        .then(r => r.json())
                        .then(status => {
                            if (status.authenticated) { clearInterval(qrPollInterval); checkTgStatus(); location.reload(); }
                        });
                    }, 2500);
                }
            });
        });
    }

    const logoutBtn = document.getElementById('tg-logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            if(!confirm('Disconnect Telegram?')) return;
            fetch('/admin/tg-logout', { method: 'POST' }).then(() => { checkTgStatus(); location.reload(); });
        });
    }

    const testBtn = document.getElementById('tg-test-btn');
    if (testBtn) {
        testBtn.addEventListener('click', function() {
            fetch('/admin/tg-test-msg', { method: 'POST' })
                .then(r => r.json())
                .then(d => alert(d.success ? 'Success! Check your Telegram' : 'Error: ' + d.error));
        });
    }

    var tgTestVoiceBtn = document.getElementById('tg-test-voice-btn');
    if (tgTestVoiceBtn) {
        tgTestVoiceBtn.addEventListener('click', function() {
            const originalText = tgTestVoiceBtn.innerText;
            tgTestVoiceBtn.innerText = 'Sending Voice...';
            tgTestVoiceBtn.disabled = true;
            fetch('/admin/tg-test-voice', { method: 'POST' })
                .then(r => r.json())
                .then(d => alert(d.success ? 'Success! Voice message sent to yourself. Check your Telegram for the transcription.' : 'Error: ' + d.error))
                .finally(() => { 
                    tgTestVoiceBtn.innerText = originalText;
                    tgTestVoiceBtn.disabled = false;
                });
        });
    }

    document.querySelectorAll('.deactivate-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            var uid = btn.dataset.userid;
            var action = btn.innerText.includes('Stop') ? 'stop' : 'delete';
            if(!confirm('Are you sure?')) return;
            fetch('/admin/user-action', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: uid, action: action })
            }).then(() => location.reload());
        });
    });

    // Whisper Config Logic
    function loadWhisperConfig() {
        fetch('/admin/whisper-config').then(r => r.json()).then(data => {
            const providerLocal = document.getElementById('provider-local');
            const providerCf = document.getElementById('provider-cf');
            if (data.provider === 'local') {
                if (providerLocal) providerLocal.checked = true;
            } else {
                if (providerCf) providerCf.checked = true;
            }
            const statusTag = document.getElementById('whisper-status-tag');
            if (statusTag) statusTag.innerText = data.provider.toUpperCase();
        });
    }
    loadWhisperConfig();

    const saveWhisperBtn = document.getElementById('save-whisper-btn');
    if (saveWhisperBtn) {
        saveWhisperBtn.addEventListener('click', () => {
            const checked = document.querySelector('input[name="whisper_provider"]:checked');
            if (!checked) return;
            const provider = checked.value;
            
            saveWhisperBtn.innerText = 'Saving...';
            fetch('/admin/whisper-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider })
            }).then(r => r.json()).then(d => {
                alert(d.success ? 'Whisper config saved' : 'Error: ' + d.error);
                saveWhisperBtn.innerText = 'Save Whisper Config';
                loadWhisperConfig();
            });
        });
    }

    // Test Speech2Text button handler
    const testS2tBtn = document.getElementById('test-s2t-btn');
    if (testS2tBtn) {
        testS2tBtn.addEventListener('click', () => {
            const checked = document.querySelector('input[name="whisper_provider"]:checked');
            if (!checked) return;
            const provider = checked.value;
            
            // In a real separate file, we can't easily use the JS variable from the server unless we globalize it
            // So we'll fetch it from a specific endpoint or just leave this one as is if it's dynamic
            // But since I'm moving it to a static file, I'll fetch the sample from a route.
            
            fetch('/admin/sample-audio')
                .then(r => r.json())
                .then(data => {
                    return fetch(data.url);
                })
                .then(r => r.blob())
                .then(blob => {
                    const form = new FormData();
                    form.append('file', blob, 'sample.wav');
                    return fetch('/test-whisper?provider=' + provider, {
                        method: 'POST',
                        body: form
                    });
                })
                .then(r => r.json())
                .then(data => {
                    alert(data.success ? '✅ ' + provider + ' transcription: ' + data.text : '❌ Error: ' + data.error);
                })
                .catch(e => alert('Fetch error: ' + e));
        });
    }

    const statusBadge = document.querySelector('.status-badge');
    if (statusBadge) {
        statusBadge.addEventListener('click', () => {
            location.href = '/admin/logout';
        });
    }
});
