/** @jsxImportSource preact */
import { render } from 'preact-render-to-string';
import type { UserSession } from '../../types';
import type { ErrorLog } from '../../logger';
import type { ConfigItemProps, UserRowProps, ErrorLogItemProps } from './Admin.types';

export const ConfigItem = ({ label, active }: ConfigItemProps) => (
    <div class="config-item">
        <span class="config-label">{label}</span>
        <span class={`config-value ${active ? 'configured' : 'missing'}`}>
            {active ? 'ACTIVE' : 'MISSING'}
        </span>
    </div>
);

export const formatUptime = (startedAt?: number) => {
    if (!startedAt) return '-';
    const seconds = Math.floor((Date.now() - startedAt) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours < 24) return `${hours}h ${remainingMinutes}m`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
};

export const UserRow = ({ user }: UserRowProps) => (
    <tr class="user-row" data-userid={user.userId}>
        <td>
            <div style={{ fontWeight: '600' }}>{user.firstName}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>@{user.username || 'n/a'}</div>
        </td>
        <td><code style={{ fontSize: '11px', color: '#888' }}>{user.userId}</code></td>
        <td style={{ fontSize: '12px' }}>{user.phone || 'n/a'}</td>
        <td style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                <span class={`status-tag ${user.isActive ? 'active' : 'inactive'}`} style={{ fontSize: '10px', padding: '2px 6px' }}>
                    {user.currentStatus || (user.isActive ? 'RUNNING' : 'STOPPED')}
                </span>
                {user.podName && (
                    <div style={{ fontSize: '9px', color: '#8B5CF6', marginTop: '2px', fontWeight: 'bold', fontFamily: 'monospace' }}>
                        {user.podName}
                    </div>
                )}
                <span style={{ fontSize: '9px', color: user.tgAuthenticated ? '#22c55e' : '#ef4444', fontWeight: 'bold' }}>
                    {user.tgAuthenticated ? 'TG AUTH' : 'TG NEED LOGIN'}
                </span>
            </div>
        </td>
        <td style={{ textAlign: 'center', fontSize: '11px' }}>{formatUptime(user.lastStartedAt)}</td>
        <td style={{ textAlign: 'center', fontWeight: '700', color: '#24A1DE' }}>{user.transcriptionCount || 0}</td>
        <td style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
            {user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleString('en-GB', { hour12: false }) : '-'}
        </td>
        <td style={{ textAlign: 'right' }}>
            <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                <button class="btn btn-sm test-user-btn" data-userid={user.userId} title="Send Test Message" style={{ width: '32px', height: '32px', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#3B82F6', color: '#fff', borderRadius: '8px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polyline points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>
                <button class="btn btn-sm restart-btn" data-userid={user.userId} title="Restart Pod" style={{ width: '32px', height: '32px', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F59E0B', color: '#000', borderRadius: '8px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
                </button>
                <button class="btn btn-sm btn-danger deactivate-btn" data-userid={user.userId} title={user.isActive ? 'Stop Pod' : 'Delete User'} style={{ width: '32px', height: '32px', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', background: user.isActive ? '#ef4444' : '#6B7280', borderRadius: '8px' }}>
                    {user.isActive ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12"/></svg>
                    ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    )}
                </button>
            </div>
        </td>
    </tr>
);

export const ErrorLogItem = ({ error }: ErrorLogItemProps) => (
    <div class="error-log-item">
        <div class="error-log-meta">
            <span class={`platform-tag ${error.platform}`}>{error.platform.toUpperCase()}</span>
            <span class="error-log-time">{new Date(error.timestamp).toLocaleString()}</span>
        </div>
        <div class="error-log-message">{error.message}</div>
    </div>
);
