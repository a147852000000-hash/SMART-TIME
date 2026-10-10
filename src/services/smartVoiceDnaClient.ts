import { apiUrl } from "./apiConfig";
import { authHeaders } from "./authService";

export interface RegisterVoiceDnaProfileRequest {
  id: string;
  displayName: string;
  relationship: string;
  language: "ar" | "en";
  dialect: string;
  speakingStyle: string;
  engineStatus: string;
  ownerConfirmed: boolean;
  guardianConfirmed: boolean;
  consentRecordedAt: string;
}

export interface VoiceDnaShareRecord {
  id: string;
  profileId: string;
  displayName: string;
  status: "pending" | "active" | "revoked";
  recipientUsername?: string;
  recipientUserId?: string;
  ownerUsername?: string;
  ownerUserId?: string;
  createdAt: string;
  acceptedAt?: string | null;
  revokedAt?: string | null;
}

async function apiRequest(path: string, options: RequestInit = {}) {
  const response = await fetch(apiUrl(path), {
    ...options,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(options.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || "تعذر تنفيذ عملية Voice DNA.");
  return payload;
}

export async function registerVoiceDnaProfile(request: RegisterVoiceDnaProfileRequest): Promise<void> {
  await apiRequest("/api/voice-dna/profiles", { method: "POST", body: JSON.stringify(request) });
}

export async function createVoiceDnaShare(profileId: string, recipientIdentifier: string): Promise<void> {
  await apiRequest("/api/voice-dna/shares", {
    method: "POST",
    body: JSON.stringify({ profileId, recipientIdentifier }),
  });
}

export async function listVoiceDnaShares(): Promise<{ outgoing: VoiceDnaShareRecord[]; incoming: VoiceDnaShareRecord[] }> {
  return await apiRequest("/api/voice-dna/shares");
}

export async function acceptVoiceDnaShare(shareId: string): Promise<void> {
  await apiRequest("/api/voice-dna/shares/" + encodeURIComponent(shareId) + "/accept", { method: "POST" });
}

export async function revokeVoiceDnaShare(shareId: string): Promise<void> {
  await apiRequest("/api/voice-dna/shares/" + encodeURIComponent(shareId) + "/revoke", { method: "POST" });
}

export async function revokeVoiceDnaProfile(profileId: string): Promise<void> {
  await apiRequest("/api/voice-dna/profiles/" + encodeURIComponent(profileId) + "/revoke", { method: "POST" });
}

export async function acknowledgeVoiceDnaSyncPackage(packageId: string): Promise<void> {
  await apiRequest("/api/voice-dna/sync/ack", {
    method: "POST",
    body: JSON.stringify({ packageId }),
  });
}


export async function synthesizeVoiceDna(input: {
  profileId: string;
  text: string;
  speakingStyle?: string;
  consentConfirmed: boolean;
  referenceText?: string;
  referenceAudio: Blob;
}): Promise<Blob> {
  const bytes = new Uint8Array(await input.referenceAudio.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  const response = await fetch(apiUrl("/api/voice-dna/synthesize"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      profileId: input.profileId,
      text: input.text,
      speakingStyle: input.speakingStyle || "natural",
      consentConfirmed: input.consentConfirmed,
      referenceText: input.referenceText || "",
      referenceAudioBase64: btoa(binary),
      referenceMimeType: input.referenceAudio.type || "audio/webm",
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error || "تعذر تشغيل صوت Voice DNA.");
  }
  return await response.blob();
}


export async function getVoiceDnaStatus(): Promise<{ provider: string; configured: boolean; healthy: boolean; localOnly: boolean }> {
  const response = await fetch(apiUrl("/api/voice-dna/status"), {
    headers: { ...authHeaders() },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || "تعذر قراءة حالة محرك Voice DNA.");
  return {
    provider: String(payload?.provider || "disabled"),
    configured: Boolean(payload?.configured),
    healthy: Boolean(payload?.healthy),
    localOnly: Boolean(payload?.localOnly),
  };
}
