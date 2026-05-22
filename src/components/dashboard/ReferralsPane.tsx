/** @jsxImportSource preact */
import type { PaneProps } from './Dashboard.types';

export function ReferralsPane({ user }: PaneProps) {
    return (
        <div class="tab-pane" id="pane-referrals">
            <div class="card referrals-welcome-card">
                <div class="referrals-banner-content">
                    <h2>🎁 Refer a Friend & Get 20% Recurring Commission!</h2>
                    <p>Share your personalized referral code. If your referrals upgrade to the Pro plan, you will continuously earn 20% of their subscription value paid out monthly.</p>
                </div>
            </div>

            <div class="grid referrals-stats-grid" style={{ marginTop: '1.5rem' }}>
                <div class="card ref-link-card">
                    <div class="card-header">
                        <h3 class="card-title">Share Your Referral Link</h3>
                    </div>
                    <div class="card-content">
                        <p class="card-description">Copy this link and send it to your friends or share on social media.</p>
                        <div class="copy-box ref-copy-box">
                            <code id="ref-link-text" onClick={() => navigator.clipboard.writeText(`https://voicemsg.net/ref/${user.userId.substring(0, 8)}`)}>
                                https://voicemsg.net/ref/{user.userId.substring(0, 8)}
                            </code>
                            <button class="copy-btn" id="ref-copy-btn" onClick={() => navigator.clipboard.writeText(`https://voicemsg.net/ref/${user.userId.substring(0, 8)}`)}>📋</button>
                        </div>
                        <div class="referral-social-share" style={{ marginTop: '1.25rem' }}>
                            <span class="social-share-title">Quick Share:</span>
                            <div class="social-buttons">
                                <button class="btn btn-secondary btn-xs">Telegram</button>
                                <button class="btn btn-secondary btn-xs">Twitter</button>
                                <button class="btn btn-secondary btn-xs">WhatsApp</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="card ref-metrics-card">
                    <div class="card-header">
                        <h3 class="card-title">Earnings & Statistics</h3>
                    </div>
                    <div class="card-content">
                        <div class="metrics-grid">
                            <div class="metric-item">
                                <span class="metric-val">12</span>
                                <span class="metric-lbl">Total Invited</span>
                            </div>
                            <div class="metric-item">
                                <span class="metric-val">3</span>
                                <span class="metric-lbl">Pro Referrals</span>
                            </div>
                            <div class="metric-item">
                                <span class="metric-val">$14.50</span>
                                <span class="metric-lbl">Earned Balance</span>
                            </div>
                        </div>
                        <button class="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => alert('Withdrawals are processed automatically once the balance exceeds $50.00 USD.')}>
                            Request Payout (Min $50)
                        </button>
                    </div>
                </div>
            </div>

            <div class="card ref-list-card" style={{ marginTop: '1.5rem' }}>
                <div class="card-header">
                    <h3 class="card-title">Recent Referrals List</h3>
                </div>
                <div class="card-content">
                    <div class="user-table-container">
                        <table class="user-table">
                            <thead>
                                <tr>
                                    <th>User Name</th>
                                    <th>Date Joined</th>
                                    <th>Referral Plan</th>
                                    <th>Monthly Pay</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>alex_k****@gmail.com</td>
                                    <td>May 14, 2026</td>
                                    <td>Pro Tier</td>
                                    <td>$2.00 / mo</td>
                                    <td><span class="status-tag active">ACTIVE</span></td>
                                </tr>
                                <tr>
                                    <td>natasha_****@mail.ru</td>
                                    <td>May 10, 2026</td>
                                    <td>Free Tier</td>
                                    <td>$0.00</td>
                                    <td><span class="status-tag active">ACTIVE</span></td>
                                </tr>
                                <tr>
                                    <td>dmitry_p****@yandex.ru</td>
                                    <td>April 28, 2026</td>
                                    <td>Pro Tier</td>
                                    <td>$2.00 / mo</td>
                                    <td><span class="status-tag active">ACTIVE</span></td>
                                </tr>
                                <tr>
                                    <td>serg****@outlook.com</td>
                                    <td>April 15, 2026</td>
                                    <td>Free Tier</td>
                                    <td>$0.00</td>
                                    <td><span class="status-tag inactive">EXPIRED</span></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
