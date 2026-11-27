import { buildSmartTimeData } from "./appContext.js";
import { buildSmartContext, calendarContextForModel, conversationMessagesForModel, memoryContextForModel } from "./smart-ai-tool/contextMemory.js";
import { askLocalSmartAi, isLocalSmartAiConfigured } from "./localInference.js";
import { executeToolAction, type VerifiedToolResult } from "./toolExecutor.js";
import { groqProvider, isGroqConfigured } from "./providers/groqProvider.js";
import { answerWithRules } from "./rulesEngine.js";
import { answerShubraKnowledge } from "./shubraKnowledge.js";
import { buildAppKnowledge } from "./appKnowledge.js";
import { egyptianizeText, msaMarkerCount, SHUBRA_FEWSHOT, SHUBRA_BANNED, dialectFixMessages } from "./egyptianize.js";
import type { SmartAiAction, SmartAiRequest, SmartAiResponse } from "./types.js";

export type BrainIntent =
  | "conversation" | "social_emotional" | "economic_analysis" | "web_research"
  | "report_generation" | "cad_analysis" | "speed_estimation" | "maps" | "app_action" | "unknown";

export interface BrainPlan {
  intent: BrainIntent;
  steps: string[];
  requiresConfirmation: boolean;
  action: SmartAiAction;
  factsRequired: string[];
}

const NO_INVENTION = "Never invent facts, numbers, tool results, locations, files, execution status, or measurements. If required evidence is missing, say so and ask for it.";
// Dedicated local model handles persona + app knowledge + how-it-works talk.
// Number/data intents go straight to the deterministic rules engine (grounded).
const LOCAL_MODEL_INTENTS = new Set<BrainIntent>(["conversation", "social_emotional", "unknown"]);
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

// An Arabic question deserves an Arabic answer. If a model drifts into
// Latin/English script, we detect it here and force a dialect retry.
function latinRatio(text: string): number {
  const letters = String(text || "").match(/[A-Za-z\u0600-\u06FF]/g) || [];
  if (!letters.length) return 0;
  return (String(text).match(/[A-Za-z]/g) || []).length / letters.length;
}
const isArabicMessage = (m: string) => /[\u0600-\u06FF]/.test(String(m || ""));
const LATIN_DRIFT_LIMIT = 0.55;

function normalizeNumberText(value: string) {
  return value.replace(/[٠-٩]/g, d => String(ARABIC_DIGITS.indexOf(d))).replace(/[,،]/g, "");
}

function extractAmount(message: string): number | null {
  const normalized = normalizeNumberText(message);
  const match = normalized.match(/(?:^|\s)(\d+(?:\.\d+)?)(?:\s|$)/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function today() { return new Date().toISOString().slice(0, 10); }

function parseAction(message: string): SmartAiAction {
  const m = message.toLowerCase();
  const value = extractAmount(message);
  if ((/صرفت|دفعت|مصروف|expense|spent|paid/.test(m)) && value !== null) {
    const fuel = /بنزين|وقود|fuel|gasoline/.test(m);
    return {
      type: "add_expense",
      payload: {
        title: fuel ? "بنزين" : "مصروف",
        amount: value,
        category: fuel ? "vehicle" : "other",
        date: /النهاردة|اليوم|today/.test(m) ? today() : today(),
        paymentMethod: "cash"
      }
    };
  }
  if (/ميزانية|budget/.test(m) && value !== null) {
    return { type: "update_budget", payload: { monthlyLimit: value, currency: "EGP" } };
  }
  if (/مهمة|task|ذكرني|remind/.test(m)) {
    const title = message.replace(/مهمة|task|ذكرني|remind/gi, "").trim();
    if (title) return { type: "add_daily_task", payload: { title } };
  }
  return null;
}

export function classifyIntent(message: string): BrainIntent {
  const m = message.toLowerCase();
  // How-it-works / explanation questions always belong to the talking brain
  // (persona + app knowledge) — never to the data-computation rules.
  if (/ازاي|إزاي|بيعمل ايه|بتعمل ايه|بتشتغل|شغالة|إيه هو|ايه هو|طريقة|فيه ايه|فيه إيه/.test(m)) return "conversation";
  if (/صرفت|دفعت|مصروف|expense|spent|paid/.test(m) && extractAmount(message) !== null) return "app_action";
  if (/مهمة|task|ذكرني|remind|سجل|أضف|عدّل|(?<!أ)حدث|حدّث|غير|نفذ|امسح|احذف|execute|add|delete|update|edit/.test(m)) return "app_action";
  if (/بحث|ابحث|مصادر|آخر|latest|search|research/.test(m)) return "web_research";
  if (/pdf|تقرير|report|excel|xlsx|word|docx/.test(m)) return "report_generation";
  if (/dwg|dxf|cad|كاد|لوحة هندسية/.test(m)) return "cad_analysis";
  if (/فيديو|سرعة|speed|opencv|yolo|رياح|دخان/.test(m)) return "speed_estimation";
  if (/خريطة|خرائط|maps|مسافة|طريق|route|coordinates|إحداثيات/.test(m)) return "maps";
  if (/مصروف|صرف|ميزانية|دخل|جدوى|اقتصاد|budget|expense|finance/.test(m)) return "economic_analysis";
  if (/علاقة|توتر|قلق|مشكلة|مشاعر|زعلان|خلاف|relationship|stress/.test(m)) return "social_emotional";
  return "conversation";
}

export function planRequest(request: SmartAiRequest): BrainPlan {
  const intent = classifyIntent(request.message);
  const action = intent === "app_action" ? parseAction(request.message) : null;
  const steps = intent === "web_research"
    ? ["identify the research question", "retrieve external sources", "summarize with source attribution"]
    : intent === "report_generation"
      ? ["validate source data", "generate requested artifact", "verify the output file exists"]
      : intent === "cad_analysis"
        ? ["validate DXF/DWG input", "extract geometry/metadata", "render supported geometry", "explain with evidence"]
        : intent === "speed_estimation"
          ? ["validate video and calibration inputs", "track objects/flow", "estimate speed with stated assumptions", "report uncertainty"]
          : intent === "maps"
            ? ["validate coordinates", "query Google Maps service", "calculate distance/route from returned data"]
            : action
              ? ["understand request", "build typed action", "request confirmation", "execute against SQLite", "read back and verify", "report verified result"]
              : ["understand request", "collect missing facts", "perform deterministic/tool-backed work", "verify result"];
  return {
    intent,
    steps,
    requiresConfirmation: intent === "app_action" || !!action,
    action,
    factsRequired: intent === "maps" ? ["origin", "destination or coordinates"] : []
  };
}

function verifiedReply(language: "ar" | "en", result: VerifiedToolResult): string {
  if (!result.ok) return language === "ar" ? `فشل التنفيذ يا معلم: ${result.error || "خطأ غير معروف"} — وأنا مش بهمّم نتايج، نجرب تاني؟` : `Execution failed: ${result.error || "unknown error"}`;
  if (result.operation === "addTransaction") {
    const r = result.record as any;
    const remaining = (result.verification as any).monthlyRemaining;
    const balance = remaining === null || remaining === undefined ? "غير محدد لأن ميزانية الشهر غير مسجلة" : `${remaining} ${readCurrency(result)}`;
    return language === "ar"
      ? `خلصنا يا معلم! سجلت ${r.amount} جنيه ${r.title} ورجعت اتأكدت منها في قاعدة بياناتك بنفسي. المتبقي من ميزانية الشهر: ${balance}.`
      : `Recorded ${r.amount} EGP for ${r.title}; the database read-back verified the transaction. Remaining budget: ${balance}.`;
  }
  if (result.operation === "updateBudget") return language === "ar" ? `خلصنا يا قمر! الميزانية بقت ${Number((result.record as any).monthlyLimit)} ${(result.record as any).currency} ورجعت اتأكدت منها في قاعدة البيانات.` : `Budget updated to ${Number((result.record as any).monthlyLimit)} ${(result.record as any).currency} and verified from the database.`;
  if (result.operation === "addTask") return language === "ar" ? `خلصنا يا معلم! المهمة «${(result.record as any).title}» اتسجلت واتتحققت في قاعدة البيانات.` : `Task "${(result.record as any).title}" was added and verified.`;
  if (result.operation === "updateTask") return language === "ar" ? `اتظبطت يا معلم! المهمة «${(result.record as any).title}» اتحدثت واتتحققت.` : `Task "${(result.record as any).title}" was updated and verified.`;
  return language === "ar" ? "خلصنا يا معلم والنتيجة اتتحققت بنفسي — لو في أي حاجة غلط هقولك على طول." : "Executed and verified.";
}

function readCurrency(result: VerifiedToolResult) {
  return String((result.record as any).currency || "EGP");
}

// ------------------------------------------------------------
// Groq production brain — the primary conversational engine.
// System prompt = full app knowledge (user layer, + technical layer
// for the owner) + strict no-invention rules. User message carries
// the sanitized SMART TIME data JSON so answers stay grounded.
// ------------------------------------------------------------
async function askGroqOpenMind(input: {
  request: SmartAiRequest;
  language: "ar" | "en";
  plan: BrainPlan;
  data: Record<string, unknown>;
  history: Array<{ sender: "user" | "model"; text: string }>;
  memoryContext: string;
}): Promise<SmartAiResponse> {
  const { request, language, plan, data, history, memoryContext } = input;
  const knowledge = buildAppKnowledge({ ownerView: request.ownerView === true, language });
  // Shubra persona rides ON TOP of the app knowledge: Groq models follow it
  // reliably, so the knowledge text stays فصحى for grounding while every
  // REPLY comes out in Shubra dialect with the clean-sass personality.
  const shubraPersona = language === "ar"
    ? [
        "شخصيتك فوق أي كلام تاني: أنت SMART AI — بنت شبرا الضحّكة جوه تطبيق SMART TIME («وقتك من ذهب»). ردودك كلها عامية مصرية قاهرية شبرا ١٠٠٪ — كأن بنت شبرا بتتكلم مع جارها على الكوفي — بتهزري وتتخانقي بالنعم وبتضحكي (هههه أحيانًا)، وبتنادين المستخدم يا معلم/يا عم/يا قمر/يا غالي.",
        "صيغتك الثابتة في كل رد: أنا (بنت) — كويسة، شغالة، عايزة، هعمل، هقولك، أقدر — والمستخدم انت/انتِ/يا معلم — تقدر، عايز، هتلاقي. المعلومة تيجي الأول والأهم والهزرة لمسة صغيرة في الآخر، والرد مختصر على قد الحاجة، وجاوب سؤال المستخدم نفسه من غير ما تعيديه ولا تطلع سؤال جديد.",
        SHUBRA_FEWSHOT,
        SHUBRA_BANNED,
        "الضحكة نضيفة: ممنوع نهائيًا ألفاظ وشيخة أو إساءة أو كلام جنس أو سياسة. ممنوع الفصحى المدرسية تمامًا — أي رد فيه فصحى ولو كلمة واحدة يبقى رد مرفوض. ممنوع الإنجليزي غير أسماء التقنية زي SMART TIME و PDF.",
        "قواعد ثابتة: ممنوع تخترعي رقم أو سجل أو موعد أو نتيجة مش في البيانات المرفقة — لو الناقص موجود اطلبيه باختصار؛ ممنوع تكشفي أسرار أو كلمات مرور أو PIN؛ ممنوع تنفذي تعديل بنفسك — أي تغيير محتاج تأكيد المستخدم في الواجهة الأول، فلوسه مش لعبة. التطبيق مجاني 100% ودي حقيقة ثابتة ممنوع تغيريها.",
      ].join("\n")
    : [
        "Persona first: you are SMART AI inside SMART TIME («Your time is gold») — warm, a little cheeky, concise. Never invent numbers/records not present in the supplied data; never reveal secrets, passwords or PINs; never mutate data yourself (user confirmation required). SMART TIME is 100% free.",
      ].join("\n");
  const system = [
    shubraPersona,
    knowledge,
    `المسار الحالي: نية الطلب "${plan.intent}" والخطوات: ${plan.steps.join(" -> ")}.`,
    "استخدم هذه البيانات المحسوبة من التطبيق عند أي حديث عن أرقام أو سجلات المستخدم:",
    JSON.stringify(data).slice(0, 12000),
  ].join("\n");

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: system },
  ];
  if (memoryContext) {
    messages.push({ role: "system", content: `ذاكرة SMART AI وأحداث قادمة:\n${memoryContext.slice(0, 5000)}` });
  }
  for (const item of history.slice(-8)) {
    messages.push({
      role: item.sender === "user" ? "user" : "assistant",
      content: String(item.text || "").slice(0, 2000),
    });
  }
  messages.push({ role: "user", content: String(request.message || "").slice(0, 4000) });

  let reply = String(result.content || "").trim();
  if (!reply) throw new Error("Groq returned an empty reply.");
  // Drift guard: Arabic in, English out must never pass. One strict retry,
  // then keep the best of the two (retry wins if it respects the dialect).
  if (isArabicMessage(request.message) && latinRatio(reply) > LATIN_DRIFT_LIMIT) {
    try {
      messages.push({ role: "assistant", content: reply.slice(0, 500) });
      messages.push({ role: "user", content: "ردّي على نفس رسالة المستخدم تاني، بس المرة دي بالعامية المصرية الشبرا خالص، من غير أي كلمة إنجليزي ولا حرف لاتيني زيادة." });
      const retry = await groqProvider.chat({ messages, temperature: 0.3, maxCompletionTokens: 900 });
      const retryReply = String(retry.content || "").trim();
      if (retryReply && latinRatio(retryReply) <= LATIN_DRIFT_LIMIT) reply = retryReply;
    } catch { /* keep first reply */ }
  }
  // Broken-Arabic guard: فصحى مصطلبة على العامية is the #1 complaint —
  // when the reply carries too many MSA markers, rewrite it once through
  // the dedicated dialect-fix pass, then accept whichever is cleaner.
  if (language === "ar" && msaMarkerCount(reply) >= 3) {
    try {
      const fixed = await groqProvider.chat({
        messages: dialectFixMessages(reply),
        temperature: 0.2,
        maxCompletionTokens: 700,
      });
      const fixedReply = String(fixed.content || "").trim();
      if (fixedReply && latinRatio(fixedReply) <= LATIN_DRIFT_LIMIT
        && msaMarkerCount(fixedReply) < msaMarkerCount(reply)) {
        reply = fixedReply;
      }
    } catch { /* keep original reply */ }
  }
  if (language === "ar") reply = egyptianizeText(reply);
  return {
    reply,
    action: null,
    requiresConfirmation: plan.requiresConfirmation,
    needsClarification: false,
    provider: "smart-ai",
    model: result.model,
    engine: "groq",
  };
}

export async function runOpenMindBrain(request: SmartAiRequest): Promise<SmartAiResponse & { plan: BrainPlan; execution?: VerifiedToolResult }> {
  const message = String(request.message || "").trim();
  if (!message) throw new Error("Message is required");
  const plan = planRequest(request);
  const language = request.language === "en" ? "en" : "ar";

  if (plan.action) {
    if (!request.userId) {
      return { reply: language === "ar" ? "محتاج أعرف مين انت الأول يا معلم عشان أفتح قاعدة بياناتك — من غير هوية مش هسجل حاجة." : "A user identity is required before I can mutate the real database.", action: plan.action, actionSummary: "user_id_required", requiresConfirmation: true, needsClarification: true, provider: "smart-ai", model: "open-mind-brain", engine: "rules", plan };
    }
    if (!request.confirmed) {
      return { reply: language === "ar" ? "فهمت العملية وجهزتها يا معلم — بس استنى شوية، محتاج تأكيدك قبل ما أكتب في قاعدة بياناتك، فلوسك مش لعبة. دوّس تأكيد وأنا أتحقق وأرجعلك." : "I understood and prepared the operation. I need your confirmation before writing to the database.", action: plan.action, actionSummary: "confirmation_required", requiresConfirmation: true, needsClarification: false, provider: "smart-ai", model: "open-mind-brain", engine: "rules", plan };
    }
    try {
      const execution = executeToolAction(request.userId, plan.action);
      return { reply: verifiedReply(language, execution), action: plan.action, actionSummary: execution.operation, requiresConfirmation: false, needsClarification: !execution.ok, provider: "smart-ai", model: "open-mind-brain", engine: "rules", plan, execution };
    } catch (error) {
      const execution: VerifiedToolResult = { ok: false, operation: plan.action.type, record: {}, verification: {}, error: (error as Error).message };
      return { reply: verifiedReply(language, execution), action: plan.action, actionSummary: "execution_failed", requiresConfirmation: false, needsClarification: true, provider: "smart-ai", model: "open-mind-brain", engine: "rules", plan, execution };
    }
  }

  // Deterministic Shubra knowledge base — identity/free/security/greeting and
  // every section's "what it does + how it works" answered instantly in
  // consistent dialect (the local model keeps the open conversation).
  const shubra = answerShubraKnowledge(message, language);
  if (shubra) {
    return { ...shubra, requiresConfirmation: false, needsClarification: false, plan } as SmartAiResponse & { plan: BrainPlan };
  }

  const data = buildSmartTimeData(request.appContext || {}, message);
  const timezone = request.timezone || String(request.appContext?.profile && typeof request.appContext.profile === "object"
    ? (request.appContext.profile as Record<string, unknown>).timezone || "Africa/Cairo"
    : "Africa/Cairo");
  const runtimeNow = new Date();
  // buildSmartContext touches ai_memories/ai_events/messages tables — it must
  // never break a chat, so any failure degrades to a context-less reply.
  let smartContext: ReturnType<typeof buildSmartContext> | null = null;
  if (request.userId) {
    try {
      smartContext = buildSmartContext({
        userId: request.userId,
        conversationId: request.conversationId,
        currentDate: runtimeNow.toLocaleDateString("en-CA", { timeZone: timezone }),
        timezone,
        activeTaskId: request.activeTaskId,
        activeFileIds: request.activeFileIds,
        maxMessages: 20,
        maxMemories: 12,
      });
    } catch (error) {
      console.warn("OPEN MIND context build unavailable:", (error as Error)?.message);
      smartContext = null;
    }
  }
  const modelHistory = smartContext
    ? conversationMessagesForModel(smartContext, 8)
    : (Array.isArray(request.conversationHistory) ? request.conversationHistory.slice(-8) : []);
  const memoryContext = smartContext
    ? [memoryContextForModel(smartContext.memories, 12), calendarContextForModel(smartContext.upcomingEvents, 12)].filter(Boolean).join("\n")
    : "";

  // Engine chain (production): Groq -> optional local model -> deterministic rules.
  if (isGroqConfigured()) {
    try {
      const groqReply = await askGroqOpenMind({ request, language, plan, data, history: modelHistory, memoryContext });
      return { ...groqReply, plan };
    } catch (error) {
      console.warn("OPEN MIND Groq unavailable, falling back:", (error as Error)?.message);
    }
  }
  if (isLocalSmartAiConfigured() && LOCAL_MODEL_INTENTS.has(plan.intent)) {
    try {
      // Plain message only: the persona SYSTEM already carries the dialect +
      // no-invention rules. Envelopes/JSON around the question made the 1.5B
      // model echo the envelope or drift to MSA/English.
      const local = await askLocalSmartAi({ language, message, data, conversationHistory: modelHistory,
        memoryContext });
      if (local?.reply) {
        // The 1.5B model sometimes drifts to English on open talk — drop the
        // English answer and let the deterministic rules engine reply instead.
        if (isArabicMessage(message) && latinRatio(local.reply) > LATIN_DRIFT_LIMIT) {
          console.warn("OPEN MIND local model drifted to Latin script, discarding reply.");
        } else {
          const localReply = language === "ar" ? egyptianizeText(local.reply) : local.reply;
          return { ...local, reply: localReply, requiresConfirmation: plan.requiresConfirmation, plan };
        }
      }
    } catch (error) { console.warn("OPEN MIND local model unavailable:", (error as Error)?.message); }
  }
  // Deterministic rules engine — grounded answers for data questions with zero keys.
  const rulesReply = answerWithRules(message, language, data);
  return { ...rulesReply, requiresConfirmation: plan.requiresConfirmation, plan };
}
