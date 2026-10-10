import { buildSmartTimeData } from "./appContext.js";
import { buildSmartContext, calendarContextForModel, conversationMessagesForModel, memoryContextForModel } from "./smart-ai-tool/contextMemory.js";
import { askLocalSmartAi, isLocalSmartAiConfigured } from "./localInference.js";
import { executeToolAction, type VerifiedToolResult } from "./toolExecutor.js";
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
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

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
  if (/صرفت|دفعت|مصروف|expense|spent|paid/.test(m) && extractAmount(message) !== null) return "app_action";
  if (/مهمة|task|ذكرني|remind|سجل|أضف|عدّل|غير|نفذ|امسح|احذف|execute|add|delete|update/.test(m)) return "app_action";
  if (/بحث|ابحث|مصادر|آخر|latest|search|research/.test(m)) return "web_research";
  if (/pdf|تقرير|report|excel|xlsx|word|docx/.test(m)) return "report_generation";
  if (/dwg|dxf|cad|كاد|لوحة هندسية/.test(m)) return "cad_analysis";
  if (/فيديو|سرعة|speed|opencv|yolo|رياح|دخان/.test(m)) return "speed_estimation";
  if (/خريطة|خرائط|maps|مسافة|طريق|route|coordinates|إحداثيات/.test(m)) return "maps";
  if (/مصروف|ميزانية|دخل|جدوى|اقتصاد|budget|expense|finance/.test(m)) return "economic_analysis";
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
  if (!result.ok) return language === "ar" ? `فشل التنفيذ فعليًا: ${result.error || "خطأ غير معروف"}` : `Execution failed: ${result.error || "unknown error"}`;
  if (result.operation === "addTransaction") {
    const r = result.record as any;
    const remaining = (result.verification as any).monthlyRemaining;
    const balance = remaining === null || remaining === undefined ? "غير محدد لأن ميزانية الشهر غير مسجلة" : `${remaining} ${readCurrency(result)}`;
    return language === "ar"
      ? `تم تسجيل ${r.amount} جنيه ${r.title}، وتم التحقق من وجود العملية في قاعدة البيانات. الرصيد المتبقي من الميزانية: ${balance}.`
      : `Recorded ${r.amount} EGP for ${r.title}; the database read-back verified the transaction. Remaining budget: ${balance}.`;
  }
  if (result.operation === "updateBudget") return language === "ar" ? `تم تحديث الميزانية إلى ${Number((result.record as any).monthlyLimit)} ${(result.record as any).currency} وتم التحقق منها من قاعدة البيانات.` : `Budget updated to ${Number((result.record as any).monthlyLimit)} ${(result.record as any).currency} and verified from the database.`;
  if (result.operation === "addTask") return language === "ar" ? `تمت إضافة المهمة «${(result.record as any).title}» والتحقق من حفظها.` : `Task "${(result.record as any).title}" was added and verified.`;
  if (result.operation === "updateTask") return language === "ar" ? `تم تحديث المهمة «${(result.record as any).title}» والتحقق من النتيجة.` : `Task "${(result.record as any).title}" was updated and verified.`;
  return language === "ar" ? "تم التنفيذ والتحقق من النتيجة." : "Executed and verified.";
}

function readCurrency(result: VerifiedToolResult) {
  return String((result.record as any).currency || "EGP");
}

export async function runOpenMindBrain(request: SmartAiRequest): Promise<SmartAiResponse & { plan: BrainPlan; execution?: VerifiedToolResult }> {
  const message = String(request.message || "").trim();
  if (!message) throw new Error("Message is required");
  const plan = planRequest(request);
  const language = request.language === "en" ? "en" : "ar";

  if (plan.action) {
    if (!request.userId) {
      return { reply: language === "ar" ? "أحتاج هوية المستخدم لتنفيذ العملية على قاعدة البيانات الحقيقية." : "A user identity is required before I can mutate the real database.", action: plan.action, actionSummary: "user_id_required", requiresConfirmation: true, needsClarification: true, provider: "smart-ai", model: "open-mind-brain", engine: "rules", plan };
    }
    if (!request.confirmed) {
      return { reply: language === "ar" ? "فهمت العملية وجهزتها. أحتاج تأكيدك قبل الكتابة في قاعدة البيانات." : "I understood and prepared the operation. I need your confirmation before writing to the database.", action: plan.action, actionSummary: "confirmation_required", requiresConfirmation: true, needsClarification: false, provider: "smart-ai", model: "open-mind-brain", engine: "rules", plan };
    }
    try {
      const execution = executeToolAction(request.userId, plan.action);
      return { reply: verifiedReply(language, execution), action: plan.action, actionSummary: execution.operation, requiresConfirmation: false, needsClarification: !execution.ok, provider: "smart-ai", model: "open-mind-brain", engine: "rules", plan, execution };
    } catch (error) {
      const execution: VerifiedToolResult = { ok: false, operation: plan.action.type, record: {}, verification: {}, error: (error as Error).message };
      return { reply: verifiedReply(language, execution), action: plan.action, actionSummary: "execution_failed", requiresConfirmation: false, needsClarification: true, provider: "smart-ai", model: "open-mind-brain", engine: "rules", plan, execution };
    }
  }

  const data = buildSmartTimeData(request.appContext || {}, message);
  const timezone = request.timezone || String(request.appContext?.profile && typeof request.appContext.profile === "object"
    ? (request.appContext.profile as Record<string, unknown>).timezone || "Africa/Cairo"
    : "Africa/Cairo");
  const runtimeNow = new Date();
  const smartContext = request.userId
    ? buildSmartContext({
        userId: request.userId,
        conversationId: request.conversationId,
        currentDate: runtimeNow.toLocaleDateString("en-CA", { timeZone: timezone }),
        timezone,
        activeTaskId: request.activeTaskId,
        activeFileIds: request.activeFileIds,
        maxMessages: 20,
        maxMemories: 12,
      })
    : null;
  const modelHistory = smartContext
    ? conversationMessagesForModel(smartContext, 8)
    : (Array.isArray(request.conversationHistory) ? request.conversationHistory.slice(-8) : []);
  const memoryContext = smartContext
    ? [memoryContextForModel(smartContext.memories, 12), calendarContextForModel(smartContext.upcomingEvents, 12)].filter(Boolean).join("\n")
    : "";
  if (isLocalSmartAiConfigured()) {
    try {
      const local = await askLocalSmartAi({ language, message: `${NO_INVENTION}\nIntent: ${plan.intent}\nPlan: ${plan.steps.join(" -> ")}\nApp data: ${JSON.stringify(data)}\nUser: ${message}`, data, conversationHistory: modelHistory,
        memoryContext });
      if (local?.reply) return { ...local, requiresConfirmation: plan.requiresConfirmation, plan };
    } catch (error) { console.warn("OPEN MIND local model unavailable:", (error as Error)?.message); }
  }
  return { reply: language === "ar" ? `فهمت الطلب كـ${plan.intent}. لا توجد نتيجة أداة موثقة لهذا الطلب داخل المسار الحالي، لذلك لن أخترع نتيجة.` : `I classified this as ${plan.intent}. No verified tool result is available, so I will not invent one.`, action: null, requiresConfirmation: false, needsClarification: true, provider: "smart-ai", model: "open-mind-brain", engine: "rules", plan };
}
