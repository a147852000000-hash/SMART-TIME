export interface TurnstileValidation {
  success: boolean;
  hostname?: string;
  action?: string;
  errorCodes: string[];
}

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const MAX_TOKEN_LENGTH = 2048;

export async function verifyTurnstileToken(
  token: string,
  secret: string,
  remoteIp?: string,
): Promise<TurnstileValidation> {
  const normalizedToken = String(token || "").trim();
  const normalizedSecret = String(secret || "").trim();

  if (!normalizedSecret) {
    return { success: false, errorCodes: ["missing-secret"] };
  }
  if (!normalizedToken) {
    return { success: false, errorCodes: ["missing-input-response"] };
  }
  if (normalizedToken.length > MAX_TOKEN_LENGTH) {
    return { success: false, errorCodes: ["invalid-input-response"] };
  }

  try {
    const body = new URLSearchParams({
      secret: normalizedSecret,
      response: normalizedToken,
    });
    if (remoteIp) body.set("remoteip", String(remoteIp));

    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(8_000),
    });

    const payload = await response.json().catch(() => ({} as any));
    if (!response.ok) {
      return {
        success: false,
        errorCodes: ["http-" + response.status],
      };
    }

    return {
      success: payload?.success === true,
      hostname: typeof payload?.hostname === "string" ? payload.hostname : undefined,
      action: typeof payload?.action === "string" ? payload.action : undefined,
      errorCodes: Array.isArray(payload?.["error-codes"]) ? payload["error-codes"].map(String) : [],
    };
  } catch {
    return { success: false, errorCodes: ["provider-unreachable"] };
  }
}
