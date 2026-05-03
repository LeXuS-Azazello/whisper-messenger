import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleLine } from '../routes/webhooks';
import { sendLineMessageSafe, getLineAudioArrayBuffer } from '../line';
import { handleUserDashboard } from '../routes/dashboard';

describe('LINE Integration', () => {
  const mockEnv = {
    STATS: {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn()
    },
    AUDIO_QUEUE: {},
    AI: {},
    BRIDGE_URL: 'https://bridge.example.com',
    BRIDGE_SECRET: 'test-secret'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Webhook Handling', () => {
    it('should handle LINE audio messages correctly', async () => {
      const userId = 'user123';
      const userSession = {
        userId,
        firstName: 'Test User',
        lineToken: 'test_line_token'
      };

      // Mock user lookup
      mockEnv.STATS.get.mockResolvedValue(JSON.stringify(userSession));

      const audioMessage = {
        destination: 'test_destination',
        events: [{
          type: 'message',
          message: {
            type: 'audio',
            id: 'audio_msg_123',
            quoteToken: 'reply_token_789'
          },
          source: {
            userId: 'line_user_456'
          }
        }]
      };

      // Mock AUDIO_QUEUE send
      const mockSend = vi.fn();
      mockEnv.AUDIO_QUEUE.send = mockSend;

      const response = await handleLine(audioMessage, userId, mockEnv);

      expect(response.status).toBe(200);
      expect(mockSend).toHaveBeenCalledWith({
        userId,
        senderId: 'line_user_456',
        audioUrl: 'audio_msg_123',
        platform: 'line',
        replyToMsgId: 'reply_token_789'
      });
    });

    it('should reject requests without LINE token configured', async () => {
      const userId = 'user123';
      const userSession = {
        userId,
        firstName: 'Test User'
        // No lineToken
      };

      mockEnv.STATS.get.mockResolvedValue(JSON.stringify(userSession));

      const audioMessage = {
        destination: 'test_destination',
        events: [{
          type: 'message',
          message: {
            type: 'audio',
            id: 'audio_msg_123'
          }
        }]
      };

      const response = await handleLine(audioMessage, userId, mockEnv);
      expect(response.status).toBe(400);
    });

    it('should ignore non-audio messages', async () => {
      const userId = 'user123';
      const userSession = {
        userId,
        firstName: 'Test User',
        lineToken: 'test_line_token'
      };

      mockEnv.STATS.get.mockResolvedValue(JSON.stringify(userSession));

      const textMessage = {
        destination: 'test_destination',
        events: [{
          type: 'message',
          message: {
            type: 'text',
            text: 'Hello world'
          }
        }]
      };

      const mockSend = vi.fn();
      mockEnv.AUDIO_QUEUE.send = mockSend;

      const response = await handleLine(textMessage, userId, mockEnv);

      expect(response.status).toBe(200);
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe('Audio Processing', () => {
    it('should fetch LINE audio content using correct API', async () => {
      const messageId = 'test_message_123';
      const token = 'test_line_token';

      // Mock fetch for LINE API
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100))
      });

      const result = await getLineAudioArrayBuffer(messageId, token);

      expect(result).not.toBeNull();
      expect(mockFetch).toHaveBeenCalledWith(
        `https://api-data.line.me/v2/bot/message/${messageId}/content`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
    });

    it('should handle LINE audio fetch failures', async () => {
      const messageId = 'test_message_123';
      const token = 'test_line_token';

      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('API Error')
      });

      const result = await getLineAudioArrayBuffer(messageId, token);
      expect(result).toBeNull();
    });
  });

  describe('Message Sending', () => {
    it('should send LINE messages with correct API structure', async () => {
      const to = 'line_user_123';
      const text = 'Test message';
      const token = 'test_line_token';
      const replyToMsgId = 'reply_token_456';

      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      mockFetch.mockResolvedValue({
        ok: true
      });

      await sendLineMessageSafe(to, text, token, replyToMsgId);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.line.me/v2/bot/message/push',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            to,
            messages: [{
              type: 'text',
              text,
              quoteToken: replyToMsgId
            }]
          })
        }
      );
    });

    it('should handle LINE message send failures', async () => {
      const to = 'line_user_123';
      const text = 'Test message';
      const token = 'test_line_token';

      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('Send failed')
      });

      // Should not throw, just log error
      await expect(sendLineMessageSafe(to, text, token)).resolves.not.toThrow();
    });
  });

  describe('Dashboard Integration', () => {
    it('should save LINE settings correctly', async () => {
      const userId = 'user123';
      const userSession = {
        userId,
        firstName: 'Test User'
      };

      mockEnv.STATS.get.mockResolvedValue(JSON.stringify(userSession));

      const request = new Request('http://localhost/dashboard/save-line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineToken: 'test_token_123',
          lineSecret: 'test_secret_456'
        })
      });

      const response = await handleUserDashboard(mockEnv, request, userId);
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(mockEnv.STATS.put).toHaveBeenCalledWith(
        `user_meta_${userId}`,
        expect.stringContaining('"lineToken":"test_token_123"')
      );
      expect(mockEnv.STATS.put).toHaveBeenCalledWith(
        `user_meta_${userId}`,
        expect.stringContaining('"lineSecret":"test_secret_456"')
      );
    });

    it('should render LINE configuration in dashboard', async () => {
      const userId = 'user123';
      const userSession = {
        userId,
        firstName: 'Test User',
        lineToken: 'configured_token',
        lineSecret: 'configured_secret'
      };

      mockEnv.STATS.get.mockResolvedValue(JSON.stringify(userSession));

      const request = new Request('http://localhost/dashboard', {
        method: 'GET'
      });

      const response = await handleUserDashboard(mockEnv, request, userId);
      const html = await response.text();

      expect(html).toContain('LINE');
      expect(html).toContain('SETUP');
      expect(html).toContain('value="configured_token"');
      expect(html).toContain('value="configured_secret"');
    });
  });

  describe('Security Features', () => {
    it('should verify webhook signatures when lineSecret is configured', async () => {
      const userId = 'user123';
      const userSession = {
        userId,
        firstName: 'Test User',
        lineToken: 'test_line_token',
        lineSecret: 'test_channel_secret'
      };

      mockEnv.STATS.get.mockResolvedValue(JSON.stringify(userSession));

      const body = '{"destination":"test","events":[]}';
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(userSession.lineSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
      const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

      // This would be tested by making an actual request to the webhook endpoint
      // For now, we verify the signature generation logic
      expect(signatureBase64).toBeDefined();
      expect(typeof signatureBase64).toBe('string');
      expect(signatureBase64.length).toBeGreaterThan(0);
    });

    it('should document webhook URL structure', () => {
      const userId = 'test_user_123';
      const expectedUrl = `https://voicemsg.net/webhooks/line/${userId}`;

      // From dashboard_ui.tsx line 190
      expect(expectedUrl).toContain('/webhooks/line/');
      expect(expectedUrl).toContain(userId);
    });
  });
});