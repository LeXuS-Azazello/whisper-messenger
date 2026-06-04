/** @jsxImportSource preact */
import type { PaneProps } from './Dashboard.types';

export function StatisticsPane({ user }: PaneProps) {
    const isTgConnected = !!user.session;

    return (
        <div class="tab-pane" id="pane-stats">
            <div class="grid stats-grid-top">
                <div class="card stats-primary-card">
                    <div class="card-header">
                        <h3 class="card-title">📈 Overall Statistics</h3>
                    </div>
                    <div class="stats-content">
                        <div class="stat-highlight">
                            <div class="stat-label">Total Transcriptions</div>
                            <div class="stat-value">{user.transcriptionCount || 0}</div>
                        </div>
                        {user.lastActiveAt && (
                            <div class="stat-footer">
                                Last active session: {new Date(user.lastActiveAt).toLocaleString()}
                            </div>
                        )}
                    </div>
                </div>

                <div class="card usage-tier-card">
                    <div class="card-header">
                        <h3 class="card-title">⚙️ Quota & Usage</h3>
                    </div>
                    <div class="card-content">
                        <div class="quota-box">
                            <div class="quota-progress-header">
                                <span class="quota-title">Monthly Allotment</span>
                                <span class="quota-stats">{user.transcriptionCount || 0} / 1,000 Transcriptions</span>
                            </div>
                            <div class="quota-bar-bg">
                                <div class="quota-bar-fill" style={{ width: `${Math.min(((user.transcriptionCount || 0) / 1000) * 100, 100)}%` }}></div>
                            </div>
                            <div class="quota-info-meta">
                                <span>Tier: Silver Member Plan</span>
                                <span>Resets in: 12 days</span>
                            </div>
                        </div>
                        <div class="platform-breakdown">
                            <h4 class="breakdown-title">Platform Statuses</h4>
                            <div class="breakdown-list">
                                <div class="breakdown-item">
                                    <span>Telegram Bridge</span>
                                    <span class={`status-dot-mini ${isTgConnected ? 'active' : 'inactive'}`}></span>
                                </div>
                                <div class="breakdown-item" style={{ display: 'none' }}>
                                    <span>Facebook Messenger</span>
                                    <span class={`status-dot-mini ${user.metaToken ? 'active' : 'inactive'}`}></span>
                                </div>
                                <div class="breakdown-item">
                                    <span>WhatsApp Gateway</span>
                                    <span class={`status-dot-mini ${user.whatsappToken ? 'active' : 'inactive'}`}></span>
                                </div>
                                <div style={{ display: 'none' }} class="breakdown-item">
                                    <span>Threads Listener</span>
                                    <span class={`status-dot-mini ${user.threadsToken ? 'active' : 'inactive'}`}></span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="grid stats-grid-bottom" style={{ marginTop: '1.5rem' }}>
                {/* SVG-drawn modern bar chart */}
                <div class="card chart-card">
                    <div class="card-header">
                        <h3 class="card-title">📊 Daily Transcription Frequency (Last 7 Days)</h3>
                    </div>
                    <div class="card-content">
                        <div class="bar-chart" id="daily-chart-container">
                            <div style="text-align: center; color: var(--text-dim); padding: 40px;">Loading chart data...</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="grid stats-grid-bottom" style={{ marginTop: '1.5rem' }}>
                <div class="card full-width-card">
                    <div class="card-header">
                        <h3 class="card-title">📜 Detailed Processing History</h3>
                    </div>
                    <div class="card-content" style={{ overflowX: 'auto' }}>
                        <table class="history-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <th style={{ padding: '12px', color: 'var(--text-dim)' }}>Date</th>
                                    <th style={{ padding: '12px', color: 'var(--text-dim)' }}>Platform</th>
                                    <th style={{ padding: '12px', color: 'var(--text-dim)' }}>Type</th>
                                    <th style={{ padding: '12px', color: 'var(--text-dim)' }}>Input → Output</th>
                                    <th style={{ padding: '12px', color: 'var(--text-dim)' }}>Characters</th>
                                    <th style={{ padding: '12px', color: 'var(--text-dim)' }}>Duration (s)</th>
                                </tr>
                            </thead>
                            <tbody id="stats-history-table">
                                <tr><td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-dim)' }}>Loading history...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
