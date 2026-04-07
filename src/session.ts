import { Env } from "./types";

/**
 * Session management with HMAC-SHA256 signing.
 * Prevents user identity spoofing.
 */

async function getSigningKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/**
 * Creates a signed session string: "userId.signature"
 */
export async function createSignedSession(userId: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await getSigningKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(userId));
  const hashArray = Array.from(new Uint8Array(signature));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `${userId}.${hashHex}`;
}

/**
 * Verifies a signed session string and returns the userId if valid.
 */
export async function verifySession(session: string, secret: string): Promise<string | null> {
  if (!session || !session.includes('.')) return null;

  const [userId, hashHex] = session.split('.');
  const key = await getSigningKey(secret);
  const encoder = new TextEncoder();

  // Convert hex back to buffer
  const hashBytes = new Uint8Array(
    hashHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
  );

  const isValid = await crypto.subtle.verify(
    "HMAC",
    key,
    hashBytes,
    encoder.encode(userId)
  );

  return isValid ? userId : null;
}
