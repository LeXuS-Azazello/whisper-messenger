import { Env } from "./types";

const DELAY = 350;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendWhatsAppTypingOn(
  phoneNumberId: string,
  to: string,
  token: string,
  env: Env
): Promise<void> {
  const version = env.META_API_VERSION || "v21.0";
  const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;

  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "typing",
      typing: { type: "typing" },
    }),
  });
}

export async function sendWhatsAppMessageSafe(
  phoneNumberId: string,
  to: string,
  text: string,
  token: string,
  env: Env,
  replyToMsgId?: string | number
): Promise<void> {
  await sleep(DELAY);

  const version = env.META_API_VERSION || "v21.0";
  const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;

  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
      ...(replyToMsgId ? { context: { message_id: String(replyToMsgId) } } : {}),
    }),
  });
}

export async function getWhatsAppAudioUrl(
  audioId: string,
  token: string,
  env: Env
): Promise<string | null> {
  const version = env.META_API_VERSION || "v21.0";
  const url = `https://graph.facebook.com/${version}/${audioId}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json() as { url?: string };
  return data.url || null;
}
