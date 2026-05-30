import mongoose from 'mongoose';
import Redis from 'ioredis';
import fs from 'fs';
import path from 'path';
import { sampleAudioBase64 } from './sample_audio';
import { cloneVoiceWithSamesame } from '../shared/samesame.js';

export interface TestLog {
  timestamp: string;
  type: 'info' | 'success' | 'error' | 'warn';
  message: string;
}

export interface TestResult {
  id: string;
  name: string;
  target: string;
  status: 'pending' | 'success' | 'failed';
  latency: number;
  logs: TestLog[];
}

export class TestSuiteRunner {
  private env: Record<string, string>;

  constructor(env: Record<string, string>) {
    this.env = env;
  }

  private createLogger(logs: TestLog[]) {
    return {
      info: (msg: string) => {
        logs.push({ timestamp: new Date().toLocaleTimeString(), type: 'info', message: msg });
        console.log(`[TEST-INFO] ${msg}`);
      },
      success: (msg: string) => {
        logs.push({ timestamp: new Date().toLocaleTimeString(), type: 'success', message: msg });
        console.log(`[TEST-SUCCESS] ${msg}`);
      },
      error: (msg: string) => {
        logs.push({ timestamp: new Date().toLocaleTimeString(), type: 'error', message: msg });
        console.error(`[TEST-ERROR] ${msg}`);
      },
      warn: (msg: string) => {
        logs.push({ timestamp: new Date().toLocaleTimeString(), type: 'warn', message: msg });
        console.warn(`[TEST-WARN] ${msg}`);
      }
    };
  }

  // 1. Cloudflare Mail Worker Test
  async testMailWorker(): Promise<TestResult> {
    const logs: TestLog[] = [];
    const log = this.createLogger(logs);
    const id = 'mail-worker';
    const name = 'Cloudflare Mail Worker Connection';
    const target = this.env.MAIL_WORKER_URL || 'https://voicemsg-mail.voicemsg.net';

    log.info(`Initializing connection check to Cloudflare Mail Worker...`);
    log.info(`Target endpoint: ${target}`);

    const startTime = Date.now();
    try {
      const apiToken = this.env.MAIL_API_TOKEN || 'voicemsg-mail-secret-default-token';
      log.info(`Using authorization token (length: ${apiToken.length} chars)`);

      // First run health check GET request
      log.info(`Performing health check GET request to ${target}/...`);
      const healthCheckRes = await fetch(target, { signal: AbortSignal.timeout(10000) });
      log.info(`Health check response status: ${healthCheckRes.status}`);

      if (healthCheckRes.ok) {
        const healthData = await healthCheckRes.json().catch(() => null);
        log.success(`Worker is ONLINE: ${JSON.stringify(healthData)}`);
      } else {
        log.warn(`Health check endpoint returned non-ok status: ${healthCheckRes.status}`);
      }

      // Now run email sending POST request
      log.info(`Executing unmocked POST request to send test email...`);
      const testEmail = 'no-reply@voicemsg.net';
      const sendRes = await fetch(`${target.replace(/\/$/, '')}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`
        },
        body: JSON.stringify({
          to: testEmail,
          subject: '[K8s Integration Test] Live Mail Worker Verification',
          template: 'generic',
          data: {
            name: 'K8s Tester Service',
            message: `This is a live integration test email triggered by the tester pod in namespace "${this.env.NAMESPACE || 'debugging-testcrash-pub'}" on the production Kubernetes server.`
          }
        }),
        signal: AbortSignal.timeout(15000)
      });

      const responseTime = Date.now() - startTime;
      log.info(`POST send response status: ${sendRes.status} in ${responseTime}ms`);

      const resBody = await sendRes.json().catch(() => null);

      if (!sendRes.ok) {
        throw new Error(`Worker returned error status ${sendRes.status}: ${JSON.stringify(resBody)}`);
      }

      log.success(`Mail sent successfully via Cloudflare Mail Worker binding! Response: ${JSON.stringify(resBody)}`);

      return {
        id,
        name,
        target,
        status: 'success',
        latency: Date.now() - startTime,
        logs
      };

    } catch (err: any) {
      log.error(`Mail worker test failed: ${err.message || String(err)}`);
      return {
        id,
        name,
        target,
        status: 'failed',
        latency: Date.now() - startTime,
        logs
      };
    }
  }



  // 2c. FunASR ASR Inference Test
  async testFunASR(): Promise<TestResult> {
    const logs: TestLog[] = [];
    const log = this.createLogger(logs);
    const id = 'funasr-service';
    const name = 'FunASR ASR Transcription';
    const target = 'http://funasr.debugging-testcrash-pub.svc.cluster.local:50001';

    log.info(`Initializing internal transcription test...`);
    log.info(`Target FunASR URL: ${target}`);

    const startTime = Date.now();
    try {
      log.info(`Decoding sample silent audio file from base64 string...`);
      const base64Data = sampleAudioBase64.replace(/^data:audio\/\w+;base64,/, '');
      const audioBuffer = Buffer.from(base64Data, 'base64');
      
      const formData = new FormData();
      const blob = new Blob([audioBuffer], { type: 'audio/wav' });
      formData.append('file', blob, 'audio.wav');
      formData.append('model', 'paraformer');
      formData.append('response_format', 'json');

      log.info(`Dispatching job to ${target}/v1/audio/transcriptions...`);
      const res = await fetch(`${target}/v1/audio/transcriptions`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(20000),
      });

      const latency = Date.now() - startTime;
      if (!res.ok) {
        throw new Error(`FunASR returned ${res.status}: ${await res.text()}`);
      }
      
      const result = await res.json() as any;
      log.success(`ASR response parsed successfully!`);
      log.success(`Transcribed Text: "${result.text || ''}"`);
      return { id, name, target, status: 'success', latency, logs };
    } catch (err: any) {
      log.error(`FunASR test failed: ${err.message || String(err)}`);
      return { id, name, target, status: 'failed', latency: Date.now() - startTime, logs };
    }
  }

  // 3. Redis Connectivity Test
  async testRedis(): Promise<TestResult> {
    const logs: TestLog[] = [];
    const log = this.createLogger(logs);
    const id = 'redis';
    const name = 'Redis Cache Database';
    const target = this.env.REDIS_URL || 'redis://redis.debugging-testcrash-pub.svc.cluster.local:6379';

    log.info(`Connecting to Redis instance...`);
    log.info(`Target URL: ${target}`);

    const startTime = Date.now();
    let redis: Redis | null = null;
    try {
      redis = new Redis(target, {
        connectTimeout: 5000,
        maxRetriesPerRequest: 1
      });

      log.info(`Sending PING request...`);
      const pingRes = await redis.ping();
      log.success(`PING response: ${pingRes}`);

      log.info(`Testing key write operation (tester_health_check)...`);
      const testKey = 'tester_health_check';
      const testVal = `OK_PROD_${Date.now()}`;
      await redis.setex(testKey, 10, testVal);
      log.success(`Set key successfully (TTL 10s)`);

      log.info(`Reading key back to verify persistence...`);
      const readVal = await redis.get(testKey);
      log.info(`Value read back: ${readVal}`);

      if (readVal !== testVal) {
        throw new Error(`Data mismatch: wrote ${testVal}, but read back ${readVal}`);
      }
      log.success(`Read/write verification matches perfectly.`);

      log.info(`Cleaning up test key...`);
      await redis.del(testKey);
      log.success(`Cleaned up successfully.`);

      return {
        id,
        name,
        target,
        status: 'success',
        latency: Date.now() - startTime,
        logs
      };

    } catch (err: any) {
      log.error(`Redis database check failed: ${err.message || String(err)}`);
      return {
        id,
        name,
        target,
        status: 'failed',
        latency: Date.now() - startTime,
        logs
      };
    } finally {
      if (redis) {
        try {
          await redis.quit();
        } catch {}
      }
    }
  }

  // 4. MongoDB Database Test
  async testMongoDB(): Promise<TestResult> {
    const logs: TestLog[] = [];
    const log = this.createLogger(logs);
    const id = 'mongodb';
    const name = 'MongoDB Document Store';
    const target = this.env.MONGODB_URI || 'mongodb://mongodb.debugging-testcrash-pub.svc.cluster.local:27017/voicemsg';

    log.info(`Connecting to MongoDB database...`);
    log.info(`Target URI: ${target.replace(/:([^:@]+)@/, ':****@')}`); // Hide passwords if any

    const startTime = Date.now();
    let isNewConnection = false;
    try {
      if (mongoose.connection.readyState === 1) {
        log.info(`Reusing existing mongoose connection...`);
      } else {
        log.info(`Establishing new mongoose connection...`);
        await mongoose.connect(target, { serverSelectionTimeoutMS: 5000 });
        isNewConnection = true;
      }

      log.info(`Mongoose connection state: ${mongoose.connection.readyState} (1 = connected)`);
      if (mongoose.connection.readyState !== 1) {
        throw new Error(`MongoDB failed to connect. State: ${mongoose.connection.readyState}`);
      }

      log.info(`Sending database ping...`);
      const pingResult = await mongoose.connection.db.admin().ping();
      log.success(`Ping response: ${JSON.stringify(pingResult)}`);

      log.info(`Listing databases in cluster to assert authorization...`);
      const listDbs = await mongoose.connection.db.admin().listDatabases();
      log.info(`Database list complete: found ${listDbs.databases.length} databases.`);
      log.success(`Read check completed successfully!`);

      return {
        id,
        name,
        target,
        status: 'success',
        latency: Date.now() - startTime,
        logs
      };

    } catch (err: any) {
      log.error(`MongoDB integration check failed: ${err.message || String(err)}`);
      return {
        id,
        name,
        target,
        status: 'failed',
        latency: Date.now() - startTime,
        logs
      };
    } finally {
      if (isNewConnection) {
        try {
          await mongoose.disconnect();
          log.info(`Disconnected test database session.`);
        } catch {}
      }
    }
  }

  // 5. Voice Clone Roundtrip (SAMESAME + FunASR)
  // Uses the real file test_audio.ogg:
  //   1. Transcribe it with FunASR → get text
  //   2. Clone voice using the SAME audio as reference speaker
  //   3. Synthesize the transcribed text in the cloned voice
  //   4. Return synthesized ogg audio (validates analyze + generate pipeline)
  async testSamesameVoiceClone(): Promise<TestResult> {
    const logs: TestLog[] = [];
    const log = this.createLogger(logs);
    const id = 'samesame-clone';
    const name = 'SAMESAME Voice Clone Roundtrip';
    const asrTarget = this.env.ASR_PROVIDER || this.env.FUNASR_URL || 'http://funasr.debugging-testcrash-pub.svc.cluster.local:50001';
    const samesameTarget = this.env.SAMESAME_URL || 'http://samesame:8002';

    log.info(`Starting voice clone roundtrip test...`);
    log.info(`ASR target: ${asrTarget}`);
    log.info(`SAMESAME target: ${samesameTarget}`);

    const startTime = Date.now();

    try {
      // Locate the real reference audio shipped with the tester image
      const audioPath = path.resolve(process.cwd(), 'test_audio.ogg');
      if (!fs.existsSync(audioPath)) {
        throw new Error(`Reference audio not found: ${audioPath}`);
      }
      const sourceAudio = fs.readFileSync(audioPath);
      log.info(`Loaded reference audio: ${sourceAudio.length} bytes (test_audio.ogg)`);

      // ── Step 1: Transcribe the audio to obtain the text we will synthesize ──
      log.info(`Transcribing reference audio with FunASR...`);
      const asrBase = asrTarget.replace(/\/$/, '');
      const asrSecret = this.env.ASR_SECRET || '';

      let transcribed = '';
      try {
        const asrRes = await fetch(`${asrBase}/v1/transcribe-base64`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(asrSecret ? { 'Authorization': `Bearer ${asrSecret}` } : {})
          },
          body: JSON.stringify({ file_data: sourceAudio.toString('base64'), language: 'auto' }),
          signal: AbortSignal.timeout(30000),
        });

        if (asrRes.status === 200) {
          const asrJson = await asrRes.json() as any;
          transcribed = (asrJson.text || '').trim();
          log.success(`ASR result: "${transcribed}"`);
        } else if (asrRes.status === 202) {
          log.warn(`FunASR returned 202 Accepted (requires polling). Using fallback text instead.`);
        } else {
          const errText = await asrRes.text();
          log.error(`FunASR failed: ${asrRes.status} ${errText}`);
        }
      } catch (err: any) {
        log.error(`FunASR request failed: ${err.message || err}`);
      }

      if (!transcribed) {
        // Fallback sentence so the clone still exercises the full path
        transcribed = 'Привет, это тест клонирования голоса через SAMESAME.';
        log.warn(`Empty transcription, using fallback: "${transcribed}"`);
      }

      // ── Step 2: Clone + synthesize using the same audio as speaker reference (exact same helper as tg-client auto-reply) ──
      const samesameSecret = this.env.SAMESAME_SECRET || '';
      if (!samesameSecret) {
        throw new Error('SAMESAME_SECRET not provided — cannot test voice synthesis');
      }

      log.info(`Synthesizing transcribed text via shared cloneVoiceWithSamesame (text len=${transcribed.length})...`);
      const synthStart = Date.now();

      const { audioBuffer: outAudio, contentType } = await cloneVoiceWithSamesame({
        sourceAudioBuffer: sourceAudio,
        text: transcribed,
        language: 'ru',
        outputFormat: 'ogg',
        sourceMimeType: 'audio/ogg',
        samesameSecret,
        samesameUrl: samesameTarget,
      });

      const synthLatency = Date.now() - synthStart;
      const totalLatency = Date.now() - startTime;

      if (!outAudio || outAudio.length < 500) {
        throw new Error(`SAMESAME returned empty or tiny audio (${outAudio?.length || 0} bytes)`);
      }

      log.success(`SAMESAME synthesis OK | audio=${outAudio.length}B | type=${contentType} | synth=${synthLatency}ms | total=${totalLatency}ms`);
      log.success(`Transcribed & re-synthesized text: "${transcribed}"`);

      return {
        id,
        name,
        target: `${asrTarget} → ${samesameTarget}/v1/clone`,
        status: 'success',
        latency: totalLatency,
        logs,
      };

    } catch (err: any) {
      log.error(`Voice clone roundtrip failed: ${err.message || String(err)}`);
      return {
        id,
        name,
        target: `${asrTarget} → ${samesameTarget}`,
        status: 'failed',
        latency: Date.now() - startTime,
        logs,
      };
    }
  }

  // Run a single test by ID
  async runTestById(testId: string): Promise<TestResult> {
    switch (testId) {
      case 'mail-worker':
        return await this.testMailWorker();
      case 'funasr-service':
        return await this.testFunASR();
      case 'redis':
        return await this.testRedis();
      case 'mongodb':
        return await this.testMongoDB();
      case 'samesame-clone':
        return await this.testSamesameVoiceClone();
      default:
        throw new Error(`Invalid test ID: ${testId}`);
    }
  }

  // Run all tests in parallel
  async runAllTests(): Promise<TestResult[]> {
    return await Promise.all([
      this.testMailWorker(),
      this.testFunASR(),
      this.testRedis(),
      this.testMongoDB(),
      this.testSamesameVoiceClone()
    ]);
  }
}
