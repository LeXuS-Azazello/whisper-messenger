import { Env } from '../../src/types';

// Whisper service configuration
export const WHISPER_PROVIDER = process.env.WHISPER_PROVIDER || 'http://whisper-service.debugging-testcrash-pub.svc.cluster.local:8000';
export const WHISPER_SECRET = process.env.WHISPER_SECRET || null;

// Worker/Manager URL for notifications
export const WORKER_URL = process.env.WORKER_URL || 'http://whatsapp-client-manager:3000';
export const MANAGER_SECRET = process.env.MANAGER_SECRET || 'changeme';

// User ID from environment
export const TARGET_USER_ID = process.env.TARGET_USER_ID || null;

// Mode (USER, MANAGER, TEST)
export const MODE = process.env.MODE || 'USER';

export default {
  WHISPER_PROVIDER,
  WHISPER_SECRET,
  WORKER_URL,
  MANAGER_SECRET,
  TARGET_USER_ID,
  MODE
};