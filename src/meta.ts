import { Env } from "./types";

export async function sendTypingOn(senderId: string, token: string, env: Env, isThreads = false) {
  try {
    await fetchGraph(
      {
        recipient: { id: senderId },
        sender_action: "typing_on",
      },
      token,
      env,
      isThreads
    );
  } catch (e) {
    console.error("Typing error:", e);
  }
}

export async function sendMessageSafe(senderId: string, text: string, token: string, env: Env, isThreads = false, replyToMsgId?: string | number) {
  try {
    const res = await sendMessage(senderId, text, token, env, isThreads, replyToMsgId);
    if (!res.ok) {
      const err: any = await res.json();
      if (err.error?.code === 10) throw new MetaNonRetryableError(err.error.message);
      throw new Error(`Meta error: ${JSON.stringify(err)}`);
    }
    return res;
  } catch (e) {
    console.error("Meta send failed:", e);
    throw e;
  }
}

export class MetaNonRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetaNonRetryableError";
  }
}

async function sendMessage(senderId: string, text: string, token: string, env: Env, isThreads = false, replyToMsgId?: string | number) {
  return await fetchGraph(
    {
      recipient: { id: senderId },
      message: { 
        text,
        ...(replyToMsgId ? { reply_to: { message_id: String(replyToMsgId) } } : {})
      },
    },
    token,
    env,
    isThreads
  );
}

async function fetchGraph(body: unknown, token: string, env: Env, isThreads: boolean): Promise<Response> {
  const domain = isThreads ? "graph.threads.net" : "graph.facebook.com";
  const url = `https://${domain}/${env.META_API_VERSION}/me/messages?access_token=${token}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return res;
}
