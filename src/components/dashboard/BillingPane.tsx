/** @jsxImportSource preact */
import type { PaneProps } from './Dashboard.types';

export function BillingPane({ user }: PaneProps) {
    return (
        <div class="tab-pane" id="pane-billing">
            <div class="grid billing-overview-grid">
                <div class="card billing-plan-card">
                    <div class="card-header">
                        <h3 class="card-title">💳 Current Plan</h3>
                        <span class="status-tag active">Active</span>
                    </div>
                    <div class="card-content">
                        <div class="billing-details-summary">
                            <div class="plan-hero">
                                <span class="plan-hero-subtitle">MEMBERSHIP</span>
                                <span class="plan-hero-title">Pay-As-You-Go (Beta)</span>
                                <span class="plan-hero-desc">Billed per second of processed audio or character of transcribed text.</span>
                            </div>
                            <div class="plan-meta-stats">
                                <div class="plan-meta-item">
                                    <span>Balance</span>
                                    <strong>$0.00 USD</strong>
                                </div>
                                <div class="plan-meta-item">
                                    <span>Estimated Cost</span>
                                    <strong>$0.00 / mo</strong>
                                </div>
                                <div class="plan-meta-item">
                                    <span>Payment Method</span>
                                    <strong>Not Linked</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="card billing-limits-card">
                    <div class="card-header">
                        <h3 class="card-title">💎 Billing Model</h3>
                    </div>
                    <div class="card-content">
                        <ul class="billing-features-list">
                            <li>✓ Billing based on total processed audio duration (per second)</li>
                            <li>✓ Alternative billing by transcribed text length (per character)</li>
                            <li>✓ No monthly fixed fees (Pure usage based)</li>
                            <li>✓ Access to all high-fidelity Whisper models</li>
                            <li>✓ Real-time credit balance subtraction</li>
                            <li>✓ Automatic top-ups available via Stripe/Crypto</li>
                        </ul>
                    </div>
                </div>
            </div>

            <div class="card billing-pricing-card" style={{ marginTop: '1.5rem' }}>
                <div class="card-header">
                    <h3 class="card-title">⚡ Top-Up Credits</h3>
                </div>
                <div class="card-content">
                    <div class="grid pricing-tiers-grid">
                        <div class="pricing-card">
                            <div class="price-header">
                                <span class="tier-name">Starter Pack</span>
                                <div class="tier-price">$5 <span>/ credit</span></div>
                            </div>
                            <ul class="tier-features">
                                <li>~60 mins of audio</li>
                                <li>Standard processing speed</li>
                                <li>Email support</li>
                            </ul>
                            <button class="btn btn-secondary btn-full" onClick={() => alert('Opening payment options...')}>Buy Credits</button>
                        </div>

                        <div class="pricing-card active">
                            <div class="price-header">
                                <span class="tier-name">Power User</span>
                                <div class="tier-price">$20 <span>/ credit</span></div>
                                <span class="pricing-badge-popular">POPULAR</span>
                            </div>
                            <ul class="tier-features">
                                <li>~240 mins of audio</li>
                                <li>Priority processing</li>
                                <li>Priority support</li>
                            </ul>
                            <button class="btn btn-primary btn-full" onClick={() => alert('Opening payment options...')}>Buy Credits</button>
                        </div>

                        <div class="pricing-card">
                            <div class="price-header">
                                <span class="tier-name">Enterprise pack</span>
                                <div class="tier-price">$50 <span>/ credit</span></div>
                            </div>
                            <ul class="tier-features">
                                <li>~600 mins of audio</li>
                                <li>Ultra-priority queue</li>
                                <li>Dedicated manager</li>
                            </ul>
                            <button class="btn btn-secondary btn-full" onClick={() => alert('Please contact sales: sales@voicemsg.net')}>Buy Credits</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Payment Method Selection Placeholder */}
            <div class="card payment-methods-card" style={{ marginTop: '1.5rem' }}>
                <div class="card-header">
                    <h3 class="card-title">🛡️ Select Payment Method</h3>
                </div>
                <div class="card-content">
                    <div class="grid payment-options-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div class="payment-option-card" style={{ border: '1px solid #333', padding: '1.5rem', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center', background: 'rgba(255,255,255,0.03)' }} onClick={() => alert('Visa/Mastercard gateway coming soon!')}>
                            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💳</div>
                            <h4 style={{ margin: '0 0 0.5rem 0' }}>Bank Card</h4>
                            <p style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '1rem' }}>Visa, Mastercard, Maestro</p>
                            <span class="status-tag inactive">Coming Soon</span>
                        </div>
                        <div class="payment-option-card" style={{ border: '1px solid #333', padding: '1.5rem', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center', background: 'rgba(255,255,255,0.03)' }} onClick={() => alert('Crypto gateway coming soon!')}>
                            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>₿</div>
                            <h4 style={{ margin: '0 0 0.5rem 0' }}>Cryptocurrency</h4>
                            <p style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '1rem' }}>USDT, BTC, ETH</p>
                            <span class="status-tag inactive">Coming Soon</span>
                        </div>
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
                                    <td>TX-2026-003</td>
                                    <td>May 1, 2026</td>
                                    <td>Credit Top-up</td>
                                    <td>+$5.00</td>
                                    <td><span class="status-tag active">SUCCESS</span></td>
                                </tr>
                                <tr>
                                    <td>TX-2026-002</td>
                                    <td>April 1, 2026</td>
                                    <td>Usage Fee</td>
                                    <td>-$1.20</td>
                                    <td><span class="status-tag active">SUCCESS</span></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
