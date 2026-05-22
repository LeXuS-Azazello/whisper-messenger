import type { UserSession, Env } from '../../types';

export interface DashboardShellProps {
    user: UserSession;
    env: Env;
}

export interface PaneProps {
    user: UserSession;
    env: Env;
}
