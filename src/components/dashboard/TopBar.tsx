/** @jsxImportSource preact */
import type { UserSession } from '../../types';

interface TopBarProps {
    user: UserSession;
}

export function TopBar({ user }: TopBarProps) {
    return (
        <div class="top-bar">
            <div class="top-bar-heading">
                <h1 class="section-title" id="current-section-title">Connections</h1>
                <p class="section-subtitle" id="current-section-subtitle">Manage your linked accounts and messaging channels</p>
            </div>
            <div class="top-bar-actions">
                <div class="stat-badge-mini">
                    <span class="badge-dot"></span>
                    <span class="badge-text" id="stat-count-badge">{user.transcriptionCount || 0} Transcribed</span>
                </div>
            </div>
        </div>
    );
}
