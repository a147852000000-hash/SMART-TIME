import type { SmartVoiceDnaConsentMode, SmartVoiceDnaRelationship, SmartVoiceDnaDialect, SmartVoiceDnaSpeakingStyle } from "../types";
import { StorageAdapter } from './storageAdapter';

export interface SmartVoiceDnaProfile {
  id: string;
  displayName: string;
  relationship: SmartVoiceDnaRelationship;
  language: "ar" | "en";
  locale: SmartVoiceDnaDialect;
  dialect: SmartVoiceDnaDialect;
  speakingStyle: SmartVoiceDnaSpeakingStyle;
  isDefault: boolean;
  consentMode: SmartVoiceDnaConsentMode;
  ownerConfirmed: boolean;
  guardianConfirmed: boolean;
  consentRecordedAt: string;
  createdAt: string;
  sampleDurationMs: number;
  engineStatus: "pending_local_engine" | "ready";
  origin?: "local" | "shared";
  ownerUserId?: string;
  shareId?: string;
}

interface StoredVoiceSample {
  id: string;
  profileId: string;
  mimeType: string;
  durationMs: number;
  iv: ArrayBuffer;
  ciphertext: ArrayBuffer;
  createdAt: string;
}

const DB_NAME = "smart-time-voice-dna";
const DB_VERSION = 3;
const PROFILE_STORE = "profiles";
const SAMPLE_STORE = "samples";
const KEY_STORE = "keys";
const KEY_ID = "voice-dna-aes-key";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined" && !!window.crypto?.subtle;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isBrowser()) {
      reject(new Error("Voice DNA storage requires a browser."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PROFILE_STORE)) {
        db.createObjectStore(PROFILE_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(SAMPLE_STORE)) {
        const store = db.createObjectStore(SAMPLE_STORE, { keyPath: "id" });
        store.createIndex("profileId", "profileId", { unique: false });
      }
      if (!db.objectStoreNames.contains(KEY_STORE)) {
        db.createObjectStore(KEY_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open Voice DNA storage."));
  });
}

async function getOrCreateKey(db: IDBDatabase): Promise<CryptoKey> {
  const existing = await new Promise<CryptoKey | undefined>((resolve, reject) => {
    const tx = db.transaction(KEY_STORE, "readonly");
    const request = tx.objectStore(KEY_STORE).get(KEY_ID);
    request.onsuccess = () => resolve(request.result?.key as CryptoKey | undefined);
    request.onerror = () => reject(request.error);
  });

  if (existing) return existing;

  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(KEY_STORE, "readwrite");
    tx.objectStore(KEY_STORE).put({ id: KEY_ID, key });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Could not persist Voice DNA key."));
  });

  return key;
}

export async function listVoiceDnaProfiles(): Promise<SmartVoiceDnaProfile[]> {
  const db = await openDb();
  try {
    return await new Promise<SmartVoiceDnaProfile[]>((resolve, reject) => {
      const tx = db.transaction(PROFILE_STORE, "readonly");
      const request = tx.objectStore(PROFILE_STORE).getAll();
      request.onsuccess = () => {
        const profiles = Array.isArray(request.result) ? request.result : [];
        resolve(profiles.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))));
      };
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function saveVoiceDnaProfile(profile: SmartVoiceDnaProfile): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PROFILE_STORE, "readwrite");
      tx.objectStore(PROFILE_STORE).put(profile);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("Could not save Voice DNA profile."));
    });
  } finally {
    db.close();
  }
}

export async function saveVoiceDnaSample(
  profileId: string,
  blob: Blob,
  durationMs: number
): Promise<void> {
  const db = await openDb();
  try {
    const key = await getOrCreateKey(db);
    const plain = await blob.arrayBuffer();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain);

    const record: StoredVoiceSample = {
      id: profileId,
      profileId,
      mimeType: blob.type || "audio/webm",
      durationMs,
      iv: iv.slice().buffer as ArrayBuffer,
      ciphertext,
      createdAt: new Date().toISOString(),
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SAMPLE_STORE, "readwrite");
      tx.objectStore(SAMPLE_STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("Could not save Voice DNA sample."));
    });
  } finally {
    db.close();
  }
}

export async function readVoiceDnaSample(profileId: string): Promise<Blob | null> {
  const db = await openDb();
  try {
    const record = await new Promise<StoredVoiceSample | undefined>((resolve, reject) => {
      const tx = db.transaction(SAMPLE_STORE, "readonly");
      const request = tx.objectStore(SAMPLE_STORE).get(profileId);
      request.onsuccess = () => resolve(request.result as StoredVoiceSample | undefined);
      request.onerror = () => reject(request.error);
    });

    if (!record) return null;

    const key = await getOrCreateKey(db);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(record.iv) },
      key,
      record.ciphertext
    );

    return new Blob([plain], { type: record.mimeType || "audio/webm" });
  } finally {
    db.close();
  }
}

export async function deleteVoiceDnaProfile(profileId: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([PROFILE_STORE, SAMPLE_STORE], "readwrite");
      tx.objectStore(PROFILE_STORE).delete(profileId);
      tx.objectStore(SAMPLE_STORE).delete(profileId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("Could not delete Voice DNA profile."));
    });
  } finally {
    db.close();
  }
}

export async function hasVoiceDnaSample(profileId: string): Promise<boolean> {
  const db = await openDb();
  try {
    return await new Promise<boolean>((resolve, reject) => {
      const tx = db.transaction(SAMPLE_STORE, "readonly");
      const request = tx.objectStore(SAMPLE_STORE).getKey(profileId);
      request.onsuccess = () => resolve(Boolean(request.result));
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}
 
export function createVoiceDnaId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return "voice_" + crypto.randomUUID();
  }
  return "voice_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2);
}

const DEFAULT_PROFILE_KEY = "smart-time-voice-dna-default";

export function getDefaultVoiceDnaProfileId(): string | null {
  try {
    return localStorage.getItem(DEFAULT_PROFILE_KEY);
  } catch {
    return null;
  }
}

export async function setDefaultVoiceDnaProfile(profileId: string): Promise<void> {
  const profiles = await listVoiceDnaProfiles();
  const exists = profiles.some((profile) => profile.id === profileId);
  if (!exists) throw new Error("Voice DNA profile not found.");

  for (const profile of profiles) {
    if (profile.isDefault !== (profile.id === profileId)) {
      await saveVoiceDnaProfile({ ...profile, isDefault: profile.id === profileId });
    }
  }

  try {
    StorageAdapter.setItem(DEFAULT_PROFILE_KEY, profileId);
  } catch {
    // Local preference storage may be unavailable.
  }
}

export async function clearDefaultVoiceDnaProfile(): Promise<void> {
  const profiles = await listVoiceDnaProfiles();
  for (const profile of profiles) {
    if (profile.isDefault) await saveVoiceDnaProfile({ ...profile, isDefault: false });
  }
  try {
    localStorage.removeItem(DEFAULT_PROFILE_KEY);
  } catch {
    // no-op
  }
}
