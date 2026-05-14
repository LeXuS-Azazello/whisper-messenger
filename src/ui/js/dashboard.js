document.addEventListener('DOMContentLoaded', function() {
    // Basic elements
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => { location.href = '/auth/logout'; });
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

    document.getElementById('back-to-choice-1')?.addEventListener('click', () => { stopQrPolling(); showStep('choice'); });
    document.getElementById('back-to-choice-2')?.addEventListener('click', () => { showStep('choice'); });

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

    function startQrPolling(token) {
        stopQrPolling();
        
        qrTimeoutId = setTimeout(() => {
            stopQrPolling();
            alert('QR code expired');
            showStep('choice');
        }, 300000); // 5 minutes

        qrPollInterval = setInterval(() => {
            fetch('/auth/qr-check?token=' + token)
                .then(r => r.json())
                .then(s => {
                    if (s.done) {
                        stopQrPolling();
                        showStep('success');
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
            testBtn.disabled = true;
            fetch('/dashboard/test-tg', { method: 'POST' })
                .then(r => r.json())
                .then(d => {
                    alert(d.success ? 'Success! Test message sent.' : 'Error: ' + d.error);
                    testBtn.disabled = false;
                });
        };
    }

    const restartBtn = document.getElementById('restart-tg-btn');
    if (restartBtn) {
        restartBtn.onclick = () => {
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
                    }
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
});
