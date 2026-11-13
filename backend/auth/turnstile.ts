/**
 * B-2: server-side Cloudflare Turnstile verification (free, no quota cost).
 *
 * Enforcement is driven by TURNSTILE_SECRET_KEY:
 *  - unset  -> verification is skipped (deployment without CAPTCHA keeps
 *              working; persistent rate limits from B-3 still protect the
 *              endpoints and a warning is logged once at startup).
 *  - set    -> the token is REQUIRED and verified at
 *              https://challenges.cloudflare.com/turnstile/v0/siteverify.
 *              An explicit rejection from Cloudflare fails the request
 *              (fail closed). A network failure reaching siteverify only
 *              logs loudly and allows the request through (fail open) so a
 *              temporary Cloudflare outage cannot lock every user out of
 *              their account; B-3 rate limits still apply.
 */
const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function isTurnstileEnforced(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

export interface TurnstileVerdict {
  /** true when a secret is configured and the token passed verification. */
  ok: boolean;
  /** true when verification is configured (secret present). */
  enforced: boolean;
  reason?: string;
}

export async function verifyTurnstileToken(token: string, remoteIp?: string): Promise<TurnstileVerdict> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true, enforced: false, reason: "not-configured" };

  const candidate = String(token || "").trim();
  if (!candidate) return { ok: false, enforced: true, reason: "missing-token" };

  try {
    const body = new URLSearchParams({ secret, response: candidate });
    if (remoteIp) body.set("remoteip", remoteIp);
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(8000),
    });
    const payload: any = await response.json().catch(() => ({}));
    if (payload?.success === true) return { ok: true, enforced: true };
    const codes = Array.isArray(payload?.["error-codes"]) ? payload["error-codes"].join(",") : "rejected";
    console.warn("Turnstile rejected token:", codes);
    return { ok: false, enforced: true, reason: codes };
  } catch (error) {
    // Cannot reach siteverify — fail open, loudly (availability trade-off).
    console.error("Turnstile siteverify unreachable:", (error as Error)?.message);
    return { ok: true, enforced: true, reason: "siteverify-unreachable" };
  }
}
