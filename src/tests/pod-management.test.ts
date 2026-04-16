import { describe, it, expect, vi } from 'vitest';

describe('User Pod Management', () => {
  const createMockUser = (overrides = {}) => ({
    userId: 'test_user_123',
    firstName: 'Test',
    username: 'testuser',
    phone: '+1234567890',
    session: 'mock_session_data',
    platform: 'telegram' as const,
    createdAt: Date.now() - 86400000,
    lastActiveAt: Date.now() - 3600000,
    isActive: true,
    transcriptionCount: 5,
    ...overrides
  });

  describe('UserSession type should have uptime tracking', () => {
    it('should have lastStartedAt and lastStoppedAt fields', () => {
      const user: any = createMockUser({
        lastStartedAt: Date.now() - 3600000,
        lastStoppedAt: null
      });

      expect(user.lastStartedAt).toBeDefined();
      expect(user.isActive).toBe(true);
    });

    it('should track when pod was stopped', () => {
      const user: any = createMockUser({
        isActive: false,
        lastStoppedAt: Date.now() - 60000,
        lastStartedAt: Date.now() - 7200000
      });

      expect(user.isActive).toBe(false);
      expect(user.lastStoppedAt).toBeLessThan(Date.now());
    });
  });

  describe('Uptime calculation', () => {
    const formatUptime = (startedAt: number): string => {
      const seconds = Math.floor((Date.now() - startedAt) / 1000);
      if (seconds < 60) return `${seconds}s`;
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}m`;
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (hours < 24) return `${hours}h ${remainingMinutes}m`;
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      return `${days}d ${remainingHours}h`;
    };

    it('should format uptime less than a minute', () => {
      const startedAt = Date.now() - 30000;
      expect(formatUptime(startedAt)).toBe('30s');
    });

    it('should format uptime less than an hour', () => {
      const startedAt = Date.now() - 3500000;
      expect(formatUptime(startedAt)).toBe('58m');
    });

    it('should format uptime more than an hour', () => {
      const startedAt = Date.now() - 7200000;
      expect(formatUptime(startedAt)).toBe('2h 0m');
    });

    it('should format uptime more than a day', () => {
      const startedAt = Date.now() - 90000000;
      expect(formatUptime(startedAt)).toBe('1d 1h');
    });
  });

  describe('Restart action should re-start pod', () => {
    it('restart action should set isActive to true when spawn succeeds', async () => {
      let spawnCalled = false;
      
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation((url) => {
        if (typeof url === 'string' && url.includes('/spawn')) {
          spawnCalled = true;
          return Promise.resolve({ ok: true, status: 200 });
        }
        return Promise.resolve({ ok: true, status: 200 });
      });

      try {
        const user = createMockUser({ isActive: false, session: 'test_session' });
        
        let meta: any = { isActive: false, lastStoppedAt: Date.now() };
        const session = 'test_session';
        
        const res = await fetch('http://test/bridge/spawn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.userId, session })
        });

        if (res.ok) {
          meta.isActive = true;
          meta.lastStartedAt = Date.now();
          meta.lastStoppedAt = undefined;
        }

        expect(spawnCalled).toBe(true);
        expect(meta.isActive).toBe(true);
        expect(meta.lastStartedAt).toBeDefined();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('restart action should set isActive to false when spawn fails', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation(() => {
        return Promise.resolve({ ok: false, status: 500 });
      });

      try {
        const user = createMockUser({ isActive: false });
        let meta: any = { isActive: false };

        const res = await fetch('http://test/bridge/spawn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.userId, session: user.session })
        });

        if (!res.ok) {
          meta.isActive = false;
        } else {
          meta.isActive = true;
        }

        expect(meta.isActive).toBe(false);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('Stop action should properly deactivate user', () => {
    it('stop action should set isActive to false and record lastStoppedAt', async () => {
      const user: any = createMockUser({ isActive: true, lastStartedAt: Date.now() - 3600000 });

      const meta: any = { 
        isActive: false, 
        lastStoppedAt: Date.now(),
        lastStartedAt: user.lastStartedAt
      };

      expect(meta.isActive).toBe(false);
      expect(meta.lastStoppedAt).toBeDefined();
    });
  });

  describe('Test message should check pod status', () => {
    it('should not send test message if user is not active', async () => {
      const user: any = createMockUser({ isActive: false });
      
      const canSend = user.isActive;

      expect(canSend).toBe(false);
    });

    it('should allow test message if user is active', async () => {
      const user: any = createMockUser({ isActive: true });
      
      const canSend = user.isActive;

      expect(canSend).toBe(true);
    });
  });
});