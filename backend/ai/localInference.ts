import type { SmartAiResponse } from "./types.js";

const LOCAL_URL = String(process.env.SMART_AI_LOCAL_URL || "").trim().replace(/\/$/, "");
const LOCAL_MODEL = String(process.env.SMART_AI_LOCAL_MODEL || "smart-time-local").trim();
const LOCAL_TOKEN = String(process.env.SMART_AI_LOCAL_TOKEN || "").trim();

export function isLocalSmartAiConfigured(): boolean {
  return Boolean(LOCAL_URL);
}

function extractText(data: any): string {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part: any) => typeof part?.text === "string" ? part.text : "")
      .join("")
      .trim();
  }
  return "";
}

type LocalAiRequest = {
  language: "ar" | "en";
  message: string;
  data: Record<string, unknown>;
  conversationHistory?: Array<{ sender: "user" | "model"; text: string }>;
  memoryContext?: string;
};

export async function askLocalSmartAi(input: LocalAiRequest): Promise<SmartAiResponse | null> {
  if (!LOCAL_URL) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  const system = input.language === "ar"
    ? [
        "أنت SMART AI داخل تطبيق SMART TIME.",
        "استخدم بيانات SMART TIME المرفقة فقط عند الحديث عن أرقام أو سجلات أو تواريخ.",
        "لا تخترع أي رقم أو سجل أو حقيقة غير موجودة في البيانات.",
        "لا تكشف أسرارًا أو مفاتيح API أو كلمات مرور أو PIN.",
        "لا تنفذ أي تعديل على البيانات من نفسك؛ أي تعديل يحتاج تأكيد المستخدم.",
        "تحدث بعربية مصرية طبيعية ومختصرة.",
        "إذا وُجد سياق ذاكرة، استخدمه كمرجع تفضيلي فقط ولا تحوله إلى حقيقة جديدة دون دليل."
      ].join("\n")
    : [
        "You are SMART AI inside SMART TIME.",
        "Use only the supplied SMART TIME data for numbers, records, and dates.",
        "Never invent a number, record, or fact that is not present in the data.",
        "Never reveal secrets, API keys, passwords, or PINs.",
        "Never mutate data yourself; changes require explicit user confirmation.",
        "Be concise and natural.",
        "If memory context is supplied, use it as a preference/reference only and do not invent facts from it."
      ].join("\n");

  // Keep the optional persistent-memory field explicitly typed at the request boundary.
  const persistentMemory = input.memoryContext;

  const body = {
    model: LOCAL_MODEL,
    stream: false,
    temperature: 0.2,
    max_tokens: 700,
    // Qwen3-compatible OpenAI servers can use this to keep runtime replies
    // concise and avoid emitting hidden reasoning blocks into the UI.
    chat_template_kwargs: { enable_thinking: false },
    messages: [
      { role: "system", content: system },
      ...(persistentMemory ? [{ role: "system", content: `Persistent SMART AI memory:\n${persistentMemory.slice(0, 5000)}` }] : []),
      ...(input.conversationHistory || []).slice(-6).map((item) => ({
        role: item.sender === "user" ? "user" : "assistant",
        content: String(item.text || "").slice(0, 2000)
      })),
      {
        role: "user",
        content: JSON.stringify({
          request: input.message,
          smartTimeData: input.data
        })
      }
    ]
  };

  try {
    const response = await fetch(`${LOCAL_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(LOCAL_TOKEN ? { Authorization: `Bearer ${LOCAL_TOKEN}` } : {})
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Local SMART AI HTTP ${response.status}`);
    }

    const data = await response.json();
    const reply = extractText(data);
    if (!reply) throw new Error("Local SMART AI returned an empty response.");

    return {
      reply,
      action: null,
      requiresConfirmation: false,
      needsClarification: false,
      provider: "smart-ai",
      model: LOCAL_MODEL,
      engine: "local"
    };
  } finally {
    clearTimeout(timeout);
  }
}

export interface LocalSmartAiStreamEvent {
  type: "delta" | "done";
  text?: string;
}

function extractDelta(data: any): string {
  const content = data?.choices?.[0]?.delta?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part: any) => typeof part?.text === "string" ? part.text : "")
      .join("");
  }
  return "";
}

export async function* streamLocalSmartAi(input: {
  language: "ar" | "en";
  message: string;
  data: Record<string, unknown>;
  conversationHistory?: Array<{ sender: "user" | "model"; text: string }>;
  memoryContext?: string;
}): AsyncGenerator<LocalSmartAiStreamEvent> {
  if (!LOCAL_URL) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  const system = input.language === "ar"
    ? [
        "أنت SMART AI داخل تطبيق SMART TIME.",
        "استخدم بيانات SMART TIME المرفقة فقط عند الحديث عن أرقام أو سجلات أو تواريخ.",
        "لا تخترع أي رقم أو سجل أو حقيقة غير موجودة في البيانات.",
        "لا تكشف أسرارًا أو مفاتيح API أو كلمات مرور أو PIN.",
        "لا تنفذ أي تعديل على البيانات من نفسك؛ أي تعديل يحتاج تأكيد المستخدم.",
        "تحدث بعربية مصرية طبيعية ومختصرة."
      ].join("\n")
    : [
        "You are SMART AI inside SMART TIME.",
        "Use only the supplied SMART TIME data for numbers, records, and dates.",
        "Never invent a number, record, or fact that is not present in the data.",
        "Never reveal secrets, API keys, passwords, or PINs.",
        "Never mutate data yourself; changes require explicit user confirmation.",
        "Be concise and natural."
      ].join("\n");

  const persistentMemory = input.memoryContext;

  const body = {
    model: LOCAL_MODEL,
    stream: true,
    temperature: 0.2,
    max_tokens: 700,
    chat_template_kwargs: { enable_thinking: false },
    messages: [
      { role: "system", content: system },
      ...(persistentMemory ? [{ role: "system", content: `Persistent SMART AI memory:\n${persistentMemory.slice(0, 5000)}` }] : []),
      ...(input.conversationHistory || []).slice(-6).map((item) => ({
        role: item.sender === "user" ? "user" : "assistant",
        content: String(item.text || "").slice(0, 2000)
      })),
      {
        role: "user",
        content: JSON.stringify({
          request: input.message,
          smartTimeData: input.data
        })
      }
    ]
  };

  try {
    const response = await fetch(`${LOCAL_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(LOCAL_TOKEN ? { Authorization: `Bearer ${LOCAL_TOKEN}` } : {})
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Local SMART AI HTTP ${response.status}`);
    }
    if (!response.body) {
      throw new Error("Local SMART AI returned no streaming body.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith(":")) continue;
        const payload = line.startsWith("data:") ? line.slice(5).trim() : line;
        if (!payload || payload === "[DONE]") continue;

        try {
          const delta = extractDelta(JSON.parse(payload));
          if (delta) yield { type: "delta", text: delta };
        } catch {
          // Ignore malformed SSE frames; the final non-stream path remains available.
        }
      }
    }

    buffer += decoder.decode();
    const finalLine = buffer.trim();
    if (finalLine && finalLine !== "[DONE]") {
      const payload = finalLine.startsWith("data:") ? finalLine.slice(5).trim() : finalLine;
      try {
        const delta = extractDelta(JSON.parse(payload));
        if (delta) yield { type: "delta", text: delta };
      } catch {
        // Ignore an incomplete trailing SSE frame.
      }
    }

    yield { type: "done" };
  } finally {
    clearTimeout(timeout);
  }
}
