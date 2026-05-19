import { WhatsAppBaileysClient } from '../../whatsapp-baileys-client/src/whatsappBaileysClient';
import { Env } from '../../src/types';
import fs from 'fs/promises';
import path from 'path';
import { downloadMediaMessage } from '@whiskeysockets/baileys';

export class WhatsAppBaileysManager {
  private clients: Map<string, WhatsAppBaileysClient> = new Map();
  private qrCodes: Map<string, { qr: string, info: string }> = new Map();
  private pairingCodes: Map<string, string> = new Map();
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  async bootstrap() {
    console.log('[WhatsAppBaileysManager] Bootstrapping connected clients...');
  }

  async initUserClient(userId: string, phoneNumber?: string) {
    if (this.clients.has(userId)) {
      return { status: 'already_running' };
    }

    const client = new WhatsAppBaileysClient({
      userId,
      env: this.env,
      onQR: (qr, info) => {
        this.qrCodes.set(userId, { qr, info });
        console.log(`[WhatsAppBaileysManager] QR generated for user ${userId}`);
      },
      onPairingCode: (code) => {
        this.pairingCodes.set(userId, code);
        console.log(`[WhatsAppBaileysManager] Pairing code generated for user ${userId}: ${code}`);
      },
      onReady: () => {
        this.qrCodes.delete(userId);
        this.pairingCodes.delete(userId);
        console.log(`[WhatsAppBaileysManager] User ${userId} is now connected`);
      },
      onMessage: async (msg, uid) => {
        await this.handleIncomingMessage(msg, uid);
      }
    });

    this.clients.set(userId, client);
    await client.start(phoneNumber);

    return { status: 'starting' };
  }

  async handleIncomingMessage(msg: any, userId: string) {
    if (msg?.message?.audioMessage || msg?.message?.voiceMessage) {
      try {
        const client = this.clients.get(userId);
        if (!client) throw new Error('Client not found');
        const sock = await client.getClient();
        if (!sock) throw new Error('Socket not initialized');

        const media = await downloadMediaMessage(
          msg,
          'buffer',
          {},
          {
            logger: console as any,
            reacquireMediaKey: async () => { return undefined; }
          } as any
        );
        if (media) {
          const fileName = `wa_${userId}_${Date.now()}.ogg`;
          const filePath = path.join(process.cwd(), 'public/audio', fileName);

          await fs.mkdir(path.join(process.cwd(), 'public/audio'), { recursive: true });
          await fs.writeFile(filePath, media);

          const audioUrl = `${this.env.DOMAIN}/audio/${fileName}`;

          console.log(`[WhatsAppBaileysManager] Audio received from ${msg.key?.remoteJid}, forwarding to queue...`);

          await this.env.AUDIO_QUEUE.send({
            userId: userId,
            senderId: msg.key?.remoteJid || '',
            audioUrl: audioUrl,
            platform: 'whatsapp_baileys',
            replyToMsgId: msg.key?.id || ''
          });
        }
      } catch (err) {
        console.error(`[WhatsAppBaileysManager] Error processing audio message:`, err);
      }
    }
  }

  async sendMessage(userId: string, to: string, text: string) {
    const client = this.clients.get(userId);
    if (!client) throw new Error('Client not initialized for this user');
    await client.sendMessage(to, text);
  }

  getQR(userId: string): { qr: string, info: string } | null {
    return this.qrCodes.get(userId) || null;
  }

  getPairingCode(userId: string): string | null {
    return this.pairingCodes.get(userId) || null;
  }

  async stopClient(userId: string) {
    const client = this.clients.get(userId);
    if (client) {
      await client.stop();
      this.clients.delete(userId);
    }
  }

  isConnected(userId: string): boolean {
    return this.clients.has(userId) && !this.qrCodes.has(userId) && !this.pairingCodes.has(userId);
  }
}

