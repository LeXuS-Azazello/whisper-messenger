import { Env } from "./types";

const DELAY = 350;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendLineTypingOn(
  userId: string,
  token: string
): Promise<void> {
  const url = `https://api.line.me/v2/bot/chat/loading/start`;

  // LINE typing indicator API
  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      chatId: userId,
      loadingSeconds: 15
    }),
  }).catch(() => {});
}

export async function sendLineMessageSafe(
  to: string,
  text: string,
  token: string,
  replyToMsgId?: string | number
): Promise<void> {
  await sleep(DELAY);

  const url = `https://api.line.me/v2/bot/message/push`;

  const messagePayload: any = {
    type: "text",
    text: text
  };

  // If quoteToken (replyToMsgId) is provided, quote the original message
  if (replyToMsgId) {
    messagePayload.quoteToken = String(replyToMsgId);
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      to,
      messages: [messagePayload],
    }),
  });

  if (!res.ok) {
    console.error(`[line] send message failed: ${await res.text()}`);
  }
}

export async function getLineAudioArrayBuffer(
  messageId: string,
  token: string
): Promise<ArrayBuffer | null> {
  const url = `https://api-data.line.me/v2/bot/message/${messageId}/content`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    console.error(`[line] audio fetch failed: ${await response.text()}`);
    return null;
  }

  return await response.arrayBuffer();
}
