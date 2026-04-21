import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logInfo } from '../logger';
import { Env } from '../types';

describe('KV Optimization Tests', () => {
    let mockEnv: any;

    beforeEach(() => {
        vi.mock('../admin.js', () => ({
            default: 'console.log("mocked admin js")'
        }));

        mockEnv = {
            STATS: {
                get: vi.fn(),
                put: vi.fn(),
                delete: vi.fn(),
                list: vi.fn(),
            },
            TELEGRAM_CHAT_ID: '123',
            TELEGRAM_BOT_TOKEN: 'token',
            ADMIN_SECRET: 'admin',
            BRIDGE_URL: 'http://bridge',
            BRIDGE_SECRET: 'secret'
        };
        vi.clearAllMocks();
    });

    it('logInfo should not use KV STATS', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        await logInfo('test', 'Hello World', mockEnv as unknown as Env);
        
        expect(mockEnv.STATS.get).not.toHaveBeenCalled();
        expect(mockEnv.STATS.put).not.toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[INFO][test] Hello World'));
        
        consoleSpy.mockRestore();
    });

    it('fetchUsersWithStatus should limit users to 50', async () => {
        // Mock a list of 100 users
        const manyUserIds = Array.from({ length: 100 }, (_, i) => `user_${i}`);
        mockEnv.STATS.get.mockImplementation((key: string) => {
            if (key === 'users_list') return JSON.stringify(manyUserIds);
            if (key.startsWith('user_meta_')) return JSON.stringify({ userId: key.replace('user_meta_', ''), firstName: 'Test' });
            return null;
        });

        // Import the function to test
        const { handleAdmin } = await import('../routes/admin');
        
        const req = new Request('https://example.com/admin/users-json', {
            method: 'GET',
            headers: { 'Cookie': 'admin_session=admin' }
        });
        
        // Mock session verification for admin
        vi.mock('../session', () => ({
            verifySession: vi.fn().mockResolvedValue('admin'),
            createSignedSession: vi.fn(),
            verifySignedSession: vi.fn().mockResolvedValue('admin')
        }));
        
        // Temporarily override ADMIN_SECRET to match a simple string for the test
        mockEnv.ADMIN_SECRET = 'admin';

        const res = await handleAdmin(mockEnv as unknown as Env, req);
        expect(res.status).toBe(200);
        
        const data = await res.json() as any[];
        expect(data.length).toBeLessThanOrEqual(50);
        // It should take the LAST 50
        expect(data[0].userId).toBe('user_50');
    });
});
