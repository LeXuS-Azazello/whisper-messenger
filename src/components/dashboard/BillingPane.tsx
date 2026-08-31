/** @jsxImportSource preact */
import type { PaneProps } from './Dashboard.types';

export function BillingPane({ user, env, billingConfig = {} }: PaneProps) {
    const priceTranscription = billingConfig.priceTranscription || 0.01;
    const priceWord = billingConfig.priceWord || 0.001;

    return (
        <div class="tab-pane" id="pane-billing">
            <div class="grid billing-overview-grid">
                <div class="card billing-plan-card">
                    <div class="card-header">
                        <h3 class="card-title">💳 Current Balance</h3>
                        <span class="status-tag active">Active</span>
                    </div>
                    <div class="card-content">
                        <div class="billing-details-summary">
                            <div class="plan-meta-stats" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div class="plan-meta-item" style={{ fontSize: '1.2rem' }}>
                                    <span>Available Balance:</span>
                                    <strong style={{ fontSize: '1.5rem', color: '#10b981' }}>${(user.balance || 0).toFixed(2)} USD</strong>
                                </div>
                                <div class="plan-meta-item">
                                    <span>Current Plan:</span>
                                    <strong>{user.currentPlan || 'Pay-As-You-Go'}</strong>
                                </div>
                                <div class="plan-meta-item">
                                    <span>Supported Platforms:</span>
                                    <strong>Telegram, WhatsApp</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="card billing-limits-card">
                    <div class="card-header">
                        <h3 class="card-title">💎 Pay-As-You-Go Rates</h3>
                    </div>
                    <div class="card-content">
                        <ul class="billing-features-list">
                            <li>✓ <strong>Transcription:</strong> ${priceTranscription} per message</li>
                            <li>✓ <strong>Words:</strong> ${priceWord} per transcribed word</li>
                            <li>✓ Real-time balance deduction</li>
                        </ul>
                    </div>
                </div>
            </div>

            <div class="card billing-pricing-card" style={{ marginTop: '1.5rem' }}>
                <div class="card-header">
                    <h3 class="card-title">📦 Subscription Packages</h3>
                </div>
                <div class="card-content">
                    <div class="grid pricing-tiers-grid">
                        <div class="pricing-card">
                            <div class="price-header">
                                <span class="tier-name">Weekly Unlimited</span>
                                <div class="tier-price">$1 <span>/ week</span></div>
                            </div>
                            <ul class="tier-features">
                                <li>Unlimited Transcriptions</li>
                                <li>Unlimited Translations</li>
                                <li>Unlimited Words</li>
                                <li>Telegram & WhatsApp</li>
                            </ul>
                            <button class="btn btn-secondary btn-full" onClick={() => window.open(`https://t.me/kilo_alexey_bot?start=sub_weekly_${user.userId}`, '_blank')}>Subscribe</button>
                        </div>

                        <div class="pricing-card active">
                            <div class="price-header">
                                <span class="tier-name">Monthly Unlimited</span>
                                <div class="tier-price">$2 <span>/ month</span></div>
                                <span class="pricing-badge-popular">POPULAR</span>
                            </div>
                            <ul class="tier-features">
                                <li>All Weekly features</li>
                                <li>Priority Queue</li>
                                <li>Premium Support</li>
                            </ul>
                            <button class="btn btn-primary btn-full" onClick={() => window.open(`https://t.me/kilo_alexey_bot?start=sub_monthly_${user.userId}`, '_blank')}>Subscribe</button>
                        </div>

                        <div class="pricing-card">
                            <div class="price-header">
                                <span class="tier-name">Flexible (Daytime Only)</span>
                                <div class="tier-price">$0.1 <span>/ month</span></div>
                            </div>
                            <ul class="tier-features">
                                <li>Unlimited 08:00 - 20:00</li>
                                <li>Pay-As-You-Go at night</li>
                                <li>Perfect for work hours</li>
                            </ul>
                            <button class="btn btn-secondary btn-full" onClick={() => window.open(`https://t.me/kilo_alexey_bot?start=sub_flexible_${user.userId}`, '_blank')}>Subscribe</button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card payment-methods-card" style={{ marginTop: '1.5rem' }}>
                <div class="card-header">
                    <h3 class="card-title">🛡️ Top-Up Balance</h3>
                </div>
                <div class="card-content">
                    <div class="grid payment-options-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div class="payment-option-card" style={{ border: '1px solid #333', padding: '1.5rem', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center', background: 'rgba(255,255,255,0.03)' }} onClick={() => window.open(`https://t.me/kilo_alexey_bot?start=${user.userId}`, '_blank')}>
                            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✈️</div>
                            <h4 style={{ margin: '0 0 0.5rem 0' }}>Telegram</h4>
                            <p style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '1rem' }}>Fast top-up via official bot</p>
                            <span class="status-tag active" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}>Available</span>
                        </div>
                        <div class="payment-option-card" style={{ border: '1px solid #333', padding: '1.5rem', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center', background: 'rgba(255,255,255,0.03)' }} onClick={() => { document.getElementById('crypto-form')!.style.display = 'block'; }}>
                            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>₿</div>
                            <h4 style={{ margin: '0 0 0.5rem 0' }}>Cryptocurrency</h4>
                            <p style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '1rem' }}>USDT, BTC, ETH</p>
                            <span class="status-tag active" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}>Available</span>
                        </div>
                    </div>

                    <div id="crypto-form" style={{ display: 'none', marginTop: '1.5rem', padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid #333' }}>
                        <h4 style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>Pay with Cryptocurrency</h4>
                        <p style={{ marginBottom: '1rem', opacity: 0.8, fontSize: '0.95rem' }}>Leave your Telegram username or email, and our manager will contact you with payment details to top up your balance.</p>
                        <input type="text" placeholder="@username or email" class="styled-input" style={{ width: '100%', maxWidth: '400px', marginBottom: '1rem', padding: '12px', borderRadius: '8px', border: '1px solid #444', background: '#111', color: '#fff' }} id="crypto-contact" />
                        <br />
                        <button class="btn btn-primary" onClick={() => {
                            const input = document.getElementById('crypto-contact') as HTMLInputElement;
                            if (input.value.trim() === '') {
                                alert('Please enter your contact details.');
                                return;
                            }
                            alert('Request sent! We will contact you soon.');
                            document.getElementById('crypto-form')!.style.display = 'none';
                            input.value = '';
                        }}>Send Request</button>
                    </div>
                </div>
            </div>

            <div class="card invoice-history-card" style={{ marginTop: '1.5rem' }}>
                <div class="card-header">
                    <h3 class="card-title">🧾 Transaction History</h3>
                </div>
                <div class="card-content">
                    <div class="user-table-container">
                        <table class="user-table">
                            <thead>
                                <tr>
                                    <th>Tx ID</th>
                                    <th>Date</th>
                                    <th>Type</th>
                                    <th>Amount</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: '1rem', opacity: 0.5 }}>No transactions yet</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
