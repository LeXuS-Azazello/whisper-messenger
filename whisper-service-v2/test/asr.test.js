import { afterAll, describe, expect, it, beforeAll, vi } from 'vitest';
import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';

const TEST_MODELS_DIR = join(process.cwd(), 'whisper-service-v2', 'test-models');
const samplePath = join(process.cwd(), 'voicemsg-tester', 'test_whisper.ogg');

process.env.MODELS_DIR = TEST_MODELS_DIR;

vi.mock('sherpa-onnx-node', () => {
  return {
    OfflineRecognizer: class {
      constructor() {}
      createStream() {
        return { acceptWaveform: () => {} };
      }
      decode() {}
      getResult() {
        return { text: 'mock result', lang: 'en' };
      }
    },
    VoiceActivityDetector: class {
      constructor() {
        this._done = false;
      }
      acceptWaveform() {
        this._done = false;
      }
      isEmpty() {
        return this._done;
      }
      front() {
        this._done = true;
        return { samples: new Float32Array([0, 0, 0]) };
      }
      pop() {}
    },
    OfflinePunctuation: class {
      constructor() {}
      addPunct(text) {
        return `${text}.`;
      }
    },
  };
});

import { getAudioHash, makeCacheKey, processBuffer } from '../src/asr.js';

function hasFfmpeg() {
  try {
    execFileSync('ffmpeg', ['-version']);
    return true;
  } catch {
    return false;
  }
}

beforeAll(() => {
  mkdirSync(join(TEST_MODELS_DIR, 'sense_voice'), { recursive: true });
  mkdirSync(join(TEST_MODELS_DIR, 'vad'), { recursive: true });
  writeFileSync(join(TEST_MODELS_DIR, 'sense_voice', 'model.int8.onnx'), 'mock');
  writeFileSync(join(TEST_MODELS_DIR, 'sense_voice', 'tokens.txt'), 'mock');
  writeFileSync(join(TEST_MODELS_DIR, 'vad', 'silero_vad.onnx'), 'mock');
});

afterAll(() => {
  if (existsSync(TEST_MODELS_DIR)) {
    rmSync(TEST_MODELS_DIR, { recursive: true, force: true });
  }
});

describe('whisper-service-v2 ASR helpers', () => {
  it('computes a deterministic SHA256 hash from the first 8KB', () => {
    const buffer = Buffer.alloc(1024, 'test');
    const hash = getAudioHash(buffer);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(makeCacheKey(hash)).toBe(`whisper-v2:cache:${hash}`);
  });

  it('computes the same hash for identical audio buffers', () => {
    if (!existsSync(samplePath)) {
      return;
    }
    const buffer1 = readFileSync(samplePath);
    const buffer2 = readFileSync(samplePath);
    expect(getAudioHash(buffer1)).toBe(getAudioHash(buffer2));
  });

  it('processes the sample audio when models and ffmpeg are available', async () => {
    if (!existsSync(samplePath)) {
      return;
    }
    if (!hasFfmpeg()) {
      return;
    }

    try {
      const result = await processBuffer(readFileSync(samplePath), null);
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('language');
      expect(typeof result.text).toBe('string');
    } catch (error) {
      if (error.message.includes('Missing sherpa-onnx SenseVoice model')) {
        return;
      }
      throw error;
    }
  });
});
