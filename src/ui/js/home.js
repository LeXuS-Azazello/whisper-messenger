import { getTdClient, startQrLogin, tryRestoreSession, closeTdClient } from './tdlib.js';

document.addEventListener('DOMContentLoaded', function () {
    const sessionMatch = document.cookie.match(/session=([^;]+)/);
    if (sessionMatch) {
        window.location.href = '/dashboard';
        return;
    }

    const qrBtn = document.getElementById('qr-login-btn');
    const restoreBtn = document.getElementById('restore-session-btn');
    const qrContainer = document.getElementById('qr-container');
    const qrImg = document.getElementById('qr-img');
    const statusMsg = document.getElementById('status-msg');

    // QR Code login
    if (qrBtn) {
        qrBtn.onclick = async () => {
            qrBtn.disabled = true;
            qrBtn.innerText = 'Connecting to Telegram...';
            statusMsg.innerText = '';

            try {
                const client = getTdClient(async (update) => {
                    if (update['@type'] === 'updateAuthorizationState') {
                        const state = update.authorization_state;
                        const type = state['@type'] || state['_'];

                        console.log('[home] Auth state update:', type);

                        // States where we can request QR code
                        const canRequestQR = [
                            'authorizationStateWaitPhoneNumber',
                            'authorizationStateWaitPremiumPurchase',
                            'authorizationStateWaitEmailAddress',
                            'authorizationStateWaitEmailCode',
                            'authorizationStateWaitCode',
                            'authorizationStateWaitRegistration',
                            'authorizationStateWaitPassword'
                        ].includes(type);

                        if (canRequestQR) {
                            const { requestQR } = await import('./tdlib.js');
                            requestQR(client).catch(err => {
                                console.error('[home] Failed to request QR:', err);
                            });
                        }

                        if (type === 'authorizationStateWaitOtherDeviceConfirmation') {
                            const link = state.link;
                            qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(link)}`;
                            qrContainer.style.display = 'block';
                            statusMsg.innerText = 'Scan this QR code with your Telegram app';
                            qrBtn.innerText = 'Login with Telegram QR Code';
                        }

                        if (type === 'authorizationStateReady') {
                            statusMsg.innerText = 'Login successful!';
                            setTimeout(() => window.location.href = '/dashboard', 600);
                            closeTdClient();
                        }

                        if (type === 'authorizationStateWaitPassword') {
                            statusMsg.innerText = '2FA password required (please check your phone)';
                        }

                        if (type === 'authorizationStateWaitEmailAddress' || type === 'authorizationStateWaitEmailCode') {
                            statusMsg.innerText = 'Email verification required';
                        }
                    }
                });

                await startQrLogin();
            } catch (e) {
                statusMsg.innerText = 'Error: ' + e.message;
                qrBtn.disabled = false;
                qrBtn.innerText = 'Login with QR Code';
            }
        };
    }

    // Restore Session (existing logged-in device)
    if (restoreBtn) {
        restoreBtn.onclick = async () => {
            restoreBtn.disabled = true;
            restoreBtn.innerText = 'Checking session...';
            statusMsg.innerText = '';

            try {
                const client = getTdClient((update) => {
                    if (update['@type'] === 'updateAuthorizationState') {
                        const type = update.authorization_state['@type'];

                        if (type === 'authorizationStateReady') {
                            statusMsg.innerText = 'Session restored! Redirecting...';
                            setTimeout(() => window.location.href = '/dashboard', 500);
                            closeTdClient();
                        }

                        if (type === 'authorizationStateWaitPhoneNumber') {
                            statusMsg.innerText = 'No saved session found. Use QR code instead.';
                            restoreBtn.disabled = false;
                            restoreBtn.innerText = 'Restore Session';
                        }
                    }
                });

                await tryRestoreSession();
            } catch (e) {
                statusMsg.innerText = 'No session found: ' + e.message;
                restoreBtn.disabled = false;
                restoreBtn.innerText = 'Restore Session';
            }
        };
    }
});