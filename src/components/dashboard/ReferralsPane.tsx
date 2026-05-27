/** @jsxImportSource preact */
import type { PaneProps } from './Dashboard.types';

export function ReferralsPane({ user }: PaneProps) {
    const refLink = `https://voicemsg.net/ref/${user.userId.substring(0, 8)}`;

    return (
        <div class="tab-pane" id="pane-referrals">
            <div class="card referrals-welcome-card">
                <div class="referrals-banner-content">
                    <h2>🎁 Invite Friends</h2>
                    <p>Share your QR code or link. New users get a bonus, and you earn rewards!</p>
                </div>
            </div>

            <div class="grid referrals-stats-grid" style={{ marginTop: '1.5rem' }}>
                <div class="card ref-link-card">
                    <div class="card-header">
                        <h3 class="card-title">Your Referral Entry</h3>
                    </div>
                    <div class="card-content">
                        <div class="qr-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                            <div id="ref-qr-code" style={{ background: 'white', padding: '10px', borderRadius: '12px', display: 'inline-block' }}></div>
                            <div class="copy-box ref-copy-box" style={{ width: '100%' }}>
                                <code id="ref-link-text" onClick={() => navigator.clipboard.writeText(refLink)}>
                                    {refLink}
                                </code>
                                <button class="copy-btn" id="ref-copy-btn" onClick={() => navigator.clipboard.writeText(refLink)}>📋</button>
                            </div>
                        </div>
                        <p class="card-description" style={{ marginTop: '1rem', textAlign: 'center' }}>Scan the QR code to join instantly</p>
                    </div>
                </div>

                <div class="card ref-metrics-card">
                    <div class="card-header">
                        <h3 class="card-title">Statistics</h3>
                    </div>
                    <div class="card-content">
                        <div class="metrics-grid">
                            <div class="metric-item">
                                <span class="metric-val">12</span>
                                <span class="metric-lbl">Total Invited</span>
                            </div>
                            <div class="metric-item">
                                <span class="metric-val">3</span>
                                <span class="metric-lbl">Active Users</span>
                            </div>
                            <div class="metric-item">
                                <span class="metric-val">$14.50</span>
                                <span class="metric-lbl">Earned</span>
                            </div>
                        </div>
                        <button class="btn btn-primary" style={{ marginTop: '1rem', width: '100%' }} onClick={() => alert('Withdrawals are processed automatically once the balance exceeds $50.00 USD.')}>
                            Request Payout
                        </button>
                    </div>
                </div>
            </div>

            <div class="card ref-list-card" style={{ marginTop: '1.5rem' }}>
                <div class="card-header">
                    <h3 class="card-title">Recent Referrals</h3>
                </div>
                <div class="card-content">
                    <div class="user-table-container">
                        <table class="user-table">
                            <thead>
                                <tr>
                                    <th>User</th>
                                    <th>Joined</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>alex_k****@gmail.com</td>
                                    <td>May 14, 2026</td>
                                    <td><span class="status-tag active">ACTIVE</span></td>
                                </tr>
                                <tr>
                                    <td>natasha_****@mail.ru</td>
                                    <td>May 10, 2026</td>
                                    <td><span class="status-tag active">ACTIVE</span></td>
                                </tr>
                                <tr>
                                    <td>dmitry_p****@yandex.ru</td>
                                    <td>April 28, 2026</td>
                                    <td><span class="status-tag active">ACTIVE</span></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
