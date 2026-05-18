import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleGoogleCallback, handleEmailVerify, handleRegister, handleLogin } from '../controllers/authController';
import User from '../models/User';
import { Env } from '../types';

vi.mock('../models/User', () => {
  const mockSave = vi.fn().mockResolvedValue(true);
  
  // A constructor/function mock that acts as a class
  const MockUserClass = function (this: any, data: any) {
    Object.assign(this, data);
    this.save = mockSave;
    return this;
  } as any;

  MockUserClass.findOne = vi.fn();
  MockUserClass.findOneAndUpdate = vi.fn();
  MockUserClass.save = mockSave;

  return {
    default: MockUserClass
  };
});

describe('Authentication Merging and Conflict Resolution', () => {
  let mockEnv: Env;
  let fetchSpy: any;

  beforeEach(() => {
    mockEnv = {
      GOOGLE_CLIENT_ID: 'test-google-id',
      GOOGLE_CLIENT_SECRET: 'test-google-secret',
      DOMAIN: 'voicemsg.net',
      WORKER_URL: 'https://voicemsg.net',
      STATS: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
      },
    } as any;

    fetchSpy = vi.spyOn(globalThis, 'fetch');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('handleGoogleCallback with an existing email-registered user', () => {
    it('should find user by email and merge Google credentials without changing the userId', async () => {
      // Mock Google OAuth token exchange & userinfo responses
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '12345', email: 'lexus@example.com', name: 'Google Name' })
      } as any);

      // Existing email-based user doc
      const existingUser = {
        userId: 'email_lexus_example_com',
        email: 'lexus@example.com',
        firstName: 'Lexus',
        emailVerified: true,
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(User, 'findOne').mockImplementation(async (query: any) => {
        if (query.email === 'lexus@example.com') {
          return existingUser as any;
        }
        return null;
      });

      const response = await handleGoogleCallback(
        mockEnv,
        { code: 'google-code-123' },
        new URL('https://voicemsg.net/auth/google/callback'),
        null
      );

      expect(response.status).toBe(200);
      expect(User.findOne).toHaveBeenCalledWith({ email: 'lexus@example.com' });
      expect(existingUser.save).toHaveBeenCalled();
      expect(existingUser.firstName).toBe('Lexus'); // untouched
      expect(existingUser.userId).toBe('email_lexus_example_com'); // unchanged userId!
    });
  });

  describe('handleEmailVerify with an existing Google-registered user', () => {
    it('should find the user by email and mark verified instead of creating a new email user', async () => {
      (mockEnv.STATS.get as any).mockResolvedValueOnce('lexus@example.com');

      const existingUser = {
        userId: 'google_12345',
        email: 'lexus@example.com',
        emailVerified: false,
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(User, 'findOne').mockResolvedValueOnce(existingUser as any);

      const response = await handleEmailVerify(
        mockEnv,
        'valid-token',
        new URL('https://voicemsg.net/auth/email/verify')
      );

      expect(response.status).toBe(200);
      expect(User.findOne).toHaveBeenCalledWith({ email: 'lexus@example.com' });
      expect(existingUser.emailVerified).toBe(true);
      expect(existingUser.save).toHaveBeenCalled();
    });
  });

  describe('handleRegister with an existing Google-registered user', () => {
    it('should allow setting password (merging) without returning a 409 user-exists conflict', async () => {
      // Mock existing google user who doesn't have a passwordHash yet
      const existingUser = {
        userId: 'google_12345',
        email: 'lexus@example.com',
        emailVerified: true,
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(User, 'findOne').mockResolvedValueOnce(existingUser as any);

      const response = await handleRegister(
        mockEnv,
        { email: 'lexus@example.com', password: 'new-password-123', firstName: 'Lexus' },
        new URL('https://voicemsg.net/auth/register')
      );

      const data = await response.json() as any;
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(existingUser.save).toHaveBeenCalled();
      expect((existingUser as any).passwordHash).toBeDefined();
    });

    it('should return a 409 conflict if user is already verified AND already has a passwordHash', async () => {
      const existingUser = {
        userId: 'email_lexus_example_com',
        email: 'lexus@example.com',
        emailVerified: true,
        passwordHash: 'somehash123',
        save: vi.fn(),
      };

      vi.spyOn(User, 'findOne').mockResolvedValueOnce(existingUser as any);

      const response = await handleRegister(
        mockEnv,
        { email: 'lexus@example.com', password: 'new-password-123', firstName: 'Lexus' },
        new URL('https://voicemsg.net/auth/register')
      );

      const data = await response.json() as any;
      expect(response.status).toBe(409);
      expect(data.error).toContain('already exists and is verified');
    });
  });

  describe('handleLogin', () => {
    it('should look up by email directly to successfully authenticate merged/google accounts with passwords', async () => {
      const existingUser = {
        userId: 'google_12345',
        email: 'lexus@example.com',
        emailVerified: true,
        passwordHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', // SHA-256 of empty string for simplicity or hash
      };

      // Hash hex for empty string
      // Let's compute actual SHA-256 hash of 'password123'
      const password = 'password123';
      const passwordHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
      const passwordHashHex = Array.from(new Uint8Array(passwordHash)).map(b => b.toString(16).padStart(2, '0')).join('');

      existingUser.passwordHash = passwordHashHex;

      vi.spyOn(User, 'findOne').mockResolvedValueOnce(existingUser as any);

      const response = await handleLogin(
        mockEnv,
        { email: 'lexus@example.com', password },
        new URL('https://voicemsg.net/auth/login')
      );

      const data = await response.json() as any;
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.userId).toBe('google_12345');
      expect(User.findOne).toHaveBeenCalledWith({ email: 'lexus@example.com' });
    });
  });
});
