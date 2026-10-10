import type {
  AIChatRequest,
  AIChatResult,
  AIProvider,
  AIStructuredRequest,
  AIMessage,
  AIToolCall,
  GroqModelSummary,
  GroqProviderHealth,
} from "./aiProvider.js";

export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";

export class GroqProviderError extends Error {
  constructor(
    message: string,
    public readonly code: "not_configured" | "timeout" | "unauthorized" | "rate_limited" | "bad_request" | "upstream" | "invalid_response",
    public readonly status?: number,
  ) {
    super(message);
    this.name = "GroqProviderError";
  }
}

type FetchLike = typeof fetch;

export interface GroqProviderOptions {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}

function readApiKey(explicit?: string): string {
  return String(explicit ?? process.env.GROQ_API_KEY ?? "").trim();
}

function readModel(explicit?: string): string {
  return String(explicit ?? process.env.GROQ_MODEL ?? DEFAULT_GROQ_MODEL).trim() || DEFAULT_GROQ_MODEL;
}

function normalizeModels(payload: any): GroqModelSummary[] {
  return Array.isArray(payload?.data)
    ? payload.data.map((model: any) => ({
        id: String(model?.id || ""),
        active: model?.active,
        ownedBy: model?.owned_by,
      })).filter((model: GroqModelSummary) => model.id)
    : [];
}

function messageContent(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value.map((part: any) => typeof part?.text === "string" ? part.text : "").join("").trim();
  }
  return "";
}

function normalizeToolCalls(value: unknown): AIToolCall[] {
  if (!Array.isArray(value)) return [];
  return value.map((call: any) => ({
    id: String(call?.id || ""),
    type: "function" as const,
    function: {
      name: String(call?.function?.name || ""),
      arguments: String(call?.function?.arguments || "{}"),
    },
  })).filter((call) => call.id && call.function.name);
}

function toGroqMessages(messages: AIMessage[]) {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
    ...(message.tool_call_id ? { tool_call_id: message.tool_call_id } : {}),
    ...(message.name ? { name: message.name } : {}),
    ...(message.tool_calls ? { tool_calls: message.tool_calls } : {}),
  }));
}

function errorForStatus(status: number, body: string): GroqProviderError {
  const detail = body ? `: ${body.slice(0, 300)}` : "";
  if (status === 401 || status === 403) return new GroqProviderError(`Groq authentication failed${detail}`, "unauthorized", status);
  if (status === 429) return new GroqProviderError(`Groq rate limit reached${detail}`, "rate_limited", status);
  if (status >= 400 && status < 500) return new GroqProviderError(`Groq request rejected (${status})${detail}`, "bad_request", status);
  return new GroqProviderError(`Groq upstream failure (${status})${detail}`, "upstream", status);
}

export class GroqProvider implements AIProvider {
  readonly id = "groq";
  private readonly apiKey: string;
  private readonly defaultModel: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchLike;

  constructor(options: GroqProviderOptions = {}) {
    this.apiKey = readApiKey(options.apiKey);
    this.defaultModel = readModel(options.model);
    this.timeoutMs = Math.max(1000, Number(options.timeoutMs || 30000));
    this.fetchImpl = options.fetchImpl || fetch;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async models(): Promise<GroqModelSummary[]> {
    if (!this.apiKey) return [];
    const response = await this.request("/models", { method: "GET" });
    const payload = await this.readJson(response);
    return normalizeModels(payload);
  }

  async health(): Promise<GroqProviderHealth> {
    if (!this.apiKey) return { configured: false, reachable: false, models: [] };
    try {
      const models = await this.models();
      return { configured: true, reachable: true, models };
    } catch {
      return { configured: true, reachable: false, models: [] };
    }
  }

  async chat(request: AIChatRequest): Promise<AIChatResult> {
    const model = readModel(request.model || this.defaultModel);
    const body: Record<string, unknown> = {
      model,
      messages: toGroqMessages(request.messages),
      stream: false,
      temperature: request.temperature ?? 0.2,
      max_completion_tokens: request.maxCompletionTokens ?? 1200,
    };
    if (request.tools?.length) {
      body.tools = request.tools;
      body.tool_choice = request.toolChoice ?? "auto";
    }
    const response = await this.request("/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await this.readJson(response);
    const message = payload?.choices?.[0]?.message;
    if (!message) throw new GroqProviderError("Groq returned no assistant message.", "invalid_response", response.status);
    return {
      provider: this.id,
      model: String(payload?.model || model),
      content: messageContent(message.content),
      toolCalls: normalizeToolCalls(message.tool_calls),
      finishReason: payload?.choices?.[0]?.finish_reason ? String(payload.choices[0].finish_reason) : null,
      requestId: payload?.id ? String(payload.id) : undefined,
    };
  }

  async *streamChat(request: AIChatRequest): AsyncGenerator<string, void, void> {
    const model = readModel(request.model || this.defaultModel);
    const body: Record<string, unknown> = {
      model,
      messages: toGroqMessages(request.messages),
      stream: true,
      temperature: request.temperature ?? 0.2,
      max_completion_tokens: request.maxCompletionTokens ?? 1200,
    };
    if (request.tools?.length) {
      body.tools = request.tools;
      body.tool_choice = request.toolChoice ?? "auto";
    }

    const response = await this.request("/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.body) throw new GroqProviderError("Groq stream has no response body.", "invalid_response", response.status);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") return;
          try {
            const data = JSON.parse(payload);
            const delta = messageContent(data?.choices?.[0]?.delta?.content);
            if (delta) yield delta;
          } catch {
            throw new GroqProviderError("Groq returned malformed stream data.", "invalid_response");
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async transcribeAudio(input: {
    audio: Uint8Array;
    mimeType: string;
    language?: string;
    filename?: string;
    prompt?: string;
    model?: string;
  }): Promise<{ provider: string; model: string; text: string; requestId?: string }> {
    if (!this.apiKey) throw new GroqProviderError("GROQ_API_KEY is not configured.", "not_configured");
    const model = String(input.model || process.env.GROQ_STT_MODEL || "whisper-large-v3-turbo").trim() || "whisper-large-v3-turbo";
    const form = new FormData();
    form.append("file", new Blob([input.audio], { type: input.mimeType }), input.filename || "voice.webm");
    form.append("model", model);
    form.append("language", input.language || "ar");
    form.append("response_format", "json");
    form.append("temperature", "0");
    if (input.prompt?.trim()) form.append("prompt", input.prompt.trim().slice(0, 900));

    const response = await this.request("/audio/transcriptions", {
      method: "POST",
      body: form,
    });
    const payload = await this.readJson(response);
    const text = messageContent(payload?.text);
    if (!text) throw new GroqProviderError("Groq returned an empty transcript.", "invalid_response", response.status);
    return {
      provider: this.id,
      model: String(payload?.model || model),
      text,
      requestId: payload?.x_groq?.id ? String(payload.x_groq.id) : undefined,
    };
  }

  async generateStructured(request: AIStructuredRequest) {
    const model = readModel(request.model || this.defaultModel);
    const body = {
      model,
      messages: toGroqMessages(request.messages),
      stream: false,
      temperature: 0.1,
      max_completion_tokens: 1200,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: request.schemaName,
          strict: request.strict ?? true,
          schema: request.schema,
        },
      },
    };
    const response = await this.request("/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await this.readJson(response);
    const content = messageContent(payload?.choices?.[0]?.message?.content);
    if (!content) throw new GroqProviderError("Groq returned empty structured output.", "invalid_response", response.status);
    return {
      provider: this.id,
      model: String(payload?.model || model),
      content,
      requestId: payload?.id ? String(payload.id) : undefined,
    };
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    if (!this.apiKey) throw new GroqProviderError("GROQ_API_KEY is not configured.", "not_configured");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(GROQ_BASE_URL + path, {
        ...init,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          ...(init.headers || {}),
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw errorForStatus(response.status, body);
      }
      return response;
    } catch (error) {
      if (error instanceof GroqProviderError) throw error;
      if (error instanceof Error && error.name === "AbortError") throw new GroqProviderError("Groq request timed out.", "timeout");
      throw new GroqProviderError(error instanceof Error ? error.message : "Groq request failed.", "upstream");
    } finally {
      clearTimeout(timeout);
    }
  }

  private async readJson(response: Response): Promise<any> {
    try {
      return await response.json();
    } catch {
      throw new GroqProviderError("Groq returned invalid JSON.", "invalid_response", response.status);
    }
  }
}

export const groqProvider = new GroqProvider();

export function isGroqConfigured(): boolean {
  return groqProvider.isConfigured();
}

export async function getGroqHealth(): Promise<GroqProviderHealth> {
  return groqProvider.health();
}
