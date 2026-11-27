import { StorageAdapter } from './storageAdapter';
import { apiUrl } from './apiConfig';
import { authHeaders } from './authService';
export type SmartAiVoiceId = "male" | "female" | "youth" | "child";

export type SmartAiVoiceProvider = "browser-tts" | "voice-dna-local";

export interface SmartAiVoiceRuntimeStatus {
  provider: SmartAiVoiceProvider;
  ready: boolean;
  note: string;
}

export function getSmartAiVoiceRuntimeStatus(provider: SmartAiVoiceProvider = "browser-tts"): SmartAiVoiceRuntimeStatus {
  if (provider === "voice-dna-local") {
    return {
      provider,
      ready: false,
      note: "Voice DNA local TTS adapter is not connected yet; recorded profiles remain private and local.",
    };
  }
  return {
    provider,
    ready: typeof window !== "undefined" && "speechSynthesis" in window,
    note: "Browser Web Speech API adapter.",
  };
}

export interface SmartAiVoiceProfile {
  id: SmartAiVoiceId;
  labelAr: string;
  labelEn: string;
  rate: number;
  pitch: number;
  volume: number;
  prefer: "male" | "female" | "any";
}

export const SMART_AI_VOICE_PROFILES: SmartAiVoiceProfile[] = [
  { id: "male", labelAr: "صوت رجالي", labelEn: "Male", rate: 0.96, pitch: 0.92, volume: 1, prefer: "male" },
  { id: "female", labelAr: "صوت نسائي", labelEn: "Female", rate: 0.98, pitch: 1.08, volume: 1, prefer: "female" },
  { id: "youth", labelAr: "صوت شبابي", labelEn: "Youth", rate: 1.03, pitch: 1.12, volume: 1, prefer: "any" },
  { id: "child", labelAr: "صوت طفولي", labelEn: "Child", rate: 1.08, pitch: 1.28, volume: 0.95, prefer: "any" }
];

const STORAGE_KEY = "smart-time-smart-ai-voice";

export function getSmartAiVoiceProfile(id?: string | null): SmartAiVoiceProfile {
  return SMART_AI_VOICE_PROFILES.find((p) => p.id === id) || SMART_AI_VOICE_PROFILES[0];
}

export function loadSmartAiVoiceId(): SmartAiVoiceId {
  try {
    const value = localStorage.getItem(STORAGE_KEY) as SmartAiVoiceId | null;
    return getSmartAiVoiceProfile(value).id;
  } catch {
    return "male";
  }
}

export function saveSmartAiVoiceId(id: SmartAiVoiceId): void {
  try {
    StorageAdapter.setItem(STORAGE_KEY, id);
  } catch {
    // Storage may be unavailable in private browsing/webviews.
  }
}

function scoreVoice(voice: SpeechSynthesisVoice, profile: SmartAiVoiceProfile, language: "ar" | "en"): number {
  const name = voice.name.toLowerCase();
  const lang = voice.lang.toLowerCase();
  const ar = language === "ar";
  let score = 0;

  if (ar && lang.startsWith("ar")) score += 100;
  if (!ar && lang.startsWith("en")) score += 100;

  if (profile.prefer === "male" && /(male|man|mohamed|ahmed|maged|omar)/i.test(name)) score += 35;
  if (profile.prefer === "female" && /(female|woman|woman|sara|sarah|maria|laila|layla)/i.test(name)) score += 35;

  if (profile.id === "child" && /(child|kid|junior|young|girl|boy)/i.test(name)) score += 30;
  if (profile.id === "youth" && /(young|teen|youth)/i.test(name)) score += 20;

  if (voice.localService) score += 5;
  return score;
}

export function speakSmartAi(text: string, language: "ar" | "en", profileId: SmartAiVoiceId): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !text.trim()) return false;

  const profile = getSmartAiVoiceProfile(profileId);
  const synth = window.speechSynthesis;
  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(text.trim());
  utterance.lang = language === "ar" ? "ar-EG" : "en-US";
  utterance.rate = profile.rate;
  utterance.pitch = profile.pitch;
  utterance.volume = profile.volume;

  const voices = synth.getVoices();
  const sorted = [...voices].sort(
    (a, b) => scoreVoice(b, profile, language) - scoreVoice(a, profile, language)
  );
  if (sorted[0]) utterance.voice = sorted[0];

  synth.speak(utterance);
  return true;
}

export function stopSmartAiVoice(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

// ------------------------------------------------------------
// Server Egyptian voice (edge-tts ar-EG) — preferred over the browser
// voices: devices without an installed Arabic voice fall back to an
// English one, which made SMART AI "talk English". The server voice is
// always Egyptian dialect. Browser TTS stays as offline fallback.
// ------------------------------------------------------------
let serverVoiceAudio: HTMLAudioElement | null = null;

export function stopServerVoice(): void {
  if (serverVoiceAudio) {
    try { serverVoiceAudio.pause(); } catch { /* already stopped */ }
    serverVoiceAudio = null;
  }
}

export function hasArabicBrowserVoice(): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  return (window.speechSynthesis.getVoices() || []).some((v) => (v.lang || "").toLowerCase().startsWith("ar"));
}

export async function speakServerVoice(text: string, profileId: SmartAiVoiceId): Promise<boolean> {
  if (!text.trim() || typeof window === "undefined") return false;
  try {
    stopServerVoice();
    stopSmartAiVoice();
    const voice = profileId === "male" ? "male" : "female";
    const res = await fetch(apiUrl("/api/ai/tts"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ text: text.slice(0, 1200), voice }),
    });
    if (!res.ok) return false;
    const blob = await res.blob();
    if (!blob || blob.size < 500) return false;
    const audio = new Audio(URL.createObjectURL(blob));
    serverVoiceAudio = audio;
    await audio.play();
    return true;
  } catch {
    return false;
  }
}
