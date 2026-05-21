import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLocalJid,
  باسورد
} from 'baileys';
import { Boom } from '@wb2/boom';
import qrcode from 'qrcode';
import { Env } from '../../src/types';
import pino from 'pino';

export interface WhatsAppClientConfig {
  userId: string;
  env: Env;
  onQR: (qr: string, info: string) => void;
  onPairingCode: (code: string) => void;
  onReady: () => void;
  onMessage: (msg: any, userId: string) => Promise<void>;
}

export class WhatsAppClient {
  private sock: any;
  private userId: string;
  private env: Env;
  private onQR: (qr: string, info: string) => void;
  private onPairingCode: (code: string) => void;
  private onReady: () => void;
  private onMessage: (msg: any, userId: string) => Promise<void>;
  private authState: any;

  constructor(config: WhatsAppClientConfig) {
    this.userId = config.userId;
    this.env = config.env;
    this.onQR = config.onQR;
    this.onPairingCode = config.onPairingCode;
    this.onReady = config.onReady;
    this.onMessage = config.onMessage;
  }

  private async initAuth() {
    // Custom auth store using the provided Env.STATS
    const state = {
      creds: {},
      keys: {
        preKey: {},
        session: {},
        appState: {},
        net: {}
      }
    };

    const loadCreds = async () => {
      const data = await this.env.STATS.get(`wa_session_${this.userId}`);
      return data ? JSON.parse(data) : null;
    };

    const saveCreds = async (creds: any) => {
      await this.env.STATS.put(`wa_session_${this.userId}`, JSON.stringify(creds));
    };

    return { state, saveCreds, loadCreds };
  }

  async start(phoneNumber?: string) {
    const { state, saveCreds, loadCreds } = await this.initAuth();
    const savedCreds = await loadCreds();
    if (savedCreds) {
      state.creds = savedCreds;
    }

    this.sock = makeWASocket({
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('connection.update', async (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log(`[WhatsAppClient ${this.userId}] Connection closed. Reconnecting: ${shouldReconnect}`);
        if (shouldReconnect) {
          this.start(phoneNumber);
        }
      } else if (connection === 'open') {
        console.log(`[WhatsAppClient ${this.userId}] Client is ready!`);
        this.onReady();
      } else if (qr) {
        try {
          const qrImage = await qrcode.toDataURL(qr);
          const infoText = "After scanning the code, WhatsApp will forcibly disconnect you, forcing a reconnect such that we can present the authentication credentials. Don't worry, this is not an error";
          this.onQR(qrImage, infoText);
        } catch (err) {
          console.error(`[WhatsAppClient ${this.userId}] QR Generation Error:`, err);
        }
      }
    });

    this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type === 'notify') {
        for (const msg of messages) {
          if (!msg.key.fromMe) {
            await this.onMessage(msg, this.userId);
          }
        }
      }
    });

    if (phoneNumber) {
      // Pairing code request
      setTimeout(async () => {
        try {
          const code = await this.sock.requestPairingCode(phoneNumber);
          this.onPairingCode(code);
        } catch (err) {
          console.error(`[WhatsAppClient ${this.userId}] Pairing Code Error:`, err);
        }
      }, 3000);
    }
  }

  async stop() {
    if (this.sock) {
      await this.sock.logout();
      await this.sock.close();
    }
  }

  async sendMessage(to: string, text: string) {
    const jid = to.includes('@s.whatsapp.net') ? to : `${to}@s.whatsapp.net`;
    await this.sock.sendMessage(jid, { text });
  }

  async getClient() {
    return this.sock;
  }
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
