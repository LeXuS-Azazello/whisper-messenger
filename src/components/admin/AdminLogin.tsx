/** @jsxImportSource preact */
import fs from 'fs';
import { render } from 'preact-render-to-string';
import type { HealthChecks, UserSession, Env } from '../../types';
import type { ErrorLog } from '../../logger';
import { ConfigItem, formatUptime, UserRow, ErrorLogItem } from './Admin.utils';

const cssPath = new URL('./Admin.css', import.meta.url);
const adminCss = fs.readFileSync(cssPath, 'utf-8');

export const renderAdminLogin = (error?: string) => {
    return "<!DOCTYPE html>" + render(
        <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <title>Admin Login</title>
                <style dangerouslySetInnerHTML={{ __html: adminCss }} />
            </head>
            <body>
                <div class="login-container">
                    <div class="card login-card" style={{ maxWidth: '400px', margin: '100px auto' }}>
                        <h1>Whisper Admin</h1>
                        {error && <div class="error-msg">{error}</div>}
                        <form method="POST" action="/admin/login">
                            <div class="input-group">
                                <label class="input-label">Password</label>
                                <input class="input-field" type="password" name="password" required autoFocus />
                            </div>
                            <button type="submit" class="btn">Login</button>
                        </form>
                    </div>
                </div>
            </body>
        </html>
    );
}
