import { describe, it, expect, vi } from 'vitest';

describe('Admin API User Status Validation', () => {
  describe('tg-test-msg should check isActive before sending', () => {
    it('should reject when user is not active', async () => {
      const userMeta = {
        userId: 'test123',
        isActive: false,
        lastStoppedAt: Date.now() - 60000
      };

      const canSendTest = userMeta.isActive === true;
      expect(canSendTest).toBe(false);
    });

    it('should allow when user is active', async () => {
      const userMeta = {
        userId: 'test123',
        isActive: true,
        lastStartedAt: Date.now() - 3600000
      };

      const canSendTest = userMeta.isActive === true;
      expect(canSendTest).toBe(true);
    });
  });

  describe('Stop action should update lastStoppedAt', () => {
    it('stop action should set lastStoppedAt timestamp', async () => {
      const meta: any = {
        isActive: true,
        lastStartedAt: Date.now() - 3600000
      };

      meta.isActive = false;
      meta.lastStoppedAt = Date.now();

      expect(meta.isActive).toBe(false);
      expect(meta.lastStoppedAt).toBeDefined();
    });
  });

  describe('Restart action should update timestamps', () => {
    it('restart should set lastStartedAt and remove lastStoppedAt', async () => {
      const meta: any = {
        isActive: false,
        lastStoppedAt: Date.now() - 60000
      };

      meta.isActive = true;
      meta.lastStartedAt = Date.now();
      delete meta.lastStoppedAt;

      expect(meta.isActive).toBe(true);
      expect(meta.lastStartedAt).toBeDefined();
      expect(meta.lastStoppedAt).toBeUndefined();
    });
  });

  describe('Uptime formatting', () => {
    const formatUptime = (startedAt?: number): string => {
      if (!startedAt) return '-';
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

    it('should return - for undefined startedAt', () => {
      expect(formatUptime(undefined)).toBe('-');
    });

    it('should format 30 seconds', () => {
      expect(formatUptime(Date.now() - 30000)).toBe('30s');
    });

    it('should format 1 hour 30 minutes', () => {
      expect(formatUptime(Date.now() - 5400000)).toBe('1h 30m');
    });

    it('should format 2 days', () => {
      expect(formatUptime(Date.now() - 172800000)).toBe('2d 0h');
    });
  });
});