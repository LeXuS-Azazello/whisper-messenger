import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handlePublicAuth } from './routes/auth';
import { Env, UserSession } from './types';

// Helper to create a minimal Env mock
const createMockEnv = (overrides = {}): Env => ({
    GOOGLE_CLIENT_ID: 'test-google-client-id',
    GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
    SESSION_SECRET: 'test-session-secret',
    ADMIN_SECRET: 'test-admin-secret',
    STATS: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
    } as any,
    BRIDGE_URL: 'https://bridge.test',
    BRIDGE_SECRET: 'bridge-secret',
    ...overrides
} as any);

// Helper to create a mock ID Token (JWT)
// Note: We only need the payload part for the current implementation in auth.ts
const createMockIdToken = (payload: any) => {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payloadBase64 = btoa(JSON.stringify(payload)).replace(/=/g, '');
    const signature = 'mock-signature';
    return `${header}.${payloadBase64}.${signature}`;
};

describe('Google OAuth Callback Integration', () => {
    let env: Env;

    beforeEach(() => {
        env = createMockEnv();
        // Mock global fetch for registerNewUser call
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            text: () => Promise.resolve('ok'),
            json: () => Promise.resolve({ ok: true })
        });
    });

    it.skip('should successfully authenticate with a valid Google ID Token', async () => {
        // SKIPPED: Google auth is currently disabled in auth.ts line 78
        const payload = {
            aud: env.GOOGLE_CLIENT_ID,
            sub: '123456789',
            email: 'test@example.com',
            given_name: 'Test',
            name: 'Test User'
        };
        const idToken = createMockIdToken(payload);

        const formData = new FormData();
        formData.append('credential', idToken);

        const req = new Request('https://whisper.debug.org.ua/auth/google/callback', {
            method: 'POST',
            body: formData
        });

        const response = await handlePublicAuth(env, req, null);

        expect(response.status).toBe(302);
        expect(response.headers.get('Location')).toBe('/dashboard');
        
        const setCookie = response.headers.get('Set-Cookie');
        expect(setCookie).toContain('session=google_123456789.');
        expect(setCookie).toContain('Path=/');
        expect(setCookie).toContain('HttpOnly');

        // Verify KV storage calls
        expect(env.STATS.get).toHaveBeenCalledWith('user_meta_google_123456789');
        expect(env.STATS.put).toHaveBeenCalledWith('user_meta_google_123456789', expect.stringContaining('"userId":"google_123456789"'));
    });

    it.skip('should fail if audience mismatch', async () => {
        // SKIPPED: Google auth is currently disabled in auth.ts line 78
        const payload = {
            aud: 'wrong-client-id',
            sub: '123456789',
            email: 'test@example.com'
        };
        const idToken = createMockIdToken(payload);

        const formData = new FormData();
        formData.append('credential', idToken);

        const req = new Request('https://whisper.debug.org.ua/auth/google/callback', {
            method: 'POST',
            body: formData
        });

        const response = await handlePublicAuth(env, req, null);

        expect(response.status).toBe(500);
        const text = await response.text();
        expect(text).toContain('Auth Error: Invalid Google Client ID (audience mismatch)');
    });

    it('should fail if credential is missing', async () => {
        // Returns 500 because Google auth is disabled in auth.ts
        const formData = new FormData();
        const req = new Request('https://whisper.debug.org.ua/auth/google/callback', {
            method: 'POST',
            body: formData
        });

        const response = await handlePublicAuth(env, req, null);

        expect(response.status).toBe(500);
        expect(await response.text()).toBe('Google auth disabled');
    });

    it.skip('should reuse existing user metadata if already present', async () => {
        // SKIPPED: Google auth is currently disabled in auth.ts line 78
        const userId = 'google_123456789';
        const existingUser: UserSession = {
            userId,
            firstName: 'Existing',
            session: '',
            platform: 'telegram',
            transcriptionCount: 10,
            isActive: true,
            createdAt: Date.now(),
            lastActiveAt: Date.now()
        };

        (env.STATS.get as any).mockImplementation((key: string) => {
            if (key === `user_meta_${userId}`) return JSON.stringify(existingUser);
            return null;
        });

        const payload = {
            aud: env.GOOGLE_CLIENT_ID,
            sub: '123456789',
            given_name: 'Test'
        };
        const idToken = createMockIdToken(payload);

        const formData = new FormData();
        formData.append('credential', idToken);

        const req = new Request('https://whisper.debug.org.ua/auth/google/callback', {
            method: 'POST',
            body: formData
        });

        const response = await handlePublicAuth(env, req, null);

        expect(response.status).toBe(302);
        // Should NOT call put for user_meta if it exists (according to current implementation in auth.ts)
        // Wait, looking at auth.ts:
        // if (!existingRaw) { ... await env.STATS.put(`user_meta_${userId}`, JSON.stringify(user)); ... }
        // So it should NOT call put if it exists.
        
        // Let's verify our understanding of auth.ts lines 88-103
        const putCalls = (env.STATS.put as any).mock.calls.filter((call: any) => call[0] === `user_meta_${userId}`);
        expect(putCalls.length).toBe(0);
    });
});
