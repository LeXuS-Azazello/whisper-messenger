import { Env } from "./types";

const DELAY = 350; // ms - soft limiter to prevent Meta rate limiting

/**
 * Non-retryable Meta API errors (e.g. user not found, messaging window closed).
 * These should NOT trigger queue retries — the job should be dropped.
 */
export class MetaNonRetryableError extends Error {
  public readonly status: number;
  public readonly errorCode: number;
  public readonly errorSubcode: number;

  constructor(message: string, status: number, errorCode: number, errorSubcode: number) {
    super(message);
    this.name = "MetaNonRetryableError";
    this.status = status;
    this.errorCode = errorCode;
    this.errorSubcode = errorSubcode;
  }
}

/** Error subcodes that should NOT be retried */
const NON_RETRYABLE_SUBCODES = new Set([
  2018001, // No matching users found
  2018278, // User cannot be messaged (policy / 24h window)
  2018065, // Message failed to send (blocked)
  1545041, // User has blocked the page
]);

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
      messaging_type: "RESPONSE",
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
      messaging_type: "RESPONSE",
      message: { text },
    },
    env
  );
}

async function fetchGraph(body: unknown, env: Env): Promise<Response> {
  // Instagram Messaging API uses the same Graph API endpoint
  const url = `https://graph.facebook.com/${env.META_API_VERSION}/me/messages`;

  console.log(`[meta] POST ${url} body=${JSON.stringify(body)}`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.META_PAGE_TOKEN}`,
    },
    body: JSON.stringify(body),
  });

  const responseText = await res.text();
  console.log(`[meta] response status=${res.status} body=${responseText}`);

  if (!res.ok) {
    console.error(`[meta] Send API error: ${res.status} ${responseText}`);

    // Parse error response to check if it's non-retryable
    try {
      const parsed = JSON.parse(responseText);
      const errorCode: number = parsed?.error?.code ?? 0;
      const errorSubcode: number = parsed?.error?.error_subcode ?? 0;

      if (NON_RETRYABLE_SUBCODES.has(errorSubcode)) {
        throw new MetaNonRetryableError(
          `Meta API non-retryable error: ${parsed?.error?.message ?? responseText}`,
          res.status,
          errorCode,
          errorSubcode
        );
      }
    } catch (e) {
      // Re-throw MetaNonRetryableError, ignore JSON parse failures
      if (e instanceof MetaNonRetryableError) throw e;
    }
  }

  return new Response(responseText, { status: res.status, headers: res.headers });
}
