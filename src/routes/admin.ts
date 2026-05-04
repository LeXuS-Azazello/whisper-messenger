import { Env, UserSession, HealthChecks } from "../types";
import { ErrorLog, getErrors, logError } from "../logger";
import { renderAdminDashboard, renderAdminLogin } from "../admin_ui";
import { createSignedSession, verifySession } from "../session";
import { sampleAudioBase64 } from "../sample_audio";

const ADMIN_JS_CONTENT = `document.addEventListener('DOMContentLoaded', function() {
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
            if(!confirm(\`Are you sure you want to \${action} user \${uid}?\`)) return;
            
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
                alert(d.success ? \`✅ Successfully requested Ollama to pull "\${model}"!\n\nThe download has started in the background. Check your Ollama server logs or try using the model in a few minutes.\` : '❌ Error: ' + d.error);
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
                recordTestBtn.innerText = \`Recording... \${timeLeft}s\`;
                recordTestBtn.style.background = '#ef4444';
                
                const timer = setInterval(() => {
                    timeLeft--;
                    if (timeLeft > 0) recordTestBtn.innerText = \`Recording... \${timeLeft}s\`;
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
        userTableBody.innerHTML = users.map(u => \`
            <tr class="user-row" data-userid="\${u.userId}">
                <td>
                    <div style="font-weight: 600">\${u.firstName || 'User'}</div>
                    <div style="font-size: 11px; color: var(--text-dim)">@\${u.username || 'n/a'}</div>
                </td>
                <td><code style="font-size: 11px; color: #888">\${u.userId}</code></td>
                <td style="font-size: 12px">\${u.phone || 'n/a'}</td>
                <td style="text-align: center">
                    <div style="display: flex; flexDirection: column; gap: 4px; align-items: center">
                        <span class="status-tag \${u.isActive ? 'active' : 'inactive'}" style="font-size: 10px; padding: 2px 6px">
                            \${u.currentStatus || (u.isActive ? 'RUNNING' : 'STOPPED')}
                        </span>
                        \${u.podName ? \`<div style="font-size: 9px; color: #8B5CF6; margin-top: 2px; font-weight: bold; font-family: monospace">\${u.podName}</div>\` : ''}
                        <span style="font-size: 9px; color: \${u.tgAuthenticated ? '#22c55e' : '#ef4444'}; font-weight: bold">
                            \${u.tgAuthenticated ? 'TG AUTH' : 'TG NEED LOGIN'}
                        </span>
                    </div>
                </td>
                <td style="text-align: center; font-size: 11px">\${formatUptime(u.lastStartedAt)}</td>
                <td style="text-align: center; font-weight: 700; color: #24A1DE">\${u.transcriptionCount || 0}</td>
                <td style="font-size: 11px; white-space: nowrap">
                    \${u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleString('en-GB', { hour12: false }) : '-'}
                </td>
                <td style="text-align: right">
                    <div style="display: flex; gap: 4px; justify-content: flex-end">
                        <button class="btn btn-sm test-user-btn" data-userid="\${u.userId}" title="Send Test Message" style="width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center; background: #3B82F6; color: #fff; border-radius: 8px">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polyline points="22 2 15 22 11 13 2 9 22 2"/></svg>
                        </button>
                        <button class="btn btn-sm restart-btn" data-userid="\${u.userId}" title="Restart Pod" style="width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center; background: #F59E0B; color: #000; border-radius: 8px">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
                        </button>
                        <button class="btn btn-sm btn-danger deactivate-btn" data-userid="\${u.userId}" title="\${u.isActive ? 'Stop Pod' : 'Delete User'}" style="width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center; background: \${u.isActive ? '#ef4444' : '#6B7280'}; border-radius: 8px">
                            \${u.isActive ? 
                                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12"/></svg>' : 
                                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>'
                            }
                        </button>
                    </div>
                </td>
            </tr>
        \`).join('');
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
            const infoBox = document.getElementById(\`info-box-\${userId}\`);
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
});`;



async function fetchUsersWithStatus(env: Env): Promise<UserSession[]> {
    const userIdsRaw = await env.STATS.get("users_list");
    let userIds: string[] = userIdsRaw ? JSON.parse(userIdsRaw) : [];

    // Limit to most recent 50 users to avoid hitting KV limits
    if (userIds.length > 50) {
        userIds = userIds.slice(-50);
    }

    const users: UserSession[] = [];

    // Fetch all meta in parallel
    const userConfigs = await Promise.all(userIds.map(async (id) => {
        const metaStr = await env.STATS.get(`user_meta_${id}`);
        if (!metaStr) return null;
        try {
            const meta = JSON.parse(metaStr) as UserSession;
            // Also check if TG session exists - but maybe we can optimize this too
            const session = await env.STATS.get(`tg_session_${id}`);
            meta.tgAuthenticated = !!session;
            return meta;
        } catch (e) {
            return null;
        }
    }));

    userConfigs.forEach(u => { if (u) users.push(u); });

    // Fetch live pod statuses from bridge
    try {
        const podsRes = await fetch(`http://mtproto-bridge-manager:3000/pods?secret=${env.BRIDGE_SECRET || "changeme"}`, {
            headers: { "x-bridge-secret": env.BRIDGE_SECRET || "changeme" }
        });
        if (podsRes.ok) {
            const podStatuses = await podsRes.json() as any[];
            const podMap = new Map(podStatuses.map(p => [String(p.userId), p]));
            
            users.forEach(user => {
                const pod = podMap.get(String(user.userId));
                if (pod) {
                    user.isActive = true;
                    user.currentStatus = pod.status || 'Running';
                    user.lastStartedAt = pod.startTime ? new Date(pod.startTime).getTime() : undefined;
                    user.podName = pod.podName;
                } else {
                    user.isActive = false;
                    user.currentStatus = 'Stopped';
                }
            });
        }
    } catch (e) {
        console.warn("[Admin] Failed to fetch pod statuses:", e);
        users.forEach(user => {
            user.isActive = false;
            user.currentStatus = 'Unknown';
        });
    }

    return users;
}

export async function handleAdmin(env: Env, req: Request): Promise<Response> {
    try {
        const url = new URL(req.url);
        const cookieAuth = req.headers.get("Cookie")?.match(/admin_session=([^;]+)/)?.[1];
        const adminId = cookieAuth ? await verifySession(cookieAuth, env.ADMIN_SECRET) : null;

        if (req.method === "POST" && url.pathname === "/admin/login") {
            const formData = await req.formData();
            const password = formData.get("password")?.toString();
            if (password === env.ADMIN_SECRET) {
                const signedAdminSession = await createSignedSession("admin", env.ADMIN_SECRET);
                return new Response("Redirect", { status: 302, headers: { "Location": "/admin", "Set-Cookie": `admin_session=${signedAdminSession}; Path=/; HttpOnly; SameSite=Lax;` } });
            }
        }

        if (url.pathname === "/admin/logout") {
            return new Response("Redirect", { status: 302, headers: { "Location": "/admin", "Set-Cookie": `admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT` } });
        }

        if (adminId !== "admin") {
            // If it's an API request, return 401 JSON
            if (req.method === "POST" || url.pathname.endsWith(".json") || url.pathname.includes("/tg-") || url.pathname.includes("/user-action")) {
                return new Response(JSON.stringify({ success: false, error: "Unauthorized. Please login." }), {
                    status: 401,
                    headers: { "Content-Type": "application/json" }
                });
            }
            return new Response(renderAdminLogin(), { headers: { "Content-Type": "text/html; charset=utf-8" } });
        }

        if (req.method === "POST") {
            const origin = req.headers.get("Origin");
            const host = url.hostname;
            if (origin && !origin.includes(host)) {
                // Only block if it's definitely a cross-origin request to the API
                await logError("admin", `Potential CSRF block: Origin=${origin} Host=${host}`, env);
            }
        }

        // --- Static Assets Routes ---
        if (url.pathname === "/admin/js") {
            return new Response(ADMIN_JS_CONTENT, { headers: { "Content-Type": "application/javascript" } });
        }

        if (url.pathname === "/admin/sample-audio") {
            return Response.json({ url: sampleAudioBase64 });
        }

        if (url.pathname === "/admin/tg-status") {
            const res = await fetch(`http://mtproto-bridge-manager:3000/health`, {
                headers: { "x-bridge-secret": env.BRIDGE_SECRET || "changeme" }
            });
            return res;
        }

        if (url.pathname === "/admin/tg-send-code" && req.method === "POST") {
            const { phoneNumber } = await req.json() as any;
            const res = await fetch(`http://mtproto-bridge-manager:3000/send-code`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-bridge-secret": env.BRIDGE_SECRET || "changeme" },
                body: JSON.stringify({ phone: phoneNumber })
            });
            return res;
        }

        if (url.pathname === "/admin/tg-verify-code" && req.method === "POST") {
            const { phoneNumber, code } = await req.json() as any;
            const res = await fetch(`http://mtproto-bridge-manager:3000/verify-code`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-bridge-secret": env.BRIDGE_SECRET || "changeme" },
                body: JSON.stringify({ phone: phoneNumber, code })
            });
            return res;
        }

        if (url.pathname === "/admin/tg-qr-login" && req.method === "POST") {
            const res = await fetch(`http://mtproto-bridge-manager:3000/qr-start`, {
                method: "POST",
                headers: { "x-bridge-secret": env.BRIDGE_SECRET || "changeme" }
            });
            return res;
        }

        if (url.pathname === "/admin/tg-qr-check") {
            const token = url.searchParams.get("token");
            const res = await fetch(`http://mtproto-bridge-manager:3000/qr-check?token=${token}&secret=${env.BRIDGE_SECRET || "changeme"}`, {
                headers: { "x-bridge-secret": env.BRIDGE_SECRET || "changeme" }
            });
            return res;
        }

        if (url.pathname === "/admin/tg-test-msg" && req.method === "POST") {
            const res = await fetch(`http://mtproto-bridge-manager:3000/test-tg`, {
                method: "POST",
                headers: { "x-bridge-secret": env.BRIDGE_SECRET || "changeme" },
                body: JSON.stringify({ message: "Admin test message!" })
            });
            return res;
        }


        if (url.pathname === "/admin/users-json") {
            const users = await fetchUsersWithStatus(env);
            return Response.json(users);
        }

        const users = await fetchUsersWithStatus(env);
        const checks: HealthChecks = {
            VERIFY_TOKEN: Boolean(env.VERIFY_TOKEN),
            META_PAGE_TOKEN: Boolean(env.META_PAGE_TOKEN),
            META_APP_SECRET: Boolean(env.META_APP_SECRET),
            WHATSAPP_TOKEN: Boolean(env.WHATSAPP_TOKEN),
            META_API_VERSION: Boolean(env.META_API_VERSION),
            WHATSAPP_PHONE_NUMBER_ID: Boolean(env.WHATSAPP_PHONE_NUMBER_ID),
            TELEGRAM_APP_ID: Boolean(env.TELEGRAM_APP_ID),
            TELEGRAM_APP_HASH: Boolean(env.TELEGRAM_APP_HASH),
            AUDIO_QUEUE: Boolean(env.AUDIO_QUEUE),
            AI: Boolean(env.AI),
        };

        const platforms = ["messenger", "instagram", "whatsapp", "telegram", "line"];
        const stats: any = {};
        for (const p of platforms) {
            const val = await env.STATS.get(`stats_${p}`);
            stats[p] = parseInt(val || "0", 10);
        }

        const errors = await getErrors(env);

        if (url.pathname === "/admin/whisper-config") {
            if (req.method === "GET") {
                const provider = await env.STATS.get("config_whisper_provider") || "qwen3-asr";
                const model = await env.STATS.get("config_ollama_model") || "qwen3-coder:30b";
                const localUrl = await env.STATS.get("config_local_whisper_url") || "";
                const localSecret = await env.STATS.get("config_local_whisper_secret") || "";
                const ollamaUrl = await env.STATS.get("config_ollama_url") || "";
                return Response.json({ provider, model, localUrl, localSecret, ollamaUrl });
            }
            if (req.method === "POST") {
                const { provider, model, localUrl, localSecret, ollamaUrl } = await req.json() as any;
                if (provider) await env.STATS.put("config_whisper_provider", provider);
                if (model) await env.STATS.put("config_ollama_model", model);
                if (localUrl !== undefined) await env.STATS.put("config_local_whisper_url", localUrl);
                if (localSecret !== undefined) await env.STATS.put("config_local_whisper_secret", localSecret);
                if (ollamaUrl !== undefined) await env.STATS.put("config_ollama_url", ollamaUrl);
                return Response.json({ success: true });
            }
        }

        if (url.pathname === "/admin/ollama-pull" && req.method === "POST") {
            const { url: ollamaUrl, model } = await req.json() as any;
            if (!ollamaUrl || !model) return Response.json({ success: false, error: "Missing url or model" }, { status: 400 });
            // Direct fetch to ollama as we are in K8s
            try {
                await fetch(`${ollamaUrl}/api/pull`, {
                    method: "POST",
                    body: JSON.stringify({ name: model, stream: false })
                });
                return Response.json({ success: true });
            } catch (e: any) {
                return Response.json({ success: false, error: e.message }, { status: 500 });
            }
        }

        if (url.pathname === "/admin/user-action" && req.method === "POST") {
            const { userId, action } = await req.json() as any;
            if (action === "delete") {
                await env.STATS.delete(`user_meta_${userId}`);
                await env.STATS.delete(`tg_session_${userId}`);
                const listRaw = await env.STATS.get("users_list") || "[]";
                const list = JSON.parse(listRaw).filter((id: string) => id !== userId);
                await env.STATS.put("users_list", JSON.stringify(list));
            }
            return Response.json({ success: true });
        }

        return new Response(renderAdminDashboard(checks, env, url.origin, stats, errors, users, false), {
            headers: { "Content-Type": "text/html; charset=utf-8" }
        });
    } catch (e: any) {
        console.error("CRITICAL ADMIN ERROR:", e);
        return new Response(`<h1>Admin Rendering Error</h1><p>${e.message}</p><pre>${e.stack}</pre>`, {
            status: 500,
            headers: { "Content-Type": "text/html; charset=utf-8" }
        });
    }
}
