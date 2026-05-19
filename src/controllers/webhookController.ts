import { Env, UserSession } from "../types";
import { TelegramWebhookUpdate, sendTelegramRichMessage, getTelegramFileUrl } from "../telegram";

export async function processTelegramWebhook(update: TelegramWebhookUpdate, env: Env): Promise<Response> {
  const msg = update.message;
  if (!msg || msg.chat.type !== "private") return new Response("ok");

  const text = msg.text?.trim() || "";
  const chatId = msg.chat.id;
  const userId = String(msg.from?.id);

  if (text.startsWith("/")) {
    if (text === "/start" || text === "/status") {
      const userData = await env.STATS.get(`user_meta_${userId}`);
      const appUrl = env.TELEGRAM_MINI_APP_URL || `${env.WORKER_URL}/dashboard`;
      const authUrl = env.TELEGRAM_MINI_APP_URL ? `${env.TELEGRAM_MINI_APP_URL}?startapp=auth` : `${env.WORKER_URL}/auth?auto=true`;

      if (!userData) {
        await sendTelegramRichMessage(chatId,
          `🚀 <b>Welcome to Echo Messenger!</b>\n\nTo start using the voice-to-text bridge, you need to connect your Telegram account. It's safe and takes 2 seconds.`,
          env,
          {
            inline_keyboard: [[{ text: "🔌 Connect Telegram Now", url: authUrl }]]
          }
        );
        return new Response("ok");
      }

      const user: UserSession = JSON.parse(userData);
      const isConnected = !!user.session;

      let status = "Not Connected";
      let buttons: any[] = [[{ text: "🔌 Connect Telegram", url: appUrl }]];

      if (isConnected) {
        status = "🟢 RUNNING";
        buttons = [
          [{ text: "⚙️ Dashboard & Settings", url: appUrl }]
        ];
      }

      await sendTelegramRichMessage(chatId,
        `👤 <b>User Info</b>\nID: <code>${userId}</code>\nBridge Status: <b>${status}</b>\n\nYou can manage your bridge directly from here or via the dashboard.`,
        env,
        { inline_keyboard: buttons }
      );
      return new Response("ok");
    }
  }

  const media = msg.voice || msg.audio || msg.video_note;
  if (media && msg.from) {
    const targetId = msg.from.id;
    const audioUrl = await getTelegramFileUrl(media.file_id, env);
    if (audioUrl) await env.AUDIO_QUEUE.send({ senderId: String(targetId), audioUrl, platform: "telegram", replyToMsgId: msg.message_id });
  }
  return new Response("ok");
}