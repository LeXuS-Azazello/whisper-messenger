function initDashboard() {
    // Basic elements
    const logoutBtn = document.getElementById('logout-btn');
    const mobileLogoutBtn = document.getElementById('mobile-logout-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const tabButtons = document.querySelectorAll('.tab-btn, .nav-item, .bottom-nav-item');
    const sectionTitle = document.getElementById('current-section-title');
    const sectionSubtitle = document.getElementById('current-section-subtitle');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => { location.href = '/auth/logout'; });
    }
    if (mobileLogoutBtn) {
        mobileLogoutBtn.addEventListener('click', () => { location.href = '/auth/logout'; });
    }

    // Modal elements
    const modalOverlay = document.getElementById('tg-modal-overlay');
    const modalClose = document.getElementById('tg-modal-close');
    const openModalBtn = document.getElementById('open-tg-modal-btn');

    // Steps
    const steps = {
        choice: document.getElementById('tg-step-1'),
        qr: document.getElementById('tg-step-qr'),
        phone: document.getElementById('tg-step-phone'),
        code: document.getElementById('tg-step-code'),
        password: document.getElementById('tg-step-password'),
        email: document.getElementById('tg-step-email'),
        bot: document.getElementById('tg-step-bot'),
        success: document.getElementById('tg-step-success'),
        loading: document.getElementById('tg-step-loading')
    };

    let currentPhone = '';
    let currentToken = '';
    let qrPollInterval = null;
    let qrTimeoutId = null;

    function showStep(stepId) {
        Object.values(steps).forEach(s => s?.classList.remove('active'));
        steps[stepId]?.classList.add('active');
    }

    function openModal() {
        modalOverlay?.classList.add('active');
        showStep('choice');
    }

    function closeModal() {
        modalOverlay?.classList.remove('active');
        stopQrPolling();
    }

    function stopQrPolling() {
        if (qrPollInterval) clearInterval(qrPollInterval);
        if (qrTimeoutId) clearTimeout(qrTimeoutId);
        qrPollInterval = null;
        qrTimeoutId = null;
    }

    if (openModalBtn) {
        openModalBtn.addEventListener('click', () => {
            console.log('Connect Telegram button clicked');
            openModal();
        });
    }
    if (modalClose) {
        modalClose.addEventListener('click', closeModal);
    }

    // Quick Connect buttons
    document.getElementById('quick-qr-btn')?.addEventListener('click', () => {
        openModal();
        document.getElementById('choose-qr-btn')?.click();
    });
    document.getElementById('quick-bot-btn')?.addEventListener('click', () => {
        openModal();
        document.getElementById('choose-bot-btn')?.click();
    });

    // Choice selection
    document.getElementById('choose-qr-btn')?.addEventListener('click', () => {
        showStep('loading');
        document.getElementById('loading-text').innerText = 'Generating QR Code...';

        fetch('/auth/qr-start', { method: 'POST' })
            .then(r => r.json())
            .then(data => {
                if (data.token) {
                    currentToken = data.token;
                    const container = document.getElementById('modal-qr-container');
                    if (container) {
                        if (data.qrDataUrl) {
                            container.innerHTML = `<img src="${data.qrDataUrl}" width="180" height="180" />`;
                        } else if (window.QRCode) {
                            container.innerHTML = '';
                            new QRCode(container, { text: data.qrUrl, width: 180, height: 180 });
                        }
                    }
                    showStep('qr');
                    startQrPolling(data.token);
                } else {
                    alert('Failed to start QR auth: ' + (data.error || 'Unknown error'));
                    showStep('choice');
                }
            })
            .catch(err => {
                console.error(err);
                showStep('choice');
            });
    });

    document.getElementById('choose-phone-btn')?.addEventListener('click', () => {
        showStep('phone');
    });
    document.getElementById('choose-email-btn')?.addEventListener('click', () => {
        showStep('email');
    });
    document.getElementById('choose-bot-btn')?.addEventListener('click', () => {
        showStep('bot');
    });

    document.getElementById('choose-restore-btn')?.addEventListener('click', () => {
        showStep('loading');
        document.getElementById('loading-text').innerText = 'Restoring session...';
        fetch('/dashboard/restart-tg', { method: 'POST' })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    showStep('success');
                    setTimeout(() => location.reload(), 1500);
                } else {
                    alert('Restore failed: ' + data.error);
                    showStep('choice');
                }
            })
            .catch(() => showStep('choice'));
    });

    document.getElementById('back-to-choice-1')?.addEventListener('click', () => { stopQrPolling(); showStep('choice'); });
    document.getElementById('back-to-choice-2')?.addEventListener('click', () => { showStep('choice'); });
    document.getElementById('back-to-choice-3')?.addEventListener('click', () => { showStep('choice'); });
    document.getElementById('back-to-choice-4')?.addEventListener('click', () => { showStep('choice'); });

    // Phone Auth
    const sendCodeBtn = document.getElementById('modal-send-code-btn');
    const phoneInput = document.getElementById('modal-tg-phone');

    if (sendCodeBtn) {
        sendCodeBtn.onclick = () => {
            const phone = phoneInput.value.trim();
            if (!phone) return alert('Please enter phone number');

            showStep('loading');
            document.getElementById('loading-text').innerText = 'Sending code...';

            fetch('/auth/send-code', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone })
            }).then(r => r.json()).then(data => {
                if (data.success) {
                    currentPhone = phone;
                    showStep('code');
                    if (data.requiresPassword) showStep('password');
                } else {
                    alert('Error: ' + data.error);
                    showStep('phone');
                }
            }).catch(e => {
                alert('Connection error');
                showStep('phone');
            });
        };
    }

    const verifyCodeBtn = document.getElementById('modal-verify-code-btn');
    const codeInput = document.getElementById('modal-tg-code');

    if (verifyCodeBtn) {
        verifyCodeBtn.onclick = () => {
            const code = codeInput.value.trim();
            if (!code) return alert('Enter code');

            showStep('loading');
            document.getElementById('loading-text').innerText = 'Verifying...';

            fetch('/auth/verify-code', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: currentPhone, code })
            }).then(r => r.json()).then(data => {
                if (data.success) {
                    showStep('success');
                    setTimeout(() => location.reload(), 1500);

                } else if (data.requiresPassword) {
                    showStep('password');
                } else {
                    alert('Error: ' + data.error);
                    showStep('code');
                }
            }).catch(e => {
                alert('Verification failed');
                showStep('code');
            });
        };
    }

    const verifyPasswordBtn = document.getElementById('modal-verify-password-btn');
    const passwordInput = document.getElementById('modal-tg-password');

    if (verifyPasswordBtn) {
        verifyPasswordBtn.onclick = () => {
            const password = passwordInput.value.trim();
            if (!password) return alert('Enter password');

            showStep('loading');
            document.getElementById('loading-text').innerText = 'Checking password...';

            fetch('/auth/verify-password', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: currentPhone, password })
            }).then(r => r.json()).then(data => {
                if (data.success) {
                    showStep('success');
                    setTimeout(() => location.reload(), 1500);
                } else {
                    alert('Error: ' + data.error);
                    showStep('password');
                }
            }).catch(e => {
                alert('Password check failed');
                showStep('password');
            });
        };
    }

    // Email Auth
    const sendEmailBtn = document.getElementById('modal-send-email-btn');
    const emailInput = document.getElementById('modal-tg-email');
    if (sendEmailBtn) {
        sendEmailBtn.onclick = () => {
            const email = emailInput.value.trim();
            if (!email) return alert('Enter email');
            showStep('loading');
            fetch('/auth/verify-email', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: currentPhone, email })
            }).then(r => r.json()).then(data => {
                if (data.success) {
                    showStep('code'); // Wait for email code
                } else {
                    alert('Error: ' + data.error);
                    showStep('email');
                }
            }).catch(() => showStep('email'));
        };
    }

    // Bot Auth
    const verifyBotBtn = document.getElementById('modal-verify-bot-btn');
    const botInput = document.getElementById('modal-tg-bot-token');
    if (verifyBotBtn) {
        verifyBotBtn.onclick = () => {
            const token = botInput.value.trim();
            if (!token) return alert('Enter bot token');
            showStep('loading');
            fetch('/auth/bot-login', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            }).then(r => r.json()).then(data => {
                if (data.success) {
                    showStep('success');
                    setTimeout(() => location.reload(), 1500);
                } else {
                    alert('Error: ' + data.error);
                    showStep('bot');
                }
            }).catch(() => showStep('bot'));
        };
    }

    function startQrPolling(token) {
        stopQrPolling();

        qrTimeoutId = setTimeout(() => {
            stopQrPolling();
            alert('QR code expired');
            showStep('choice');
        }, 600000); // 10 minutes

        qrPollInterval = setInterval(() => {
            fetch('/auth/qr-check?token=' + token)
                .then(r => r.json())
                .then(s => {
                    if (s.done) {
                        stopQrPolling();
                        showStep('success');
                        setTimeout(() => location.reload(), 1500);

                    } else if (s.expired) {
                        stopQrPolling();
                        alert('QR code expired');
                        showStep('choice');
                    }
                })
                .catch(err => console.error('Polling error:', err));
        }, 2000);
    }

    // Dashboard controls
    const disconnectBtn = document.getElementById('disconnect-tg-btn');
    if (disconnectBtn) {
        disconnectBtn.onclick = () => {
            if (!confirm('Disconnect your Telegram account?')) return;
            fetch('/dashboard/disconnect-tg', { method: 'POST' }).then(() => location.reload());
        };
    }

    const testBtn = document.getElementById('test-tg-btn');
    if (testBtn) {
        testBtn.onclick = () => {
            const originalText = testBtn.innerText;
            testBtn.innerText = 'Sending...';
            testBtn.disabled = true;
            fetch('/dashboard/test-tg', { method: 'POST' })
                .then(r => r.json())
                .then(d => {
                    alert(d.success ? 'Success! Test message sent.' : 'Error: ' + d.error);
                    testBtn.disabled = false;
                    testBtn.innerText = originalText;
                })
                .catch(() => {
                    testBtn.disabled = false;
                    testBtn.innerText = originalText;
                });
        };
    }

    const restartBtn = document.getElementById('restart-tg-btn');
    if (restartBtn) {
        restartBtn.onclick = () => {
            const originalText = restartBtn.innerText;
            restartBtn.innerText = 'Restarting...';
            restartBtn.disabled = true;
            fetch('/dashboard/restart-tg', { method: 'POST' })
                .then(r => r.json())
                .then(d => {
                    if (d.success) {
                        alert('Restart initiated');
                        location.reload();
                    } else {
                        alert('Restart failed: ' + d.error);
                        restartBtn.disabled = false;
                        restartBtn.innerText = originalText;
                    }
                })
                .catch(() => {
                    restartBtn.disabled = false;
                    restartBtn.innerText = originalText;
                });
        };
    }

    // Meta/WA settings
    document.getElementById('save-wa-btn')?.addEventListener('click', () => {
        fetch('/dashboard/save-wa', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                whatsappToken: document.getElementById('wa-token').value,
                whatsappPhoneId: document.getElementById('wa-phone-id').value
            })
        }).then(() => location.reload());
    });

    document.getElementById('connect-meta-btn')?.addEventListener('click', () => {
        location.href = '/auth/meta/login';
    });

    document.getElementById('connect-threads-btn')?.addEventListener('click', () => {
        location.href = '/auth/threads/login';
    });

    // WhatsApp Web Logic
    const connectWaWebBtn = document.getElementById('connect-wa-web-btn');
    const disconnectWaWebBtn = document.getElementById('disconnect-wa-web-btn');
    const waWebQrContainer = document.getElementById('wa-web-qr-container');
    const waWebQrImg = document.getElementById('wa-web-qr-img');
    const waWebStatus = document.getElementById('wa-web-status');

    // WhatsApp method cards (new data-method UI) - replaces old sub-tabs
    const waMethodCards = document.querySelectorAll('.wa-web-card .wa-method-card');
    const waQrPanel = document.getElementById('wa-qr-panel');
    const waPhonePanel = document.getElementById('wa-phone-panel');
    const waWamePanel = document.getElementById('wa-wame-panel');

    const waGetCodeBtn = document.getElementById('wa-get-code-btn');
    const waPhoneNumberInput = document.getElementById('wa-phone-number');
    const waPairingCodeDisplay = document.getElementById('wa-pairing-code-display');
    const waPairingCodeText = document.getElementById('wa-pairing-code-text');
    const disconnectWaCodeBtn = document.getElementById('disconnect-wa-web-code-btn');

    function setWaMethod(method) {
        waMethodCards.forEach(c => c.classList.remove('active'));
        const targetCard = document.querySelector(`.wa-web-card .wa-method-card[data-method="${method}"]`);
        if (targetCard) targetCard.classList.add('active');

        if (waQrPanel) waQrPanel.style.display = (method === 'qr') ? 'block' : 'none';
        if (waPhonePanel) waPhonePanel.style.display = (method === 'phone') ? 'block' : 'none';
        if (waWamePanel) waWamePanel.style.display = (method === 'wame') ? 'block' : 'none';
    }

    waMethodCards.forEach(card => {
        card.addEventListener('click', () => {
            const method = card.dataset.method;
            if (method) setWaMethod(method);
        });
    });

    // default: show QR method panel (most common)
    if (waMethodCards.length) {
        setWaMethod('qr');
    }

    // expose for inline onclick handlers in SSR Preact components
    window.setWaMethod = setWaMethod;

    if (disconnectWaCodeBtn) {
        disconnectWaCodeBtn.addEventListener('click', () => {
            if (disconnectWaWebBtn) disconnectWaWebBtn.click();
        });
    }

    let waQrPollInterval = null;
    let waToken = null;

    function stopWaQrPolling() {
        if (waQrPollInterval) clearInterval(waQrPollInterval);
        waQrPollInterval = null;
    }

    function startWaQrPolling(token) {
        stopWaQrPolling();
        waToken = token || waToken;
        waQrPollInterval = setInterval(() => {
            const url = '/dashboard/whatsapp-web/qr-check?token=' + encodeURIComponent(waToken || '');
            fetch(url)
                .then(r => r.json())
                .then(data => {
                    if (data.done) {
                        stopWaQrPolling();
                        if (waWebQrContainer) waWebQrContainer.style.display = 'none';
                        if (waPairingCodeDisplay) waPairingCodeDisplay.style.display = 'none';
                        waWebStatus.innerText = 'CONNECTED';
                        waWebStatus.className = 'status-tag active';
                        
                        if (disconnectWaWebBtn) disconnectWaWebBtn.style.display = 'block';
                        if (connectWaWebBtn) connectWaWebBtn.style.display = 'none';
                        if (disconnectWaCodeBtn) disconnectWaCodeBtn.style.display = 'block';
                        if (waGetCodeBtn) waGetCodeBtn.style.display = 'none';

                        alert('WhatsApp connected successfully!');
                        setTimeout(() => location.reload(), 1200);
                    } else if (data.expired) {
                        stopWaQrPolling();
                        alert('Link session expired. Please try again.');
                        if (waWebQrContainer) waWebQrContainer.style.display = 'none';
                        if (waPairingCodeDisplay) waPairingCodeDisplay.style.display = 'none';
                        
                        if (connectWaWebBtn) {
                            connectWaWebBtn.disabled = false;
                            connectWaWebBtn.innerText = 'Generate QR Code';
                        }
                        if (waGetCodeBtn) {
                            waGetCodeBtn.disabled = false;
                            waGetCodeBtn.innerText = 'Get Pairing Code';
                        }
                    }
                })
                .catch(err => console.error('WA qr-check poll error:', err));
        }, 2000);
    }

    if (connectWaWebBtn) {
        connectWaWebBtn.addEventListener('click', async () => {
            connectWaWebBtn.disabled = true;
            connectWaWebBtn.innerText = 'Initializing...';
            
            try {
                const initRes = await fetch('/dashboard/whatsapp-web/init', { method: 'POST' });
                const initData = await initRes.json();
                
                if (initData.status === 'starting' || initData.status === 'already_running') {
                    if (initData.qrDataUrl) {
                        waWebQrImg.src = initData.qrDataUrl;
                        waWebQrContainer.style.display = 'block';

                        // Show important info message from backend (e.g. forced reconnect warning)
                        const infoBox = document.getElementById('wa-web-info-box');
                        const infoText = document.getElementById('wa-web-info-text');
                        if (infoBox && infoText && initData.info) {
                            infoText.textContent = initData.info;
                            infoBox.style.display = 'block';
                        }

                        startWaQrPolling(initData.token);
                        connectWaWebBtn.innerText = 'Waiting for scan...';
                    } else if (initData.qrUrl) {
                        waWebQrImg.src = initData.qrUrl;
                        waWebQrContainer.style.display = 'block';

                        const infoBox = document.getElementById('wa-web-info-box');
                        const infoText = document.getElementById('wa-web-info-text');
                        if (infoBox && infoText && initData.info) {
                            infoText.textContent = initData.info;
                            infoBox.style.display = 'block';
                        }

                        startWaQrPolling(initData.token);
                        connectWaWebBtn.innerText = 'Waiting for scan...';
                    } else {
                        const statusRes = await fetch('/dashboard/whatsapp-web/status');
                        const statusData = await statusRes.json();
                        if (statusData.connected) {
                            waWebStatus.innerText = 'CONNECTED';
                            waWebStatus.className = 'status-tag active';
                            disconnectWaWebBtn.style.display = 'block';
                            connectWaWebBtn.style.display = 'none';
                        } else {
                            alert('QR code not available yet. Please wait a few seconds.');
                            connectWaWebBtn.disabled = false;
                            connectWaWebBtn.innerText = 'Generate QR Code';
                        }
                    }
                }
            } catch (e) {
                console.error(e);
                alert('Connection failed');
                connectWaWebBtn.disabled = false;
                connectWaWebBtn.innerText = 'Generate QR Code';
            }
        });
    }

    if (waGetCodeBtn) {
        waGetCodeBtn.addEventListener('click', async () => {
            const phone = waPhoneNumberInput ? waPhoneNumberInput.value.trim() : '';
            if (!phone) {
                return alert('Please enter your phone number');
            }

            waGetCodeBtn.disabled = true;
            waGetCodeBtn.innerText = 'Initializing...';
            if (waPairingCodeDisplay) waPairingCodeDisplay.style.display = 'none';

            try {
                const res = await fetch('/dashboard/whatsapp-web/send-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone })
                });
                const data = await res.json();
                if (data.success && data.code) {
                    waPairingCodeText.innerText = data.code;
                    waPairingCodeDisplay.style.display = 'block';
                    waGetCodeBtn.innerText = 'Waiting for phone link...';
                    startWaQrPolling(data.token);
                } else {
                    alert('Failed to get code: ' + (data.error || 'Unknown error'));
                    waGetCodeBtn.disabled = false;
                    waGetCodeBtn.innerText = 'Get Pairing Code';
                }
            } catch (e) {
                console.error(e);
                alert('Connection error');
                waGetCodeBtn.disabled = false;
                waGetCodeBtn.innerText = 'Get Pairing Code';
            }
        });
    }

    if (disconnectWaWebBtn) {
        disconnectWaWebBtn.addEventListener('click', async () => {
            if (!confirm('Disconnect WhatsApp account?')) return;
            await fetch('/dashboard/whatsapp-web/disconnect', { method: 'POST' });
            location.reload();
        });
    }

    // Facebook FCA Logic — AppState ONLY (credentials are dead, Facebook blocks them)
    const connectFbBtn = document.getElementById('connect-fb-fca-btn');
    const disconnectFbBtn = document.getElementById('disconnect-fb-fca-btn');
    const fbAppstateInput = document.getElementById('fb-appstate');
    const fbStatus = document.getElementById('fb-fca-status');
    const fbAppstateArea = document.getElementById('fb-appstate-area');

    if (connectFbBtn) {
        connectFbBtn.addEventListener('click', async () => {
            const appState = fbAppstateInput ? fbAppstateInput.value.trim() : '';

            if (!appState) {
                return alert('Пожалуйста, вставьте AppState JSON (массив cookies из расширения C3C UFC Utility)');
            }

            let parsed;
            try {
                parsed = JSON.parse(appState);
                if (!Array.isArray(parsed) || parsed.length === 0) {
                    throw new Error('AppState must be a non-empty array');
                }
                // Basic shape check
                const first = parsed[0];
                if (!first || typeof first !== 'object' || !first.key || !first.value) {
                    throw new Error('Invalid cookie format — each item must have "key" and "value"');
                }
            } catch (jsonErr) {
                alert('Неверный AppState JSON: ' + jsonErr.message + '\n\nСкопируйте ровно то, что выдало расширение C3C UFC Utility (начинается с [ { "key": "c_user", ... } ])');
                return;
            }

            connectFbBtn.disabled = true;
            connectFbBtn.innerText = 'Подключение...';

            try {
                const res = await fetch('/dashboard/facebook/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ appState })
                });
                const data = await res.json();
                if (data.success) {
                    fbStatus.innerText = 'CONNECTED';
                    fbStatus.className = 'status-tag active';
                    disconnectFbBtn.style.display = 'block';
                    connectFbBtn.style.display = 'none';
                    if (fbAppstateInput) fbAppstateInput.value = '';
                    if (fbAppstateArea) fbAppstateArea.style.display = 'none';
                    alert('Facebook Messenger успешно подключён!');
                } else {
                    alert('Ошибка подключения: ' + (data.error || 'Unknown error'));
                    connectFbBtn.disabled = false;
                    connectFbBtn.innerText = 'Подключить аккаунт';
                }
            } catch (e) {
                console.error(e);
                alert('Ошибка сети при подключении');
                connectFbBtn.disabled = false;
                connectFbBtn.innerText = 'Подключить аккаунт';
            }
        });
    }

    if (disconnectFbBtn) {
        disconnectFbBtn.addEventListener('click', async () => {
            if (!confirm('Disconnect Facebook Messenger account?')) return;
            try {
                const res = await fetch('/dashboard/facebook/disconnect', { method: 'POST' });
                if (res.ok) {
                    location.reload();
                } else {
                    alert('Failed to disconnect');
                }
            } catch (e) {
                alert('Disconnect error');
            }
        });
    }

    // Instagram FCA Logic — AppState preferred (manager supports it), username/password as fallback
    const connectInstaBtn = document.getElementById('connect-insta-fca-btn');
    const disconnectInstaBtn = document.getElementById('disconnect-insta-fca-btn');
    const instaUsernameInput = document.getElementById('insta-username');
    const instaPasswordInput = document.getElementById('insta-password');
    const instaAppstateInput = document.getElementById('insta-appstate');
    const instaStatus = document.getElementById('insta-fca-status');
    const instaCredsArea = document.getElementById('insta-creds-area');

    if (connectInstaBtn) {
        connectInstaBtn.addEventListener('click', async () => {
            const appState = instaAppstateInput ? instaAppstateInput.value.trim() : '';
            const username = instaUsernameInput ? instaUsernameInput.value.trim() : '';
            const password = instaPasswordInput ? instaPasswordInput.value.trim() : '';

            let payload;
            if (appState) {
                try {
                    const parsed = JSON.parse(appState);
                    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('empty array');
                } catch (e) {
                    return alert('Неверный AppState JSON для Instagram: ' + e.message);
                }
                payload = { appState };
            } else if (username && password) {
                payload = { username, password };
            } else {
                return alert('Вставьте AppState JSON или введите username + password для Instagram');
            }

            connectInstaBtn.disabled = true;
            connectInstaBtn.innerText = 'Подключение...';

            try {
                const res = await fetch('/dashboard/instagram/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (data.success) {
                    instaStatus.innerText = 'CONNECTED';
                    instaStatus.className = 'status-tag active';
                    disconnectInstaBtn.style.display = 'block';
                    connectInstaBtn.style.display = 'none';
                    if (instaAppstateInput) instaAppstateInput.value = '';
                    if (instaCredsArea) instaCredsArea.style.display = 'none';
                    if (instaUsernameInput) instaUsernameInput.value = '';
                    if (instaPasswordInput) instaPasswordInput.value = '';
                    alert('Instagram успешно подключён!');
                } else {
                    alert('Ошибка подключения Instagram: ' + (data.error || 'Unknown error'));
                    connectInstaBtn.disabled = false;
                    connectInstaBtn.innerText = 'Подключить';
                }
            } catch (e) {
                console.error(e);
                alert('Ошибка сети');
                connectInstaBtn.disabled = false;
                connectInstaBtn.innerText = 'Подключить';
            }
        });
    }

    if (disconnectInstaBtn) {
        disconnectInstaBtn.addEventListener('click', async () => {
            if (!confirm('Disconnect Instagram account?')) return;
            try {
                const res = await fetch('/dashboard/instagram/disconnect', { method: 'POST' });
                if (res.ok) {
                    location.reload();
                } else {
                    alert('Failed to disconnect');
                }
            } catch (e) {
                alert('Disconnect error');
            }
        });
    }

    // Initial status check on load
    window.addEventListener('load', async () => {
        const res = await fetch('/dashboard/whatsapp-web/status');
        const data = await res.json();
        if (data.connected) {
            if (waWebStatus) {
                waWebStatus.innerText = 'CONNECTED';
                waWebStatus.className = 'status-tag active';
            }
            if (disconnectWaWebBtn) disconnectWaWebBtn.style.display = 'block';
            if (connectWaWebBtn) connectWaWebBtn.style.display = 'none';
            if (disconnectWaCodeBtn) disconnectWaCodeBtn.style.display = 'block';
            if (waGetCodeBtn) waGetCodeBtn.style.display = 'none';

            // hide the method selector cards when already connected
            const waGrid = document.querySelector('.wa-web-card .wa-methods-grid');
            if (waGrid) waGrid.style.display = 'none';
            // also collapse any open panel
            if (waQrPanel) waQrPanel.style.display = 'none';
            if (waPhonePanel) waPhonePanel.style.display = 'none';
            if (waWamePanel) waWamePanel.style.display = 'none';
        }
    
        // Check FB status
        const fbRes = await fetch('/dashboard/facebook/status');
        const fbData = await fbRes.json();
        if (fbData.connected) {
            if (fbStatus) {
                fbStatus.innerText = 'CONNECTED';
                fbStatus.className = 'status-tag active';
            }
            if (disconnectFbBtn) disconnectFbBtn.style.display = 'block';
            if (connectFbBtn) connectFbBtn.style.display = 'none';

            // hide method selector cards when already connected
            const fbGrid = document.querySelector('.fb-fca-card .wa-methods-grid');
            if (fbGrid) fbGrid.style.display = 'none';
        }
    
        // Check Instagram status
        const instaRes = await fetch('/dashboard/instagram/status');
        const instaData = await instaRes.json();
        if (instaData.connected) {
            if (instaStatus) {
                instaStatus.innerText = 'CONNECTED';
                instaStatus.className = 'status-tag active';
            }
            if (disconnectInstaBtn) disconnectInstaBtn.style.display = 'block';
            if (connectInstaBtn) connectInstaBtn.style.display = 'none';
            const instaCredsArea = document.getElementById('insta-creds-area');
            if (instaCredsArea) instaCredsArea.style.display = 'none';
            const instaAppArea = document.getElementById('insta-appstate-area');
            if (instaAppArea) instaAppArea.style.display = 'none';
        }
    });
    
    const tabMeta = {
        connections: {
            title: 'Connections',
            subtitle: 'Manage your linked accounts and messaging channels'
        },
        stats: {
            title: 'Statistics',
            subtitle: 'Real-time overview of your voice message transcriptions'
        },
        profile: {
            title: 'Profile Settings',
            subtitle: 'Update your password and manage account security'
        },
        referrals: {
            title: 'Referrals Program',
            subtitle: 'Invite your colleagues and earn recurring commission'
        },
        billing: {
            title: 'Plan & Billing',
            subtitle: 'Check your active package and billing invoices'
        }
    };

    function switchTab(targetTab) {
        if (!targetTab) return;
        
        // Update active states on buttons
        tabButtons.forEach(b => {
            if (b.getAttribute('data-tab') === targetTab) {
                b.classList.add('active');
            } else {
                b.classList.remove('active');
            }
        });

        // Update active states on panes
        tabPanes.forEach(pane => {
            pane.classList.remove('active');
        });
        const targetPane = document.getElementById(`pane-${targetTab}`);
        if (targetPane) {
            targetPane.classList.add('active');
        }

        // Update titles
        if (sectionTitle && tabMeta[targetTab]) {
            sectionTitle.textContent = tabMeta[targetTab].title;
        }
        if (sectionSubtitle && tabMeta[targetTab]) {
            sectionSubtitle.textContent = tabMeta[targetTab].subtitle;
        }

        if (targetTab === 'stats') {
            fetchStats();
        }

        // Smooth scroll to top on content change
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    tabButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTab = btn.getAttribute('data-tab');
            if (!targetTab) return;
            
            const href = btn.getAttribute('href') || ('/dashboard' + (targetTab === 'connections' ? '' : '/' + targetTab));
            history.pushState({ tab: targetTab }, '', href);
            switchTab(targetTab);
        });
    });

    window.addEventListener('popstate', (e) => {
        if (e.state && e.state.tab) {
            switchTab(e.state.tab);
        } else {
            // Fallback parsing from URL
            const path = window.location.pathname;
            let tab = 'connections';
            if (path.includes('/stats')) tab = 'stats';
            if (path.includes('/profile')) tab = 'profile';
            if (path.includes('/referrals')) tab = 'referrals';
            if (path.includes('/billing')) tab = 'billing';
            switchTab(tab);
        }
    });

    // Initial load handling
    const initialPath = window.location.pathname;
    let initialTab = 'connections';
    if (initialPath.includes('/stats')) initialTab = 'stats';
    if (initialPath.includes('/profile')) initialTab = 'profile';
    if (initialPath.includes('/referrals')) initialTab = 'referrals';
    if (initialPath.includes('/billing')) initialTab = 'billing';
    switchTab(initialTab);


    // Profile Settings: Change Password
    const savePwdBtn = document.getElementById('save-pwd-btn');
    if (savePwdBtn) {
        savePwdBtn.addEventListener('click', () => {
            const oldPwdEl = document.getElementById('profile-old-pwd');
            const newPwdEl = document.getElementById('profile-new-pwd');
            const confirmPwdEl = document.getElementById('profile-confirm-pwd');

            const oldPassword = oldPwdEl ? oldPwdEl.value.trim() : '';
            const newPassword = newPwdEl ? newPwdEl.value.trim() : '';
            const confirmPassword = confirmPwdEl ? confirmPwdEl.value.trim() : '';

            if (oldPwdEl && !oldPassword) {
                return alert('Please enter your current password.');
            }
            if (!newPassword || newPassword.length < 6) {
                return alert('New password must be at least 6 characters long.');
            }
            if (newPassword !== confirmPassword) {
                return alert('New passwords do not match.');
            }

            const originalText = savePwdBtn.innerText;
            savePwdBtn.innerText = 'Updating...';
            savePwdBtn.disabled = true;

            fetch('/dashboard/profile/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ oldPassword, newPassword })
            })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    alert(data.message || 'Password updated successfully!');
                    if (oldPwdEl) oldPwdEl.value = '';
                    if (newPwdEl) newPwdEl.value = '';
                    if (confirmPwdEl) confirmPwdEl.value = '';
                } else {
                    alert('Error: ' + data.error);
                }
            })
            .catch(() => alert('Failed to update password.'))
            .finally(() => {
                savePwdBtn.innerText = originalText;
                savePwdBtn.disabled = false;
            });
        });
    }

    // Profile Settings: Delete Account
    const deleteAgreeCheck = document.getElementById('profile-delete-agree');
    const deleteAccountBtn = document.getElementById('profile-delete-btn');

    if (deleteAgreeCheck && deleteAccountBtn) {
        deleteAgreeCheck.addEventListener('change', () => {
            deleteAccountBtn.disabled = !deleteAgreeCheck.checked;
        });

        deleteAccountBtn.addEventListener('click', () => {
            if (!deleteAgreeCheck.checked) return;

            const confirmTyped = prompt('WARNING: This action is permanent and completely irreversible.\nTo confirm account deletion, please type "DELETE" below:');
            if (confirmTyped !== 'DELETE') {
                return alert('Confirmation mismatch. Deletion cancelled.');
            }

            deleteAccountBtn.innerText = 'Deleting Account...';
            deleteAccountBtn.disabled = true;

            fetch('/dashboard/profile/delete-account', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    alert('Your account has been deleted. Redirecting you to home.');
                    location.href = '/';
                } else {
                    alert('Deletion failed: ' + data.error);
                    deleteAccountBtn.innerText = 'Delete My Entire Account';
                    deleteAccountBtn.disabled = false;
                }
            })
            .catch(() => {
                alert('Connection error during deletion.');
                deleteAccountBtn.innerText = 'Delete My Entire Account';
                deleteAccountBtn.disabled = false;
            });
        });
    }

    // Copy Referral Link
    const refCopyBtn = document.getElementById('ref-copy-btn');
    const refLinkText = document.getElementById('ref-link-text');
    if (refCopyBtn && refLinkText) {
        refCopyBtn.addEventListener('click', () => {
            const textToCopy = refLinkText.innerText.trim();
            navigator.clipboard.writeText(textToCopy)
                .then(() => {
                    const originalText = refCopyBtn.innerText;
                    refCopyBtn.innerText = '✓';
                    setTimeout(() => {
                        refCopyBtn.innerText = originalText;
                    }, 2000);
                })
                .catch(() => alert('Failed to copy link.'));
        });
    }

    // Generate referral QR code on load
    const refQrCode = document.getElementById('ref-qr-code');
    if (refQrCode && refLinkText) {
        const refUrl = refLinkText.innerText.trim();
        setTimeout(() => {
            if (window.QRCode) {
                new QRCode(refQrCode, {
                    text: refUrl,
                    width: 180,
                    height: 180,
                    colorDark: '#000000',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.H
                });
            }
        }, 100);
    }

    async function fetchStats() {
        try {
            const res = await fetch('/dashboard/api/stats');
            const data = await res.json();
            
            if (data.success) {
                const tableBody = document.getElementById('stats-history-table');
                if (tableBody) {
                    if (data.logs && data.logs.length > 0) {
                        tableBody.innerHTML = data.logs.map(log => `
                            <tr style="border-bottom: 1px solid var(--border-color)">
                                <td style="padding: 12px; color: var(--text-color)">${new Date(log.createdAt).toLocaleString()}</td>
                                <td style="padding: 12px; color: var(--text-color); text-transform: capitalize;">${log.platform}</td>
                                <td style="padding: 12px; color: var(--text-color); text-transform: capitalize;">${log.action}</td>
                                <td style="padding: 12px; color: var(--text-dim)">${log.inputLanguage || '?'} → ${log.outputLanguage || '?'}</td>
                                <td style="padding: 12px; color: var(--text-color)">${log.charactersCount || 0}</td>
                                <td style="padding: 12px; color: var(--text-color)">${log.durationSeconds || 0}</td>
                            </tr>
                        `).join('');
                    } else {
                        tableBody.innerHTML = '<tr><td colspan="6" style="padding: 20px; text-align: center; color: var(--text-dim)">No transcription history yet.</td></tr>';
                    }
                }

                const chartContainer = document.getElementById('daily-chart-container');
                if (chartContainer && data.dailyStats) {
                    if (data.dailyStats.length > 0) {
                        const maxCount = Math.max(...data.dailyStats.map(d => d.count), 1);
                        chartContainer.innerHTML = data.dailyStats.map(d => {
                            const height = Math.max((d.count / maxCount) * 110, 15); // min 15px
                            const dateObj = new Date(d._id);
                            const dayLabel = dateObj.toLocaleDateString(undefined, { weekday: 'short' });
                            return `
                                <div class="bar-item">
                                    <div class="bar-value" style="height: ${height}px;" title="${d.count} requests, ${d.chars} chars"><span class="bar-text">${d.count}</span></div>
                                    <div class="bar-label">${dayLabel}</div>
                                </div>
                            `;
                        }).join('');
                    } else {
                        chartContainer.innerHTML = '<div style="text-align: center; color: var(--text-dim); padding: 40px;">Not enough data for chart</div>';
                    }
                }
            }
        } catch (e) {
            console.error('Failed to fetch stats:', e);
        }
    }

    // ─── Voice & Transcription Settings ─────────────────────────────────────────────
    function updateVoiceStatusBadge(state) {
        const statusEl = document.getElementById('voice-settings-status-badge');
        if (!statusEl) return;
        statusEl.style.display = 'inline-block';
        if (state === 'saving') {
            statusEl.textContent = 'SAVING...';
            statusEl.className = 'status-tag inactive';
        } else if (state === 'saved') {
            statusEl.textContent = '✓ SAVED';
            statusEl.className = 'status-tag active';
            setTimeout(() => {
                if (statusEl.textContent === '✓ SAVED') {
                    statusEl.style.display = 'none';
                }
            }, 2000);
        } else {
            statusEl.textContent = 'ERROR';
            statusEl.className = 'status-tag inactive';
        }
    }

    const handleSave = () => {
        const transLangSelect = document.getElementById('translation-lang-select');
        const ttsLangSelect = document.getElementById('tts-translation-lang-select');
        const asrLangSelect = document.getElementById('asr-lang-select');
        const cloneStrategySelect = document.getElementById('clone-strategy-select');

        const translate_lang = transLangSelect ? transLangSelect.value : undefined;
        const tts_translate_lang = ttsLangSelect ? ttsLangSelect.value : undefined;
        const asr_lang = asrLangSelect ? asrLangSelect.value : undefined;
        const clone_strategy = cloneStrategySelect ? cloneStrategySelect.value : undefined;
        
        updateVoiceStatusBadge('saving');

        fetch('/dashboard/voice-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ translate_lang, tts_translate_lang, asr_lang, clone_strategy })
        })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                updateVoiceStatusBadge('saved');
            } else {
                updateVoiceStatusBadge('error');
                alert('Error: ' + (data.error || 'Unknown'));
            }
        })
        .catch(() => {
            updateVoiceStatusBadge('error');
            alert('Connection error');
        });
    };

    // Load initial settings
    fetch('/dashboard/voice-settings')
        .then(r => r.json())
        .then(data => {
            const transLangSelect = document.getElementById('translation-lang-select');
            const ttsLangSelect = document.getElementById('tts-translation-lang-select');
            const asrLangSelect = document.getElementById('asr-lang-select');
            const cloneStrategySelect = document.getElementById('clone-strategy-select');

            if (transLangSelect) transLangSelect.value = data.translate_lang || 'translate_off';
            if (ttsLangSelect) ttsLangSelect.value = data.tts_translate_lang || 'translate_off';
            if (asrLangSelect) asrLangSelect.value = data.asr_lang || 'auto';
            if (cloneStrategySelect) cloneStrategySelect.value = data.clone_strategy || 'zero_shot';
        })
        .catch(err => console.error('[voice-settings] Load error:', err));

    // Use event delegation to survive Preact DOM hydration
    document.addEventListener('change', (e) => {
        const targetId = e.target && e.target.id;
        if (targetId === 'translation-lang-select' || 
            targetId === 'tts-translation-lang-select' || 
            targetId === 'asr-lang-select' || 
            targetId === 'clone-strategy-select') {
            handleSave();
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboard);
} else {
    initDashboard();
}
