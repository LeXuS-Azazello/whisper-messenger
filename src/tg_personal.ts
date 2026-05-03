import { Env } from "./types";

export async function sendViaPersonalAccount(
  userId: string,
  chatId: string,
  text: string,
  env: Env
): Promise<boolean> {
  // Disabled as bridge is removed
  return false;
}
