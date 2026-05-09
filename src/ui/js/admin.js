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
                if (tgAuthForm) tgAuthForm.style.display = 'none';
                if (tgAuthStatusContainer) tgAuthStatusContainer.style.display = 'block';
                if (tgAuthDetails) tgAuthDetails.innerText = 'Connected as User ID: ' + data.userId;
            } else {
                if (tgAuthForm) tgAuthForm.style.display = 'block';
                if (tgAuthStatusContainer) tgAuthStatusContainer.style.display = 'none';
            }
        });
    }
    checkTgStatus();

    function showTgStatus(msg, isError) {
        if (tgAuthMessage) {
            tgAuthMessage.innerText = msg;
            tgAuthMessage.style.color = isError ? '#ef4444' : '#22c55e';
        }
    }

    if (tgSendCodeBtn) {
        tgSendCodeBtn.addEventListener('click', function() {
            var phone = tgPhoneInput ? tgPhoneInput.value.trim() : '';
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
                    if (tgCodeSection) tgCodeSection.style.display = 'block';
                    showTgStatus('Code sent to Telegram', false);
                } else { alert('Error: ' + data.error); }
                tgSendCodeBtn.innerText = 'Send Code';
            });
        });
    }

    if (tgVerifyBtn) {
        tgVerifyBtn.addEventListener('click', function() {
            var code = tgCodeInput ? tgCodeInput.value.trim() : '';
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
            if (tgQrSection) tgQrSection.style.display = 'block';
            tgShowQrBtn.style.display = 'none';
            fetch('/admin/tg-qr-login', { method: 'POST' })
            .then(r => r.json())
            .then(data => {
                if (data.token) {
                    if (qrCodeContainer) {
                        qrCodeContainer.innerHTML = '';
                        new QRCode(qrCodeContainer, { text: data.qrUrl, width: 180, height: 180 });
                    }
                    if (qrStatus) qrStatus.innerText = 'Scan now...';
                    qrPollInterval = setInterval(() => {
                        fetch('/admin/tg-qr-check?token=' + data.token)
                        .then(r => r.json())
                        .then(status => {
                            if (status.done) { clearInterval(qrPollInterval); checkTgStatus(); location.reload(); }
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
            } else if (data.provider === 'qwen3-asr') {
                const providerQwen = document.getElementById('provider-qwen3-asr');
                if (providerQwen) providerQwen.checked = true;
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

    const pullBtn = document.getElementById('pull-ollama-btn');
    if (pullBtn) {
        pullBtn.addEventListener('click', () => {
            const modelSelect = document.getElementById('ollama-model-select');
            const urlInput = document.getElementById('ollama-url');
            const model = modelSelect ? modelSelect.value.trim() : '';
            const ollamaUrl = urlInput ? urlInput.value.trim() : '';
            
            if (!model || !ollamaUrl) return alert("Enter Ollama Base URL and Model name first.");
            
            pullBtn.innerText = 'Pulling...';
            pullBtn.disabled = true;
            fetch('/admin/ollama-pull', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: ollamaUrl, model: model })
            }).then(r => r.json()).then(d => {
                alert(d.success ? `✅ Successfully requested Ollama to pull "${model}"!\n\nThe download has started in the background. Check your Ollama server logs or try using the model in a few minutes.` : '❌ Error: ' + d.error);
            }).catch(e => {
                alert('Pull request failed: ' + e.message);
            }).finally(() => {
                pullBtn.innerText = 'Pull / Download';
                pullBtn.disabled = false;
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

    // Record & Test button handler
    const recordTestBtn = document.getElementById('record-test-btn');
    if (recordTestBtn) {
        recordTestBtn.addEventListener('click', async () => {
            const checked = document.querySelector('input[name="whisper_provider"]:checked');
            const provider = checked ? checked.value : 'ollama';
            
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const mediaRecorder = new MediaRecorder(stream);
                const chunks = [];
                
                mediaRecorder.ondataavailable = e => chunks.push(e.data);
                mediaRecorder.onstop = async () => {
                    const blob = new Blob(chunks, { type: 'audio/webm' });
                    const form = new FormData();
                    form.append('file', blob, 'record.webm');
                    
                    recordTestBtn.innerText = 'Transcribing...';
                    const res = await fetch('/test-whisper?provider=' + provider, {
                        method: 'POST',
                        body: form
                    });
                    const data = await res.json();
                    
                    if (data.success) {
                        alert('✅ Recorded result: ' + data.text);
                        // Send to Telegram too
                        fetch('/admin/tg-send-text', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ message: data.text })
                        }).then(r => r.json()).then(tg => {
                            if (!tg.success) console.error('TG Send failed:', tg.error);
                        });
                    } else {
                        alert('❌ Error: ' + data.error);
                    }
                    recordTestBtn.innerText = 'Record 5s & Test';
                    recordTestBtn.style.background = 'rgba(239, 68, 68, 0.1)';
                    // Stop all tracks
                    stream.getTracks().forEach(track => track.stop());
                };
                
                mediaRecorder.start();
                let timeLeft = 5;
                recordTestBtn.innerText = `Recording... ${timeLeft}s`;
                recordTestBtn.style.background = '#ef4444';
                
                const timer = setInterval(() => {
                    timeLeft--;
                    if (timeLeft > 0) recordTestBtn.innerText = `Recording... ${timeLeft}s`;
                    else {
                        clearInterval(timer);
                        mediaRecorder.stop();
                    }
                }, 1000);
                
            } catch (e) {
                alert('Mic error: ' + e.message);
            }
        });
    }

    // --- User management polling ---
    var userTableBody = document.getElementById('user-table-body');
    var forceRefreshBtn = document.getElementById('force-refresh-btn');
    var lastUpdatedInfo = document.getElementById('last-updated-info');

    function formatUptime(startTime) {
        if (!startTime) return 'n/a';
        const now = Date.now();
        const diff = Math.floor((now - startTime) / 1000);
        if (diff < 0) return '0s';
        if (diff < 60) return diff + 's';
        if (diff < 3600) return Math.floor(diff / 60) + 'm ' + (diff % 60) + 's';
        return Math.floor(diff / 3600) + 'h ' + Math.floor((diff % 3600) / 60) + 'm';
    }

    function renderUsers(users) {
        if (!userTableBody) return;
        userTableBody.innerHTML = users.map(u => `
            <tr class="user-row" data-userid="${u.userId}">
                <td>
                    <div style="font-weight: 600">${u.firstName || 'User'}</div>
                    <div style="font-size: 11px; color: var(--text-dim)">@${u.username || 'n/a'}</div>
                </td>
                <td><code style="font-size: 11px; color: #888">${u.userId}</code></td>
                <td style="font-size: 12px">${u.phone || 'n/a'}</td>
                <td style="text-align: center">
                    <div style="display: flex; flexDirection: column; gap: 4px; align-items: center">
                        <span class="status-tag ${u.isActive ? 'active' : 'inactive'}" style="font-size: 10px; padding: 2px 6px">
                            ${u.currentStatus || (u.isActive ? 'RUNNING' : 'STOPPED')}
                        </span>
                        ${u.podName ? `<div style="font-size: 9px; color: #8B5CF6; margin-top: 2px; font-weight: bold; font-family: monospace">${u.podName}</div>` : ''}
                        <span style="font-size: 9px; color: ${u.tgAuthenticated ? '#22c55e' : '#ef4444'}; font-weight: bold">
                            ${u.tgAuthenticated ? 'TG AUTH' : 'TG NEED LOGIN'}
                        </span>
                    </div>
                </td>
                <td style="text-align: center; font-size: 11px">${formatUptime(u.lastStartedAt)}</td>
                <td style="text-align: center; font-weight: 700; color: #24A1DE">${u.transcriptionCount || 0}</td>
                <td style="font-size: 11px; white-space: nowrap">
                    ${u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleString('en-GB', { hour12: false }) : '-'}
                </td>
                <td style="text-align: right">
                    <div style="display: flex; gap: 4px; justify-content: flex-end">
                        <button class="btn btn-sm test-user-btn" data-userid="${u.userId}" title="Send Test Message" style="width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center; background: #3B82F6; color: #fff; border-radius: 8px">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polyline points="22 2 15 22 11 13 2 9 22 2"/></svg>
                        </button>
                        <button class="btn btn-sm restart-btn" data-userid="${u.userId}" title="Restart Pod" style="width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center; background: #F59E0B; color: #000; border-radius: 8px">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
                        </button>
                        <button class="btn btn-sm btn-danger deactivate-btn" data-userid="${u.userId}" title="${u.isActive ? 'Stop Pod' : 'Delete User'}" style="width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center; background: ${u.isActive ? '#ef4444' : '#6B7280'}; border-radius: 8px">
                            ${u.isActive ? 
                                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12"/></svg>' : 
                                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>'
                            }
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    function refreshUsers() {
        if (!userTableBody || document.visibilityState === 'hidden') return;
        const oFetch = originalFetch || window.fetch;
        oFetch('/admin/users-json')
            .then(r => r.json())
            .then(users => {
                renderUsers(users);
                if (lastUpdatedInfo) {
                    lastUpdatedInfo.innerText = 'Last updated: ' + new Date().toLocaleTimeString();
                }
            })
            .catch(e => console.error('Refresh users failed:', e));
    }

    if (userTableBody) {
        setInterval(refreshUsers, 5000);
        if (forceRefreshBtn) forceRefreshBtn.addEventListener('click', refreshUsers);

        userTableBody.addEventListener('click', function(e) {
            var btn = e.target.closest('.btn');
            if (!btn) return;
            var userId = btn.getAttribute('data-userid');
            if (!userId) return;

            if (btn.classList.contains('test-user-btn')) {
                btn.disabled = true;
                fetch('/admin/user-test-msg', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: userId })
                }).then(r => r.json()).then(d => {
                    if (d.success) alert('Test message sent to ' + userId);
                    else alert('Error: ' + d.error);
                }).finally(() => { btn.disabled = false; });
            } else if (btn.classList.contains('restart-btn')) {
                if (!confirm('Restart pod for ' + userId + '?')) return;
                fetch('/admin/restart-pod', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: userId })
                }).then(r => r.json()).then(d => {
                    if (d.success) refreshUsers();
                    else alert('Error: ' + d.error);
                });
            } else if (btn.classList.contains('deactivate-btn')) {
                var isDeactivate = btn.title.includes('Stop');
                if (!confirm((isDeactivate ? 'Stop pod' : 'Delete user') + ' for ' + userId + '?')) return;
                fetch('/admin/deactivate-user', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: userId })
                }).then(r => r.json()).then(d => {
                    if (d.success) refreshUsers();
                    else alert('Error: ' + d.error);
                });
            }
        });
    }

    // --- Transcription Stats Expansion ---
    document.addEventListener('click', function(e) {
        const expandBtn = e.target.closest('.expand-user-info');
        if (expandBtn) {
            const userId = expandBtn.dataset.userid;
            const infoBox = document.getElementById(`info-box-${userId}`);
            if (infoBox) {
                const isHidden = infoBox.style.display === 'none';
                infoBox.style.display = isHidden ? 'block' : 'none';
                expandBtn.innerText = isHidden ? 'HIDE' : 'INFO';
                expandBtn.style.background = isHidden ? 'rgba(239, 68, 68, 0.1)' : 'rgba(139, 92, 246, 0.1)';
                expandBtn.style.borderColor = isHidden ? 'rgba(239, 68, 68, 0.3)' : 'rgba(139, 92, 246, 0.3)';
                expandBtn.style.color = isHidden ? '#ef4444' : '#8B5CF6';
            }
        }
    });

    const statusBadge = document.querySelector('.status-badge');
    if (statusBadge) {
        statusBadge.addEventListener('click', () => {
            location.href = '/admin/logout';
        });
    }
});
