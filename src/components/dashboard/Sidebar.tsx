/** @jsxImportSource preact */
import type { UserSession } from '../../types';

interface SidebarProps {
    user: UserSession;
}

export function Sidebar({ user }: SidebarProps) {
    return (
        <aside class="sidebar">
            <div class="sidebar-header">
                <div class="logo">
                    <div class="logo-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            <line x1="12" y1="19" x2="12" y2="23" />
                            <line x1="8" y1="23" x2="16" y2="23" />
                        </svg>
                    </div>
                    <span class="logo-text">VOICEmsg.NET</span>
                </div>
            </div>

            <nav class="sidebar-nav">
                <a href="#connections" class="nav-item tab-btn active" data-tab="connections">
                    <span class="nav-icon">🔌</span>
                    <span class="nav-label">Connections</span>
                </a>
                <a href="#stats" class="nav-item tab-btn" data-tab="stats">
                    <span class="nav-icon">📊</span>
                    <span class="nav-label">Statistics</span>
                </a>
                <a href="#profile" class="nav-item tab-btn" data-tab="profile">
                    <span class="nav-icon">👤</span>
                    <span class="nav-label">Profile</span>
                </a>
                <a href="#referrals" class="nav-item tab-btn" data-tab="referrals">
                    <span class="nav-icon">🎁</span>
                    <span class="nav-label">Referrals</span>
                </a>
                <a href="#billing" class="nav-item tab-btn" data-tab="billing">
                    <span class="nav-icon">💳</span>
                    <span class="nav-label">Billing</span>
                </a>
            </nav>

            <div class="sidebar-footer">
                <div class="user-avatar-wrap">
                    <div class="user-avatar">{user.firstName ? user.firstName.charAt(0).toUpperCase() : 'U'}</div>
                    <div class="user-details">
                        <div class="user-name">{user.firstName}</div>
                        <div class="user-role">{user.email || 'Free Tier Account'}</div>
                    </div>
                </div>
                <a href="/auth/logout" class="sidebar-logout-btn">
                    <span>Logout</span> ➔
                </a>
            </div>
        </aside>
    );
}
