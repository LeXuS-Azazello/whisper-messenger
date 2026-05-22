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
                        <div class="bar-chart">
                            <div class="bar-item">
                                <div class="bar-value" style="height: 45px;"><span class="bar-text">9</span></div>
                                <div class="bar-label">Mon</div>
                            </div>
                            <div class="bar-item">
                                <div class="bar-value" style="height: 70px;"><span class="bar-text">14</span></div>
                                <div class="bar-label">Tue</div>
                            </div>
                            <div class="bar-item">
                                <div class="bar-value" style="height: 110px;"><span class="bar-text">22</span></div>
                                <div class="bar-label">Wed</div>
                            </div>
                            <div class="bar-item">
                                <div class="bar-value" style="height: 55px;"><span class="bar-text">11</span></div>
                                <div class="bar-label">Thu</div>
                            </div>
                            <div class="bar-item">
                                <div class="bar-value active" style="height: 160px;"><span class="bar-text">32</span></div>
                                <div class="bar-label">Fri</div>
                            </div>
                            <div class="bar-item">
                                <div class="bar-value" style="height: 35px;"><span class="bar-text">7</span></div>
                                <div class="bar-label">Sat</div>
                            </div>
                            <div class="bar-item">
                                <div class="bar-value" style="height: 25px;"><span class="bar-text">4</span></div>
                                <div class="bar-label">Sun</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
