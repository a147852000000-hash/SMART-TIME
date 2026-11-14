/**
 * Google Sign-In ID-token verification — free, zero dependencies.
 *
 * The frontend uses Google Identity Services (accounts.google.com/gsi/client,
 * free) and receives a signed ID token (JWT). This module verifies the token
 * signature against Google's published JWKS and validates issuer, audience,
 * expiry and email verification before an account is created or linked.
 *
 * Verification is signature-based (not the deprecated tokeninfo endpoint),
 * with a small in-memory JWKS cache — no API keys, no billing, no quota.
 */
import crypto from "node:crypto";

export const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const ALLOWED_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);
const CLOCK_LEEWAY_SECONDS = 60;

export interface GoogleTokenProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

export interface JwkSet { keys: Array<Record<string, any>>; }

type FetchLike = (url: string, init?: any) => Promise<any>;

interface JwksCacheEntry { jwks: JwkSet; fetchedAt: number; }
let jwksCache: JwksCacheEntry | null = null;
const JWKS_CACHE_MS = 5 * 60 * 1000;

function b64uToJson(buffer: Buffer): any {
  return JSON.parse(buffer.toString("utf8"));
}

function decodeSegment(segment: string): Buffer {
  return Buffer.from(segment, "base64");
}

async function fetchJwks(jwksUrl: string, fetchImpl: FetchLike): Promise<JwkSet> {
  if (jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_CACHE_MS) return jwksCache.jwks;
  const res = await fetchImpl(jwksUrl, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`تعذر جلب مفاتيح Google (HTTP ${res.status}).`);
  const jwks = await res.json() as JwkSet;
  if (!jwks || !Array.isArray(jwks.keys) || jwks.keys.length === 0) throw new Error("مفاتيح Google غير صالحة.");
  jwksCache = { jwks, fetchedAt: Date.now() };
  return jwks;
}

/** Test hook: drop the cached JWKS between scenarios. */
export function resetJwksCache(): void { jwksCache = null; }

export interface VerifyGoogleTokenOptions {
  clientId: string;
  jwksUrl?: string;
  fetchImpl?: FetchLike;
  /** Maximum JWKS fetch attempts before giving up (kid rotation safety). */
  retries?: number;
}

export async function verifyGoogleIdToken(idToken: string, options: VerifyGoogleTokenOptions): Promise<GoogleTokenProfile> {
  const clientId = String(options.clientId || "").trim();
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID غير مضبوط على الخادم.");
  const token = String(idToken || "").trim();
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("شكل رمز Google غير صالح.");
  const [headB64, payloadB64, sigB64] = parts;

  let header: any, payload: any;
  try {
    header = b64uToJson(decodeSegment(headB64));
    payload = b64uToJson(decodeSegment(payloadB64));
  } catch {
    throw new Error("رمز Google غير قابل للقراءة.");
  }
  if (header?.alg !== "RS256" || !header?.kid) throw new Error("خوارزمية رمز Google غير مدعومة.");

  const jwksUrl = options.jwksUrl || String(process.env.GOOGLE_JWKS_URL || "").trim() || GOOGLE_JWKS_URL;
  const fetchImpl = options.fetchImpl || fetch;
  const retries = options.retries ?? 1; // 1 refresh: handles key rotation cache misses

  let verified = false;
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries && !verified; attempt++) {
    const jwks = await fetchJwks(jwksUrl, fetchImpl);
    const jwk = jwks.keys.find((k) => k.kid === header.kid);
    if (!jwk) {
      lastError = new Error("مفتاح التوقيع غير موجود.");
      if (attempt < retries) { resetJwksCache(); continue; }
      throw lastError;
    }
    let keyObject: crypto.KeyObject;
    try {
      keyObject = crypto.createPublicKey({ key: jwk as any, format: "jwk" });
    } catch {
      throw new Error("مفتاح Google غير قابل للاستخدام.");
    }
    const signature = decodeSegment(sigB64);
    verified = crypto.createVerify("SHA256").update(`${headB64}.${payloadB64}`).verify(keyObject, signature);
    if (!verified) lastError = new Error("توقيع رمز Google غير صالح.");
  }
  if (!verified) throw (lastError instanceof Error ? lastError : new Error("توقيع رمز Google غير صالح."));

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp + CLOCK_LEEWAY_SECONDS < now) throw new Error("انتهت صلاحية رمز Google.");
  if (typeof payload.iat === "number" && payload.iat - CLOCK_LEEWAY_SECONDS > now) throw new Error("رمز Google غير صالح بعد (iat مستقبلي).");
  const issuers = Array.isArray(payload.iss) ? payload.iss : [payload.iss];
  if (!issuers.some((iss: string) => ALLOWED_ISSUERS.has(String(iss)))) throw new Error("مُصدر رمز Google غير صالح.");
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(clientId)) throw new Error("رمز Google صادر لتطبيق آخر (aud mismatch).");
  if (!payload.sub) throw new Error("رمز Google بلا معرف مستخدم.");
  const email = String(payload.email || "").trim().toLowerCase();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error("رمز Google لا يحتوي بريدًا صالحًا.");
  if (payload.email_verified !== true) throw new Error("بريد حساب Google غير موثق.");

  return {
    sub: String(payload.sub),
    email,
    emailVerified: true,
    name: typeof payload.name === "string" && payload.name.trim() ? payload.name.trim().slice(0, 80) : undefined,
    picture: typeof payload.picture === "string" && payload.picture.startsWith("https://") ? payload.picture : undefined,
  };
}
