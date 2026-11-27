import { buildSmartTimeData } from "./appContext.js";
import { buildSmartContext, calendarContextForModel, conversationMessagesForModel, memoryContextForModel } from "./smart-ai-tool/contextMemory.js";
import { askLocalSmartAi, isLocalSmartAiConfigured } from "./localInference.js";
import { executeToolAction, type VerifiedToolResult } from "./toolExecutor.js";
import { groqProvider, isGroqConfigured } from "./providers/groqProvider.js";
import { answerWithRules } from "./rulesEngine.js";
import { answerShubraKnowledge } from "./shubraKnowledge.js";
import { buildAppKnowledge } from "./appKnowledge.js";
import { egyptianizeText, msaMarkerCount, looksBrokenArabic, SHUBRA_FEWSHOT, SHUBRA_BANNED, dialectFixMessages } from "./egyptianize.js";
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
  // Amount priority: «بمبلغ 250» / «مبلغ 250» → «250 جنيه» → bare number.
  // The bare-number fallback strips fuel-grade numbers («بنزين 92») so the
  // octane is NEVER mistaken for the amount.
  let match = normalized.match(/(?:بمبلغ|مبلغ)\s*([\d]+(?:\.[\d]+)?)/);
  if (!match) match = normalized.match(/([\d]+(?:\.[\d]+)?)\s*(?:جنيه|ج\s|egp)/);
  if (!match) {
    const cleaned = normalized.replace(/(?:بنزين|سولار)\s*\d+/g, " بنزين ");
    match = cleaned.match(/(?:^|\s)(\d+(?:\.\d+)?)(?:\s|$)/);
  }
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function today() { return new Date().toISOString().slice(0, 10); }
function daysAgo(n: number) { return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10); }
function daysAhead(n: number) { return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10); }

// ------------------------------------------------------------
// Data-entry parser (the "قل وانا أسجل" flow): turns a spoken Arabic
// instruction like «دخل مصروف بنزين 92 بمبلغ 250 امبارح كاش» into a
// typed, confirmable action. Precision rules:
//   * «بنزين 92» — 92 is the OCTANE (fuel grade), never the amount.
//   * Amount priority: بمبلغ/مبلغ X → X جنيه → bare number (octane stripped).
//   * Extracts date (امبارح/قبل يومين), payment method (كاش/فيز/محفظة),
//     category (عربيات/تعليم/أكل/مواصلات/صحة/فواتير), and task time/priority.
// Budget writes are NOT parsed — the canonical finance boundary is
// read-only for budget in this phase, so a failing action is worse than
// a clear pointer to the screen.
// ------------------------------------------------------------
const CATEGORY_LABELS: Record<string, string> = {
  vehicle: "عربيات", education: "تعليم", food: "أكل", transport: "مواصلات",
  health: "صحة", bills: "فواتير", other: "أخرى",
};
const PAYMENT_LABELS: Record<string, string> = {
  cash: "كاش", card: "فيز/بطاقة", wallet: "محفظة إلكترونية",
};

function parseExpenseDate(m: string): string {
  if (/امبارح|إمبارح|البارحة|اول امس|أول أمس|yesterday/.test(m)) return daysAgo(1);
  const before = m.match(/قبل\s*(?:(\d+|يومين|اثنين))\s*(?:يوم|أيام|ايام)?/);
  if (before) {
    const n = before[1] === "يومين" || before[1] === "اثنين" ? 2 : Number(before[1]);
    if (Number.isFinite(n) && n > 0 && n < 60) return daysAgo(n);
  }
  return today();
}

function parsePaymentMethod(m: string): string {
  if (/فيز|فيصا|بطاقة|كارت|card|visa/.test(m)) return "card";
  if (/محفظة|محفظتى|فودافون|انستا|instapay|wallet|كاش كارد/.test(m)) return "wallet";
  return "cash";
}

function parseCategory(m: string): string {
  if (/بنزين|وقود|سولار|عربية|عربيه|صيانة|صيانه|طوارق|كويليك|fuel/.test(m)) return "vehicle";
  if (/درس|دروس|تعليم|مدرسة|مدرسه|كتب|درس خصوصي|جزاين|tuition/.test(m)) return "education";
  if (/اكل|أكل|مطعم|غدا|غداء|عشا|فطار|سناك|قهوة|كافيه|food|restaurant/.test(m)) return "food";
  if (/مواصلات|مترو|أتوبيس|اتوبيس|تاكسي|اوبير|uber|كريم|careem|باج/.test(m)) return "transport";
  if (/دواء|دوا|دكتور|مستشفى|تحاليل|معمل|صيدلية|علاج/.test(m)) return "health";
  if (/فاتورة|فواتير|كهرباء|مياه|غاز|انترنت|إنترنت|تليفون|موبايل|شحن/.test(m)) return "bills";
  return "other";
}

function parseTimeOfDay(m: string): string | null {
  const t = m.match(/الساعة\s*(\d{1,2})(?:[:٫.](\d{1,2}))?\s*(صباحاً|صباح|مساءً|مساء|ظهراً|ظهر|بالليل|ليل)?/);
  if (!t) return null;
  let h = Number(t[1]);
  const min = t[2] ? String(Math.min(59, Number(t[2]))).padStart(2, "0") : "00";
  const part = t[3] || "";
  if (h >= 0 && h <= 12) {
    if (/مساء|ظهر|ليل/.test(part)) h = h === 12 ? 12 : h + 12;
    else if (h === 12) h = 0; // الساعة 12 صباحاً
  }
  if (h > 23 || h < 0) return null;
  return `${String(h).padStart(2, "0")}:${min}`;
}

function parseAction(message: string): SmartAiAction {
  const m = message.toLowerCase();
  const fuelOctane = m.match(/(?:بنزين|سولار)\s*(80|92|95)/);
  const value = extractAmount(message);
  // Tasks FIRST: «مهمة ادخل على المدرسة الساعة 5» must never be read as an
  // expense just because a bare number (the time) is present.
  if (/مهمة|مهام|ذكرني|remind|task/.test(m) && !/مصروف|صرفت|دفعت|بنزين|سولار/.test(m)) {
    const dueTime = parseTimeOfDay(m);
    const dueDate = /بكرة|بكره|غدا|غداً|tomorrow/.test(m) ? daysAhead(1)
      : /النهاردة|اليوم|today/.test(m) ? today()
        : undefined;
    const priority = /عالية|عاليه|هامة|مهم جدا|حرجة|urgent|high/.test(m) ? "high"
      : /منخفضة|منخفضه|مش مهم|لو حبيت|low/.test(m) ? "low"
        : "medium";
    const title = message
      .replace(/(?:^|\s)ذكرني(?:\s+(?:اني|أنى|ان\s))?/gi, " ")
      .replace(/remind me (?:to )?/gi, "")
      .replace(/^(?:اضف|أضف|سجل|حط|دخل|ادخل|أدخل|انشاء|أنشاء)\s+(?:مهمة|مهام|task|a task)\s*/i, "")
      .replace(/^(?:مهمة|مهام|task)\s*/i, "")
      // temporal tail: time phrase and trailing date words, with or without tail
      .replace(/\s+الساعة\s*\d.*$/i, "")
      .replace(/\s+(?:بكرة|بكره|غدا|غداً|النهاردة|اليوم)(?:\s.*$|\s*$)/i, "")
      // priority words are standalone tokens, strip only the words themselves
      .replace(/\s*(?:بأولوية|أولوية|عالية|عاليه|هامة|مهم جدا|متوسطة|منخفضة|منخفضه|حرجة)\s*/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (title) return { type: "add_daily_task", payload: { title, priority, ...(dueDate ? { dueDate } : {}), ...(dueTime ? { dueTime } : {}), category: "general" } };
    if (!/صرفت|دفعت|مصروف/.test(m)) return null;
  }
  if ((/صرفت|دفعت|مصروف|بنزين|سولار|وقود|expense|spent|paid|(?<![أا])دخل\s|ادخل\s+(?:مصروف|بنزين|فلوس)|أدخل\s+(?:مصروف|بنزين|فلوس)|عندي\s+(مصروف|فلوس)/.test(m)) && value !== null) {
    const title = fuelOctane ? `بنزين ${fuelOctane[1]}` : /بنزين|وقود|سولار/.test(m) ? "بنزين"
      : /فاتورة|كهرباء|مياه|انترنت/.test(m) ? "فاتورة"
        : /دواء|دكتور|تحاليل/.test(m) ? "علاج"
          : /اكل|أكل|مطعم|غدا|عشا|فطار/.test(m) ? "أكل"
            : /درس|دروس|مدرسة|تعليم/.test(m) ? "مصروف تعليمي"
              : "مصروف";
    return {
      type: "add_expense",
      payload: {
        title,
        amount: value,
        category: parseCategory(m),
        date: parseExpenseDate(m),
        paymentMethod: parsePaymentMethod(m),
        notes: fuelOctane ? `أوكتان ${fuelOctane[1]} — مسجل بالكلام من مركز الذكاء` : "مسجل بالكلام من مركز الذكاء"
      }
    };
  }
  return null;
}

// Human-readable one-liner for the UI confirmation card («إجراء جاهز»).
export function actionCardSummary(action: SmartAiAction): string {
  if (!action) return "";
  if (action.type === "add_expense") {
    const p = action.payload as Record<string, string | number>;
    const cat = CATEGORY_LABELS[String(p.category)] || String(p.category);
    const pay = PAYMENT_LABELS[String(p.paymentMethod)] || String(p.paymentMethod);
    const when = String(p.date) === today() ? "النهاردة" : String(p.date) === daysAgo(1) ? "امبارح" : String(p.date);
    return `مصروف «${p.title}» — ${p.amount} جنيه — تصنيف ${cat} — ${pay} — ${when}. هيتسجل في شاشة المصروفات والميزانية.`;
  }
  if (action.type === "add_daily_task") {
    const p = action.payload as Record<string, string>;
    const parts = [`مهمة «${p.title}»`, `أولوية ${p.priority === "high" ? "عالية" : p.priority === "low" ? "منخفضة" : "متوسطة"}`];
    if (p.dueTime) parts.push(`الساعة ${p.dueTime}`);
    if (p.dueDate) parts.push(p.dueDate === today() ? "النهاردة" : p.dueDate === daysAhead(1) ? "بكرة" : p.dueDate);
    parts.push("هيتسجل في شاشة المهام.");
    return parts.join(" — ");
  }
  return "";
}

export function classifyIntent(message: string): BrainIntent {
  const m = message.toLowerCase();
  // How-it-works / explanation questions always belong to the talking brain
  // (persona + app knowledge) — never to the data-computation rules.
  if (/ازاي|إزاي|بيعمل ايه|بتعمل ايه|بتشتغل|شغالة|إيه هو|ايه هو|طريقة|فيه ايه|فيه إيه/.test(m)) return "conversation";
  // Data-entry verbs (the «قل وأنا أسجل» flow) — mirrors parseAction's verbs:
  // بنزين/سولار + amount, and entry verbs with a bare amount.
  if (/صرفت|دفعت|مصروف|بنزين|سولار|وقود|expense|spent|paid|(?<![أا])دخل\s|ادخل|أدخل|عندي\s+(مصروف|فلوس)/.test(m) && extractAmount(message) !== null) return "app_action";
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

function verifiedReply(language: "ar" | "en", result: VerifiedToolResult, action?: SmartAiAction): string {
  if (!result.ok) return language === "ar" ? `فشل التنفيذ يا معلم: ${result.error || "خطأ غير معروف"} — وأنا مش بهمّم نتايج، نجرب تاني؟` : `Execution failed: ${result.error || "unknown error"}`;
  if (result.operation === "addTransaction") {
    const r = result.record as any;
    const remaining = (result.verification as any).monthlyRemaining;
    const balance = remaining === null || remaining === undefined ? "غير محدد لأن ميزانية الشهر غير مسجلة" : `${remaining} ${readCurrency(result)}`;
    return language === "ar"
      ? `خلصنا يا معلم! سجلت ${r.amount} جنيه «${r.title}» (${CATEGORY_LABELS[String(r.category)] || "مصروف"}${r.paymentMethod === "cash" ? "، كاش" : r.paymentMethod === "card" ? "، فيز/بطاقة" : r.paymentMethod === "wallet" ? "، محفظة" : ""}) ورجعت اتأكدت منها بنفسي في قاعدة بياناتك — هتلاقيه في شاشة المصروفات والميزانية على طول. المتبقي من ميزانية الشهر: ${balance}.`
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
        "صيغتك الثابتة: بتتكلمي بصوت بنت شبرا — استخدمي كويسة/شغالة/عايزة/هعمل/هقولك/أقدر عن نفسك، وعن المستخدم تقدر/عايز/هتلاقي/يا معلم. ممنوع تفتحي الرد بتعريف نفسك (زي «أنا بنت شبرا» أو «أنا كويسة») غير لو المستخدم سألك عرف نفسك أو ازيك — ادخلي في الجواب على طول. المعلومة تيجي الأول والأهم والهزرة لمسة صغيرة في الآخر، والرد مختصر على قد الحاجة، وجاوب سؤال المستخدم نفسه من غير ما تعيديه ولا تطلع سؤال جديد.",
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
    // Groq free tier = 8000 tokens/min. Data JSON at 12k chars alone ate
    // ~3k tokens and pushed every request over the limit (429) — the exact
    // root cause of broken-Arabic fallbacks. Keep the whole request well
    // under the ceiling: 3000 chars of data ≈ ~800 tokens.
    JSON.stringify(data).slice(0, 3000),
  ].join("\n");

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: system },
  ];
  if (memoryContext) {
    messages.push({ role: "system", content: `ذاكرة SMART AI وأحداث قادمة:\n${memoryContext.slice(0, 1800)}` });
  }
  for (const item of history.slice(-6)) {
    messages.push({
      role: item.sender === "user" ? "user" : "assistant",
      content: String(item.text || "").slice(0, 700),
    });
  }
  messages.push({ role: "user", content: String(request.message || "").slice(0, 2000) });

  // Free-tier TPM: a 429 body carries "try again in Nms" — waiting exactly
  // that long costs nothing and saves the request from the broken-Arabic
  // fallback chain. One retry, capped at ~3.5s.
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const rateLimitDelay = (e: unknown): number => {
    const msg = String((e as Error)?.message || "");
    const m = msg.match(/try again in ([\d.]+)m?s/i);
    const ms = m ? Math.ceil(parseFloat(m[1]) * (/s$/i.test(m[1]) || /\d+\s?s/i.test(m[1]) ? 1000 : 1)) : 0;
    if (ms > 0) return Math.min(ms + 400, 3500);
    return /rate limit/i.test(msg) ? 1200 : 0;
  };

  let result: { content?: string; model?: string } = { content: "" };
  try {
    try {
      result = await groqProvider.chat({
        messages,
        temperature: 0.3,
        maxCompletionTokens: 480,
      });
    } catch (e) {
      const wait = rateLimitDelay(e);
      if (wait > 0 && /rate limit/i.test(String((e as Error)?.message || ""))) {
        await sleep(wait);
        result = await groqProvider.chat({
          messages,
          temperature: 0.3,
          maxCompletionTokens: 480,
        });
      } else throw e;
    }
    // Empty reply happens occasionally (content filter / glitch) — one cheap
    // retry beats dropping into the fallback chain.
    if (!String(result.content || "").trim()) {
      result = await groqProvider.chat({
        messages,
        temperature: 0.5,
        maxCompletionTokens: 480,
      });
    }
  } catch (error) {
    if (!String(result.content || "").trim()) throw error;
  }
  let reply = String(result.content || "").trim();
  if (!reply) throw new Error("Groq returned an empty reply.");
  // Drift guard: Arabic in, English out must never pass. One strict retry,
  // then keep the best of the two (retry wins if it respects the dialect).
  if (isArabicMessage(request.message) && latinRatio(reply) > LATIN_DRIFT_LIMIT) {
    try {
      messages.push({ role: "assistant", content: reply.slice(0, 500) });
      messages.push({ role: "user", content: "ردّي على نفس رسالة المستخدم تاني، بس المرة دي بالعامية المصرية الشبرا خالص، من غير أي كلمة إنجليزي ولا حرف لاتيني زيادة." });
      const retry = await groqProvider.chat({ messages, temperature: 0.3, maxCompletionTokens: 480 });
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
        maxCompletionTokens: 480,
      });
      const fixedReply = String(fixed.content || "").trim();
      if (fixedReply && latinRatio(fixedReply) <= LATIN_DRIFT_LIMIT
        && msaMarkerCount(fixedReply) < msaMarkerCount(reply)) {
        reply = fixedReply;
      }
    } catch { /* keep original reply */ }
  }
  if (language === "ar") reply = egyptianizeText(reply);
  // Final broken-Arabic net: a coherent Shubra reply always carries a
  // conversational anchor — anything else falls through to the deterministic
  // engines instead of reaching the user (this is the video complaint fix).
  if (language === "ar" && looksBrokenArabic(reply)) {
    console.warn("OPEN MIND Groq reply rejected by broken-Arabic net.");
    throw new Error("Groq reply failed the dialect quality gate.");
  }
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
      const card = actionCardSummary(plan.action);
      const reply = language === "ar"
        ? (card
          ? `فهمتك يا معلم، جهزت التسجيل بالكامل: ${card} — استنى تأكيدك بالضغطة وبتعد وتتحقق بنفسي في قاعدة بياناتك، فلوسك مش لعبة.`
          : "فهمت العملية وجهزتها يا معلم — بس محتاج تأكيدك قبل ما أكتب في قاعدة بياناتك، فلوسك مش لعبة. دوّس تأكيد وأنا أتحقق وأرجعلك.")
        : "Operation prepared — your confirmation is required before writing to the database.";
      return { reply, action: plan.action, actionSummary: card || "confirmation_required", requiresConfirmation: true, needsClarification: false, provider: "smart-ai", model: "open-mind-brain", engine: "rules", plan };
    }
    try {
      const execution = executeToolAction(request.userId, plan.action);
      return { reply: verifiedReply(language, execution, plan.action), action: plan.action, actionSummary: execution.ok ? (actionCardSummary(plan.action) || execution.operation) : "execution_failed", requiresConfirmation: false, needsClarification: !execution.ok, provider: "smart-ai", model: "open-mind-brain", engine: "rules", plan, execution };
    } catch (error) {
      const execution: VerifiedToolResult = { ok: false, operation: plan.action.type, record: {}, verification: {}, error: (error as Error).message };
      return { reply: verifiedReply(language, execution, plan.action), action: plan.action, actionSummary: "execution_failed", requiresConfirmation: false, needsClarification: true, provider: "smart-ai", model: "open-mind-brain", engine: "rules", plan, execution };
    }
  }

  // Deterministic Shubra knowledge base — identity/free/security/greeting and
  // every section's "what it does + how it works" answered instantly in
  // consistent dialect (the local model keeps the open conversation).
  const shubra = answerShubraKnowledge(message, language, request.ownerView === true);
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

  // Engine chain (production): Groq -> deterministic rules (Arabic).
  // The 1.5B local model produced مكسر Arabic (the #1 user complaint, see the
  // Nov-27 video) — it is NO LONGER part of the Arabic chain. It stays for
  // English conversation only, where its output is coherent.
  if (isGroqConfigured()) {
    try {
      const groqReply = await askGroqOpenMind({ request, language, plan, data, history: modelHistory, memoryContext });
      return { ...groqReply, plan };
    } catch (error) {
      console.warn("OPEN MIND Groq unavailable, falling back:", (error as Error)?.message);
    }
  }
  if (language === "en" && isLocalSmartAiConfigured() && LOCAL_MODEL_INTENTS.has(plan.intent)) {
    try {
      const local = await askLocalSmartAi({ language, message, data, conversationHistory: modelHistory,
        memoryContext });
      if (local?.reply) {
        return { ...local, requiresConfirmation: plan.requiresConfirmation, plan };
      }
    } catch (error) { console.warn("OPEN MIND local model unavailable:", (error as Error)?.message); }
  }
  // Deterministic rules engine — grounded answers for data questions with zero keys.
  const rulesReply = answerWithRules(message, language, data);
  return { ...rulesReply, requiresConfirmation: plan.requiresConfirmation, plan };
}
