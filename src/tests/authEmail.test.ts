import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendEmail } from '../controllers/authController';
import { Env } from '../types';

describe('Auth Email Sender Integration', () => {
  let mockEnv: Env;
  let fetchSpy: any;

  beforeEach(() => {
    mockEnv = {
      MAIL_WORKER_URL: 'https://voicemsg-mail.voicemsg.net',
      MAIL_API_TOKEN: 'test-api-token-123',
      EMAIL_FROM: 'no-reply@voicemsg.net',
      DOMAIN: 'voicemsg.net',
    } as any;

    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call the Cloudflare Mail Worker with correct parameters for template emails', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, message: 'Email sent successfully' })
    } as any);

    const result = await sendEmail(
      mockEnv,
      'user@example.com',
      'Verify Email',
      '<h2>Verify</h2>',
      'verification',
      { name: 'John Doe', link: 'https://voicemsg.net/verify' }
    );

    expect(result).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith('https://voicemsg-mail.voicemsg.net/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-api-token-123'
      },
      body: JSON.stringify({
        to: 'user@example.com',
        subject: 'Verify Email',
        template: 'verification',
        data: { name: 'John Doe', link: 'https://voicemsg.net/verify' }
      })
    });
  });

  it('should fall back to MailChannels if the Cloudflare Mail Worker returns non-ok status', async () => {
    // 1st call to mail worker returns 500
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error'
    } as any);

    // 2nd call to MailChannels succeeds
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      text: async () => 'MailChannels Success'
    } as any);

    const result = await sendEmail(
      mockEnv,
      'user@example.com',
      'Verify Email',
      '<h2>Verify</h2>',
      'verification',
      { name: 'John Doe', link: 'https://voicemsg.net/verify' }
    );

    expect(result).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    // Check first call (mail worker)
    expect(fetchSpy.mock.calls[0][0]).toBe('https://voicemsg-mail.voicemsg.net/send');

    // Check second call (MailChannels fallback)
    expect(fetchSpy.mock.calls[1][0]).toBe('https://api.mailchannels.net/tx/v1/send');
    expect(JSON.parse(fetchSpy.mock.calls[1][1].body)).toEqual({
      personalizations: [{ to: [{ email: 'user@example.com' }] }],
      from: { email: 'no-reply@voicemsg.net', name: 'Voice Messenger' },
      subject: 'Verify Email',
      content: [{ type: 'text/html', value: '<h2>Verify</h2>' }]
    });
  });

  it('should fall back to MailChannels if fetch throws an exception', async () => {
    // 1st call throws error
    fetchSpy.mockRejectedValueOnce(new Error('Network offline'));

    // 2nd call to MailChannels succeeds
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      text: async () => 'MailChannels Success'
    } as any);

    const result = await sendEmail(
      mockEnv,
      'user@example.com',
      'Verify Email',
      '<h2>Verify</h2>',
      'verification',
      { name: 'John Doe', link: 'https://voicemsg.net/verify' }
    );

    expect(result).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[1][0]).toBe('https://api.mailchannels.net/tx/v1/send');
  });
});
