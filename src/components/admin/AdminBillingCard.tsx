/** @jsxImportSource preact */
import { UserSession } from '../../types';

interface AdminBillingCardProps {
    users: UserSession[];
    priceTranscription: number;
    priceWord: number;
    priceClone: number;
}

export function AdminBillingCard({ users, priceTranscription, priceWord, priceClone }: AdminBillingCardProps) {
    const totalBalance = users.reduce((acc, user) => acc + (user.balance || 0), 0);
    const activeSubscribers = users.filter(u => u.currentPlan && u.currentPlan !== 'Pay-As-You-Go').length;

    return (
        <div class="card" style={{ gridColumn: '1 / -1' }}>
            <div class="card-header" style={{ marginBottom: '20px' }}>
                <h3 class="card-title" style={{ color: '#fff', fontSize: '1.25rem' }}>Billing & Financials</h3>
                <div style={{ display: 'flex', gap: '15px' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>System Total Balance</div>
                        <div style={{ fontSize: '18px', fontWeight: '800', color: '#10B981' }}>${totalBalance.toFixed(2)}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Active Subscriptions</div>
                        <div style={{ fontSize: '18px', fontWeight: '800', color: '#3B82F6' }}>{activeSubscribers}</div>
                    </div>
                </div>
            </div>
            <div class="card-content" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                {/* Pricing Config */}
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px' }}>
                    <h4 style={{ color: 'var(--text-dim)', marginBottom: '15px' }}>System Tariffs Configuration</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div class="config-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={{ fontSize: '14px', color: '#ccc' }}>Transcription (per message)</label>
                            <input type="number" id="price-transcription" class="styled-input" style={{ width: '100px', padding: '5px' }} value={priceTranscription} step="0.001" />
                        </div>
                        <div class="config-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={{ fontSize: '14px', color: '#ccc' }}>Transcription (per word)</label>
                            <input type="number" id="price-word" class="styled-input" style={{ width: '100px', padding: '5px' }} value={priceWord} step="0.0001" />
                        </div>
                        <div class="config-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={{ fontSize: '14px', color: '#ccc' }}>Voice Cloning (per XTTS)</label>
                            <input type="number" id="price-clone" class="styled-input" style={{ width: '100px', padding: '5px' }} value={priceClone} step="0.01" />
                        </div>
                        <button class="btn btn-primary btn-sm" id="save-prices-btn" style={{ marginTop: '10px', alignSelf: 'flex-end', width: 'auto' }}>Save Prices</button>
                    </div>
                </div>

                {/* Manage Balances */}
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px' }}>
                    <h4 style={{ color: 'var(--text-dim)', marginBottom: '15px' }}>User Balance & Tariff Management</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div class="config-row">
                            <select id="user-balance-select" class="styled-input" style={{ width: '100%', padding: '5px' }}>
                                <option value="">Select a user...</option>
                                {users.map(u => (
                                    <option value={u.userId} key={u.userId}>
                                        {u.firstName} {u.username ? `(@${u.username})` : ''} | Bal: ${(u.balance || 0).toFixed(2)} | Plan: {u.currentPlan || 'Pay-As-You-Go'}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div class="config-row" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <input type="number" id="add-balance-amount" class="styled-input" style={{ flex: 1, padding: '5px' }} placeholder="Amount (+/-)" step="0.01" />
                            <button class="btn btn-secondary btn-sm" id="update-balance-btn" style={{ margin: 0, width: 'auto' }}>Add/Remove</button>
                        </div>
                        <div class="config-row" style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '10px' }}>
                            <select id="user-plan-select" class="styled-input" style={{ flex: 1, padding: '5px' }}>
                                <option value="Pay-As-You-Go">Pay-As-You-Go</option>
                                <option value="Weekly Unlimited">Weekly Unlimited</option>
                                <option value="Monthly Unlimited">Monthly Unlimited</option>
                                <option value="Flexible (Daytime)">Flexible (Daytime)</option>
                            </select>
                            <button class="btn btn-secondary btn-sm" id="update-plan-btn" style={{ margin: 0, width: 'auto' }}>Set Plan</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
