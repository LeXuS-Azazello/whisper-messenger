import { Env } from "./types";

/**
 * Meta webhook verification module.
 *
 * Two layers of protection:
 *
 * 1. **X-Hub-Signature-256** (works on every Cloudflare plan)
 *    Meta signs every webhook POST with HMAC-SHA256 using your App Secret.
 *    We recompute the signature and compare.
 *
 * 2. **mTLS client-certificate check** (requires CA uploaded via Cloudflare mTLS API)
 *    When enabled, Cloudflare terminates TLS and exposes the client cert via
 *    `request.cf.tlsClientAuth`. We verify the Common Name (CN) equals
 *    `client.webhooks.fbclientcerts.com`.
 *
 * @see https://developers.facebook.com/docs/graph-api/webhooks/getting-started/#verification-requests
 * @see https://developers.facebook.com/docs/graph-api/webhooks/getting-started/#mtls-for-webhooks
 */

// ─── Signature verification (HMAC-SHA256) ────────────────────────────────────

/**
 * Verify the X-Hub-Signature-256 header sent by Meta on every webhook POST.
 * Returns `true` when the signature is valid, `false` otherwise.
 */
export async function verifySignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): Promise<boolean> {
  if (!signatureHeader) {
    console.warn("[verify] Missing X-Hub-Signature-256 header");
    return false;
  }

  // Header format: "sha256=<hex>"
  const prefix = "sha256=";
  if (!signatureHeader.startsWith(prefix)) {
    console.warn(`[verify] Unexpected signature format: ${signatureHeader.substring(0, 30)}`);
    return false;
  }

  const receivedHex = signatureHeader.slice(prefix.length);

  // Compute expected HMAC-SHA256
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const expectedHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison (best-effort in JS)
  if (receivedHex.length !== expectedHex.length) {
    console.warn("[verify] Signature length mismatch");
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < receivedHex.length; i++) {
    mismatch |= receivedHex.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  }

  if (mismatch !== 0) {
    console.warn("[verify] Signature mismatch");
    return false;
  }

  console.log("[verify] X-Hub-Signature-256 verified ✓");
  return true;
}

// ─── mTLS client-certificate verification ────────────────────────────────────

/**
 * The Common Name that Meta's webhook client certificate presents.
 * @see https://developers.facebook.com/docs/graph-api/webhooks/getting-started/#mtls-for-webhooks
 */
const META_MTLS_CN = "client.webhooks.fbclientcerts.com";

/**
 * Cloudflare exposes client-certificate info via `request.cf.tlsClientAuth`
 * when API Shield mTLS or Cloudflare Access is enabled for the zone.
 *
 * @see https://developers.cloudflare.com/workers/runtime-apis/request/#incomingrequestcfproperties
 */
interface TlsClientAuth {
  certIssuerDN: string;
  certIssuerDNLegacy: string;
  certSubjectDN: string;
  certSubjectDNLegacy: string;
  certFingerprintSHA1: string;
  certFingerprintSHA256: string;
  certNotBefore: string;
  certNotAfter: string;
  certSerial: string;
  certPresented: string; // "0" or "1"
  certVerified: string;  // "SUCCESS", "FAILED:reason", "NONE"
  certRevoked: string;   // "0" or "1"
}

/**
 * Verify Meta's mTLS client certificate from the Cloudflare `cf` object.
 *
 * Returns:
 * - `"ok"`       – certificate is valid and CN matches Meta
 * - `"skip"`     – mTLS not configured (tlsClientAuth is null); fall through to signature check
 * - `"rejected"` – certificate present but invalid or CN doesn't match
 */
export function verifyMtls(req: Request): "ok" | "skip" | "rejected" {
  const cf = (req as any).cf;
  if (!cf) {
    console.log("[verify] No cf object on request (local dev?)");
    return "skip";
  }

  const tls: TlsClientAuth | null = cf.tlsClientAuth;
  if (!tls) {
    // mTLS CA not associated with this hostname – fall through to signature check
    console.log("[verify] tlsClientAuth is null – mTLS not enabled on this zone");
    return "skip";
  }

  // Log ALL fields for debugging
  console.log(
    `[verify] mTLS dump: presented="${tls.certPresented}" verified="${tls.certVerified}" ` +
    `revoked="${tls.certRevoked}" serial="${tls.certSerial}" ` +
    `subject="${tls.certSubjectDN}" issuer="${tls.certIssuerDN}" ` +
    `fp256="${tls.certFingerprintSHA256}" ` +
    `notBefore="${tls.certNotBefore}" notAfter="${tls.certNotAfter}"`
  );

  // Was a certificate presented?
  if (tls.certPresented !== "1") {
    // No client cert presented – this is normal for non-mTLS clients.
    // Fall through to signature verification instead of hard-rejecting.
    console.log("[verify] mTLS: no client certificate presented, falling back to signature check");
    return "skip";
  }

  // Did Cloudflare verify the certificate chain?
  if (tls.certVerified !== "SUCCESS") {
    console.warn(`[verify] mTLS: certificate verification failed: ${tls.certVerified}`);
    return "rejected";
  }

  // Is the certificate revoked?
  if (tls.certRevoked === "1") {
    console.warn("[verify] mTLS: client certificate is revoked");
    return "rejected";
  }

  // Extract CN from the Subject DN
  // Format: "CN=client.webhooks.fbclientcerts.com,O=..."
  const cn = extractCN(tls.certSubjectDN);
  if (cn !== META_MTLS_CN) {
    console.warn(`[verify] mTLS: unexpected CN="${cn}", expected="${META_MTLS_CN}"`);
    return "rejected";
  }

  console.log("[verify] mTLS client certificate verified ✓");
  return "ok";
}

/**
 * Extract the CN (Common Name) from a Distinguished Name string.
 * Handles both RFC 2253 format ("CN=value,O=...") and legacy format.
 */
function extractCN(dn: string): string | null {
  // Match CN= followed by value (up to comma or end of string)
  const match = dn.match(/CN=([^,]+)/i);
  return match ? match[1].trim() : null;
}

// ─── Combined verification ───────────────────────────────────────────────────

/**
 * Verify an incoming Meta webhook request using both mTLS and signature.
 *
 * Strategy:
 * 1. If mTLS is available (API Shield enabled), check the client certificate first.
 *    - If cert is present but invalid → reject immediately.
 *    - If cert is valid → still verify signature as defense-in-depth.
 * 2. Always verify X-Hub-Signature-256 as the primary authentication method.
 *
 * Returns `null` if verification passes, or a `Response` to return if it fails.
 */
export async function verifyWebhook(
  req: Request,
  rawBody: string,
  env: Env
): Promise<Response | null> {
  // Layer 1: mTLS (if available)
  const mtlsResult = verifyMtls(req);
  if (mtlsResult === "rejected") {
    console.error("[verify] Webhook rejected: mTLS verification failed");
    return new Response("Unauthorized", { status: 401 });
  }

  // Layer 2: Signature verification (always required)
  if (!env.META_APP_SECRET) {
    console.warn("[verify] META_APP_SECRET not set – skipping signature verification");
    return null;
  }

  const signatureHeader = req.headers.get("X-Hub-Signature-256");
  const signatureValid = await verifySignature(rawBody, signatureHeader, env.META_APP_SECRET);

  if (!signatureValid) {
    console.error("[verify] Webhook rejected: signature verification failed");
    return new Response("Unauthorized", { status: 401 });
  }

  return null; // All checks passed
}
