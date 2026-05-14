import { Env } from "../types";
import MessengerSession from "../models/MessengerSession";
import User from "../models/User";
import AdminVar from "../models/AdminVar";

export async function handleConfig(env: Env, _req: Request, url: URL): Promise<Response> {
  const secret = url.searchParams.get("secret");
  if (secret !== env.BRIDGE_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const providerVar = await AdminVar.findOne({ key: "config_whisper_provider" });
  const modelVar = await AdminVar.findOne({ key: "config_ollama_model" });
  const localUrlVar = await AdminVar.findOne({ key: "config_local_whisper_url" });
  const localSecretVar = await AdminVar.findOne({ key: "config_local_whisper_secret" });
  const ollamaUrlVar = await AdminVar.findOne({ key: "config_ollama_url" });

  return Response.json({
    provider: providerVar?.value || "qwen3-asr",
    model: modelVar?.value || "whisper",
    localUrl: localUrlVar?.value || "",
    localSecret: localSecretVar?.value || "",
    ollamaUrl: ollamaUrlVar?.value || ""
  });
}

export async function handleActiveUsers(env: Env, _req: Request, url: URL): Promise<Response> {
  const secret = url.searchParams.get("secret");
  if (secret !== env.BRIDGE_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const sessions = await MessengerSession.find({ isActive: true });
    
    const activeUsers = [];
    for (const session of sessions) {
      const user = await User.findOne({ userId: session.userId });
      activeUsers.push({
        userId: session.userId,
        session: session.sessionData,
        firstName: user?.firstName || "User",
        platform: session.platform
      });
    }
    
    return Response.json(activeUsers);
  } catch (e) {
    console.error("[Internal] Error fetching active users:", e);
    return new Response("Internal error", { status: 500 });
  }
}
