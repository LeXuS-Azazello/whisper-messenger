/** @jsxImportSource preact */
import type { UserSession } from '../../types';
import { UserRow } from './Admin.utils';

interface UserManagementCardProps {
    users: UserSession[];
}

export function UserManagementCard({ users }: UserManagementCardProps) {
    const activeCount = users.filter(u => u.isActive).length;
    const needAuthCount = users.filter(u => !u.tgAuthenticated).length;

    return (
        <div class="card" style={{ gridColumn: '1 / -1' }}>
            <div class="card-header" style={{ marginBottom: '20px' }}>
                <div>
                    <h3 class="card-title" style={{ color: '#fff', fontSize: '1.25rem', marginBottom: '4px' }}>User Management (Telegram Pods)</h3>
                    <div id="last-updated-info" style={{ fontSize: '10px', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <div class="status-dot" style={{ width: '6px', height: '6px', animation: 'pulse 2s infinite' }}></div>
                        Polling active (1m) • Last updated: {new Date().toLocaleTimeString()}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Total</div>
                        <div style={{ fontSize: '18px', fontWeight: '800', color: '#fff' }}>{users.length}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Active</div>
                        <div style={{ fontSize: '18px', fontWeight: '800', color: '#10B981' }}>{activeCount}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Need Auth</div>
                        <div style={{ fontSize: '18px', fontWeight: '800', color: '#EF4444' }}>{needAuthCount}</div>
                    </div>
                    <button class="btn btn-sm" id="force-refresh-btn" style={{ width: 'auto', background: 'rgba(255,255,255,0.05)', fontSize: '11px', padding: '6px 12px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', margin: 0 }}>Refresh</button>
                </div>
            </div>
            <div class="user-table-container" style={{ overflowX: 'auto', marginTop: '10px' }}>
                <table class="user-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-dim)' }}>
                            <th style={{ padding: '10px 5px' }}>User</th>
                            <th style={{ padding: '10px 5px' }}>UID</th>
                            <th style={{ padding: '10px 5px' }}>Phone</th>
                            <th style={{ padding: '10px 5px', textAlign: 'center' }}>Pod Status</th>
                            <th style={{ padding: '10px 5px', textAlign: 'center' }}>Uptime</th>
                            <th style={{ padding: '10px 5px', textAlign: 'center' }}>Voice Stats</th>
                            <th style={{ padding: '10px 5px' }}>Last online</th>
                            <th style={{ padding: '10px 5px', textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="user-table-body">
                        {users.length > 0 ? (
                            users.map(u => <UserRow key={u.userId} user={u} />)
                        ) : (
                            <tr>
                                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>
                                    No users registered yet. Visitors: /auth
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
