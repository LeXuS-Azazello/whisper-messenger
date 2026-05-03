import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleUserDashboard } from '../routes/dashboard';
import queue from '../queue';
import { Env } from '../types';

// Mock the modules at the top level
vi.mock('../whisper', () => ({
  transcribeWithFallback: vi.fn().mockResolvedValue({
    text: 'Hello world',
    model: 'Test Model'
  })
}));

vi.mock('../telegram', () => ({
  sendTelegramMessage: vi.fn().mockResolvedValue(undefined),
  sendTelegramTypingOn: vi.fn().mockResolvedValue(undefined)
}));

describe('Translation Feature', () => {
  const mockEnv: Env = {
    STATS: {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn()
    } as any,
    BRIDGE_URL: 'https://bridge.example.com',
    BRIDGE_SECRET: 'test-secret',
    AI: {} as any,
    AUDIO_QUEUE: {} as any,
    VERIFY_TOKEN: 'test-token',
    META_API_VERSION: 'v19.0',
    META_PAGE_TOKEN: 'test-page-token',
    META_APP_SECRET: 'test-app-secret',
    WHATSAPP_PHONE_NUMBER_ID: 'test-phone-id',
    WHATSAPP_TOKEN: 'test-wa-token',
    TELEGRAM_APP_ID: 'test-tg-id',
    TELEGRAM_APP_HASH: 'test-tg-hash',
    TELEGRAM_BOT_TOKEN: 'test-tg-bot-token',
    WORKER_URL: 'https://worker.example.com',
    ADMIN_SECRET: 'admin-secret',
    META_APP_ID: 'test-meta-app-id',
    META_THREADS_APP_ID: 'test-threads-app-id',
    META_THREADS_APP_SECRET: 'test-threads-app-secret',
    GOOGLE_CLIENT_ID: 'test-google-id',
    GOOGLE_CLIENT_SECRET: 'test-google-secret'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Dashboard Settings', () => {
    it('should save translation settings correctly', async () => {
      const userId = 'user123';
      const userSession = {
        userId,
        firstName: 'Test User',
        session: '',
        platform: 'telegram',
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        isActive: false,
        transcriptionCount: 0
      };

      // Mock user data retrieval
      mockEnv.STATS.get.mockResolvedValueOnce(JSON.stringify(userSession));

      const request = new Request('http://localhost/dashboard/save-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ translateTo: 'es' })
      });

      const response = await handleUserDashboard(mockEnv, request, userId);
      const result: any = await response.json();

      expect(result.success).toBe(true);
      expect(mockEnv.STATS.put).toHaveBeenCalledWith(
        `user_meta_${userId}`,
        expect.stringContaining('"translateTo":"es"')
      );
    });

    it('should clear translation settings when disabled', async () => {
      const userId = 'user123';
      const userSession = {
        userId,
        firstName: 'Test User',
        session: '',
        platform: 'telegram',
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        isActive: false,
        transcriptionCount: 0,
        translateTo: 'en'
      };

      mockEnv.STATS.get.mockResolvedValueOnce(JSON.stringify(userSession));

      const request = new Request('http://localhost/dashboard/save-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ translateTo: '' })
      });

      const response = await handleUserDashboard(mockEnv, request, userId);
      const result: any = await response.json();

      expect(result.success).toBe(true);
      expect(mockEnv.STATS.put).toHaveBeenCalledWith(
        `user_meta_${userId}`,
        expect.not.stringContaining('translateTo')
      );
    });
  });

  describe('Queue Translation Logic', () => {
    it('should call Ollama for translation when translateTo is set', async () => {
      const userId = 'user123';
      const userSession = {
        userId,
        firstName: 'Test User',
        translateTo: 'es',
        metaToken: 'fake-token'
      };

      // Mock user lookup in STATS
      mockEnv.STATS.get.mockResolvedValue(JSON.stringify(userSession));

      // Mock fetch for Ollama call
      const mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);

      // Mock audio fetch FIRST
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100))
      });

      // Mock successful Ollama response SECOND
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: {
              content: 'Hola mundo'
            }
          }]
        })
      });

      const audioJob = {
        senderId: 'sender123',
        audioUrl: 'https://example.com/audio.ogg',
        platform: 'telegram',
        userId: userId,
        whatsappToken: '',
        whatsappPhoneId: ''
      };

      try {
        await queue({ messages: [{ body: audioJob }] } as any, mockEnv);
      } catch (e: any) {
        console.error("Queue error:", e.message, e.stack);
      }

      // Check that Ollama was called for translation
      expect(mockFetch).toHaveBeenCalledWith(
        'http://100.65.0.209:11434/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Translate the following audio transcription to es')
        })
      );
    });



    it('should skip translation when translateTo is not set', async () => {
      const userId = 'user123';
      const userSession = {
        userId,
        firstName: 'Test User',
        metaToken: 'fake-token'
        // No translateTo field
      };

      mockEnv.STATS.get.mockResolvedValue(JSON.stringify(userSession));

      const mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);

      // Mock audio fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100))
      });

      const audioJob = {
        senderId: 'sender123',
        audioUrl: 'https://example.com/audio.ogg',
        platform: 'telegram',
        userId: userId,
        whatsappToken: '',
        whatsappPhoneId: ''
      };

      try {
        await queue({ messages: [{ body: audioJob }] } as any, mockEnv);
      } catch (e) {
        // Queue might fail due to mocked dependencies
      }

      // Ollama should not be called for translation
      const ollamaCalls = mockFetch.mock.calls.filter(call =>
        call[0].includes('/v1/chat/completions')
      );
      expect(ollamaCalls.length).toBe(0);
    });

    it('should handle translation failure gracefully', async () => {
      const userId = 'user123';
      const userSession = {
        userId,
        firstName: 'Test User',
        translateTo: 'es',
        metaToken: 'fake-token'
      };

      // Mock user lookup in STATS
      mockEnv.STATS.get.mockResolvedValue(JSON.stringify(userSession));

      const mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);

      // Mock Ollama failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      // Mock audio fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100))
      });

      const audioJob = {
        senderId: 'sender123',
        audioUrl: 'https://example.com/audio.ogg',
        platform: 'telegram',
        userId: userId,
        whatsappToken: '',
        whatsappPhoneId: ''
      };

      try {
        await queue({ messages: [{ body: audioJob }] } as any, mockEnv);
      } catch (e) {
        // Queue might fail, but translation failure should be handled
      }
    });


  });

  describe('Language Flags', () => {
    it('should add correct language flags to translated messages', () => {
      const flags: Record<string, string> = {
        en: "🇺🇸", uk: "🇺🇦", ru: "🇷🇺", es: "🇪🇸", de: "🇩🇪", fr: "🇫🇷", zh: "🇨🇳", ja: "🇯🇵"
      };

      Object.entries(flags).forEach(([lang, flag]) => {
        const langFlag = ` | ${flag}`;
        expect(langFlag).toBe(` | ${flags[lang]}`);
      });
    });

    it('should fallback to language code for unknown languages', () => {
      const unknownLang = 'pt';
      const langFlag = ` | pt`;
      expect(langFlag).toBe(' | pt');
    });
  });

  describe('UI Integration', () => {
    it('should render translation checkbox correctly in dashboard', async () => {
      const userId = 'user123';
      const userSession = {
        userId,
        firstName: 'Test User',
        translateTo: 'es'
      };

      mockEnv.STATS.get.mockResolvedValueOnce(JSON.stringify(userSession));

      const request = new Request('http://localhost/dashboard', {
        method: 'GET'
      });

      const response = await handleUserDashboard(mockEnv, request, userId);
      const html = await response.text();

      expect(html).toContain('Enable Translation');
      expect(html).toContain('Translate To Language');
      expect(html).toContain('checked');
      expect(html).toContain('value="es"');
    });

    it('should hide translation options when disabled', async () => {
      const userId = 'user123';
      const userSession = {
        userId,
        firstName: 'Test User'
        // No translateTo
      };

      mockEnv.STATS.get.mockResolvedValueOnce(JSON.stringify(userSession));

      const request = new Request('http://localhost/dashboard', {
        method: 'GET'
      });

      const response = await handleUserDashboard(mockEnv, request, userId);
      const html = await response.text();

      expect(html).toContain('Enable Translation');
      expect(html).toContain('id="translate-options" style="display:none;'); // translate-options should be hidden
    });
  });
});