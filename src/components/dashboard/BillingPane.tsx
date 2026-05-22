/** @jsxImportSource preact */
import type { PaneProps } from './Dashboard.types';

export function BillingPane({ user }: PaneProps) {
    return (
        <div class="tab-pane" id="pane-billing">
            <div class="grid billing-overview-grid">
                <div class="card billing-plan-card">
                    <div class="card-header">
                        <h3 class="card-title">💳 Subscription Plan</h3>
                        <span class="status-tag active">Active</span>
                    </div>
                    <div class="card-content">
                        <div class="billing-details-summary">
                            <div class="plan-hero">
                                <span class="plan-hero-subtitle">CURRENT SUBSCRIPTION</span>
                                <span class="plan-hero-title">Silver Dev Plan</span>
                                <span class="plan-hero-desc">Free early-bird preview access with up to 1,000 monthly voice message transcriptions.</span>
                            </div>
                            <div class="plan-meta-stats">
                                <div class="plan-meta-item">
                                    <span>Price</span>
                                    <strong>$0.00 USD / mo</strong>
                                </div>
                                <div class="plan-meta-item">
                                    <span>Billing Cycle</span>
                                    <strong>Monthly Recurring</strong>
                                </div>
                                <div class="plan-meta-item">
                                    <span>Renewal Date</span>
                                    <strong>June 1, 2026</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="card billing-limits-card">
                    <div class="card-header">
                        <h3 class="card-title">💎 Features Included</h3>
                    </div>
                    <div class="card-content">
                        <ul class="billing-features-list">
                            <li>✓ High-fidelity large-v3-turbo Whisper model</li>
                            <li>✓ Automate Telegram personal chats transcription</li>
                            <li>✓ Automate Facebook Pages & Instagram Direct</li>
                            <li>✓ WhatsApp Business cloud webhook replies</li>
                            <li>✓ Real-time direct Redis queue processing</li>
                            <li>✓ Up to 1,000 operations monthly</li>
                        </ul>
                    </div>
                </div>
            </div>

            <div class="card billing-pricing-card" style={{ marginTop: '1.5rem' }}>
                <div class="card-header">
                    <h3 class="card-title">⚡ Plan Upgrades</h3>
                </div>
                <div class="card-content">
                    <div class="grid pricing-tiers-grid">
                        <div class="pricing-card">
                            <div class="price-header">
                                <span class="tier-name">Free Plan</span>
                                <div class="tier-price">$0 <span>/ mo</span></div>
                            </div>
                            <ul class="tier-features">
                                <li>Up to 50 transcriptions/mo</li>
                                <li>1 Telegram bridge active</li>
                                <li>Standard transcription queue</li>
                            </ul>
                            <button class="btn btn-secondary btn-full" disabled>Active Tier</button>
                        </div>

                        <div class="pricing-card active">
                            <div class="price-header">
                                <span class="tier-name">Pro Member Plan</span>
                                <div class="tier-price">$9.99 <span>/ mo</span></div>
                                <span class="pricing-badge-popular">POPULAR</span>
                            </div>
                            <ul class="tier-features">
                                <li>Unlimited transcriptions/mo</li>
                                <li>5 Telegram bridges active</li>
                                <li>Priority transcription queue</li>
                                <li>WhatsApp advanced replies</li>
                                <li>Priority chat support</li>
                            </ul>
                            <button class="btn btn-primary btn-full" onClick={() => alert('Payment gateway integration will be launched soon! Stay tuned.')}>Upgrade to Pro</button>
                        </div>

                        <div class="pricing-card">
                            <div class="price-header">
                                <span class="tier-name">Enterprise Dev</span>
                                <div class="tier-price">$49.99 <span>/ mo</span></div>
                            </div>
                            <ul class="tier-features">
                                <li>Unlimited Telegram bridges</li>
                                <li>Custom LLM prompt overrides</li>
                                <li>Full Webhook delivery log access</li>
                                <li>Direct server API keys</li>
                                <li>24/7 dedicated support manager</li>
                            </ul>
                            <button class="btn btn-secondary btn-full" onClick={() => alert('Please contact enterprise sales: sales@voicemsg.net')}>Contact Sales</button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card invoice-history-card" style={{ marginTop: '1.5rem' }}>
                <div class="card-header">
                    <h3 class="card-title">🧾 Payment & Invoice History</h3>
                </div>
                <div class="card-content">
                    <div class="user-table-container">
                        <table class="user-table">
                            <thead>
                                <tr>
                                    <th>Invoice ID</th>
                                    <th>Date Generated</th>
                                    <th>Subscription Plan</th>
                                    <th>Charged Amount</th>
                                    <th>Payment Method</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>INV-2026-003</td>
                                    <td>May 1, 2026</td>
                                    <td>Silver Dev Plan</td>
                                    <td>$0.00 USD</td>
                                    <td>Subscription Promotion</td>
                                    <td><span class="status-tag active">PAID</span></td>
                                </tr>
                                <tr>
                                    <td>INV-2026-002</td>
                                    <td>April 1, 2026</td>
                                    <td>Silver Dev Plan</td>
                                    <td>$0.00 USD</td>
                                    <td>Subscription Promotion</td>
                                    <td><span class="status-tag active">PAID</span></td>
                                </tr>
                                <tr>
                                    <td>INV-2026-001</td>
                                    <td>March 1, 2026</td>
                                    <td>Silver Dev Plan</td>
                                    <td>$0.00 USD</td>
                                    <td>Subscription Promotion</td>
                                    <td><span class="status-tag active">PAID</span></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
