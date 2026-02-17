import { Env } from "./types";

const DELAY = 350; // ms - soft limiter to prevent Meta rate limiting

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendTypingOn(
  id: string,
  env: Env
): Promise<void> {
  await fetchGraph(
    {
      recipient: { id },
      sender_action: "typing_on",
    },
    env
  );
}

export async function sendMessageSafe(
  id: string,
  text: string,
  env: Env
): Promise<void> {
  await sleep(DELAY);

  await fetchGraph(
    {
      recipient: { id },
      message: { text },
    },
    env
  );
}

async function fetchGraph(body: unknown, env: Env): Promise<Response> {
  // Instagram Messaging API uses the same Graph API endpoint
  const url = `https://graph.facebook.com/${env.META_API_VERSION}/me/messages`;

  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.META_PAGE_TOKEN}`,
    },
    body: JSON.stringify(body),
  });
}
