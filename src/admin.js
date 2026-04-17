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
            var text = btn.innerText.trim();
            var action = text.includes('Stop') ? 'stop' : 'delete';
            if(!confirm(`Are you sure you want to ${action} user ${uid}?`)) return;
            
            btn.disabled = true;
            fetch('/admin/user-action', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: uid, action: action })
            }).then(r => r.json()).then(data => {
                if (data.success) {
                    location.reload();
                } else {
                    alert('Action failed: ' + (data.error || 'Unknown error'));
                    btn.disabled = false;
                }
            }).catch(err => {
                alert('Network error: ' + err.message);
                btn.disabled = false;
            });
        });
    });

    document.querySelectorAll('.restart-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            var uid = btn.dataset.userid;
            if(!confirm('Restart this pod? This will stop and restart the session without deleting data.')) return;
            
            btn.disabled = true;
            fetch('/admin/user-action', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: uid, action: 'restart' })
            }).then(r => r.json()).then(data => {
                if (data.success) {
                    location.reload();
                } else {
                    alert('Restart failed: ' + (data.error || 'Unknown error'));
                    btn.disabled = false;
                }
            }).catch(err => {
                alert('Network error: ' + err.message);
                btn.disabled = false;
            });
        });
    });

    // Whisper Config Logic
    function loadWhisperConfig() {
        fetch('/admin/whisper-config').then(r => r.json()).then(data => {
            const providerLocal = document.getElementById('provider-local');
            const providerCf = document.getElementById('provider-cf');
            const providerOllama = document.getElementById('provider-ollama');
            const ollamaSection = document.getElementById('ollama-config-section');
            const localSection = document.getElementById('local-config-section');
            const modelSelect = document.getElementById('ollama-model-select');
            
            const localUrlInput = document.getElementById('local-whisper-url');
            const localSecretInput = document.getElementById('local-whisper-secret');
            const ollamaUrlInput = document.getElementById('ollama-url');
            
            if (data.provider === 'local') {
                if (providerLocal) providerLocal.checked = true;
                if (localSection) localSection.style.display = 'block';
            } else if (data.provider === 'ollama') {
                if (providerOllama) providerOllama.checked = true;
                if (ollamaSection) ollamaSection.style.display = 'block';
            } else {
                if (providerCf) providerCf.checked = true;
            }

            if (modelSelect && data.model) {
                modelSelect.value = data.model;
            }
            if (localUrlInput && data.localUrl) localUrlInput.value = data.localUrl;
            if (localSecretInput && data.localSecret) localSecretInput.value = data.localSecret;
            if (ollamaUrlInput && data.ollamaUrl) ollamaUrlInput.value = data.ollamaUrl;

            const statusTag = document.getElementById('whisper-status-tag');
            if (statusTag) statusTag.innerText = data.provider.toUpperCase();
        });
    }
    loadWhisperConfig();

    document.querySelectorAll('input[name="whisper_provider"]').forEach(input => {
        input.addEventListener('change', (e) => {
            const ollamaSection = document.getElementById('ollama-config-section');
            const localSection = document.getElementById('local-config-section');
            if (ollamaSection) ollamaSection.style.display = e.target.value === 'ollama' ? 'block' : 'none';
            if (localSection) localSection.style.display = e.target.value === 'local' ? 'block' : 'none';
        });
    });

    const saveWhisperBtn = document.getElementById('save-whisper-btn');
    if (saveWhisperBtn) {
        saveWhisperBtn.addEventListener('click', () => {
            const checked = document.querySelector('input[name="whisper_provider"]:checked');
            if (!checked) return;
            const provider = checked.value;
            const modelSelect = document.getElementById('ollama-model-select');
            const model = modelSelect ? modelSelect.value : null;
            
            const localUrl = document.getElementById('local-whisper-url')?.value || '';
            const localSecret = document.getElementById('local-whisper-secret')?.value || '';
            const ollamaUrl = document.getElementById('ollama-url')?.value || '';
            
            saveWhisperBtn.innerText = 'Saving...';
            fetch('/admin/whisper-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider, model, localUrl, localSecret, ollamaUrl })
            }).then(r => r.json()).then(d => {
                alert(d.success ? 'AI config saved' : 'Error: ' + d.error);
                saveWhisperBtn.innerText = 'Save AI Config';
                loadWhisperConfig();
            }).catch(e => {
                alert('Save failed: ' + e.message);
                saveWhisperBtn.innerText = 'Save AI Config';
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
