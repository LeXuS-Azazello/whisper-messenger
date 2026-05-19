import { makeWASocket, useSingleFileAuthState, delay, DisconnectReason, proto } from '@whiskeysockets/baileys';
import qrcode from 'qrcode';
import { Env } from '../../src/types';
import fs from 'fs/promises';
import path from 'path';

export interface WhatsAppBaileysClientConfig {
  userId: string;
  env: Env;
  onQR: (qr: string) => void;
  onReady: () => void;
  onMessage: (msg: proto.IWebMessageInfo, userId: string) => Promise<void>;
}

export class WhatsAppBaileysClient {
  private sock: ReturnType<typeof makeWASocket> | null = null;
  private userId: string;
  private env: Env;
  private onQR: (qr: string) => void;
  private onReady: () => void;
  private onMessage: (msg: proto.IWebMessageInfo, userId: string) => Promise<void>;
  private authState: { state: any; saveCreds: () => Promise<void> } | null = null;

  constructor(config: WhatsAppBaileysClientConfig) {
    this.userId = config.userId;
    this.env = config.env;
    this.onQR = config.onQR;
    this.onReady = config.onReady;
    this.onMessage = config.onMessage;
  }

  private setupHandlers() {
    if (!this.sock) return;

    this.sock.ev.on('creds.update', async () => {
      await this.authState?.saveCreds();
    });

    this.sock.ev.on('connection.update', async (update: any) => {
      const { connection, lastDisconnect } = update;
      if (connection === 'open') {
        console.log(`[WhatsAppBaileysClient ${this.userId}] Client is ready!`);
        this.onReady();
      } else if (connection === 'close' && lastDisconnect?.error && lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut) {
        console.error(`[WhatsAppBaileysClient ${this.userId}] Connection closed due to error:`, lastDisconnect.error);
        // Reconnect after delay
        await delay(5000);
        this.initialize();
      }
    });

    this.sock.ev.on('messages.upsert', async (m: any) => {
      try {
        await this.onMessage(m.messages[0], this.userId);
      } catch (err) {
        console.error(`[WhatsAppBaileysClient ${this.userId}] Message Error:`, err);
      }
    });
  }

  async initialize() {
    // Load or create auth state
    this.authState = useSingleFileAuthState(
      path.join(process.cwd(), 'sessions', `baileys_${this.userId}.json`)
    );

    this.sock = makeWASocket({
      auth: this.authState,
      printQRInTerminal: false,
      browser: ['Baileys', 'Chrome', '']
    });

    this.setupHandlers();

    // Event for QR code
    this.sock.ev.on('connection.update', async (update : any) => {
      const { qr } = update;
      if (qr) {
        try {
          const qrImage = await qrcode.toDataURL(qr);
          this.onQR(qrImage);
        } catch (err) {
          console.error(`[WhatsAppBaileysClient ${this.userId}] QR Generation Error:`, err);
        }
      }
    });
  }

  async start() {
    await this.initialize();
  }

  async stop() {
    if (this.sock) {
      await this.sock.close();
      this.sock = null;
    }
  }

  async sendMessage(to: string, text: string) {
    if (!this.sock) throw new Error('Client not initialized');
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    await this.sock.sendMessage(jid, { text });
  }

  async getClient() {
    return this.sock;
  }
}