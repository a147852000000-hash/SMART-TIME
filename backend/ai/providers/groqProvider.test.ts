import assert from "node:assert/strict";
import { GroqProvider, GroqProviderError } from "./groqProvider.js";

function response(status: number, payload: unknown, headers: Record<string,string> = {}) {
  return new Response(typeof payload === "string" ? payload : JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function fakeFetch(status: number, payload: unknown) {
  return async () => response(status, payload);
}

const okPayload = {
  id: "req_test",
  model: "openai/gpt-oss-120b",
  choices: [{ message: { content: "تمام", tool_calls: [] }, finish_reason: "stop" }],
};

const ok = new GroqProvider({ apiKey: "test-secret", fetchImpl: fakeFetch(200, okPayload) as typeof fetch });
const result = await ok.chat({ messages: [{ role: "user", content: "اختبار" }] });
assert.equal(result.provider, "groq");
assert.equal(result.content, "تمام");
assert.equal(result.model, "openai/gpt-oss-120b");

const structured = new GroqProvider({
  apiKey: "test-secret",
  fetchImpl: fakeFetch(200, {
    id: "req_structured",
    model: "openai/gpt-oss-120b",
    choices: [{ message: { content: '{"tool":"clarification"}' }, finish_reason: "stop" }],
  }) as typeof fetch,
});
const structuredResult = await structured.generateStructured({
  messages: [{ role: "user", content: "اختبار" }],
  schemaName: "test",
  schema: { type: "object", properties: { tool: { type: "string" } }, required: ["tool"], additionalProperties: false },
});
assert.equal(structuredResult.content, '{"tool":"clarification"}');

const stt = new GroqProvider({
  apiKey: "test-secret",
  fetchImpl: (async (_url: string | URL | Request, init?: RequestInit) => {
    assert.equal(init?.method, "POST");
    assert.equal(init?.body instanceof FormData, true);
    return response(200, { text: "أنا بتكلم مصري", x_groq: { id: "req_stt" } });
  }) as typeof fetch,
});
const sttResult = await stt.transcribeAudio({
  audio: new Uint8Array([1, 2, 3]),
  mimeType: "audio/webm",
  language: "ar",
});
assert.equal(sttResult.text, "أنا بتكلم مصري");
assert.equal(sttResult.model, "whisper-large-v3-turbo");

const unauthorized = new GroqProvider({ apiKey: "test-secret", fetchImpl: fakeFetch(401, { error: { message: "invalid api key" } }) as typeof fetch });
await assert.rejects(() => unauthorized.chat({ messages: [{ role: "user", content: "x" }] }), (error: unknown) => error instanceof GroqProviderError && error.code === "unauthorized");

const limited = new GroqProvider({ apiKey: "test-secret", fetchImpl: fakeFetch(429, { error: { message: "rate limited" } }) as typeof fetch });
await assert.rejects(() => limited.chat({ messages: [{ role: "user", content: "x" }] }), (error: unknown) => error instanceof GroqProviderError && error.code === "rate_limited");

const timeoutFetch = async (_url: string | URL | Request, init?: RequestInit) => {
  await new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
  });
  throw new Error("unreachable");
};
const timed = new GroqProvider({ apiKey: "test-secret", timeoutMs: 1000, fetchImpl: timeoutFetch as typeof fetch });
await assert.rejects(() => timed.chat({ messages: [{ role: "user", content: "x" }] }), (error: unknown) => error instanceof GroqProviderError && error.code === "timeout");

const notConfigured = new GroqProvider({ apiKey: "", fetchImpl: fakeFetch(200, {}) as typeof fetch });
await assert.rejects(() => notConfigured.chat({ messages: [{ role: "user", content: "x" }] }), (error: unknown) => error instanceof GroqProviderError && error.code === "not_configured");

console.log("Groq provider contract tests: PASS");
