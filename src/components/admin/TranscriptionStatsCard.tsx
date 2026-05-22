/** @jsxImportSource preact */
import type { UserSession } from '../../types';

interface TranscriptionStatsCardProps {
    stats: any;
    users: UserSession[];
}

export function TranscriptionStatsCard({ stats, users }: TranscriptionStatsCardProps) {
    const totalTranscriptions = Object.values(stats).reduce((a: any, b: any) => a + b, 0);

    return (
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Transcription Stats</h3>
                <div style={{ fontSize: '12px', background: 'var(--primary)', padding: '2px 8px', borderRadius: '4px' }}>
                    Total: {totalTranscriptions}
                </div>
            </div>
            <div class="stats-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div class="stat-box" style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '4px' }}>MESSENGER</div>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#00B2FF' }}>{stats.messenger}</div>
                </div>
                <div class="stat-box" style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '4px' }}>INSTAGRAM</div>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#FF0072' }}>{stats.instagram}</div>
                </div>
                <div class="stat-box" style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '4px' }}>WHATSAPP</div>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#25D366' }}>{stats.whatsapp}</div>
                </div>
                <div class="stat-box" style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '4px' }}>TELEGRAM</div>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#24A1DE' }}>{stats.telegram || 0}</div>
                </div>
                <div class="stat-box" style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '4px' }}>LINE</div>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#00C300' }}>{stats.line || 0}</div>
                </div>
            </div>

            <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px' }}>
                <h4 style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '700' }}>Active Users Stats</h4>
                <div class="user-stats-list">
                    {users.filter(u => (u.transcriptionCount || 0) > 0)
                        .slice()
                        .sort((a, b) => (b.transcriptionCount || 0) - (a.transcriptionCount || 0))
                        .map(u => (
                            <div class="user-stat-item" key={u.userId} style={{ marginBottom: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: u.isActive ? '#22c55e' : '#6B7280', boxShadow: u.isActive ? '0 0 8px #22c55e' : 'none' }}></div>
                                        <div>
                                            <div style={{ fontSize: '14px', fontWeight: '600' }}>{u.firstName}</div>
                                            <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>@{u.username || 'n/a'}</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '16px', fontWeight: '800', color: '#24A1DE' }}>{u.transcriptionCount}</div>
                                            <div style={{ fontSize: '9px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>msgs</div>
                                        </div>
                                        <button class="expand-user-info" data-userid={u.userId} title="Expand Info" style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)', color: '#8B5CF6', borderRadius: '8px', padding: '4px 8px', fontSize: '10px', cursor: 'pointer', fontWeight: '700' }}>
                                            INFO
                                        </button>
                                    </div>
                                </div>
                                <div id={`info-box-${u.userId}`} class="user-info-detail" style={{ display: 'none', marginTop: '10px', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px', fontSize: '11px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                        <div><span style={{ color: 'var(--text-dim)' }}>UID:</span> <code style={{ color: '#fff' }}>{u.userId}</code></div>
                                        <div><span style={{ color: 'var(--text-dim)' }}>Pod:</span> <span style={{ color: '#8B5CF6', fontWeight: 'bold' }}>{u.podName || 'n/a'}</span></div>
                                        <div><span style={{ color: 'var(--text-dim)' }}>Phone:</span> <span style={{ color: '#fff' }}>{u.phone || 'n/a'}</span></div>
                                        <div><span style={{ color: 'var(--text-dim)' }}>Status:</span> <span style={{ color: u.isActive ? '#22c55e' : '#ef4444' }}>{u.currentStatus || (u.isActive ? 'Running' : 'Stopped')}</span></div>
                                        <div><span style={{ color: 'var(--text-dim)' }}>Created:</span> <span style={{ color: '#fff' }}>{new Date(u.createdAt).toLocaleDateString()}</span></div>
                                    </div>
                                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                        <span style={{ color: 'var(--text-dim)' }}>Last Activity:</span> <span style={{ color: '#fff' }}>{u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleString() : 'Never'}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    {users.filter(u => (u.transcriptionCount || 0) > 0).length === 0 && (
                        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-dim)', fontSize: '12px', fontStyle: 'italic' }}>
                            No transcription data yet
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
