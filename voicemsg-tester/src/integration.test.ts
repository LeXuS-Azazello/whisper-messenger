import { describe, it, expect, beforeAll } from 'vitest';
import { TestSuiteRunner } from './tests';

describe('Voice Messenger Production Cluster Integration Tests', () => {
  let runner: TestSuiteRunner;

  beforeAll(() => {
    // Assert required environment secrets are set
    console.log('[Vitest Setup] Checking environment secrets...');
    runner = new TestSuiteRunner(process.env as any);
  });

  it('should successfully establish handshake with Cloudflare Mail Worker and send a diagnostic email', async () => {
    const result = await runner.testMailWorker();
    console.log(`[Vitest Result] Mail Worker: ${result.status} in ${result.latency}ms`);
    
    // Print logs to standard output
    result.logs.forEach(log => {
      console.log(`  [${log.type.toUpperCase()}] ${log.message}`);
    });

    expect(result.status).toBe('success');
  }, 20000); // 20s timeout

  it('should successfully transcribe base64 audio utilizing Whisper-Turbo ASR engine', async () => {
    const result = await runner.testWhisperTurbo();
    console.log(`[Vitest Result] Whisper-Turbo: ${result.status} in ${result.latency}ms`);
    
    result.logs.forEach(log => {
      console.log(`  [${log.type.toUpperCase()}] ${log.message}`);
    });

    expect(result.status).toBe('success');
  }, 35000); // 35s timeout

  it('should verify latency and perform TTL key read/write verification on Redis cache database', async () => {
    const result = await runner.testRedis();
    console.log(`[Vitest Result] Redis Database: ${result.status} in ${result.latency}ms`);
    
    result.logs.forEach(log => {
      console.log(`  [${log.type.toUpperCase()}] ${log.message}`);
    });

    expect(result.status).toBe('success');
  }, 10000); // 10s timeout

  it('should assert connection health and run database administrative ping on MongoDB document store', async () => {
    const result = await runner.testMongoDB();
    console.log(`[Vitest Result] MongoDB Database: ${result.status} in ${result.latency}ms`);
    
    result.logs.forEach(log => {
      console.log(`  [${log.type.toUpperCase()}] ${log.message}`);
    });

    expect(result.status).toBe('success');
  }, 10000); // 10s timeout

  it('should perform full voice clone roundtrip: test_whisper.ogg → Whisper ASR → SAMESAME clone + synthesis of the recognized text', async () => {
    const result = await runner.testSamesameVoiceClone();
    console.log(`[Vitest Result] SAMESAME Voice Clone: ${result.status} in ${result.latency}ms`);
    
    result.logs.forEach(log => {
      console.log(`  [${log.type.toUpperCase()}] ${log.message}`);
    });

    expect(result.status).toBe('success');
  }, 240000); // up to 4 minutes (first run may need model load + heavy inference)
});
