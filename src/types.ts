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
  BRIDGE_URL: string;
  BRIDGE_SECRET: string;
  WORKER_URL: string;
  ADMIN_SECRET: string;
  STATS: KVNamespace;
}

export interface PlatformStats {
  messenger: number;
  instagram: number;
  whatsapp: number;
  telegram: number;
}

export interface AudioJob {
  senderId: string;
  audioUrl: string;
  platform: "messenger" | "instagram" | "whatsapp" | "telegram";
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
    messaging?: MetaMessage[];
  }>;
}

export interface WhatsAppWebhookBody {
  object: string;
  entry?: Array<{
    changes?: Array<{
      value: {
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
  transcriptionCount: number;
}
