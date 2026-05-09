document.addEventListener('DOMContentLoaded', function() {
    var logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            location.href = '/auth/logout';
        });
    }

    // Telegram Auth JS
    var tgPhoneInput = document.getElementById('tg-phone-input');
    var tgCodeInput = document.getElementById('tg-code-input');
    var tgSendCodeBtn = document.getElementById('tg-send-code-btn');
    var tgVerifyBtn = document.getElementById('tg-verify-btn');
    var tgCodeSection = document.getElementById('tg-code-section');
    var tgShowQrBtn = document.getElementById('tg-show-qr-btn');
    var tgQrSection = document.getElementById('tg-qr-section');
    var qrCodeContainer = document.getElementById('qr-code-container');
    var currentPhone = '';

    if (tgSendCodeBtn) {
        tgSendCodeBtn.addEventListener('click', function() {
            var phone = tgPhoneInput.value.trim();
            if (!phone) return alert('Enter phone');
            fetch('/auth/send-code', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: phone })
            }).then(r => r.json()).then(data => {
                if (data.success) {
                    currentPhone = phone;
                    if (tgCodeSection) tgCodeSection.style.display = 'block';
                    alert('Code sent!');
                } else { alert('Error: ' + data.error); }
            });
        });
    }

    if (tgVerifyBtn) {
        tgVerifyBtn.addEventListener('click', function() {
            var code = tgCodeInput.value.trim();
            fetch('/auth/verify-code', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: currentPhone, code: code })
            }).then(r => r.json()).then(data => {
                if (data.success) { location.reload(); } else { alert('Error: ' + data.error); }
            });
        });
    }

    // Simplified Dashboard Auth
    var simpleConnectBtn = document.getElementById('tg-simple-connect-btn');
    var manualBtn = document.getElementById('show-manual-auth-btn');
    var simpleView = document.getElementById('tg-simple-connect-view');
    var manualView = document.getElementById('tg-manual-auth-view');

    if (manualBtn) {
        manualBtn.onclick = () => {
            if (simpleView) simpleView.style.display = 'none';
            if (manualView) manualView.style.display = 'block';
        };
    }

    function startQrPolling(token) {
        var timeoutId = setTimeout(function() {
            clearInterval(interval);
            if (tgQrSection) tgQrSection.style.display = 'none';
            alert('QR code expired. Please try again.');
            if (simpleConnectBtn) simpleConnectBtn.innerText = 'Connect Telegram';
        }, 120000); // 2 minute timeout
        
        var interval = setInterval(() => {
            fetch('/auth/qr-check?token=' + token)
                .then(r => r.json())
                .then(s => {
                    if (s.done) { 
                        clearInterval(interval); 
                        clearTimeout(timeoutId);
                        location.reload(); 
                    }
                    else if (s.requiresPassword) {
                        clearInterval(interval);
                        clearTimeout(timeoutId);
                        alert('2FA Password required. Please use manual login or wait for update.');
                    } else if (s.expired) {
                        clearInterval(interval);
                        clearTimeout(timeoutId);
                        alert('QR code expired. Please try again.');
                        if (simpleConnectBtn) simpleConnectBtn.innerText = 'Connect Telegram';
                    }
                })
                .catch(err => {
                    console.error('QR check failed:', err);
                    clearInterval(interval);
                    clearTimeout(timeoutId);
                    alert('Bridge connection lost. Please refresh and try again.');
                    if (simpleConnectBtn) simpleConnectBtn.innerText = 'Connect Telegram';
                });
        }, 2500);
    }

    if (simpleConnectBtn) {
        simpleConnectBtn.onclick = () => {
            simpleConnectBtn.innerText = 'Connecting...';
            fetch('/auth/qr-start', { method: 'POST' }).then(r => r.json()).then(data => {
                if (data.qrUrl) {
                    startQrPolling(data.token);
                    window.location.href = data.qrUrl;
                    setTimeout(() => {
                        if (simpleView) simpleView.style.display = 'none';
                        if (manualView) manualView.style.display = 'block';
                        if (tgQrSection) tgQrSection.style.display = 'block';
                        if (qrCodeContainer) {
                            qrCodeContainer.innerHTML = '';
                            new QRCode(qrCodeContainer, { text: data.qrUrl, width: 140, height: 140 });
                        }
                    }, 2000);
                }
            });
        };
    }

    if (tgShowQrBtn) {
        tgShowQrBtn.addEventListener('click', function() {
            if (tgQrSection) tgQrSection.style.display = 'block';
            tgShowQrBtn.style.display = 'none';
            fetch('/auth/qr-start', { method: 'POST' }).then(r => r.json()).then(data => {
                if (data.token) {
                    if (qrCodeContainer) {
                        qrCodeContainer.innerHTML = '';
                        new QRCode(qrCodeContainer, { text: data.qrUrl, width: 180, height: 180 });
                    }
                    
                    var appBtn = document.getElementById('tg-app-link');
                    if (appBtn) { appBtn.href = data.qrUrl; appBtn.style.display = 'inline-flex'; }

                    startQrPolling(data.token);
                }
            });
        });
    }

    var disconnectTgBtn = document.getElementById('disconnect-tg-btn');
    if (disconnectTgBtn) {
        disconnectTgBtn.addEventListener('click', () => {
            if(!confirm('Disconnect Telegram?')) return;
            fetch('/dashboard/disconnect-tg', { method: 'POST' }).then(() => location.reload());
        });
    }

    var testTgBtn = document.getElementById('test-tg-btn');
    if (testTgBtn) {
        testTgBtn.addEventListener('click', () => {
            fetch('/dashboard/test-tg', { method: 'POST' })
                .then(r => r.json())
                .then(d => alert(d.success ? 'Success! Check your Telegram' : 'Error: ' + (d.error || 'Failed to send test message')));
        });
    }

    var restartTgBtn = document.getElementById('restart-tg-btn');
    if (restartTgBtn) {
        restartTgBtn.addEventListener('click', () => {
            restartTgBtn.disabled = true;
            restartTgBtn.innerText = 'Restarting...';
            fetch('/dashboard/restart-tg', { method: 'POST' })
                .then(r => r.json())
                .then(d => {
                    if (d.success) {
                        alert('Restart initiated. Please wait a few seconds for the pod to start.');
                        location.reload();
                    } else {
                        alert('Restart failed: ' + (d.error || 'Unknown error'));
                        restartTgBtn.disabled = false;
                        restartTgBtn.innerText = 'Restart Bridge';
                    }
                });
        });
    }

    // Meta / WA hooks
    var connectMetaBtn = document.getElementById('connect-meta-btn');
    if (connectMetaBtn) {
        connectMetaBtn.addEventListener('click', () => {
            location.href = '/auth/meta/login';
        });
    }

    var connectThreadsBtn = document.getElementById('connect-threads-btn');
    if (connectThreadsBtn) {
        connectThreadsBtn.addEventListener('click', () => {
            location.href = '/auth/threads/login';
        });
    }

    var saveWaBtn = document.getElementById('save-wa-btn');
    if (saveWaBtn) {
        saveWaBtn.addEventListener('click', () => {
            fetch('/dashboard/save-wa', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ whatsappToken: document.getElementById('wa-token').value, whatsappPhoneId: document.getElementById('wa-phone-id').value })
            }).then(() => location.reload());
        });
    }

    var saveLineBtn = document.getElementById('save-line-btn');
    if (saveLineBtn) {
        saveLineBtn.addEventListener('click', () => {
            fetch('/dashboard/save-line', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lineToken: document.getElementById('line-token').value, lineSecret: document.getElementById('line-secret').value })
            }).then(() => location.reload());
        });
    }

    var testWaBtn = document.getElementById('test-wa-btn');
    if (testWaBtn) {
        testWaBtn.addEventListener('click', () => {
            const token = document.getElementById('wa-token').value;
            const phoneId = document.getElementById('wa-phone-id').value;
            const recipient = document.getElementById('wa-test-num').value;
            
            if (!recipient) return alert('Enter test recipient phone number (format: 15551234567)');
            
            testWaBtn.disabled = true;
            testWaBtn.innerText = 'Testing...';
            
            fetch('/dashboard/test-wa', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ whatsappToken: token, whatsappPhoneId: phoneId, testRecipient: recipient })
            }).then(r => r.json()).then(d => {
                if (d.success) alert('Test message sent!');
                else alert('Error: ' + d.error);
                testWaBtn.disabled = false;
                testWaBtn.innerText = 'Test';
            });
        });
    }

    // Translation settings
    const translateCheckbox = document.getElementById('translate-checkbox');
    const translateLang = document.getElementById('translate-lang');
    const translateOptions = document.getElementById('translate-options');
    const testTranslateBtn = document.getElementById('test-translate-btn');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const testTranslationInput = document.getElementById('test-translation-input');
    const translationResult = document.getElementById('translation-result');

    if (translateCheckbox) {
        translateCheckbox.addEventListener('change', () => {
            if (translateOptions) translateOptions.style.display = translateCheckbox.checked ? 'block' : 'none';
        });
    }

    if (testTranslateBtn && testTranslationInput) {
        testTranslateBtn.addEventListener('click', async () => {
            const text = testTranslationInput.value.trim();
            const lang = translateLang?.value;

            if (!text) return alert('Enter text to test translation');
            if (!lang) return alert('Select target language first');

            testTranslateBtn.disabled = true;
            testTranslateBtn.innerText = 'Translating...';

            try {
                const response = await fetch('/dashboard/test-translation', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text, targetLang: lang })
                });
                const result = await response.json();

                if (translationResult) {
                    translationResult.style.display = 'block';
                    if (result.success) {
                        translationResult.innerHTML = '<div style="color: #22c55e;"><strong>Original:</strong> ' + text.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div><div style="color: #8B5CF6; margin-top: 5px;"><strong>Translated:</strong> ' + result.translated.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>';
                    } else {
                        translationResult.innerHTML = '<div style="color: #ef4444;"><strong>Error:</strong> ' + result.error.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>';
                    }
                }
            } catch (e) {
                if (translationResult) {
                    translationResult.style.display = 'block';
                    translationResult.innerHTML = '<div style="color: #ef4444;"><strong>Error:</strong> Failed to test translation</div>';
                }
            } finally {
                testTranslateBtn.disabled = false;
                testTranslateBtn.innerText = 'Test Translation';
            }
        });
    }

    if (saveSettingsBtn && translateCheckbox && translateLang) {
        saveSettingsBtn.addEventListener('click', async () => {
            const enabled = translateCheckbox.checked;
            const lang = enabled ? translateLang.value : '';

            saveSettingsBtn.disabled = true;
            saveSettingsBtn.innerText = 'Saving...';

            try {
                const response = await fetch('/dashboard/save-settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ translateTo: lang })
                });
                const result = await response.json();

                if (result.success) {
                    alert('Settings saved successfully!');
                } else {
                    alert('Error saving settings: ' + (result.error || 'Unknown error'));
                }
            } catch (e) {
                alert('Error saving settings');
            } finally {
                saveSettingsBtn.disabled = false;
                saveSettingsBtn.innerText = 'Save Settings';
            }
        });
    }
});
