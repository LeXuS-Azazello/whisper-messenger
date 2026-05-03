/// <reference types="@cloudflare/workers-types/2023-07-01" />

export interface KVLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string | ArrayBuffer | ArrayBufferView | ReadableStream, options?: { expirationTtl?: number; expiration?: number; metadata?: any }): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface Env {
  AI: Ai;
  AUDIO_QUEUE: Queue;
  VERIFY_TOKEN: string;
  META_API_VERSION: string;
  META_PAGE_TOKEN: string;
  META_APP_SECRET: string;
  WHATSAPP_PHONE_NUMBER_ID: string;
  WHATSAPP_TOKEN: string;
  TELEGRAM_APP_ID: string;
  TELEGRAM_APP_HASH: string;
  TELEGRAM_BOT_TOKEN: string;
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
  WHISPER_PROVIDER?: "cloudflare" | "local" | "ollama" | "qwen3-asr";
  LOCAL_WHISPER_URL?: string;
  LOCAL_WHISPER_SECRET?: string;
  OLLAMA_BASE_URL?: string;
  OLLAMA_MODEL?: string;
  
  // SMTP Config
  EMAIL_FROM?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_SECURE?: string;

  // Cloudflare Config
  CLOUDFLARE_GLOBAL_TOKEN?: string;
  CLOUDFLARE_ZONE_ID?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CF_ACCESS_CLIENT_ID?: string;
  CF_ACCESS_CLIENT_SECRET?: string;
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
  firstName: string;
  username?: string;
  email?: string;
  phone?: string;
  session: string;
  platform: "telegram";
  createdAt: number;
  lastActiveAt: number;
  isActive: boolean;
  currentStatus?: string;
  lastStartedAt?: number;
  lastStoppedAt?: number;
  transcriptionCount: number;
  metaToken?: string;
  instagramId?: string;
  threadsToken?: string;
  threadsUserId?: string;
  whatsappToken?: string;
  whatsappPhoneId?: string;
  lineToken?: string;
  lineSecret?: string;
  translateTo?: string;
  tgAuthenticated?: boolean;
}
