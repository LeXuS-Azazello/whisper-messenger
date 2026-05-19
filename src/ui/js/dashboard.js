document.addEventListener('DOMContentLoaded', function () {
    // Basic elements
    const logoutBtn = document.getElementById('logout-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const tabButtons = document.querySelectorAll('.tab-btn');
    const sectionTitle = document.getElementById('current-section-title');
    const sectionSubtitle = document.getElementById('current-section-subtitle');
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
        }, 300000); // 5 minutes

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

    let waQrPollInterval = null;

    function stopWaQrPolling() {
        if (waQrPollInterval) clearInterval(waQrPollInterval);
        waQrPollInterval = null;
    }

    function startWaQrPolling() {
        stopWaQrPolling();
        waQrPollInterval = setInterval(() => {
            fetch('/dashboard/whatsapp-web/status')
                .then(r => r.json())
                .then(data => {
                    if (data.connected) {
                        stopWaQrPolling();
                        document.getElementById('wa-web-qr-container').style.display = 'none';
                        waWebStatus.innerText = 'CONNECTED';
                        waWebStatus.className = 'status-tag active';
                        disconnectWaWebBtn.style.display = 'block';
                        connectWaWebBtn.style.display = 'none';
                        alert('WhatsApp connected successfully!');
                    }
                })
                .catch(err => console.error('WA status poll error:', err));
        }, 3000);
    }

    if (connectWaWebBtn) {
        connectWaWebBtn.addEventListener('click', async () => {
            connectWaWebBtn.disabled = true;
            connectWaWebBtn.innerText = 'Initializing...';
            
            try {
                const initRes = await fetch('/dashboard/whatsapp-web/init', { method: 'POST' });
                const initData = await initRes.json();
                
                if (initData.status === 'starting' || initData.status === 'already_running') {
                    const qrRes = await fetch('/dashboard/whatsapp-web/qr');
                    const qrData = await qrRes.json();
                    
                    if (qrData.qr) {
                        waWebQrImg.src = qrData.qr;
                        waWebQrContainer.style.display = 'block';
                        startWaQrPolling();
                        connectWaWebBtn.innerText = 'Waiting for scan...';
                    } else {
                        // Check if already connected
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
                            connectWaWebBtn.innerText = 'Connect via QR Code';
                        }
                    }
                }
            } catch (e) {
                console.error(e);
                alert('Connection failed');
                connectWaWebBtn.disabled = false;
                connectWaWebBtn.innerText = 'Connect via QR Code';
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

    // Facebook FCA Logic
    const connectFbBtn = document.getElementById('connect-fb-fca-btn');
    const disconnectFbBtn = document.getElementById('disconnect-fb-fca-btn');
    const fbAppstateInput = document.getElementById('fb-appstate');
    const fbEmailInput = document.getElementById('fb-email');
    const fbPasswordInput = document.getElementById('fb-password');
    const fbStatus = document.getElementById('fb-fca-status');

    if (connectFbBtn) {
        connectFbBtn.addEventListener('click', async () => {
            const appState = fbAppstateInput ? fbAppstateInput.value.trim() : '';
            const email = fbEmailInput ? fbEmailInput.value.trim() : '';
            const password = fbPasswordInput ? fbPasswordInput.value.trim() : '';

            if (!appState && (!email || !password)) {
                return alert('Please enter AppState JSON or Email & Password');
            }

            connectFbBtn.disabled = true;
            connectFbBtn.innerText = 'Connecting...';

            try {
                const res = await fetch('/dashboard/facebook/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password, appState })
                });
                const data = await res.json();
                if (data.success) {
                    fbStatus.innerText = 'CONNECTED';
                    fbStatus.className = 'status-tag active';
                    disconnectFbBtn.style.display = 'block';
                    connectFbBtn.style.display = 'none';
                    if (fbAppstateInput) fbAppstateInput.value = '';
                    if (fbEmailInput) fbEmailInput.value = '';
                    if (fbPasswordInput) fbPasswordInput.value = '';
                    alert('Facebook Messenger connected successfully!');
                } else {
                    alert('Connection failed: ' + (data.error || 'Unknown error'));
                    connectFbBtn.disabled = false;
                    connectFbBtn.innerText = 'Connect Account';
                }
            } catch (e) {
                console.error(e);
                alert('Connection error');
                connectFbBtn.disabled = false;
                connectFbBtn.innerText = 'Connect Account';
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

    // Instagram FCA Logic
    const connectInstaBtn = document.getElementById('connect-insta-fca-btn');
    const disconnectInstaBtn = document.getElementById('disconnect-insta-fca-btn');
    const instaUsernameInput = document.getElementById('insta-username');
    const instaPasswordInput = document.getElementById('insta-password');
    const instaStatus = document.getElementById('insta-fca-status');

    if (connectInstaBtn) {
        connectInstaBtn.addEventListener('click', async () => {
            const username = instaUsernameInput ? instaUsernameInput.value.trim() : '';
            const password = instaPasswordInput ? instaPasswordInput.value.trim() : '';

            if (!username || !password) {
                return alert('Please enter Instagram username and password');
            }

            connectInstaBtn.disabled = true;
            connectInstaBtn.innerText = 'Connecting...';

            try {
                const res = await fetch('/dashboard/instagram/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await res.json();
                if (data.success) {
                    instaStatus.innerText = 'CONNECTED';
                    instaStatus.className = 'status-tag active';
                    disconnectInstaBtn.style.display = 'block';
                    connectInstaBtn.style.display = 'none';
                    if (instaUsernameInput) instaUsernameInput.value = '';
                    if (instaPasswordInput) instaPasswordInput.value = '';
                    alert('Instagram connected successfully!');
                } else {
                    alert('Connection failed: ' + (data.error || 'Unknown error'));
                    connectInstaBtn.disabled = false;
                    connectInstaBtn.innerText = 'Connect Account';
                }
            } catch (e) {
                console.error(e);
                alert('Connection error');
                connectInstaBtn.disabled = false;
                connectInstaBtn.innerText = 'Connect Account';
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
            waWebStatus.innerText = 'CONNECTED';
            waWebStatus.className = 'status-tag active';
            disconnectWaWebBtn.style.display = 'block';
            connectWaWebBtn.style.display = 'none';
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

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
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

            // Smooth scroll to top on content change
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });

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
});
