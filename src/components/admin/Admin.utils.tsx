/** @jsxImportSource preact */
import React from 'preact/compat';
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ 
                    width: '32px', 
                    height: '32px', 
                    borderRadius: '10px', 
                    background: 'linear-gradient(135deg, var(--primary) 0%, #3B82F6 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: '800',
                    color: '#fff',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
                }}>
                    {(user.firstName || 'U')[0].toUpperCase()}
                </div>
                <div>
                    <div style={{ fontWeight: '600', color: '#fff' }}>{user.firstName || 'Unknown User'}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>@{user.username || 'n/a'}</div>
                </div>
            </div>
        </td>
        <td><code style={{ fontSize: '11px', color: '#94A3B8', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>{user.userId}</code></td>
        <td style={{ fontSize: '12px', color: '#CBD5E1' }}>{user.phone || 'n/a'}</td>
        <td style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                <span class={`status-tag ${user.isActive ? 'active' : 'inactive'}`} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '8px' }}>
                    {user.currentStatus || (user.isActive ? 'RUNNING' : 'STOPPED')}
                </span>
                {user.podName && (
                    <div style={{ fontSize: '9px', color: '#A78BFA', marginTop: '2px', fontWeight: 'bold', fontFamily: 'JetBrains Mono, monospace' }}>
                        {user.podName}
                    </div>
                )}
                <span style={{ 
                    fontSize: '9px', 
                    color: user.tgAuthenticated ? '#34D399' : '#F87171', 
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }}></span>
                    {user.tgAuthenticated ? 'TG AUTH' : 'TG NEED LOGIN'}
                </span>
            </div>
        </td>
        <td style={{ textAlign: 'center', fontSize: '11px', color: '#94A3B8' }}>{formatUptime(user.lastStartedAt)}</td>
        <td style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: '800', color: '#38BDF8', fontSize: '16px' }}>{user.transcriptionCount || 0}</div>
            <div style={{ fontSize: '9px', color: 'var(--text-dim)', display: 'flex', gap: '6px', justifyContent: 'center', marginTop: '2px', flexWrap: 'wrap' }}>
                {user.tgTranscriptionCount !== undefined && user.tgTranscriptionCount > 0 && <span title="Telegram" style={{ color: '#24A1DE', fontWeight: 'bold' }}>TG:{user.tgTranscriptionCount}</span>}
                {user.waTranscriptionCount !== undefined && user.waTranscriptionCount > 0 && <span title="WhatsApp" style={{ color: '#25D366', fontWeight: 'bold' }}>WA:{user.waTranscriptionCount}</span>}
                {user.fbTranscriptionCount !== undefined && user.fbTranscriptionCount > 0 && <span title="Facebook" style={{ color: '#00B2FF', fontWeight: 'bold' }}>FB:{user.fbTranscriptionCount}</span>}
            </div>
        </td>
        <td style={{ fontSize: '11px', color: '#94A3B8', whiteSpace: 'nowrap' }}>
            {user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleString('en-GB', { hour12: false }) : '-'}
        </td>
        <td style={{ textAlign: 'right' }}>
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                <button class="btn btn-sm test-user-btn" data-userid={user.userId} title="Send Test Message" style={{ width: '34px', height: '34px', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(59, 130, 246, 0.1)', color: '#3B82F6', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '10px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polyline points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>
                <a href={`/admin/users/${user.userId}`} class="btn btn-sm" title="View Profile" style={{ width: '34px', height: '34px', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(16, 185, 129, 0.1)', color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '10px', textDecoration: 'none' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </a>
                <button class="btn btn-sm restart-btn" data-userid={user.userId} title="Restart Pod" style={{ width: '34px', height: '34px', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '10px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
                </button>
                {user.isActive && (
                    <button class="btn btn-sm stop-btn" data-userid={user.userId} title="Stop Pod" style={{ width: '34px', height: '34px', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '10px' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12"/></svg>
                    </button>
                )}
                <button class="btn btn-sm btn-danger delete-btn" data-userid={user.userId} title="Delete User" style={{ width: '34px', height: '34px', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(239, 68, 68, 0.15)', color: '#F87171', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
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
