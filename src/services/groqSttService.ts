import { apiUrl } from './apiConfig';
import { authHeaders } from './authService';

export interface GroqSttResult {
  provider: string;
  model: string;
  transcript: string;
  requestId?: string;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to encode audio.'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(blob);
  });
}

export async function transcribeVoiceBlob(blob: Blob, language: 'ar' | 'en'): Promise<GroqSttResult> {
  if (!blob.size) throw new Error('No audio was captured.');

  const audioBase64 = await blobToBase64(blob);
  const locale = language === 'ar' ? 'ar-EG' : 'en-US';
  const response = await fetch(apiUrl('/api/ai/stt'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({
      audioBase64,
      mimeType: blob.type || 'audio/webm',
      language,
      locale,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code =
      response.status === 401 ? 'authentication-required' :
      response.status === 413 ? 'audio-too-large' :
      response.status === 429 ? 'rate-limit' :
      response.status === 415 ? 'unsupported-audio-format' :
      'provider-network';
    const error = new Error(String(payload?.error || 'Speech transcription failed.'));
    (error as Error & { code?: string }).code = code;
    throw error;
  }

  const transcript = String(payload?.transcript || '').trim();
  if (!transcript) {
    const error = new Error('No clear speech was detected.');
    (error as Error & { code?: string }).code = 'empty-transcript';
    throw error;
  }

  return {
    provider: String(payload?.provider || 'groq'),
    model: String(payload?.model || ''),
    transcript,
    requestId: payload?.requestId ? String(payload.requestId) : undefined,
  };
}
