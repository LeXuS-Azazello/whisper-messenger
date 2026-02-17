export interface Env {
  AI: Ai;
  AUDIO_QUEUE: Queue;
  VERIFY_TOKEN: string;
  META_API_VERSION: string;
  META_PAGE_TOKEN: string;
}

export interface AudioJob {
  senderId: string;
  audioUrl: string;
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
  object: string;
  entry?: Array<{
    messaging?: MetaMessage[];
  }>;
}
