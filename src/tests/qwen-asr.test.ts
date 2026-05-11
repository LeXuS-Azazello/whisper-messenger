import { describe, it, expect, vi, beforeEach } from 'vitest';
import { transcribeWithFallback } from '../whisper';
import { Env } from '../types';
import { sampleAudioBase64 } from '../sample_audio';

describe('Qwen3-ASR Transcription', () => {
  let mockEnv: Env;
  const audioBuffer = Buffer.from(sampleAudioBase64.split(',')[1], 'base64').buffer;

  beforeEach(() => {
    mockEnv = {
      STATS: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
      },
      OLLAMA_BASE_URL: 'http://qwen3-asr:11434',
      WHISPER_PROVIDER: 'qwen3-asr',
      // ... other fields as needed
    } as any;
  });

  it('should call Qwen3-ASR endpoint with correct format', async () => {
    // Mock the fetch call
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({ text: 'Hello world from Qwen3' }),
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    (mockEnv.STATS.get as any).mockImplementation((key: string) => {
      if (key === 'config_whisper_provider') return Promise.resolve('qwen3-asr');
      if (key === 'config_ollama_url') return Promise.resolve('http://qwen3-asr:11434');
      return Promise.resolve(null);
    });

    const result = await transcribeWithFallback(audioBuffer, mockEnv);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/v1/audio/transcriptions'),
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      })
    );
    const callBody = (global.fetch as any).mock.calls[0][1].body as FormData;
    expect(callBody.get('model')).toBe('qwen3-asr');
    expect(result.text).toBe('Hello world from Qwen3');
    expect(result.model).toBe('Qwen3-ASR');
  });

  it('should handle hallucination cleanup (repeating sentences)', async () => {
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({ text: "I'm testing. I'm testing. I'm testing." }),
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    (mockEnv.STATS.get as any).mockResolvedValue('qwen3-asr');

    const result = await transcribeWithFallback(audioBuffer, mockEnv);

    // Should remove the 3rd repetition
    expect(result.text).toBe("I'm testing. I'm testing.");
  });

  it('should throw error if server returns error', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    (mockEnv.STATS.get as any).mockResolvedValue('qwen3-asr');

    await expect(transcribeWithFallback(audioBuffer, mockEnv)).rejects.toThrow('Qwen3-ASR error 500: Internal Server Error');
  });
});
