/** @jsxImportSource preact */

interface AdminHeaderProps {
    tgAuthenticated: boolean;
}

export function AdminHeader({ tgAuthenticated }: AdminHeaderProps) {
    return (
        <header>
            <div class="logo">
                <div class="logo-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" y1="19" x2="12" y2="23" />
                        <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                </div>
                ECHO ADMIN
            </div>
            <a href="/admin/logout" class="status-badge" title="Click to logout">
                <div class="status-dot"></div>
                SYSTEM ONLINE (LOGOUT)
            </a>
        </header>
    );
}
