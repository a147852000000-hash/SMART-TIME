/**
 * WebAuthn / Passkey support (fingerprint login) — free forever.
 *
 * Everything is implemented against node:crypto and a focused CBOR decoder.
 * No third-party packages, no paid services, no external network calls:
 * the browser's platform authenticator (Android fingerprint, Windows Hello,
 * Touch/Face ID) does the biometric part, this module verifies the result.
 *
 * Supported assertion algorithms (the ones real devices emit):
 *   ES256 (-7, EC2 P-256)  — Windows Hello, Android, iOS
 *   RS256 (-257, RSA)      — some TPM-backed authenticators
 *   EdDSA (-8, Ed25519)    — modern FIDO2 keys
 *
 * Flow (all same-origin, Oracle deployment behind nginx):
 *   register: POST /api/auth/passkey/register/options  (session required)
 *             POST /api/auth/passkey/register/verify
 *   login:    POST /api/auth/passkey/login/options     (public, rate limited)
 *             POST /api/auth/passkey/login/verify
 *
 * Challenges are stored in SQLite (webauthn_challenges) so restarts and any
 * multi-process setup cannot invalidate a pending ceremony mid-flow.
 */
import crypto from "node:crypto";
import { db } from "../database.js";

// ---------- base64url helpers ----------

export function toB64u(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Buffer.from(bytes).toString("base64url");
}

export function fromB64u(value: string): Buffer {
  return Buffer.from(String(value || ""), "base64url");
}

export function randomChallenge(): string {
  return toB64u(crypto.randomBytes(32));
}

// ---------- minimal CBOR decoder (subset used by WebAuthn) ----------

class CborDecodeError extends Error {}

/**
 * Decodes the CBOR subset that appears in WebAuthn structures:
 * unsigned/negative integers, byte strings, text strings, arrays, maps,
 * tags (unwrapped), true/false/null and floats. Exactly what attestation
 * objects and COSE keys use — nothing more, by design.
 */
export function cborDecode(input: Uint8Array): any {
  const result = cborDecodeOne(input);
  if (result.byteLength !== input.length) throw new CborDecodeError("CBOR trailing bytes");
  return result.value;
}

interface CborDecodeOneResult { value: any; byteLength: number; }

/** Decodes exactly one CBOR item and returns the number of bytes consumed. */
export function cborDecodeOne(input: Uint8Array): CborDecodeOneResult {
  let offset = 0;
  const read = (n: number): Uint8Array => {
    if (offset + n > input.length) throw new CborDecodeError("CBOR truncated");
    const slice = input.subarray(offset, offset + n);
    offset += n;
    return slice;
  };
  const readUint = (n: number): bigint => {
    const bytes = read(n);
    let value = 0n;
    for (const b of bytes) value = (value << 8n) | BigInt(b);
    return value;
  };
  const parseOne = (): any => {
    const initial = read(1)[0];
    const major = initial >> 5;
    const short = initial & 0x1f;
    const readLength = (): bigint => {
      if (short < 24) return BigInt(short);
      if (short === 24) return BigInt(read(1)[0]);
      if (short === 25) return readUint(2);
      if (short === 26) return readUint(4);
      if (short === 27) return readUint(8);
      throw new CborDecodeError(`CBOR indefinite length not supported (${initial})`);
    };
    switch (major) {
      case 0: {
        const v = readLength();
        if (v > BigInt(Number.MAX_SAFE_INTEGER)) throw new CborDecodeError("CBOR int too large");
        return Number(v);
      }
      case 1: {
        const v = readLength();
        if (v > BigInt(Number.MAX_SAFE_INTEGER)) throw new CborDecodeError("CBOR int too large");
        return -1 - Number(v);
      }
      case 2: {
        const len = Number(readLength());
        return read(len);
      }
      case 3: {
        const len = Number(readLength());
        return Buffer.from(read(len)).toString("utf8");
      }
      case 4: {
        const len = Number(readLength());
        const out: any[] = [];
        for (let i = 0; i < len; i++) out.push(parseOne());
        return out;
      }
      case 5: {
        const len = Number(readLength());
        const map: Map<any, any> = new Map();
        for (let i = 0; i < len; i++) {
          const key = parseOne();
          map.set(key, parseOne());
        }
        return map;
      }
      case 6: {
        readLength(); // tag number — unwrap
        return parseOne();
      }
      case 7: {
        if (short === 20) return false;
        if (short === 21) return true;
        if (short === 22) return null;
        if (short === 23) return undefined;
        if (short === 25) { // half float — rare; decode via DataView trick
          const raw = readUint(2);
          const exp = Number((raw >> 10n) & 0x1fn), frac = Number(raw & 0x3ffn), sign = Number(raw >> 15n) ? -1 : 1;
          const value = exp === 0 ? frac * 2 ** -24 : exp === 31 ? (frac ? NaN : Infinity) : (frac + 1024) * 2 ** (exp - 25);
          return sign * value;
        }
        if (short === 26) {
          const bytes = read(4);
          const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
          return view.getFloat32(0);
        }
        if (short === 27) {
          const bytes = read(8);
          const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
          return view.getFloat64(0);
        }
        if (short >= 24 && short <= 28) throw new CborDecodeError("CBOR simple value not supported");
        return undefined;
      }
      default:
        throw new CborDecodeError(`CBOR major type ${major} not supported`);
    }
  };
  const value = parseOne();
  return { value, byteLength: offset };
}

// ---------- authenticator structures ----------

export const AUTH_FLAG_UP = 0x01; // user present
export const AUTH_FLAG_UV = 0x04; // user verified (biometric / PIN)
export const AUTH_FLAG_BE = 0x08; // backup eligible
export const AUTH_FLAG_BS = 0x10; // backup state
export const AUTH_FLAG_AT = 0x40; // attested credential data present
export const AUTH_FLAG_ED = 0x80; // extension data present

export interface ParsedAuthData {
  rpIdHash: Buffer;
  flags: number;
  signCount: number;
  aaguid: string;
  credentialId?: Buffer;
  credentialPublicKey?: Uint8Array;
}

export function parseAuthData(authData: Uint8Array): ParsedAuthData {
  if (authData.length < 37) throw new Error("authData too short");
  const view = new DataView(authData.buffer, authData.byteOffset, authData.byteLength);
  const rpIdHash = Buffer.from(authData.slice(0, 32));
  const flags = authData[32];
  const signCount = view.getUint32(33, false);
  const result: ParsedAuthData = { rpIdHash, flags, signCount, aaguid: "" };
  let cursor = 37;
  if ((flags & AUTH_FLAG_AT) === AUTH_FLAG_AT) {
    if (authData.length < cursor + 18) throw new Error("authData attested section truncated");
    result.aaguid = Buffer.from(authData.slice(cursor, cursor + 16)).toString("hex");
    cursor += 16;
    const credIdLen = view.getUint16(cursor, false);
    cursor += 2;
    if (authData.length < cursor + credIdLen) throw new Error("credential id truncated");
    result.credentialId = Buffer.from(authData.slice(cursor, cursor + credIdLen));
    cursor += credIdLen;
    // The COSE key is the remainder of the attested credential data; decode it
    // standalone so a trailing extension section (ED flag) is not swallowed.
    result.credentialPublicKey = decodeFirstCbor(authData.slice(cursor));
  }
  return result;
}

/** Decodes the first CBOR item from a byte slice and returns its raw span. */
function decodeFirstCbor(input: Uint8Array): Uint8Array {
  const first = cborDecodeOne(input);
  return input.slice(0, first.byteLength);
}

// ---------- minimal CBOR encoder (for canonicalizing COSE keys) ----------

export function cborEncode(value: any): Uint8Array {
  const chunks: Buffer[] = [];
  const push = (b: Buffer) => chunks.push(b);
  const head = (major: number, n: number): Buffer => {
    const m = major << 5;
    if (n < 24) return Buffer.from([m | n]);
    if (n <= 0xff) return Buffer.from([m | 24, n]);
    if (n <= 0xffff) { const b = Buffer.alloc(3); b[0] = m | 25; b.writeUInt16BE(n, 1); return b; }
    if (n <= 0xffffffff) { const b = Buffer.alloc(5); b[0] = m | 26; b.writeUInt32BE(n, 1); return b; }
    const b = Buffer.alloc(9); b[0] = m | 27; b.writeBigUInt64BE(BigInt(n), 1); return b;
  };
  const walk = (v: any): void => {
    if (v instanceof Uint8Array || Buffer.isBuffer(v)) {
      push(head(2, v.length)); push(Buffer.from(v)); return;
    }
    if (typeof v === "number") {
      if (Number.isInteger(v) && v >= 0) { push(head(0, v)); return; }
      if (Number.isInteger(v) && v < 0) { push(head(1, -1 - v)); return; }
      // non-integers: float64
      const b = Buffer.alloc(9); b[0] = 0xfb; b.writeDoubleBE(v, 1); push(b); return;
    }
    if (typeof v === "string") { const raw = Buffer.from(v, "utf8"); push(head(3, raw.length)); push(raw); return; }
    if (typeof v === "boolean") { push(Buffer.from([v ? 0xf5 : 0xf4])); return; }
    if (v === null || v === undefined) { push(Buffer.from([0xf6])); return; }
    if (Array.isArray(v)) { push(head(4, v.length)); v.forEach(walk); return; }
    if (v instanceof Map) {
      push(head(5, v.size));
      const keys = [...v.keys()].sort((a, b) => {
        // CTAP2 canonical form: lower major type first, then shorter, then bytewise
        const ka = Buffer.from(cborEncode(a)), kb = Buffer.from(cborEncode(b));
        return Buffer.compare(ka, kb);
      });
      keys.forEach((k) => { walk(k); walk(v.get(k)); });
      return;
    }
    throw new Error(`cborEncode: unsupported type ${typeof v}`);
  };
  walk(value);
  return Buffer.concat(chunks);
}

// ---------- COSE key → node KeyObject ----------

const COSE_KTY_EC2 = 2, COSE_KTY_RSA = 3, COSE_KTY_OKP = 1;
const COSE_ALG_ES256 = -7, COSE_ALG_RS256 = -257, COSE_ALG_EDDSA = -8;

export interface DecodedCoseKey {
  keyObject: crypto.KeyObject;
  alg: "ES256" | "RS256" | "EdDSA";
}

/** Converts a decoded COSE public key map into a node KeyObject via JWK import. */
export function coseKeyToKeyObject(cose: any): DecodedCoseKey {
  if (!(cose instanceof Map)) throw new Error("COSE key must be a CBOR map");
  const kty = cose.get(1);
  const alg = cose.get(3);
  if (kty === COSE_KTY_EC2 && alg === COSE_ALG_ES256) {
    const crv = cose.get(-1);
    if (crv !== 1) throw new Error(`unsupported EC curve ${crv}`);
    const x = Buffer.from(cose.get(-2));
    const y = Buffer.from(cose.get(-3));
    if (x.length !== 32 || y.length !== 32) throw new Error("bad P-256 coordinates");
    const keyObject = crypto.createPublicKey({
      key: { kty: "EC", crv: "P-256", x: x.toString("base64url"), y: y.toString("base64url") },
      format: "jwk",
    });
    return { keyObject, alg: "ES256" };
  }
  if (kty === COSE_KTY_RSA && alg === COSE_ALG_RS256) {
    const n = Buffer.from(cose.get(-1));
    const e = Buffer.from(cose.get(-2));
    if (!n.length || !e.length) throw new Error("bad RSA parameters");
    const keyObject = crypto.createPublicKey({
      key: { kty: "RSA", n: n.toString("base64url"), e: e.toString("base64url") },
      format: "jwk",
    });
    return { keyObject, alg: "RS256" };
  }
  if (kty === COSE_KTY_OKP && alg === COSE_ALG_EDDSA) {
    const crv = cose.get(-1);
    if (crv !== 6) throw new Error(`unsupported OKP curve ${crv}`);
    const x = Buffer.from(cose.get(-2));
    if (x.length !== 32) throw new Error("bad Ed25519 key");
    const keyObject = crypto.createPublicKey({
      key: { kty: "OKP", crv: "Ed25519", x: x.toString("base64url") },
      format: "jwk",
    });
    return { keyObject, alg: "EdDSA" };
  }
  throw new Error(`unsupported COSE key kty=${kty} alg=${alg}`);
}

/** DER-encoded signature (ES256) or raw (Ed25519) — verified with node crypto. */
export function verifySignature(alg: DecodedCoseKey["alg"], keyObject: crypto.KeyObject, data: Buffer, signature: Buffer): boolean {
  try {
    if (alg === "EdDSA") return crypto.verify(null, data, keyObject, signature);
    if (alg === "RS256") return crypto.verify("sha256", data, keyObject, signature);
    // WebAuthn ES256 signatures are ASN.1 DER encoded — node's default.
    return crypto.verify("sha256", data, keyObject, signature);
  } catch {
    return false;
  }
}

// ---------- client data / attestation parsing ----------

export interface ParsedClientData {
  type: string;
  challenge: string;
  origin: string;
  crossOrigin?: boolean;
}

export function parseClientData(clientDataJSON: Buffer): ParsedClientData {
  let parsed: any;
  try { parsed = JSON.parse(clientDataJSON.toString("utf8")); } catch { throw new Error("clientDataJSON is not valid JSON"); }
  if (typeof parsed?.type !== "string" || typeof parsed?.challenge !== "string" || typeof parsed?.origin !== "string") {
    throw new Error("clientDataJSON missing required fields");
  }
  return { type: parsed.type, challenge: parsed.challenge, origin: parsed.origin, crossOrigin: !!parsed.crossOrigin };
}

// ---------- origin / rp-id resolution ----------

function firstHost(hostHeader: string): string {
  return String(hostHeader || "").split(",")[0].trim().split(":")[0].toLowerCase();
}

export function rpIdForHost(hostHeader: string): string {
  const override = String(process.env.WEBAUTHN_RP_ID || "").trim();
  if (override) return override.toLowerCase();
  return firstHost(hostHeader);
}

/**
 * Full origin expected in clientDataJSON — includes the port when the host
 * header carries one (dev/tests), respects X-Forwarded-Proto from nginx, and
 * strips default ports. Host header cannot be trusted blindly, but this value
 * is only COMPARED against what the browser signed, so a spoofed header can
 * only cause a mismatch (fail closed), never a bypass.
 */
export function expectedOriginForHost(hostHeader: string, protoHeader?: string): string {
  const override = String(process.env.WEBAUTHN_EXPECTED_ORIGIN || "").trim().replace(/\/+$/, "");
  if (override) return override;
  const rawHost = String(hostHeader || "").split(",")[0].trim().toLowerCase();
  if (!rawHost) return "";
  const hostname = rawHost.split(":")[0];
  const port = rawHost.includes(":") ? rawHost.split(":")[1] : "";
  const proto = String(protoHeader || "").split(",")[0].trim().toLowerCase();
  const scheme = proto || (hostname === "localhost" || hostname === "127.0.0.1" ? "http" : "https");
  const isDefaultPort = !port || (scheme === "https" && port === "443") || (scheme === "http" && port === "80");
  return `${scheme}://${isDefaultPort ? hostname : `${hostname}:${port}`}`;
}

// ---------- challenge store (SQLite) ----------

export type ChallengeKind = "register" | "login";

export function ensureWebauthnTables(): void {
  try { db.exec(`CREATE TABLE IF NOT EXISTS webauthn_challenges (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    challenge TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`); } catch {}
  try { db.exec(`CREATE TABLE IF NOT EXISTS webauthn_credentials (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    public_key TEXT NOT NULL,
    alg TEXT NOT NULL,
    sign_count INTEGER NOT NULL DEFAULT 0,
    transports TEXT,
    device_name TEXT,
    created_at TEXT NOT NULL
  )`); } catch {}
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_user ON webauthn_credentials(user_id)"); } catch {}
  try { db.exec("DELETE FROM webauthn_challenges WHERE expires_at < datetime('now')"); } catch {}
}

export function storeChallenge(id: string, kind: ChallengeKind, challenge: string, ttlSeconds = 300): void {
  const now = new Date();
  const expires = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
  // id is fully namespaced by the caller (register:<userId> / login:<random>),
  // so re-requesting options simply replaces the pending challenge for the
  // same user while independent login ceremonies stay untouched.
  db.prepare("DELETE FROM webauthn_challenges WHERE id=?").run(id);
  db.prepare("INSERT INTO webauthn_challenges (id,kind,challenge,expires_at,created_at) VALUES (?,?,?,?,?)").run(id, kind, challenge, expires, now.toISOString());
}

export function takeChallenge(id: string, kind: ChallengeKind): string | null {
  const row = db.prepare("SELECT challenge,expires_at FROM webauthn_challenges WHERE id=? AND kind=?").get(id, kind) as any;
  if (!row) return null;
  db.prepare("DELETE FROM webauthn_challenges WHERE id=?").run(id); // single use
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  return String(row.challenge);
}

// ---------- credential store ----------

export interface StoredCredential {
  id: string;
  user_id: string;
  public_key: string;
  alg: string;
  sign_count: number;
  transports?: string | null;
  device_name?: string | null;
  created_at: string;
}

export function saveCredential(entry: {
  id: string; userId: string; publicKeySpki: Buffer; alg: string; signCount: number; transports?: string; deviceName?: string;
}): void {
  db.prepare("INSERT OR REPLACE INTO webauthn_credentials (id,user_id,public_key,alg,sign_count,transports,device_name,created_at) VALUES (?,?,?,?,?,?,?,?)")
    .run(entry.id, entry.userId, entry.publicKeySpki.toString("base64"), entry.alg, entry.signCount, entry.transports || null, entry.deviceName || null, new Date().toISOString());
}

export function getCredential(credentialId: string): StoredCredential | null {
  const row = db.prepare("SELECT * FROM webauthn_credentials WHERE id=?").get(credentialId) as any;
  return row || null;
}

export function listUserCredentials(userId: string): Array<{ id: string; deviceName?: string | null; createdAt: string; alg: string }> {
  const rows = db.prepare("SELECT id,device_name,created_at,alg FROM webauthn_credentials WHERE user_id=? ORDER BY created_at DESC").all(userId) as any[];
  return rows.map((r) => ({ id: r.id, deviceName: r.device_name, createdAt: r.created_at, alg: r.alg }));
}

export function deleteUserCredential(userId: string, credentialId: string): boolean {
  const info = db.prepare("DELETE FROM webauthn_credentials WHERE user_id=? AND id=?").run(userId, credentialId);
  return Number(info.changes) > 0;
}

function keyObjectFromStored(stored: StoredCredential): crypto.KeyObject {
  return crypto.createPublicKey({ key: Buffer.from(stored.public_key, "base64"), format: "der", type: "spki" });
}

// ---------- registration ceremony ----------

export interface RegisterVerifyInput {
  userId: string;
  hostHeader: string;
  protoHeader?: string;
  expectedChallengeId: string;
  credentialIdB64u: string;
  rawIdB64u: string;
  clientDataJSON: Buffer;
  attestationObject: Buffer;
  transports?: string;
  deviceName?: string;
}

export interface RegisterVerifyResult {
  ok: boolean;
  error?: string;
  credentialId?: string;
  deviceName?: string;
}

export function verifyRegistration(input: RegisterVerifyInput): RegisterVerifyResult {
  try {
    const clientData = parseClientData(input.clientDataJSON);
    if (clientData.type !== "webauthn.create") return { ok: false, error: "نوع الاستجابة غير صحيح (webauthn.create مطلوب)." };
    const expectedChallenge = takeChallenge(input.expectedChallengeId, "register");
    if (!expectedChallenge) return { ok: false, error: "انتهت صلاحية طلب تسجيل البصمة. أعد المحاولة." };
    if (!safeEqualB64u(clientData.challenge, expectedChallenge)) return { ok: false, error: "تحدي الأمان غير مطابق." };
    const expectedOrigin = expectedOriginForHost(input.hostHeader, input.protoHeader);
    if (expectedOrigin && clientData.origin !== expectedOrigin) return { ok: false, error: `الأصل غير متوقع (${clientData.origin}).` };
    if (clientData.crossOrigin) return { ok: false, error: "غير مسموح بالتسجيل من نطاق آخر (iframe)." };

    const attestation = cborDecode(new Uint8Array(input.attestationObject));
    if (!(attestation instanceof Map)) return { ok: false, error: "attestationObject غير صالح." };
    const fmt = attestation.get("fmt");
    const authDataBytes = attestation.get("authData");
    // fmt === 'none' is what platform authenticators emit with attestation:none;
    // self-attestation ('packed' with empty cert path) is also accepted — the
    // credential public key itself is what we verify later, attestation is not
    // a security boundary for this deployment (privacy friendly, free).
    if (fmt !== "none" && fmt !== "packed" && fmt !== "self") return { ok: false, error: `صيغة attestation غير مدعومة (${fmt}).` };
    if (!(authDataBytes instanceof Uint8Array) || authDataBytes.length < 37) return { ok: false, error: "authData غير صالح." };

    const authData = parseAuthData(authDataBytes);
    if ((authData.flags & AUTH_FLAG_UP) !== AUTH_FLAG_UP) return { ok: false, error: "المصادق غير حاضر (UP flag)." };
    if ((authData.flags & AUTH_FLAG_UV) !== AUTH_FLAG_UV) return { ok: false, error: "لم يتم التحقق من المستخدم (البصمة/PIN مطلوبة)." };
    if (!authData.credentialId || !authData.credentialPublicKey) return { ok: false, error: "لا توجد بيانات اعتماد في الاستجابة." };

    const rpId = rpIdForHost(input.hostHeader);
    const expectedRpIdHash = crypto.createHash("sha256").update(rpId).digest();
    if (!authData.rpIdHash.equals(expectedRpIdHash)) return { ok: false, error: "rpId غير مطابق لهذا النطاق." };

    const decoded = coseKeyToKeyObject(cborDecode(authData.credentialPublicKey));
    const spki = decoded.keyObject.export({ format: "der", type: "spki" });
    const credentialId = input.credentialIdB64u || toB64u(authData.credentialId);
    if (!input.rawIdB64u || input.rawIdB64u !== credentialId) return { ok: false, error: "rawId لا يطابق معرف الاعتماد." };
    if (getCredential(credentialId)) return { ok: false, error: "هذا المعرف مسجل مسبقًا." };

    const deviceName = String(input.deviceName || "").trim().slice(0, 60) || "جهاز بصمة";
    saveCredential({
      id: credentialId,
      userId: input.userId,
      publicKeySpki: Buffer.from(spki),
      alg: decoded.alg,
      signCount: authData.signCount,
      transports: String(input.transports || "").trim().slice(0, 60),
      deviceName,
    });
    return { ok: true, credentialId, deviceName };
  } catch (e: any) {
    return { ok: false, error: e?.message || "تعذر التحقق من تسجيل البصمة." };
  }
}

// ---------- assertion (login) ceremony ----------

export interface AssertionVerifyInput {
  hostHeader: string;
  protoHeader?: string;
  expectedChallengeId: string;
  credentialIdB64u: string;
  clientDataJSON: Buffer;
  authenticatorData: Buffer;
  signature: Buffer;
}

export interface AssertionVerifyResult {
  ok: boolean;
  error?: string;
  userId?: string;
}

export function verifyAssertion(input: AssertionVerifyInput): AssertionVerifyResult {
  try {
    const clientData = parseClientData(input.clientDataJSON);
    if (clientData.type !== "webauthn.get") return { ok: false, error: "نوع الاستجابة غير صحيح (webauthn.get مطلوب)." };
    const expectedChallenge = takeChallenge(input.expectedChallengeId, "login");
    if (!expectedChallenge) return { ok: false, error: "انتهت صلاحية طلب الدخول بالبصمة. أعد المحاولة." };
    if (!safeEqualB64u(clientData.challenge, expectedChallenge)) return { ok: false, error: "تحدي الأمان غير مطابق." };
    const expectedOrigin = expectedOriginForHost(input.hostHeader, input.protoHeader);
    if (expectedOrigin && clientData.origin !== expectedOrigin) return { ok: false, error: `الأصل غير متوقع (${clientData.origin}).` };
    if (clientData.crossOrigin) return { ok: false, error: "غير مسموح بالدخول من نطاق آخر." };

    const stored = getCredential(input.credentialIdB64u);
    if (!stored) return { ok: false, error: "هذا الجهاز غير مسجل للدخول بالبصمة." };

    const authData = input.authenticatorData;
    if (!authData || authData.length < 37) return { ok: false, error: "authenticatorData غير صالح." };
    const flags = authData[32];
    if ((flags & AUTH_FLAG_UP) !== AUTH_FLAG_UP) return { ok: false, error: "المصادق غير حاضر." };
    if ((flags & AUTH_FLAG_UV) !== AUTH_FLAG_UV) return { ok: false, error: "التحقق بالبصمة/PIN مطلوب للدخول." };

    const rpId = rpIdForHost(input.hostHeader);
    const expectedRpIdHash = crypto.createHash("sha256").update(rpId).digest();
    if (!Buffer.from(authData.slice(0, 32)).equals(expectedRpIdHash)) return { ok: false, error: "rpId غير مطابق لهذا النطاق." };

    // Clone detection: monotonic signature counter (skip when either side is 0,
    // many platform authenticators keep it at 0 forever).
    const view = new DataView(authData.buffer, authData.byteOffset, authData.byteLength);
    const currentCount = view.getUint32(33, false);
    const storedCount = Number(stored.sign_count) || 0;
    if (currentCount !== 0 && storedCount !== 0 && currentCount <= storedCount) {
      return { ok: false, error: "عدد التوقيعات غير متسق — قد تكون بيانات الاعتماد مكررة." };
    }

    const keyObject = keyObjectFromStored(stored);
    const alg = (stored.alg as DecodedCoseKey["alg"]) || "ES256";
    const clientHash = crypto.createHash("sha256").update(input.clientDataJSON).digest();
    const signedData = Buffer.concat([Buffer.from(authData), clientHash]);
    if (!verifySignature(alg, keyObject, signedData, input.signature)) {
      return { ok: false, error: "توقيع المصادقة غير صالح." };
    }

    db.prepare("UPDATE webauthn_credentials SET sign_count=? WHERE id=?").run(currentCount, input.credentialIdB64u);
    return { ok: true, userId: stored.user_id };
  } catch (e: any) {
    return { ok: false, error: e?.message || "تعذر التحقق من الدخول بالبصمة." };
  }
}

function safeEqualB64u(a: string, b: string): boolean {
  const bufA = fromB64u(a), bufB = fromB64u(b);
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
