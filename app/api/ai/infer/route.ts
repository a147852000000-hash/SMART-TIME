import type { AIMessage } from "../../../../backend/ai/providers/aiProvider.js";
import { groqProvider } from "../../../../backend/ai/providers/groqProvider.js";
import { validateV2Output } from "../../../../backend/ai/training/v2StructuredOutput.js";
import { executeToolAction } from "../../../../backend/ai/toolExecutor.js";
import { buildSmartTimeData } from "../../../../backend/ai/appContext.js";
import { formatSmartTimeKnowledge } from "../../../../backend/ai/smartTimeKnowledge.js";

const GROQ_CHAT_MODEL = String(process.env.GROQ_CHAT_MODEL || process.env.GROQ_MODEL || "openai/gpt-oss-120b").trim();
const DEFAULT_USER_ID = "smart-time-trial-user";
const MUTATING_TOOLS = new Set(["add_expense", "add_daily_task", "calendar.event.create"]);

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}

function meta(model: string, attempts: number) {
  return { model, runtime: { source: "groq", provider: "groq" }, retryAttempts: attempts };
}

function parseDecision(raw: string): any {
  try {
    const clean = raw.replace(/^\s*\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`\s*$/i, "").trim();
    const parsed = JSON.parse(clean);
    if (parsed && typeof parsed === "object" && typeof parsed.tool === "string") return parsed;
  } catch {}
  return { tool: "clarification", arguments: {}, reply: raw };
}

async function groqReply(system: string, messages: AIMessage[], temperature = 0.7): Promise<string> {
  const response = await groqProvider.chat({
    model: GROQ_CHAT_MODEL,
    messages,
    temperature,
    maxCompletionTokens: 500,
  });
  return response.content.trim();
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({}));
    const input = String(body?.input ?? body?.prompt ?? "").trim();
    if (!input) return json({ error: "input is required" }, 400);
    if (input.length > 4000) return json({ error: "input is too long" }, 413);

    const confirmed = body?.confirmed === true;
    const userId = String(body?.userId || DEFAULT_USER_ID).trim() || DEFAULT_USER_ID;

    let smartTimeData: Record<string, unknown> = {};
    try {
      smartTimeData = buildSmartTimeData(body?.context || {}, input);
    } catch {
      smartTimeData = {};
    }

    const knowledge = formatSmartTimeKnowledge();
    const system = [
      "أنت SMART TIME AI، المساعد الذكي الأساسي داخل تطبيق SMART TIME.",
      "المحرك الإنتاجي هو Groq. لا تتصرف كروبوت بقوالب ثابتة.",
      "إذا تحدث المستخدم بالعربية، استخدم العربية المصرية الطبيعية. غيّر الأسلوب حسب السؤال والسياق، ولا تكرر نفس الجملة بلا داعٍ.",
      "اعتمد على معرفة SMART TIME وسياق المستخدم المرفقين. لا تخترع بيانات غير موجودة.",
      "إذا كان السؤال عن أرقام أو سجلات المستخدم، استخدم السياق فقط. إذا كانت البيانات غير كافية، قل ذلك أو اطلب المعلومة الناقصة.",
      "لا تدّعِ تنفيذ أي إجراء قبل أن يرجع executor بنتيجة ناجحة ومتحقق منها.",
      "في الرسالة الأولى الخاصة بالطلب، أعد JSON واحدًا فقط يحتوي tool وarguments وneeds_clarification، ويمكن إضافة reply.",
      "الأدوات المسموحة: clarification, unsupported, add_expense, add_daily_task, calendar.event.create, finance.summary, finance.compare, finance.income.summary, finance.fuel.summary.",
      "clarification للطلبات التي تحتاج معلومة ناقصة. unsupported لما هو خارج قدرات التطبيق الحالية.",
      "أي عملية تغيير بيانات تحتاج تأكيدًا صريحًا من المستخدم.",
      "معرفة SMART TIME:",
      knowledge,
      "سياق SMART TIME الحالي للمستخدم:",
      JSON.stringify(smartTimeData),
    ].join("\n");

    const history: AIMessage[] = Array.isArray(body?.messages)
      ? body.messages.map((message: any): AIMessage => ({
          role: message?.role === "assistant" ? "assistant" : "user",
          content: String(message?.content ?? message?.text ?? "").trim(),
        })).filter((message: { content: string }) => message.content)
      : [];
    const messages: AIMessage[] = [...history, { role: "user" as const, content: input }];

    let attempts = 0;
    let raw: string;
    try {
      raw = await groqReply(system, [{ role: "system", content: system }, ...messages]);
      attempts = 1;
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Groq chat failed", provider: "groq", ...meta(GROQ_CHAT_MODEL, attempts) }, 502);
    }

    const parsed = parseDecision(raw);
    const parsedReply = String(parsed?.reply || parsed?.ask || "").trim();
    const clarificationQuestion = String(
      parsed?.arguments?.question
      || parsed?.arguments?.ask
      || parsed?.arguments?.clarification
      || ""
    ).trim();
    const cleanDecisionReply =
      parsedReply
      || (parsed.tool === "clarification" ? clarificationQuestion : "")
      || (parsed.tool === "unsupported" ? "الطلب ده غير مدعوم حاليًا." : "");

    if (parsed.tool === "clarification" || parsed.tool === "unsupported") {
      return json({
        result: {
          tool: parsed.tool,
          arguments: {},
          reply: cleanDecisionReply || "ممكن توضّحلي طلبك أكتر؟",
        },
        routed: false,
        executed: false,
        degraded: false,
        ...meta(GROQ_CHAT_MODEL, attempts),
      });
    }

    const decisionForValidation = {
      tool: parsed.tool,
      arguments: parsed.arguments || {},
      needs_clarification: false,
    };
    const validation = validateV2Output(JSON.stringify(decisionForValidation));

    if (!validation.valid || !validation.parsed) {
      return json({
        result: { tool: "clarification", arguments: {}, reply: parsedReply || "ممكن توضّحلي طلبك أكتر؟" },
        routed: false,
        executed: false,
        validation,
        ...meta(GROQ_CHAT_MODEL, attempts),
      });
    }

    const result = validation.parsed;

    if (MUTATING_TOOLS.has(result.tool) && !confirmed) {
      return json({
        result: { ...result, reply: parsedReply || "تمام، فهمت طلبك. تأكدلي بس إنك عايزني أنفذه." },
        validation,
        routed: true,
        executed: false,
        requiresConfirmation: true,
        confirmationReason: "Mutation requires explicit confirmation.",
        ...meta(GROQ_CHAT_MODEL, attempts),
      });
    }

    if (result.tool === "add_expense" || result.tool === "add_daily_task") {
      const toolResult = executeToolAction(userId, { type: result.tool, payload: result.arguments || {} } as any);
      const verified = toolResult.ok === true && toolResult.verification?.persisted === true;

      if (!verified) {
        return json({
          result,
          validation,
          routed: true,
          executed: false,
          routerStatus: "backend_verification_failed",
          toolResult,
          ...meta(GROQ_CHAT_MODEL, attempts),
        }, 502);
      }

      const finalSystem = [
        "أنت SMART TIME AI.",
        "اكتب ردًا نهائيًا قصيرًا وطبيعيًا بالمصرية للمستخدم.",
        "تم تنفيذ الأداة والتحقق من نجاحها. لا تطلب تأكيدًا مرة أخرى.",
        "لا تذكر JSON أو أسماء الأدوات أو تفاصيل داخلية.",
      ].join("\n");

      let reply = parsedReply || "تم تنفيذ الطلب بنجاح.";
      try {
        reply = await groqReply(finalSystem, [
          { role: "system", content: finalSystem },
          { role: "user", content: input },
          { role: "assistant", content: JSON.stringify(result) },
          { role: "tool", tool_call_id: "smart-time-execution", name: result.tool, content: JSON.stringify(toolResult) },
        ], 0.6);
        attempts += 1;
      } catch {}

      return json({
        result: { ...result, reply },
        validation,
        routed: true,
        executed: true,
        toolResult,
        ...meta(GROQ_CHAT_MODEL, attempts),
      });
    }

    if (result.tool === "calendar.event.create") {
      return json({
        result: { ...result, reply: "حجز المواعيد من المساعد لسه مش متوصل بالتقويم في النسخة الحالية." },
        validation,
        routed: true,
        executed: false,
        requiresConfirmation: false,
        routerStatus: "calendar_executor_not_implemented",
        ...meta(GROQ_CHAT_MODEL, attempts),
      }, 501);
    }

    const readOnlySystem = [
      "أنت SMART TIME AI.",
      "اكتب ردًا نهائيًا قصيرًا وطبيعيًا بالمصرية.",
      "استخدم سياق SMART TIME المرفق للإجابة الفعلية عن السؤال.",
      "لا تخترع أرقامًا. لو البيانات غير موجودة قل ذلك بوضوح.",
      "لا تذكر JSON أو أسماء الأدوات أو تفاصيل داخلية.",
    ].join("\n");

    let reply = parsedReply || "هراجع بيانات SMART TIME المتاحة وأقولك النتيجة.";
    try {
      reply = await groqReply(readOnlySystem, [
        { role: "system", content: readOnlySystem },
        { role: "user", content: input },
        { role: "assistant", content: JSON.stringify(result) },
        { role: "tool", tool_call_id: "smart-time-context", name: result.tool, content: JSON.stringify(smartTimeData) },
      ], 0.5);
      attempts += 1;
    } catch {}

    return json({
      result: { ...result, reply },
      validation,
      routed: true,
      executed: false,
      routerStatus: "read_only_answered_by_groq",
      ...meta(GROQ_CHAT_MODEL, attempts),
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "SMART TIME inference failed", retry: false, provider: "groq" }, 500);
  }
}
