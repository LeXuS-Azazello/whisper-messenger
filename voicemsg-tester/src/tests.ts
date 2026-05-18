import mongoose from 'mongoose';
import Redis from 'ioredis';
import { sampleAudioBase64 } from './sample_audio.js';

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
      const testEmail = 'test-k8s@voicemsg.net';
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

  // 2. Whisper-Turbo ASR Inference Test
  async testWhisperTurbo(): Promise<TestResult> {
    const logs: TestLog[] = [];
    const log = this.createLogger(logs);
    const id = 'whisper-turbo';
    const name = 'Whisper-Turbo ASR Transcription';
    const target = this.env.WHISPER_TURBO_URL || 'http://whisper-turbo.debugging-testcrash-pub.svc.cluster.local:8000';

    log.info(`Initializing internal transcription test...`);
    log.info(`Target ASR engine URL: ${target}`);

    const startTime = Date.now();
    try {
      log.info(`Decoding sample silent audio file from base64 string...`);
      const base64Data = sampleAudioBase64.replace(/^data:audio\/\w+;base64,/, '');
      const audioBuffer = Buffer.from(base64Data, 'base64');
      log.info(`Decoded audio buffer size: ${audioBuffer.byteLength} bytes`);

      log.info(`Preparing FormData with model configuration...`);
      const formData = new FormData();
      const blob = new Blob([audioBuffer], { type: 'audio/ogg' });
      formData.append('file', blob, 'audio.ogg');
      formData.append('model', 'openai/whisper-large-v3-turbo');
      formData.append('language', 'auto');

      const whisperSecret = this.env.LOCAL_WHISPER_SECRET || '';
      log.info(`Dispatching request to ${target}/v1/audio/transcriptions...`);

      const response = await fetch(`${target.replace(/\/$/, '')}/v1/audio/transcriptions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${whisperSecret}`
        },
        body: formData,
        signal: AbortSignal.timeout(30000) // 30s timeout
      });

      const latency = Date.now() - startTime;
      log.info(`Whisper Turbo responded with status ${response.status} in ${latency}ms`);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ASR engine returned error ${response.status}: ${errorText}`);
      }

      const result = await response.json() as any;
      log.success(`ASR response parsed successfully! Result payload: ${JSON.stringify(result)}`);
      log.success(`Transcribed Text: "${result.text || ''}"`);

      return {
        id,
        name,
        target,
        status: 'success',
        latency,
        logs
      };

    } catch (err: any) {
      log.error(`ASR test failed: ${err.message || String(err)}`);
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

  // Run a single test by ID
  async runTestById(testId: string): Promise<TestResult> {
    switch (testId) {
      case 'mail-worker':
        return await this.testMailWorker();
      case 'whisper-turbo':
        return await this.testWhisperTurbo();
      case 'redis':
        return await this.testRedis();
      case 'mongodb':
        return await this.testMongoDB();
      default:
        throw new Error(`Invalid test ID: ${testId}`);
    }
  }

  // Run all tests in parallel
  async runAllTests(): Promise<TestResult[]> {
    return await Promise.all([
      this.testMailWorker(),
      this.testWhisperTurbo(),
      this.testRedis(),
      this.testMongoDB()
    ]);
  }
}
