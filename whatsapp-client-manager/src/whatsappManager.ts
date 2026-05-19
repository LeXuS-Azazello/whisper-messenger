import { WhatsAppClient, WhatsAppClientConfig } from '../../whatsapp-client/src/whatsappClient';
import { Env } from '../../src/types';
import { Message } from 'whatsapp-web.js';
import fs from 'fs/promises';
import path from 'path';

export class WhatsAppManager {
  private clients: Map<string, WhatsAppClient> = new Map();
  private qrCodes: Map<string, string> = new Map();
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  async bootstrap() {
    console.log('[WhatsAppManager] Bootstrapping connected clients...');
    
    // Find all users who have a WhatsApp session in KV/Redis
    // Since KV is not searchable, we typically rely on a list of active users in DB 
    // or a specific prefix. In this case, we can iterate through known users if provided
    // For now, we'll assume the system will call a recovery method or 
    // we'll implement a background scan of session keys if the KV allows.
    
    // For simplicity, you can call this method from the main server start
  }

  async initUserClient(userId: string) {
    if (this.clients.has(userId)) {
      return { status: 'already_running' };
    }

    const client = new WhatsAppClient({
      userId,
      env: this.env,
      onQR: (qr) => {
        this.qrCodes.set(userId, qr);
        console.log(`[WhatsAppManager] QR generated for user ${userId}`);
      },
      onReady: () => {
        this.qrCodes.delete(userId);
        console.log(`[WhatsAppManager] User ${userId} is now connected`);
      },
      onMessage: async (msg, uid) => {
        await this.handleIncomingMessage(msg, uid);
      }
    });

    this.clients.set(userId, client);
    await client.start();
    
    return { status: 'starting' };
  }

  async handleIncomingMessage(msg: Message, userId: string) {
    if (msg.hasMedia && msg.type === 'audio') {
      const media = await (msg as any).download();
      if (media) {
        const fileName = `wa_${userId}_${Date.now()}.ogg`;
        const filePath = path.join(process.cwd(), 'public/audio', fileName);
        
        await fs.mkdir(path.join(process.cwd(), 'public/audio'), { recursive: true });
        await fs.writeFile(filePath, media.data);
        
        const audioUrl = `${this.env.DOMAIN}/audio/${fileName}`;
        
        console.log(`[WhatsAppManager] Audio received from ${msg.from}, forwarding to queue...`);
        
        await this.env.AUDIO_QUEUE.send({
          userId: userId,
          senderId: msg.from,
          audioUrl: audioUrl,
          platform: 'whatsapp',
          replyToMsgId: msg.id
        });
      }
    }
  }

  async sendMessage(userId: string, to: string, text: string) {
    const client = this.clients.get(userId);
    if (!client) throw new Error('Client not initialized for this user');
    await client.sendMessage(to, text);
  }

  getQR(userId: string): string | null {
    return this.qrCodes.get(userId) || null;
  }

  async stopClient(userId: string) {
    const client = this.clients.get(userId);
    if (client) {
      await client.stop();
      this.clients.delete(userId);
    }
  }

  isConnected(userId: string): boolean {
    return this.clients.has(userId) && !this.qrCodes.has(userId);
  }
}
