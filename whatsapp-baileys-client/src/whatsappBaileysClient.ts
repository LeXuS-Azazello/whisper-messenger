import { makeWASocket, delay, DisconnectReason, proto, useMultiFileAuthState, downloadMediaMessage } from 'baileys';
import qrcode from 'qrcode';
import { Env } from '../../src/types';
import fs from 'fs/promises';
import path from 'path';
import { 
  getPreferredTranslationLang, 
  reportQR, 
  reportPairingCode, 
  clearConnectionCodes,
  reportStatus,
  getLangLabel
} from './config.js';

export interface WhatsAppBaileysClientConfig {
  userId: string;
  env: Env;
  onQR: (qrImage: string, info: string) => void;
  onPairingCode: (code: string) => void;
  onReady: () => void;
  onMessage: (msg: proto.IWebMessageInfo, userId: string) => Promise<void>;
}

export class WhatsAppBaileysClient {
  private sock: ReturnType<typeof makeWASocket> | null = null;
  private userId: string;
  private env: Env;
  private onQR: (qrImage: string, info: string) => void;
  private onPairingCode: (code: string) => void;
  private onReady: () => void;
  private onMessage: (msg: proto.IWebMessageInfo, userId: string) => Promise<void>;
  private authState: { state: any; saveCreds: () => Promise<void> } | null = null;

  constructor(config: WhatsAppBaileysClientConfig) {
    this.userId = config.userId;
    this.env = config.env;
    this.onQR = config.onQR;
    this.onPairingCode = config.onPairingCode;
    this.onReady = config.onReady;
    this.onMessage = config.onMessage;
  }

  private setupHandlers() {
    if (!this.sock) return;

    this.sock.ev.on('creds.update', async () => {
      await this.authState?.saveCreds();
    });

    this.sock.ev.on('connection.update', async (update: any) => {
      const { connection, lastDisconnect, qr } = update;
      if (connection === 'open') {
        console.log(`[WhatsAppBaileysClient ${this.userId}] Client is ready!`);
        this.onReady();
        await clearConnectionCodes();
        await reportStatus('ready');
      } else if (connection === 'close' && lastDisconnect?.error && lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut) {
        console.error(`[WhatsAppBaileysClient ${this.userId}] Connection closed due to error:`, lastDisconnect.error);
        await reportStatus('error');
        await delay(5000);
        this.initialize();
      } else if (qr) {
        try {
          const qrImage = await qrcode.toDataURL(qr);
          const infoText = "After scanning the code, WhatsApp will forcibly disconnect you, forcing a reconnect such that we can present the authentication credentials. Don't worry, this is not an error";
          this.onQR(qrImage, infoText);
          await reportQR(qrImage, infoText);
          await reportStatus('qr');
        } catch (err) {
          console.error(`[WhatsAppBaileysClient ${this.userId}] QR Generation Error:`, err);
        }
      }
    });

    this.sock.ev.on('messages.upsert', async (m: any) => {
      const msg = m.messages[0];
      try {
        // Process voice messages directly in the client (per-user POD model)
        if (msg?.message?.audioMessage || msg?.message?.voiceMessage) {
          await this.processVoiceMessage(msg);
        }

        // Still forward to manager for other logic / logging
        await this.onMessage(msg, this.userId);
      } catch (err) {
        console.error(`[WhatsAppBaileysClient ${this.userId}] Message Error:`, err);
      }
    });
  }

  async initialize(phoneNumber?: string) {
    const { state, saveCreds } = await useMultiFileAuthState(
      path.join(process.cwd(), 'sessions', `baileys_${this.userId}`)
    );
    this.authState = { state, saveCreds };

    this.sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: ['Baileys', 'Chrome', ''],
    });

    this.setupHandlers();

    if (phoneNumber) {
      await reportStatus('pairing');
      setTimeout(async () => {
        try {
          const code = await this.sock?.requestPairingCode(phoneNumber);
          if (code) {
            this.onPairingCode(code);
            await reportPairingCode(code);
            await reportStatus('pairing');
          } else {
            console.warn(`[WhatsAppBaileysClient ${this.userId}] Pairing code was not returned`);
          }
        } catch (err) {
          console.error(`[WhatsAppBaileysClient ${this.userId}] Pairing Code Error:`, err);
        }
      }, 3000);
    } else {
      await reportStatus('connecting');
    }
  }

  async start(phoneNumber?: string) {
    await reportStatus('connecting');
    await this.initialize(phoneNumber);
  }

  async stop() {
    if (this.sock) {
      try {
        if (typeof (this.sock as any).logout === 'function') {
          await (this.sock as any).logout();
        } else if ((this.sock as any).ws) {
          (this.sock as any).ws.close();
        }
      } catch (e) {
        console.error('Error stopping socket:', e);
      }
      this.sock = null;
    }
  }

  async sendMessage(to: string, text: string) {
    if (!this.sock) throw new Error('Client not initialized');
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

    const chunks = this.splitTextIntoChunks(text, 3900);

    for (let i = 0; i < chunks.length; i++) {
      let part = chunks[i];
      if (chunks.length > 1) {
        part = `(Part ${i + 1}/${chunks.length})\n\n${part}`;
      }
      await this.sock.sendMessage(jid, { text: part });
      if (i < chunks.length - 1) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }

  private splitTextIntoChunks(text: string, limit: number = 3900): string[] {
    if (!text) return [];
    if (text.length <= limit) return [text];

    const chunks: string[] = [];
    let currentChunk = '';
    const paragraphs = text.split('\n');

    for (const paragraph of paragraphs) {
      const addition = currentChunk ? '\n' + paragraph : paragraph;

      if (addition.length > limit) {
        if (currentChunk) {
          chunks.push(currentChunk);
          currentChunk = '';
        }

        // Split long paragraph by sentences
        const sentences = paragraph.match(/[^.!?]+[.!?]+(\s+|$)/g) || [paragraph];
        for (const sentence of sentences) {
          const clean = sentence.trim();
          if (!clean) continue;

          if (currentChunk && (currentChunk + ' ' + clean).length > limit) {
            chunks.push(currentChunk);
            currentChunk = clean;
          } else {
            currentChunk = currentChunk ? currentChunk + ' ' + clean : clean;
          }
        }
      } else {
        if (currentChunk && (currentChunk + '\n' + paragraph).length > limit) {
          chunks.push(currentChunk);
          currentChunk = paragraph;
        } else {
          currentChunk = currentChunk ? currentChunk + '\n' + paragraph : paragraph;
        }
      }
    }

    if (currentChunk) chunks.push(currentChunk);
    return chunks.filter(Boolean);
  }

  async getClient() {
    return this.sock;
  }

  private async processVoiceMessage(msg: any) {
    try {
      const sock = this.sock;
      if (!sock) return;

      const isVoice = !!msg.message?.voiceMessage;
      const mediaType = isVoice ? 'voice' : 'audio';

      console.log(`[WhatsAppBaileysClient ${this.userId}] Processing ${mediaType} message from ${msg.key?.remoteJid}`);

      // Download audio
      const buffer = await downloadMediaMessage(
        msg,
        'buffer',
        {},
        {
          logger: console as any,
          reacquireMediaKey: async () => undefined
        } as any
      );

      if (!buffer) {
        console.warn(`[WhatsAppBaileysClient ${this.userId}] Failed to download voice media`);
        return;
      }

      // Get user's preferred translation language from Redis
      const targetLang = await getPreferredTranslationLang(this.userId);

      // Call whisper-service-v2
      const base64Data = Buffer.from(buffer as Buffer).toString('base64');

      const whisperUrl = process.env.WHISPER_URL ||
        'http://whisper-service-v2.debugging-testcrash-pub.svc.cluster.local:8000';

      const payload: any = {
        file_data: base64Data,
        language: 'auto',
      };
      if (targetLang) {
        payload.target_language = targetLang;
      }

      const whisperRes = await fetch(`${whisperUrl}/v1/transcribe-base64`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.WHISPER_SECRET || ''}`
        },
        body: JSON.stringify(payload),
      });

      if (!whisperRes.ok) {
        const errText = await whisperRes.text();
        throw new Error(`Whisper error: ${whisperRes.status} ${errText}`);
      }

      const result = await whisperRes.json() as any;

      const originalText = (result.text || '').trim();
      const translatedText = result.translated ? result.translated.trim() : null;
      const detectedLang = result.language || 'unknown';

      if (!originalText) {
        console.log(`[WhatsAppBaileysClient ${this.userId}] Empty transcription`);
        return;
      }

      // Format with flags (same style as tg-client)
      let replyText = `${getLangLabel(detectedLang)} ${originalText}`;

      if (translatedText && targetLang) {
        const targetLabel = getLangLabel(targetLang);
        replyText += `\n\n${targetLabel} ${translatedText}`;
      }

      // Send reply to the sender
      const senderJid = msg.key?.remoteJid;
      if (senderJid) {
        await this.sendMessage(senderJid, replyText);
        console.log(`[WhatsAppBaileysClient ${this.userId}] Replied with transcription`);
      }

    } catch (err: any) {
      console.error(`[WhatsAppBaileysClient ${this.userId}] Voice processing error:`, err.message);
    }
  }


}
