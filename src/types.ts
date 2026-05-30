export interface KVLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string | ArrayBuffer | ArrayBufferView | ReadableStream, options?: { expirationTtl?: number; expiration?: number; metadata?: any }): Promise<void>;
  delete(key: string): Promise<void>;
}

/** Local ExecutionContext equivalent (subset of Cloudflare's ExecutionContext) */
export interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

/** Local MessageBatch equivalent (subset of Cloudflare's MessageBatch) */
export interface MessageBatch<T> {
  messages: Array<{ body: T }>;
}

export interface Env {
  AI: any;
  AUDIO_QUEUE: any;
  VERIFY_TOKEN: string;
  META_API_VERSION: string;
  META_PAGE_TOKEN: string;
  META_APP_SECRET: string;
  WHATSAPP_PHONE_NUMBER_ID: string;
  WHATSAPP_TOKEN: string;
  TELEGRAM_APP_ID: string;
  TELEGRAM_APP_HASH: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_BOT_USERNAME?: string;
  TELEGRAM_MINI_APP_URL?: string;
  TELEGRAM_CHAT_ID?: string;
  REDIS_URL: string;
  WORKER_URL: string;
  ADMIN_SECRET: string;
  SESSION_SECRET?: string;
  META_APP_ID: string;
  META_THREADS_APP_ID: string;
  META_THREADS_APP_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  META_SYSTEM_USER_TOKEN?: string;
  META_SYSTEM_USER_ID?: string;
  STATS: KVLike;
  // Whisper Config
  WHISPER_PROVIDER?: string;
  WHISPER_SECRET?: string;
  XTTS_URL?: string;
  XTTS_SECRET?: string;
  FUNASR_URL?: string;
  FUNASR_SECRET?: string;
  ASR_PROVIDER?: string;
  ASR_MODEL?: string;

  // SMTP Config
  EMAIL_FROM?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_SECURE?: string;

  // Mail Worker Config
  MAIL_WORKER_URL?: string;
  MAIL_API_TOKEN?: string;

  // Cloudflare Config

  CLOUDFLARE_ZONE_ID?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CF_ACCESS_CLIENT_ID?: string;
  CF_ACCESS_CLIENT_SECRET?: string;
  MANAGER_SECRET?: string;
  MANAGER_URL?: string;
  WA_MANAGER_URL?: string;
  FB_MANAGER_URL?: string;
  INSTA_MANAGER_URL?: string;
  LINE_MANAGER_URL?: string;
  MANAGER_PUBLIC_URL?: string;
  DOMAIN: string;
  NAMESPACE: string;
}

export interface HealthChecks {
  VERIFY_TOKEN: boolean;
  META_PAGE_TOKEN: boolean;
  META_APP_SECRET: boolean;
  WHATSAPP_TOKEN: boolean;
  META_API_VERSION: boolean;
  WHATSAPP_PHONE_NUMBER_ID: boolean;
  TELEGRAM_APP_ID: boolean;
  TELEGRAM_APP_HASH: boolean;
  AUDIO_QUEUE: boolean;
  AI: boolean;
  META_SYSTEM_USER_TOKEN?: boolean;
  LINE_BOT?: boolean;
}

export interface PlatformStats {
  messenger: number;
  instagram: number;
  whatsapp: number;
  telegram: number;
  line: number;
}

export interface AudioJob {
  userId?: string;
  senderId: string;
  audioUrl: string;
  platform: "messenger" | "instagram" | "whatsapp" | "telegram" | "threads" | "line";
  replyToMsgId?: number | string;
}

export interface MetaMessage {
  sender: {
    id: string;
  };
  message?: {
    mid?: string;
    attachments?: Array<{
      type: string;
      payload: {
        url: string;
      };
    }>;
  };
}

export interface MetaWebhookBody {
  object: "page" | "instagram" | string;
  entry?: Array<{
    id: string; // The Page ID
    messaging?: MetaMessage[];
  }>;
}

export interface WhatsAppWebhookBody {
  object: string;
  entry?: Array<{
    changes?: Array<{
      value: {
        metadata?: {
          display_phone_number: string;
          phone_number_id: string;
        };
        messages?: WhatsAppMessage[];
      };
    }>;
  }>;
}

export interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type?: string;
  audio?: {
    id: string;
    mime_type: string;
  };
}

export interface UserSession {
  userId: string;
  // Optional translation language preferences (dashboard settings)
  preferred_translation_lang?: string;
  preferredTranslationLanguage?: string;
  firstName: string;
  username?: string;
  email?: string;
  phone?: string;
  session: string;
  platform: "telegram";
  createdAt: number;
  lastActiveAt?: number;
  isActive: boolean;
  currentStatus?: string;
  lastStartedAt?: number;
  lastStoppedAt?: number;
  transcriptionCount: number;
  tgTranscriptionCount?: number;
  waTranscriptionCount?: number;
  fbTranscriptionCount?: number;
  lineTranscriptionCount?: number;
  instaTranscriptionCount?: number;
  passwordHash?: string;
  emailVerified?: boolean;
  metaToken?: string;
  instagramId?: string;
  threadsToken?: string;
  threadsUserId?: string;
  whatsappToken?: string;
  whatsappPhoneId?: string;
  lineToken?: string;
  lineSecret?: string;
  tgAuthenticated?: boolean;
  podName?: string;
  tgId?: string;
  tgLogin?: string;
  waId?: string;
  waLogin?: string;
  fbId?: string;
  fbLogin?: string;
  igId?: string;
  igLogin?: string;
}

export interface DiagnosticResult {
  status: 'healthy' | 'unhealthy' | 'error' | 'unknown';
  message: string;
}

export interface DiagnosticResults {
  redis: DiagnosticResult;
  mongodb: DiagnosticResult;
  manager: DiagnosticResult;
  asr: DiagnosticResult;
  k8s: DiagnosticResult;
}
