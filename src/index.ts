import { Env, AudioJob, MetaWebhookBody } from "./types";
import { sendMessageSafe, sendTypingOn } from "./meta";

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    // VERIFY - Meta webhook verification
    if (req.method === "GET") {
      if (url.searchParams.get("hub.verify_token") === env.VERIFY_TOKEN) {
        return new Response(url.searchParams.get("hub.challenge"));
      }
      return new Response("Forbidden", { status: 403 });
    }

    if (req.method === "POST") {
      const body: MetaWebhookBody = await req.json();
      const msg = body.entry?.[0]?.messaging?.[0];

      if (!msg) return new Response("ok");

      const senderId = msg.sender.id;
      const att = msg.message?.attachments?.[0];

      if (att?.type === "audio") {
        // ⚡ Fast response - send immediately
        await sendTypingOn(senderId, env);

        await sendMessageSafe(senderId, "*transcribe in progress*", env);

        // Push async job to queue
        const job: AudioJob = {
          senderId,
          audioUrl: att.payload.url,
        };

        await env.AUDIO_QUEUE.send(job);
      }

      return new Response("ok");
    }

    return new Response("404");
  },
};
