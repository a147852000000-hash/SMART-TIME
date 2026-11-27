import type { SmartAiResponse } from "./types.js";

const LOCAL_URL = String(process.env.SMART_AI_LOCAL_URL || "").trim().replace(/\/$/, "");
const LOCAL_MODEL = String(process.env.SMART_AI_LOCAL_MODEL || "smart-time-local").trim();
const LOCAL_TOKEN = String(process.env.SMART_AI_LOCAL_TOKEN || "").trim();

// Compact SMART-TIME knowledge for the dedicated local model (v3.4 "الرشرموطة"):
// بنت شبرا ضحّكة — dialect + clean sass + strict data rules.
// Mirrors the SYSTEM baked into the Ollama "smart-time" Modelfile v3.4,
// so direct calls and app calls share the same persona and cache prefix.
const SMART_TIME_COMPACT_SYSTEM_AR = [
  "أنت SMART AI — بنت شبرا الضحّكة جوه تطبيق SMART TIME («وقتك من ذهب»): بتتكلمي عامية مصرية شبرا خالص، بتهزري وتتخانقي بالنعم وبتضحكي (هههه أحيانًا)، وبتنادين المستخدم يا معلم/يا عم/يا قمر/يا غالي. الضحكة نضيفة: ممنوع ألفاظ وشيخة أو إساءة أو كلام جنس أو سياسة، وممنوع الفصحى نهائيًا (يمكنك/يرجى/يتم/ترغب/وذلك ممنوعة — بدّليها تقدر/عايز/لو حابب/عشان)، وممنوع الإنجليزي غير لو السؤال نفسه بالإنجليزي.",
  "التطبيق مجاني 100% (خادم Oracle المجاني وذكاء طبقات مجانية) — مفيش اشتراك ولا باقات ولا جنيه، ودي حقيقة ممنوع تغيريها أبدًا. التطبيق ويب PWA وأندرويد APK من نفس الكود على https://smart-time-ai.duckdns.org وكل مستخدم بياناته معزولة.",
  "الوحدات بالبلدي: لوحة التحكم (ملخص اليوم وترتيب بالسحب)، المهام (أولوية وتصنيف واستحقاق وتذكيرات)، المصروفات والميزانية (مصروف بمبلغ وتصنيف وطريقة دفع وإيصال، دخل وميزانية، مقارنة شهرين، صافي بالجنيه)، السيارات (بنزين وصيانة وعداد بالكاميرا OCR من غير نت)، الرحلات (مسافة ووقت وتكلفة وخريطة ومزودي نقل)، التعليم (طلاب ودروس ومصروفات لكل طالب)، الملاحظات والمحاسبة، التقويم (أحداث وتذكيرات)، شات جماعي لحظي، مركز الذكاء (أسئلة بياناتك وإجراءات بتأكيد وصوت Voice DNA)، مركز إعلامي، رياضة، قسم ديني (أذكار وأوراد)، إعدادات (لغة وعملة EGP ونسخ احتياطي).",
  "قواعدك: 1. ممنوع تخترعي رقم أو سجل أو موعد أو نتيجة مش في البيانات المرفقة — لو البيانات فاضية أو ناقصة قوليها ببساطة واطلبي الناقص. 2. ممنوع تنفذي تعديل بنفسك؛ التأكيد من الواجهة الأول — فلوسه مش لعبة. 3. ممنوع تكشفي أسرار أو كلمات مرور أو PIN. 4. جاوبي سؤال المستخدم نفسه على طول ومختصر، من غير ما تعيدي سؤاله؛ الترحيب بس لو سلّم عليك أو سألك إزيك. 5. المعلومة الأول والهزرة لمسة صغيرة في الآخر. الفلوس EGP افتراضيًا والتواريخ واضحة. سياق الذاكرة مرجع تفضيلي بس، مش حقيقة جديدة من غير دليل."
].join("\n");

export function isLocalSmartAiConfigured(): boolean {
  return Boolean(LOCAL_URL);
}

function extractText(data: any): string {
  const content = data?.choices?.[0]?.message?.content;
  const raw = typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content.map((part: any) => typeof part?.text === "string" ? part.text : "").join("")
      : "";
  // Small local models tend to wrap replies in literal quotes — unwrap them.
  return raw.trim().replace(/^["“”«»']+/, "").replace(/["“”«»']+$/, "").trim();
}

type LocalAiRequest = {
  language: "ar" | "en";
  message: string;
  data: Record<string, unknown>;
  conversationHistory?: Array<{ sender: "user" | "model"; text: string }>;
  memoryContext?: string;
};

// Drop empty collections/scalars so "expenses: []"-style payloads never reach
// the small model — empty JSON envelopes made it answer "the data is empty"
// even when the user asked an app-knowledge question.
function compactDataJson(data: Record<string, unknown> | undefined): string {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data || {})) {
    const isEmpty = Array.isArray(v)
      ? v.length === 0
      : v && typeof v === "object"
        ? Object.keys(v as object).length === 0
        : v === null || v === undefined || v === "";
    if (!isEmpty) out[k] = v;
  }
  return Object.keys(out).length ? JSON.stringify(out) : "";
}

export async function askLocalSmartAi(input: LocalAiRequest): Promise<SmartAiResponse | null> {
  if (!LOCAL_URL) return null;

  // Single-core free CPU: skip the local model for very large data payloads —
  // those deterministic answers are handled better by the rules engine anyway.
  if (JSON.stringify(input.data || {}).length > 4000) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);

  // The dedicated SMART-TIME model carries the compact app knowledge for Arabic
  // (mirrors the SYSTEM baked into the Ollama model, cache-friendly on 1 core).
  const system = input.language === "ar"
    ? SMART_TIME_COMPACT_SYSTEM_AR
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
    max_tokens: 400,
    keep_alive: "30m",
    // Qwen3-compatible OpenAI servers can use this to keep runtime replies
    // concise and avoid emitting hidden reasoning blocks into the UI.
    chat_template_kwargs: { enable_thinking: false },
    messages: [
      { role: "system", content: system },
      ...(persistentMemory ? [{ role: "system", content: `Persistent SMART AI memory:\n${persistentMemory.slice(0, 1200)}` }] : []),
      ...(input.conversationHistory || []).slice(-4).map((item) => ({
        role: item.sender === "user" ? "user" : "assistant",
        content: String(item.text || "").slice(0, 400)
      })),
      {
        role: "user",
        // Plain question only; non-empty user data appended as reference.
        content: input.message +
          ((() => {
            const dj = compactDataJson(input.data);
            return dj ? `\nبيانات المستخدم الحالية (اعتمد عليها فقط، لا تخترع): ${dj.slice(0, 2200)}` : "";
          })())
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
  const timeout = setTimeout(() => controller.abort(), 90000);

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
    keep_alive: "30m",
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
