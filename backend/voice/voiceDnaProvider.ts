export interface VoiceDnaSynthesisRequest {
  text: string;
  language: "ar" | "en";
  locale: "ar-EG" | "en-US";
  profileId: string;
  referenceAudio?: Uint8Array;
  referenceMimeType?: string;
  referenceText?: string;
  speaker?: string;
  speakingStyle?: "natural" | "calm" | "warm" | "formal" | "alert";
}

export interface VoiceDnaSynthesisResult {
  audio: Uint8Array;
  contentType: string;
  provider: string;
}

export interface VoiceDnaProvider {
  readonly id: string;
  isAvailable(): boolean;
  synthesize(request: VoiceDnaSynthesisRequest): Promise<VoiceDnaSynthesisResult>;
}

export class DisabledVoiceDnaProvider implements VoiceDnaProvider {
  readonly id = "disabled";
  isAvailable(): boolean { return false; }
  async synthesize(_request: VoiceDnaSynthesisRequest): Promise<VoiceDnaSynthesisResult> {
    throw new Error("Voice DNA local provider is not configured.");
  }
}

export function createHttpVoiceDnaProvider(options: { id?: string; url: string; token?: string; timeoutMs?: number }): VoiceDnaProvider {
  const id = options.id || "voice-dna-http";
  return {
    id,
    isAvailable: () => Boolean(options.url.trim()),
    async synthesize(request) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 90000);
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Accept: "audio/wav, audio/mpeg, application/json",
        };
        if (options.token?.trim()) headers.Authorization = "Bearer " + options.token.trim();

        const body: Record<string, unknown> = {
          text: request.text,
          language: request.language,
          locale: request.locale,
          profileId: request.profileId,
          referenceText: request.referenceText || "",
          speaker: request.speaker || "",
          speakingStyle: request.speakingStyle || "natural",
        };
        if (request.referenceAudio?.length) {
          body.referenceAudioBase64 = Buffer.from(request.referenceAudio).toString("base64");
          body.referenceMimeType = request.referenceMimeType || "audio/wav";
        }

        const response = await fetch(options.url, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (!response.ok) {
          const bodyText = await response.text().catch(() => "");
          throw new Error("Voice DNA provider failed (" + response.status + ")" + (bodyText ? ": " + bodyText.slice(0, 300) : ""));
        }
        const contentType = String(response.headers.get("content-type") || "audio/wav");
        if (contentType.includes("application/json")) {
          const json = await response.json() as { audioBase64?: string; contentType?: string };
          if (!json.audioBase64) throw new Error("Voice DNA provider returned no audio.");
          return {
            audio: Uint8Array.from(Buffer.from(json.audioBase64, "base64")),
            contentType: json.contentType || "audio/wav",
            provider: id,
          };
        }
        return {
          audio: new Uint8Array(await response.arrayBuffer()),
          contentType,
          provider: id,
        };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}