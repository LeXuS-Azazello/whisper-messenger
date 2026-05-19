import { Client, RemoteAuth, Message } from 'whatsapp-web.js';
import qrcode from 'qrcode';
import { Env } from '../../src/types';
import fs from 'fs/promises';
import path from 'path';

export interface WhatsAppClientConfig {
  userId: string;
  env: Env;
  onQR: (qr: string) => void;
  onReady: () => void;
  onMessage: (msg: Message, userId: string) => Promise<void>;
}

export class WhatsAppClient {
  private client: Client;
  private userId: string;
  private env: Env;
  private onQR: (qr: string) => void;
  private onReady: () => void;
  private onMessage: (msg: Message, userId: string) => Promise<void>;

  constructor(config: WhatsAppClientConfig) {
    this.userId = config.userId;
    this.env = config.env;
    this.onQR = config.onQR;
    this.onReady = config.onReady;
    this.onMessage = config.onMessage;

    this.client = new Client({
      authStrategy: new RemoteAuth({
        clientId: this.userId,
        backupSyncIntervalMs: 60000,
        store: {
          save: async (data) => {
            await this.env.STATS.put(`wa_session_${this.userId}`, JSON.stringify(data));
          },
          extract: async () => {
            const data = await this.env.STATS.get(`wa_session_${this.userId}`);
            return data ? JSON.parse(data) : null;
          },
          delete: async () => {
            await this.env.STATS.delete(`wa_session_${this.userId}`);
          },
          sessionExists: async (options?: any) => {
            const data = await this.env.STATS.get(`wa_session_${this.userId}`);
            return !!data;
          }
        }
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-root-user-downgrade'
        ]
      }
    });

    this.setupHandlers();
  }

  private setupHandlers() {
    this.client.on('qr', async (qr) => {
      try {
        const qrImage = await qrcode.toDataURL(qr);
        this.onQR(qrImage);
      } catch (err) {
        console.error(`[WhatsAppClient ${this.userId}] QR Generation Error:`, err);
      }
    });

    this.client.on('ready', () => {
      console.log(`[WhatsAppClient ${this.userId}] Client is ready!`);
      this.onReady();
    });

    this.client.on('authenticated', () => {
      console.log(`[WhatsAppClient ${this.userId}] Authenticated`);
    });

    this.client.on('message', async (msg) => {
      try {
        await this.onMessage(msg, this.userId);
      } catch (err) {
        console.error(`[WhatsAppClient ${this.userId}] Message Error:`, err);
      }
    });
  }

  async start() {
    await this.client.initialize();
  }

  async stop() {
    await this.client.destroy();
  }

  async sendMessage(to: string, text: string) {
    const formattedTo = to.includes('@c.us') ? to : `${to}@c.us`;
    await this.client.sendMessage(formattedTo, text);
  }

  async getClient() {
    return this.client;
  }
}
