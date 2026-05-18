/** @jsxImportSource preact */
import { renderAuthPage } from "../auth/Auth";

export const renderHome = (googleClientId: string, origin: string) => {
    return renderAuthPage(undefined, false, origin, undefined, googleClientId, 'login');
};
