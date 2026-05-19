import { makeWASocket, delay, DisconnectReason, proto, useMultiFileAuthState } from '@whiskeysockets/baileys';
import qrcode from 'qrcode';
import { Env } from '../../src/types';
import fs from 'fs/promises';
import path from 'path';

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
      } else if (connection === 'close' && lastDisconnect?.error && lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut) {
        console.error(`[WhatsAppBaileysClient ${this.userId}] Connection closed due to error:`, lastDisconnect.error);
        await delay(5000);
        this.initialize();
      } else if (qr) {
        try {
          const qrImage = await qrcode.toDataURL(qr);
          const infoText = "After scanning the code, WhatsApp will forcibly disconnect you, forcing a reconnect such that we can present the authentication credentials. Don't worry, this is not an error";
          this.onQR(qrImage, infoText);
        } catch (err) {
          console.error(`[WhatsAppBaileysClient ${this.userId}] QR Generation Error:`, err);
        }
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
      setTimeout(async () => {
        try {
          const code = await this.sock?.requestPairingCode(phoneNumber);
          if (code) {
            this.onPairingCode(code);
          } else {
            console.warn(`[WhatsAppBaileysClient ${this.userId}] Pairing code was not returned`);
          }
        } catch (err) {
          console.error(`[WhatsAppBaileysClient ${this.userId}] Pairing Code Error:`, err);
        }
      }, 3000);
    }
  }

  async start(phoneNumber?: string) {
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
    await this.sock.sendMessage(jid, { text });
  }

  async getClient() {
    return this.sock;
  }
}
