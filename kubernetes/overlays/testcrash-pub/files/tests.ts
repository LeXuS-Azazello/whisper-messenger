import mongoose from 'mongoose';
import Redis from 'ioredis';
import fs from 'fs';
import path from 'path';
import { sampleAudioBase64 } from './sample_audio';
import { cloneVoiceWithSamesame } from '../../../shared/samesame.js';

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



    async testFunASR(): Promise<TestResult> {
      const logs: TestLog[] = [];
      const log = this.createLogger(logs);
      const id = 'funasr-service';
      const name = 'FunASR ASR Transcription';
      const target = this.env.FUNASR_URL || 'http://funasr:50001';

      log.info(`Initializing internal transcription test...`);
      log.info(`Target FunASR URL: ${target}`);

      const startTime = Date.now();
      try {
        log.info(`Decoding sample silent audio file...`);
        const base64Data = sampleAudioBase64.replace(/^data:audio\/\w+;base64,/, '');
        
        log.info(`Dispatching job to ${target}/v1/transcribe-base64...`);
        const res = await fetch(`${target}/v1/transcribe-base64`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            file_data: base64Data, 
            language: 'auto' 
          }),
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
    const target = this.env.REDIS_URL || 'redis://redis:6379';

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
    const target = this.env.MONGODB_URI || 'mongodb://mongodb:27017/voicemsg';

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

  // 6. SAMESAME Translation Synthesis Test
  async testSamesameTranslation(): Promise<TestResult> {
    const logs: TestLog[] = [];
    const log = this.createLogger(logs);
    const id = 'samesame-translate';
    const name = 'SAMESAME Translation & Synth';
    const samesameTarget = this.env.SAMESAME_URL || 'http://samesame:8002';

    log.info(`Initializing translation and synthesis test...`);
    const startTime = Date.now();
    try {
      const samesameSecret = this.env.SAMESAME_SECRET || '';
      if (!samesameSecret) throw new Error('SAMESAME_SECRET missing');

      const audioPath = path.resolve(process.cwd(), 'test_audio.ogg');
      if (!fs.existsSync(audioPath)) throw new Error(`Audio not found: ${audioPath}`);
      const sourceAudio = fs.readFileSync(audioPath);

      const testText = "Hello, this is a translation test from English to Russian";
      log.info(`Synthesizing: "${testText}" in RU...`);

      const { audioBuffer, contentType } = await cloneVoiceWithSamesame({
        sourceAudioBuffer: sourceAudio,
        text: testText,
        language: 'ru',
        outputFormat: 'ogg',
        sourceMimeType: 'audio/ogg',
        samesameSecret,
        samesameUrl: samesameTarget,
      });

      if (!audioBuffer || audioBuffer.length < 500) {
        throw new Error(`SAMESAME returned empty audio`);
      }

      log.success(`Translation synthesis OK | audio=${audioBuffer.length}B | type=${contentType}`);
      return { id, name, target: samesameTarget, status: 'success', latency: Date.now() - startTime, logs };
    } catch (err: any) {
      log.error(`Translation test failed: ${err.message || String(err)}`);
      return { id, name, target: samesameTarget, status: 'failed', latency: Date.now() - startTime, logs };
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
        return await this.testSamesameTranslation();
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
      this.testSamesameTranslation()
    ]);
  }
}
