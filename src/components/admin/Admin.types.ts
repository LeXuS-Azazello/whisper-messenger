import type { UserSession } from '../../types';
import type { ErrorLog } from '../../logger';

export interface ConfigItemProps {
    label: string;
    active: boolean;
}

export interface UserRowProps {
    user: UserSession;
}

export interface ErrorLogItemProps {
    error: ErrorLog;
}
