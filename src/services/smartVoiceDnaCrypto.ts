import { apiUrl } from "./apiConfig";
import { authHeaders } from "./authService";
import { listVoiceDnaProfiles, readVoiceDnaSample, saveVoiceDnaProfile, saveVoiceDnaSample, type SmartVoiceDnaProfile } from "./smartVoiceDnaService";

const DB_NAME = "smart-time-voice-dna";
const DB_VERSION = 3;
const KEY_STORE = "keys";
const IDENTITY_KEY_ID = "voice-dna-identity-rsa-oaep";

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  return btoa(binary);
}
function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(KEY_STORE)) db.createObjectStore(KEY_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open Voice DNA keys."));
  });
}
async function getIdentityKeyPair(): Promise<CryptoKeyPair> {
  const db = await openDb();
  try {
    const existing = await new Promise<CryptoKeyPair | null>((resolve, reject) => {
      const tx = db.transaction(KEY_STORE, "readonly");
      const request = tx.objectStore(KEY_STORE).get(IDENTITY_KEY_ID);
      request.onsuccess = () => resolve(request.result?.keyPair || null);
      request.onerror = () => reject(request.error);
    });

    if (existing?.privateKey && existing?.publicKey) {
      try {
        await crypto.subtle.exportKey("jwk", existing.publicKey);
        return existing;
      } catch {
        // Older versions may have stored a non-extractable public key.
      }
    }

    const generated = await crypto.subtle.generateKey(
      { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
      true,
      ["wrapKey", "unwrapKey"]
    ) as CryptoKeyPair;

    const publicJwk = await crypto.subtle.exportKey("jwk", generated.publicKey);
    const privateJwk = await crypto.subtle.exportKey("jwk", generated.privateKey);

    const publicKey = await crypto.subtle.importKey("jwk", publicJwk, { name: "RSA-OAEP", hash: "SHA-256" }, true, ["wrapKey"]);
    const privateKey = await crypto.subtle.importKey("jwk", privateJwk, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["unwrapKey"]);
    const keyPair = { publicKey, privateKey };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(KEY_STORE, "readwrite");
      tx.objectStore(KEY_STORE).put({ id: IDENTITY_KEY_ID, keyPair });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("Could not save Voice DNA identity."));
    });

    return keyPair;
  } finally {
    db.close();
  }
}
export async function ensureVoiceDnaPublicKeyRegistered(): Promise<void> {
  const keyPair = await getIdentityKeyPair();
  const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const response = await fetch(apiUrl("/api/voice-dna/keys/public"), { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ algorithm: "RSA-OAEP-256", publicJwk }) });
  if (!response.ok) throw new Error("تعذر تسجيل مفتاح Voice DNA العام.");
}
async function importRecipientPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", jwk, { name: "RSA-OAEP", hash: "SHA-256" }, true, ["wrapKey"]);
}
export async function createEncryptedVoiceDnaPackage(input: { audio: Blob; recipientUserId: string }): Promise<{ wrappedKey: string; iv: string; ciphertext: string; mimeType: string }> {
  const keyResponse = await fetch(apiUrl("/api/voice-dna/keys/public/" + encodeURIComponent(input.recipientUserId)), { headers: { ...authHeaders() } });
  const keyPayload = await keyResponse.json().catch(() => ({}));
  if (!keyResponse.ok || !keyPayload?.publicJwk) throw new Error(keyPayload?.error || "Recipient has no Voice DNA encryption key yet.");
  const recipientKey = await importRecipientPublicKey(keyPayload.publicJwk);
  const contentKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt","decrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, contentKey, new Uint8Array(await input.audio.arrayBuffer()));
  const wrappedKey = await crypto.subtle.wrapKey("raw", contentKey, recipientKey, { name: "RSA-OAEP" });
  return { wrappedKey: toBase64(new Uint8Array(wrappedKey)), iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(ciphertext)), mimeType: input.audio.type || "audio/webm" };
}
export async function uploadEncryptedVoiceDnaPackage(input: { profileId: string; shareId: string; recipientUserId: string; audio: Blob }): Promise<void> {
  const encrypted = await createEncryptedVoiceDnaPackage({ audio: input.audio, recipientUserId: input.recipientUserId });
  const response = await fetch(apiUrl("/api/voice-dna/sync/upload"), { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ profileId: input.profileId, shareId: input.shareId, recipientUserId: input.recipientUserId, ...encrypted }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || "تعذر مزامنة Voice DNA المشفّر.");
}
export async function listIncomingVoiceDnaPackages(): Promise<any[]> {
  const response = await fetch(apiUrl("/api/voice-dna/sync/incoming"), { headers: { ...authHeaders() } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || "تعذر قراءة حزم Voice DNA.");
  return Array.isArray(payload?.packages) ? payload.packages : [];
}
export async function decryptIncomingVoiceDnaPackage(pkg: { wrappedKey: string; iv: string; ciphertext: string; mimeType: string }): Promise<Blob> {
  const keyPair = await getIdentityKeyPair();
  const contentKey = await crypto.subtle.unwrapKey("raw", fromBase64(pkg.wrappedKey) as any, keyPair.privateKey, { name: "RSA-OAEP", hash: "SHA-256" } as any, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(pkg.iv) as any }, contentKey, fromBase64(pkg.ciphertext) as any);
  return new Blob([plaintext], { type: pkg.mimeType || "audio/webm" });
}

const RECOVERY_ITERATIONS = 300000;

async function deriveRecoveryKey(passphrase: string, salt: Uint8Array, iterations = RECOVERY_ITERATIONS): Promise<CryptoKey> {
  if (passphrase.trim().length < 12) throw new Error("مفتاح الاسترداد يجب أن يكون 12 حرفًا على الأقل.");
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function persistIdentityKeyPair(keyPair: CryptoKeyPair): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(KEY_STORE, "readwrite");
      tx.objectStore(KEY_STORE).put({ id: IDENTITY_KEY_ID, keyPair });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("Could not save Voice DNA identity."));
    });
  } finally {
    db.close();
  }
}

export async function createVoiceDnaRecoveryEnvelope(passphrase: string): Promise<void> {
  if (passphrase.trim().length < 12) throw new Error("مفتاح الاسترداد يجب أن يكون 12 حرفًا على الأقل.");

  const generated = await crypto.subtle.generateKey(
    { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["wrapKey", "unwrapKey"]
  ) as CryptoKeyPair;

  const publicJwk = await crypto.subtle.exportKey("jwk", generated.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", generated.privateKey);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const recoveryKey = await deriveRecoveryKey(passphrase, salt);
  const privatePayload = new TextEncoder().encode(JSON.stringify(privateJwk));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, recoveryKey, privatePayload);

  const response = await fetch(apiUrl("/api/voice-dna/recovery/envelope"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      algorithm: "RSA-OAEP-256",
      kdf: "PBKDF2-SHA-256",
      iterations: RECOVERY_ITERATIONS,
      salt: toBase64(salt),
      iv: toBase64(iv),
      ciphertext: toBase64(new Uint8Array(ciphertext)),
      publicJwk,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || "تعذر حفظ نسخة الاسترداد.");

  const publicKey = await crypto.subtle.importKey(
    "jwk",
    publicJwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["wrapKey"]
  );
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    privateJwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["unwrapKey"]
  );
  await persistIdentityKeyPair({ publicKey, privateKey });
  await ensureVoiceDnaPublicKeyRegistered();
}

export async function hasVoiceDnaRecoveryEnvelope(): Promise<boolean> {
  const response = await fetch(apiUrl("/api/voice-dna/recovery/envelope"), {
    headers: { ...authHeaders() },
  });
  return response.ok;
}

export async function restoreVoiceDnaFromRecovery(passphrase: string): Promise<void> {
  if (passphrase.trim().length < 12) throw new Error("مفتاح الاسترداد يجب أن يكون 12 حرفًا على الأقل.");

  const response = await fetch(apiUrl("/api/voice-dna/recovery/envelope"), {
    headers: { ...authHeaders() },
  });
  const envelope = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(envelope?.error || "لا توجد نسخة استرداد Voice DNA.");

  const salt = fromBase64(String(envelope.salt || ""));
  const iv = fromBase64(String(envelope.iv || ""));
  const iterations = Number(envelope.iterations);
  if (!salt.length || iv.length !== 12 || !Number.isInteger(iterations) || iterations < 100000 || iterations > 2000000) {
    throw new Error("نسخة الاسترداد غير صالحة.");
  }

  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  const recoveryKey = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  let privateJwk: JsonWebKey;
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      recoveryKey,
      fromBase64(String(envelope.ciphertext || ""))
    );
    privateJwk = JSON.parse(new TextDecoder().decode(decrypted));
  } catch {
    throw new Error("مفتاح الاسترداد غير صحيح.");
  }

  const publicJwk = envelope.publicJwk as JsonWebKey;
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    publicJwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["wrapKey"]
  );
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    privateJwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["unwrapKey"]
  );

  await persistIdentityKeyPair({ publicKey, privateKey });
  await ensureVoiceDnaPublicKeyRegistered();
}

export async function deleteVoiceDnaRecoveryEnvelope(): Promise<void> {
  const response = await fetch(apiUrl("/api/voice-dna/recovery/envelope"), {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error || "تعذر حذف نسخة الاسترداد.");
  }
}


async function getRecoveryEnvelope(): Promise<any> {
  const response = await fetch(apiUrl("/api/voice-dna/recovery/envelope"), {
    headers: { ...authHeaders() },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || "لا توجد نسخة استرداد Voice DNA.");
  return payload;
}

async function getValidatedRecoveryKey(envelope: any, passphrase: string): Promise<CryptoKey> {
  const salt = fromBase64(String(envelope.salt || ""));
  const iv = fromBase64(String(envelope.iv || ""));
  const iterations = Number(envelope.iterations);
  if (
    salt.length !== 16 ||
    iv.length !== 12 ||
    !Number.isInteger(iterations) ||
    iterations < 100000 ||
    iterations > 2000000 ||
    !envelope.ciphertext ||
    !envelope.publicJwk
  ) {
    throw new Error("نسخة الاسترداد غير صالحة.");
  }

  const recoveryKey = await deriveRecoveryKey(passphrase, salt, iterations);
  let privateJwk: JsonWebKey;
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      recoveryKey,
      fromBase64(String(envelope.ciphertext))
    );
    privateJwk = JSON.parse(new TextDecoder().decode(decrypted));
  } catch {
    throw new Error("مفتاح الاسترداد غير صحيح.");
  }

  const publicJwk = envelope.publicJwk as JsonWebKey;
  if (
    privateJwk.kty !== "RSA" ||
    publicJwk.kty !== "RSA" ||
    privateJwk.n !== publicJwk.n ||
    privateJwk.e !== publicJwk.e
  ) {
    throw new Error("مفتاح الاسترداد غير صحيح.");
  }

  return recoveryKey;
}

export async function backupVoiceDnaSamplesForRecovery(passphrase: string): Promise<number> {
  const envelope = await getRecoveryEnvelope();
  const salt = fromBase64(String(envelope.salt || ""));
  const recoveryKey = await getValidatedRecoveryKey(envelope, passphrase);
  const profiles = await listVoiceDnaProfiles();
  const ownerProfiles = profiles.filter((profile) => profile.origin !== "shared");
  const currentProfileIds = new Set(ownerProfiles.map((profile) => profile.id));

  const existingResponse = await fetch(apiUrl("/api/voice-dna/recovery/samples"), {
    headers: { ...authHeaders() },
  });
  const existingPayload = await existingResponse.json().catch(() => ({}));
  if (!existingResponse.ok) throw new Error(existingPayload?.error || "تعذر قراءة النسخة الاحتياطية للصوت.");
  for (const item of Array.isArray(existingPayload?.samples) ? existingPayload.samples : []) {
    const existingId = String(item?.profileId || "");
    if (existingId && !currentProfileIds.has(existingId)) {
      const deleteResponse = await fetch(apiUrl("/api/voice-dna/recovery/samples/" + encodeURIComponent(existingId)), {
        method: "DELETE",
        headers: { ...authHeaders() },
      });
      if (!deleteResponse.ok) {
        const deletePayload = await deleteResponse.json().catch(() => ({}));
        throw new Error(deletePayload?.error || "تعذر تنظيف النسخ الاحتياطية القديمة.");
      }
    }
  }

  let count = 0;

  for (const profile of ownerProfiles) {
    const sample = await readVoiceDnaSample(profile.id);
    if (!sample) continue;

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new Uint8Array(await sample.arrayBuffer());
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, recoveryKey, plaintext);

    const response = await fetch(apiUrl("/api/voice-dna/recovery/samples"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        profileId: profile.id,
        salt: toBase64(salt),
        iv: toBase64(iv),
        ciphertext: toBase64(new Uint8Array(ciphertext)),
        mimeType: sample.type || "audio/webm",
        durationMs: profile.sampleDurationMs,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || "تعذر تحديث النسخة الاحتياطية للصوت.");
    count += 1;
  }

  return count;
}

export async function restoreVoiceDnaSamplesFromRecovery(passphrase: string): Promise<number> {
  const envelope = await getRecoveryEnvelope();
  const salt = fromBase64(String(envelope.salt || ""));
  const iterations = Number(envelope.iterations);
  if (salt.length !== 16 || !Number.isInteger(iterations) || iterations < 100000 || iterations > 2000000) {
    throw new Error("نسخة الاسترداد غير صالحة.");
  }

  const profilesResponse = await fetch(apiUrl("/api/voice-dna/profiles"), {
    headers: { ...authHeaders() },
  });
  const profilePayload = await profilesResponse.json().catch(() => ({}));
  if (!profilesResponse.ok) throw new Error(profilePayload?.error || "تعذر قراءة ملفات Voice DNA.");
  const remoteProfiles = Array.isArray(profilePayload?.profiles) ? profilePayload.profiles : [];

  const recoveryKey = await deriveRecoveryKey(passphrase, salt, iterations);
  const samplesResponse = await fetch(apiUrl("/api/voice-dna/recovery/samples"), {
    headers: { ...authHeaders() },
  });
  const samplesPayload = await samplesResponse.json().catch(() => ({}));
  if (!samplesResponse.ok) throw new Error(samplesPayload?.error || "تعذر قراءة النسخة الاحتياطية للصوت.");

  let count = 0;
  for (const item of Array.isArray(samplesPayload?.samples) ? samplesPayload.samples : []) {
    const remote = remoteProfiles.find((profile: any) => String(profile.id) === String(item.profileId));
    if (!remote) continue;

    let plaintext: ArrayBuffer;
    try {
      plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: fromBase64(String(item.iv || "")) },
        recoveryKey,
        fromBase64(String(item.ciphertext || ""))
      );
    } catch {
      throw new Error("تعذر فك إحدى عينات Voice DNA. تأكد من مفتاح الاسترداد.");
    }

    const localProfile: SmartVoiceDnaProfile = {
      id: String(remote.id),
      displayName: String(remote.displayName || "Voice DNA"),
      relationship: (remote.relationship || "family") as SmartVoiceDnaProfile["relationship"],
      language: remote.language === "en" ? "en" : "ar",
      locale: remote.locale === "en-US" ? "en-US" : "ar-EG",
      dialect: remote.dialect === "en-US" ? "en-US" : "ar-EG",
      speakingStyle: (remote.speakingStyle || "natural") as SmartVoiceDnaProfile["speakingStyle"],
      isDefault: Boolean(remote.isDefault),
      consentMode: (remote.relationship === "son" || remote.relationship === "daughter") ? "guardian" : "self",
      ownerConfirmed: Boolean(remote.ownerConfirmed),
      guardianConfirmed: Boolean(remote.guardianConfirmed),
      consentRecordedAt: String(remote.consentRecordedAt || new Date().toISOString()),
      createdAt: String(remote.createdAt || new Date().toISOString()),
      sampleDurationMs: Number(item.durationMs || 0),
      engineStatus: "pending_local_engine",
      origin: "local",
      ownerUserId: String(remote.ownerUserId || ""),
    };

    await saveVoiceDnaProfile(localProfile);
    await saveVoiceDnaSample(localProfile.id, new Blob([plaintext], { type: String(item.mimeType || "audio/webm") }), localProfile.sampleDurationMs);
    count += 1;
  }

  return count;
}
