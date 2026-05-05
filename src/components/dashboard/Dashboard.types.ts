import type { UserSession } from '../../types';

export interface ConfigItemProps {
    label: string;
    active: boolean;
}

export interface UserRowProps {
    user: UserSession;
}
