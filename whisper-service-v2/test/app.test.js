import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

vi.mock('bullmq', () => ({
  Job: {
    fromId: vi.fn(async () => null),
  },
}));

vi.mock('sherpa-onnx-node', () => ({
  OfflineRecognizer: class {
    createStream() {
      return { acceptWaveform: () => { } };
    }
    decode() { }
    getResult() {
      return { text: '', lang: 'en' };
    }
  },
  VAD: class {
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
      return { samples: new Float32Array([0, 0]) };
    }
    pop() { }
  },
  OfflinePunctuation: class {
    addPunct(text) {
      return text;
    }
  },
}));

vi.mock('../src/queue.js', () => {
  const mockWaitUntilFinished = vi.fn();
  return {
    asrQueue: {
      add: vi.fn(async () => ({
        id: 'job-1',
        waitUntilFinished: mockWaitUntilFinished,
      })),
    },
    asrQueueEvents: {},
    redisCache: {
      get: vi.fn(),
      llen: vi.fn(async () => 0),
    },
    __mockWaitUntilFinished: mockWaitUntilFinished,
  };
});

import { app } from '../src/app.js';
import * as queue from '../src/queue.js';

describe('whisper-service-v2 API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when file_data is missing', async () => {
    const res = await request(app).post('/v1/transcribe-base64').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Missing file_data');
  });

  it('returns cached result when Redis cache has a hit', async () => {
    queue.redisCache.get.mockResolvedValueOnce(JSON.stringify({ text: 'cached', language: 'auto' }));

    const res = await request(app)
      .post('/v1/transcribe-base64')
      .send({ file_data: Buffer.from('hello').toString('base64') });

    expect(res.status).toBe(200);
    expect(res.body.cache_hit).toBe(true);
    expect(res.body.text).toBe('cached');
    expect(queue.asrQueue.add).not.toHaveBeenCalled();
  });

  it('enqueues a new job and returns the transcription result', async () => {
    queue.redisCache.get.mockResolvedValueOnce(null);
    queue.__mockWaitUntilFinished.mockResolvedValueOnce({ text: 'ok', language: 'auto' });

    const res = await request(app)
      .post('/v1/transcribe-base64')
      .send({ file_data: Buffer.from('hello world').toString('base64') });

    expect(res.status).toBe(200);
    expect(res.body.text).toBe('ok');
    expect(res.body.cache_hit).toBe(false);
    expect(queue.asrQueue.add).toHaveBeenCalled();
  });

  it('returns processing status when queue response times out', async () => {
    queue.redisCache.get.mockResolvedValueOnce(null);
    queue.__mockWaitUntilFinished.mockRejectedValueOnce(new Error('timeout'));

    const res = await request(app)
      .post('/v1/transcribe-base64')
      .send({ file_data: Buffer.from('timeout test').toString('base64') });

    expect(res.status).toBe(202);
    expect(res.body.status).toBe('processing');
    expect(res.body.jobId).toBe('job-1');
  });
});
