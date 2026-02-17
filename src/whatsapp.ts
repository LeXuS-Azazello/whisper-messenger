import { Env } from "./types";

const DELAY = 350;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendWhatsAppTypingOn(
  phoneNumberId: string,
  to: string,
  env: Env
): Promise<void> {
  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
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
  env: Env
): Promise<void> {
  await sleep(DELAY);

  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });
}

export async function getWhatsAppAudioUrl(
  audioId: string,
  env: Env
): Promise<string | null> {
  const url = `https://graph.facebook.com/v21.0/${audioId}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json() as { url?: string };
  return data.url || null;
}
