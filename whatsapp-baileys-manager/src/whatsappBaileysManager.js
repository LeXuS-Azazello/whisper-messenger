import * as k8s from './k8s.js';
import { redis } from './config.js'; // for session fallback if needed

// Note: We no longer import the in-memory client here.
// The manager now acts purely as a control plane that spawns K8s pods.

export class WhatsAppBaileysManager {
  constructor(env) {
    this.env = env;
  }

  async bootstrap() {
    console.log('[WhatsAppBaileysManager] Bootstrapping — running reconciliation for WhatsApp Baileys pods...');
    try {
      await k8s.runReconciliation?.();
    } catch (e) {
      console.error('[WhatsAppBaileysManager] Reconciliation failed:', e);
    }
  }

  async initUserClient(userId, phoneNumber) {
    // With pod-per-user model we always call spawn (k8s.js will handle dedup inside)
    try {
      // Try to get fresh session from Redis first (new sessions are usually here)
      let session = await redis?.get?.(`wa_session_${userId}`);

      // Fallback to Mongo if Redis miss (for old users)
      if (!session) {
        const { default: MessengerSession } = await import('./object-models/MessengerSession.js');
        const doc = await MessengerSession.findOne({ userId, platform: 'whatsapp' }).lean();
        if (doc?.sessionData) session = doc.sessionData;
      }

      const podName = await k8s.spawnPod(userId, session || '');
      console.log(`[WhatsAppBaileysManager] Spawned/ensured pod for user ${userId}: ${podName}`);

      return { status: 'starting', pod: podName };
    } catch (err) {
      console.error(`[WhatsAppBaileysManager] Failed to spawn pod for ${userId}:`, err);
      throw err;
    }
  }

  /**
   * For the pod model, incoming messages are handled inside the user pod.
   * The manager no longer needs to process audio locally.
   * We keep the method for compatibility but it can be emptied or removed later.
   */
  async handleIncomingMessage(msg, userId) {
    // In the new architecture the per-user pod handles voice transcription directly.
    // If you still want central queue fallback, you can re-enable the old code here.
    console.log(`[WhatsAppBaileysManager] Message received for ${userId} (handled by pod)`);
  }

  /**
   * Send a text message to a user's WhatsApp.
   * In pod model this should eventually call the user's pod HTTP endpoint
   * or go through a service that routes to the correct pod.
   */
  async sendMessage(userId, to, text) {
    // TODO: Implement proper routing to the user's pod (e.g. call pod's /send endpoint)
    // For now we can fall back to the old in-process path if still running,
    // or implement Redis command / HTTP call to the pod.
    throw new Error('sendMessage via manager is not yet implemented for pod-per-user model. ' +
      'Implement pod HTTP endpoint or Redis command routing.');
  }

  /**
   * QR and Pairing codes are now reported by the pods into Redis.
   * The client writes to keys like:
   *   wa_qr_${userId}          → JSON { qr, info }
   *   wa_pairing_${userId}     → string code
   *   wa_status_${userId}      → 'ready' | 'connecting' ...
   */
  async getQR(userId) {
    if (!redis) return null;
    try {
      const raw = await redis.get(`wa_qr_${userId}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async getPairingCode(userId) {
    if (!redis) return null;
    try {
      return await redis.get(`wa_pairing_${userId}`);
    } catch {
      return null;
    }
  }

  async stopClient(userId) {
    await k8s.deletePods(userId);
  }

  async isConnected(userId) {
    try {
      const pods = await k8s.listPods();
      return pods.some(p => p.userId === String(userId) && p.status === 'Running');
    } catch {
      return false;
    }
  }
}
