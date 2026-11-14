/**
 * Passkey (fingerprint login) browser plumbing — WebAuthn, free forever.
 *
 * Talks to the same-origin backend endpoints (see server.ts passkey section).
 * All base64url <-> bytes conversion lives here so authService and the UI
 * components stay simple. No third-party packages, no network services.
 */
import { apiUrl } from './apiConfig';
import { authHeaders } from './authService';

// ---------- base64url helpers ----------

function bufferToB64u(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64uToBuffer(value: string): Uint8Array {
  const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 ? '='.repeat(4 - (normalized.length % 4)) : '';
  const binary = atob(normalized + padding);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

// ---------- capability detection ----------

let availabilityCache: boolean | null = null;

export function webauthnAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.PublicKeyCredential !== 'undefined' && typeof navigator !== 'undefined' && !!navigator.credentials;
}

export async function fingerprintLoginAvailable(): Promise<boolean> {
  if (availabilityCache !== null) return availabilityCache;
  try {
    if (!webauthnAvailable() || typeof window.PublicKeyCredential!.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') {
      availabilityCache = false;
      return false;
    }
    availabilityCache = await window.PublicKeyCredential!.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    availabilityCache = false;
  }
  return availabilityCache;
}

export function resetFingerprintAvailabilityCache(): void { availabilityCache = null; }

// ---------- low-level fetch ----------

async function postJson(path: string, body: Record<string, unknown>, authed = false): Promise<any> {
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authed ? authHeaders() : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(data.error || data.message || 'تعذر الاتصال بخدمة البصمة');
    err.status = res.status;
    err.code = data.code;
    throw err;
  }
  return data;
}

// ---------- credential JSON <-> WebAuthn API ----------

function toCreationJson(cred: PublicKeyCredential): Record<string, unknown> {
  const response = cred.response as AuthenticatorAttestationResponse;
  const transports = typeof (response as any).getTransports === 'function'
    ? ((response as any).getTransports() as string[] | undefined) || []
    : [];
  return {
    id: cred.id,
    rawId: cred.id,
    type: cred.type,
    transports,
    response: {
      clientDataJSON: bufferToB64u(new Uint8Array(response.clientDataJSON)),
      attestationObject: bufferToB64u(new Uint8Array(response.attestationObject)),
    },
  };
}

function toAssertionJson(cred: PublicKeyCredential): Record<string, unknown> {
  const response = cred.response as AuthenticatorAssertionResponse;
  return {
    id: cred.id,
    rawId: cred.id,
    type: cred.type,
    response: {
      clientDataJSON: bufferToB64u(new Uint8Array(response.clientDataJSON)),
      authenticatorData: bufferToB64u(new Uint8Array(response.authenticatorData)),
      signature: bufferToB64u(new Uint8Array(response.signature)),
      userHandle: response.userHandle ? bufferToB64u(new Uint8Array(response.userHandle)) : null,
    },
  };
}

export function mapWebauthnError(err: unknown): string {
  const name = (err as any)?.name || '';
  const message = (err as any)?.message || '';
  if (name === 'NotAllowedError') return 'أُلغيت عملية البصمة أو انتهت مهلتها. حاول مرة أخرى.';
  if (name === 'InvalidStateError') return 'هذا الجهاز مسجل بالفعل للدخول بالبصمة.';
  if (name === 'SecurityError') return 'تعذر تشغيل الدخول بالبصمة من هذا النطاق.';
  if (name === 'NotSupportedError') return 'هذا المتصفح أو الجهاز لا يدعم الدخول بالبصمة.';
  if (name === 'AbortError') return 'انتهت مهلة عملية البصمة.';
  return message || 'تعذر تنفيذ عملية البصمة.';
}

// ---------- registration (enrollment) ----------

export async function enrollPasskey(deviceName?: string): Promise<{ ok: boolean; deviceName?: string; message?: string }> {
  if (!webauthnAvailable()) throw new Error('هذا المتصفح لا يدعم الدخول بالبصمة (WebAuthn).');
  const options = await postJson('/api/auth/passkey/register/options', {}, true);
  const creationOptions: PublicKeyCredentialCreationOptions = {
    challenge: b64uToBuffer(options.challenge),
    rp: options.rp,
    user: { ...options.user, id: b64uToBuffer(options.user.id) },
    pubKeyCredParams: options.pubKeyCredParams,
    timeout: options.timeout || 120000,
    attestation: options.attestation || 'none',
    authenticatorSelection: options.authenticatorSelection,
  };
  const credential = (await navigator.credentials.create({ publicKey: creationOptions })) as PublicKeyCredential | null;
  if (!credential) throw new Error('لم يتم إنشاء بصمة. حاول مرة أخرى.');
  const verified = await postJson(
    '/api/auth/passkey/register/verify',
    { credential: toCreationJson(credential), deviceName: deviceName || guessDeviceName() },
    true,
  );
  resetFingerprintAvailabilityCache();
  return { ok: !!verified?.ok, deviceName: verified?.deviceName, message: verified?.message };
}

// ---------- login (assertion) ----------

export interface PasskeyLoginServerResult {
  requiresRoleChoice?: boolean;
  availableRoles?: string[];
  roleChoiceTicket?: string;
  token?: string;
  user?: any;
}

export async function performPasskeyLogin(): Promise<PasskeyLoginServerResult> {
  if (!webauthnAvailable()) throw new Error('هذا المتصفح لا يدعم الدخول بالبصمة (WebAuthn).');
  const options = await postJson('/api/auth/passkey/login/options', {});
  const getRequestOptions: PublicKeyCredentialRequestOptions = {
    challenge: b64uToBuffer(options.challenge),
    rpId: options.rpId,
    timeout: options.timeout || 120000,
    userVerification: options.userVerification || 'required',
  };
  const credential = (await navigator.credentials.get({ publicKey: getRequestOptions })) as PublicKeyCredential | null;
  if (!credential) throw new Error('لم يتم إكمال عملية البصمة.');
  return await postJson('/api/auth/passkey/login/verify', {
    challengeId: options.challengeId,
    credential: toAssertionJson(credential),
  });
}

// ---------- management ----------

export async function listAccountPasskeys(): Promise<Array<{ id: string; deviceName?: string | null; createdAt: string; alg: string }>> {
  const res = await fetch(apiUrl('/api/auth/passkeys'), { headers: { ...authHeaders() } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'تعذر جلب قائمة البصمات.');
  return Array.isArray(data.passkeys) ? data.passkeys : [];
}

export async function removeAccountPasskey(id: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/auth/passkeys/${encodeURIComponent(id)}`), {
    method: 'DELETE',
    headers: { ...authHeaders() },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'تعذر حذف البصمة.');
}

function guessDeviceName(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (/android/i.test(ua)) return 'Android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
  if (/windows/i.test(ua)) return 'Windows';
  if (/mac os/i.test(ua)) return 'Mac';
  return 'جهاز';
}
