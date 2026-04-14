/// <reference types="@cloudflare/workers-types/2023-07-01" />

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
  BRIDGE_URL: string;
  BRIDGE_SECRET: string;
  WORKER_URL: string;
  ADMIN_SECRET: string;
  SESSION_SECRET?: string;
  META_APP_ID: string;
  META_THREADS_APP_ID: string;
  META_THREADS_APP_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  STATS: KVNamespace;
  // Whisper Config
  WHISPER_PROVIDER?: "cloudflare" | "local" | "ollama";
  LOCAL_WHISPER_URL?: string;
  LOCAL_WHISPER_SECRET?: string;
  OLLAMA_BASE_URL?: string;
  
  // SMTP Config
  EMAIL_FROM?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_SECURE?: string;
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
}

export interface PlatformStats {
  messenger: number;
  instagram: number;
  whatsapp: number;
  telegram: number;
}

export interface AudioJob {
  userId?: string;
  senderId: string;
  audioUrl: string;
  platform: "messenger" | "instagram" | "whatsapp" | "telegram" | "threads";
  replyToMsgId?: number;
}

export interface MetaMessage {
  sender: {
    id: string;
  };
  message?: {
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
  phone?: string;
  session: string;
  platform: "telegram";
  createdAt: number;
  lastActiveAt: number;
  isActive: boolean;
  lastStartedAt?: number;
  lastStoppedAt?: number;
  transcriptionCount: number;
  metaToken?: string;
  instagramId?: string;
  threadsToken?: string;
  threadsUserId?: string;
  whatsappToken?: string;
  whatsappPhoneId?: string;
}
