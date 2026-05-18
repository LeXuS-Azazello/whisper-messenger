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
            fetch('/admin/tg-test-msg', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: "Admin test voice message!" }) // The endpoint handles both text and voice tests usually
            })
                .then(r => r.json())
                .then(d => alert(d.success ? 'Success! Voice message sent to yourself. Check your Telegram for the transcription.' : 'Error: ' + d.error))
                .finally(() => { 
                    tgTestVoiceBtn.innerText = originalText;
                    tgTestVoiceBtn.disabled = false;
                });
        });
    }


    // Whisper Config Logic
    function loadWhisperConfig() {
        fetch('/admin/whisper-config').then(r => r.json()).then(data => {
            const providerWhisperTurbo = document.getElementById('provider-whisper-turbo');
            const localSection = document.getElementById('local-config-section');
            
            const localUrlInput = document.getElementById('local-whisper-url');
            const localSecretInput = document.getElementById('local-whisper-secret');
            
            if (data.provider === 'whisper-turbo') {
                if (providerWhisperTurbo) providerWhisperTurbo.checked = true;
                if (localSection) localSection.style.display = 'block';
            }

            if (localUrlInput && data.localUrl) localUrlInput.value = data.localUrl;
            if (localSecretInput && data.localSecret) localSecretInput.value = data.localSecret;

            const statusTag = document.getElementById('whisper-status-tag');
            if (statusTag) statusTag.innerText = data.provider.replace('-', ' ').toUpperCase();
        });
    }
    loadWhisperConfig();

    document.querySelectorAll('input[name="whisper_provider"]').forEach(input => {
        input.addEventListener('change', (e) => {
            const localSection = document.getElementById('local-config-section');
            if (localSection) localSection.style.display = (e.target.value === 'whisper-turbo' || e.target.value === 'local') ? 'block' : 'none';
        });
    });

    const saveWhisperBtn = document.getElementById('save-whisper-btn');
    if (saveWhisperBtn) {
        saveWhisperBtn.addEventListener('click', () => {
            const checked = document.querySelector('input[name="whisper_provider"]:checked');
            if (!checked) return;
            const provider = checked.value;
            
            const localUrl = document.getElementById('local-whisper-url')?.value || '';
            const localSecret = document.getElementById('local-whisper-secret')?.value || '';
            
            saveWhisperBtn.innerText = 'Saving...';
            fetch('/admin/whisper-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider, localUrl, localSecret })
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
            const provider = checked ? checked.value : 'whisper-turbo';
            
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
                        fetch('/admin/tg-test-msg', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ message: "Recorded: " + data.text })
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
                    <div style="display: flex; align-items: center; gap: 8px">
                        <div style="width: 32px; height: 32px; border-radius: 10px; background: linear-gradient(135deg, var(--primary) 0%, #3B82F6 100%); display: flex; align-items: center; justify-content: center; fontSize: 14px; fontWeight: 800; color: #fff; boxShadow: 0 4px 10px rgba(0,0,0,0.2)">
                            ${(u.firstName || 'U')[0].toUpperCase()}
                        </div>
                        <div>
                            <div style="font-weight: 600; color: #fff">${u.firstName || 'Unknown User'}</div>
                            <div style="font-size: 11px; color: var(--text-dim)">@${u.username || 'n/a'}</div>
                        </div>
                    </div>
                </td>
                <td><code style="font-size: 11px; color: #94A3B8; background: rgba(255,255,255,0.05); padding: 2px 6px; borderRadius: 4px">${u.userId}</code></td>
                <td style="font-size: 12px; color: #CBD5E1">${u.phone || 'n/a'}</td>
                <td style="text-align: center">
                    <div style="display: flex; flex-direction: column; gap: 4px; align-items: center">
                        <span class="status-tag ${u.isActive ? 'active' : 'inactive'}" style="font-size: 10px; padding: 2px 8px; border-radius: 8px">
                            ${u.currentStatus || (u.isActive ? 'RUNNING' : 'STOPPED')}
                        </span>
                        ${u.podName ? `<div style="font-size: 9px; color: #A78BFA; margin-top: 2px; font-weight: bold; font-family: 'JetBrains Mono', monospace">${u.podName}</div>` : ''}
                        <span style="font-size: 9px; color: ${u.tgAuthenticated ? '#34D399' : '#F87171'}; font-weight: bold; display: flex; align-items: center; gap: 4px">
                            <span style="width: 6px; height: 6px; border-radius: 50%; background: currentColor"></span>
                            ${u.tgAuthenticated ? 'TG AUTH' : 'TG NEED LOGIN'}
                        </span>
                    </div>
                </td>
                <td style="text-align: center; font-size: 11px; color: #94A3B8">${formatUptime(u.lastStartedAt)}</td>
                <td style="text-align: center">
                    <div style="font-weight: 800; color: #38BDF8; fontSize: 16px">${u.transcriptionCount || 0}</div>
                    <div style="font-size: 9px; color: var(--text-dim); text-transform: uppercase">msgs</div>
                </td>
                <td style="font-size: 11px; color: #94A3B8; white-space: nowrap">
                    ${u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleString('en-GB', { hour12: false }) : '-'}
                </td>
                <td style="text-align: right">
                    <div style="display: flex; gap: 6px; justify-content: flex-end">
                        <button class="btn btn-sm test-user-btn" data-userid="${u.userId}" title="Send Test Message" style="width: 34px; height: 34px; padding: 0; display: flex; align-items: center; justify-content: center; background: rgba(59, 130, 246, 0.1); color: #3B82F6; border: 1px solid rgba(59, 130, 246, 0.2); borderRadius: 10px">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polyline points="22 2 15 22 11 13 2 9 22 2"/></svg>
                        </button>
                        <button class="btn btn-sm restart-btn" data-userid="${u.userId}" title="Restart Pod" style="width: 34px; height: 34px; padding: 0; display: flex; align-items: center; justify-content: center; background: rgba(245, 158, 11, 0.1); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.2); borderRadius: 10px">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
                        </button>
                        ${u.isActive ? `
                        <button class="btn btn-sm stop-btn" data-userid="${u.userId}" title="Stop Pod" style="width: 34px; height: 34px; padding: 0; display: flex; align-items: center; justify-content: center; background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); borderRadius: 10px">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12"/></svg>
                        </button>
                        ` : ''}
                        <button class="btn btn-sm btn-danger delete-btn" data-userid="${u.userId}" title="Delete User" style="width: 34px; height: 34px; padding: 0; display: flex; align-items: center; justify-content: center; background: rgba(239, 68, 68, 0.15); color: #F87171; border: 1px solid rgba(239, 68, 68, 0.3); borderRadius: 10px">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
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
                    lastUpdatedInfo.innerHTML = `<div class="status-dot" style="width: 6px; height: 6px; animation: pulse 2s infinite"></div> Polling active (1m) • Last updated: ${new Date().toLocaleTimeString()}`;
                }
                
                // Update summary stats if elements exist
                const statsContainer = document.querySelector('.card-header div[style*="display: flex; gap: 15px"]');
                if (statsContainer) {
                    const totalVal = statsContainer.children[0].querySelector('div[style*="font-size: 18px"]');
                    const activeVal = statsContainer.children[1].querySelector('div[style*="font-size: 18px"]');
                    const authVal = statsContainer.children[2].querySelector('div[style*="font-size: 18px"]');
                    
                    if (totalVal) totalVal.innerText = users.length;
                    if (activeVal) activeVal.innerText = users.filter(u => u.isActive).length;
                    if (authVal) authVal.innerText = users.filter(u => !u.tgAuthenticated).length;
                }
            })
            .catch(e => console.error('Refresh users failed:', e));
    }

    if (userTableBody) {
        setInterval(refreshUsers, 60000);
        if (forceRefreshBtn) forceRefreshBtn.addEventListener('click', refreshUsers);

        userTableBody.addEventListener('click', function(e) {
            var btn = e.target.closest('.btn');
            if (!btn) return;
            var userId = btn.getAttribute('data-userid');
            if (!userId) return;

            if (btn.classList.contains('test-user-btn')) {
                btn.disabled = true;
                fetch('/admin/tg-test-msg', { 
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: userId, message: "Admin test message for you!" })
                }).then(r => r.json()).then(d => {
                    if (d.success) alert('Test message sent to ' + userId);
                    else alert('Error: ' + (d.error || 'Not implemented'));
                }).finally(() => { btn.disabled = false; });
            } else if (btn.classList.contains('restart-btn')) {
                if (!confirm('Restart pod for ' + userId + '? This will stop and restart the session without deleting data.')) return;
                fetch('/admin/user-action', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: userId, action: 'restart' })
                }).then(r => r.json()).then(d => {
                    if (d.success) refreshUsers();
                    else alert('Error: ' + d.error);
                });
            } else if (btn.classList.contains('stop-btn')) {
                if (!confirm('Stop pod for ' + userId + '?')) return;
                fetch('/admin/user-action', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: userId, action: 'stop' })
                }).then(r => r.json()).then(d => {
                    if (d.success) refreshUsers();
                    else alert('Error: ' + d.error);
                });
            } else if (btn.classList.contains('delete-btn')) {
                if (!confirm('Are you sure you want to completely delete user ' + userId + '? This will delete the user from MongoDB, clear session keys from Redis, and terminate the Telegram pod.')) return;
                fetch('/admin/user-action', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: userId, action: 'delete' })
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

    // --- Diagnostics Logic ---
    const runDiagBtn = document.getElementById('run-diag-btn');
    if (runDiagBtn) {
        runDiagBtn.addEventListener('click', async () => {
            const originalText = runDiagBtn.innerText;
            runDiagBtn.innerText = 'Testing...';
            runDiagBtn.disabled = true;

            // Reset UI
            document.querySelectorAll('.diag-item').forEach(item => {
                const status = item.querySelector('.diag-status');
                const msg = item.querySelector('.diag-msg');
                status.className = 'diag-status unknown';
                status.innerHTML = '<span></span> Testing...';
                msg.innerText = 'Connecting...';
            });

            try {
                const res = await fetch('/admin/run-diagnostics', { method: 'POST' });
                const results = await res.json();

                Object.keys(results).forEach(service => {
                    updateDiagUI(service, results[service]);
                });
            } catch (e) {
                alert('Diagnostics failed: ' + e.message);
            } finally {
                runDiagBtn.innerText = originalText;
                runDiagBtn.disabled = false;
            }
        });
    }

    function updateDiagUI(service, result) {
        const item = document.querySelector(`.diag-item[data-service="${service}"]`);
        if (!item) return;

        const status = item.querySelector('.diag-status');
        const msg = item.querySelector('.diag-msg');

        status.className = `diag-status ${result.status}`;
        status.innerHTML = `<span></span> ${result.status.toUpperCase()}`;
        msg.innerText = result.message;
    }
});
