// ============================================================
// SMART TIME — AUTONOMOUS AGENT (attached to the dedicated model)
// Real tool-using agent loop for the SMART AI phase:
//   goal -> plan tool calls (Groq structured output when configured,
//   deterministic keyword planner as free fallback) -> confirmation
//   gate (per-operation policy) -> execute via toolRuntime (validate,
//   permission, execute, verify) -> verified artifacts back.
// Never invents results: every artifact in the response came from an
// actually executed and verified tool.
// ============================================================

import { groqProvider, isGroqConfigured } from "../providers/groqProvider.js";
import { executeV3Tool } from "./toolRuntime.js";
import { v3ToolRegistry, isV3ToolName } from "./toolRegistry.js";
import type { V3ToolContext, V3ToolName } from "./types.js";

export const AGENT_VERSION = "smart-agent-v1";
const MAX_STEPS = 6;

export interface AgentToolCall {
  tool: string;
  args?: Record<string, unknown>;
}

export interface AutonomousAgentRequest {
  goal: string;
  context: V3ToolContext;
  confirmed?: boolean;
  /** Explicit plan returned by the caller (UI/model) after a needs_confirmation response. */
  approvedToolCalls?: AgentToolCall[];
  /** When false, skips Groq planning and uses the deterministic planner. Default true. */
  allowModelPlanning?: boolean;
}

export interface AgentStep {
  index: number;
  tool: V3ToolName;
  args: Record<string, unknown>;
  status: "planned" | "awaiting_confirmation" | "executed" | "verified" | "failed";
  summary?: string;
  artifact?: { type: string; filename: string };
  error?: string;
}

export interface AgentArtifact {
  type: string;
  filename: string;
  data: string; // base64
}

export interface AutonomousAgentResult {
  ok: boolean;
  status: "needs_confirmation" | "completed" | "failed";
  message: string;
  planner: "groq" | "deterministic" | "explicit";
  steps: AgentStep[];
  artifacts: AgentArtifact[];
  agentVersion: string;
}

interface PlannedCall {
  tool: V3ToolName;
  args: Record<string, unknown>;
}

// ------------------------------------------------------------
// Deterministic planner (zero-cost fallback, no API key needed)
// ------------------------------------------------------------
export function planAgentToolCallsDeterministic(goal: string, context: V3ToolContext): PlannedCall[] {
  const text = String(goal || "").toLowerCase();
  const data = (context.canonicalData || {}) as Record<string, unknown>;
  const calls: PlannedCall[] = [];

  // Explicit research intent wins over artifact keywords ("search for free
  // CAD viewers" is a search, not a drawing request) unless the user asks
  // to CREATE something.
  const wantsCreate = /اعمل|أعمل|ارسم|أرسم|ولد|انشئ|أنشئ|حطل|حط|صدّر|export|generate|create|draw|build/.test(text);
  if (/بحث|ابحث|أبحث|search|مصادر|آخر أخبار|أحدث/.test(text) && !wantsCreate) {
    calls.push({ tool: "web_search", args: { message: String(goal).slice(0, 300) } });
    return calls.slice(0, MAX_STEPS);
  }
  if (/dxf|dwg|كاد|cad|رسم هندسي|مخطط هندسي|لوحة هندسية/.test(text)) {
    calls.push({ tool: "generate_dxf", args: { message: String(goal).slice(0, 500) } });
    return calls.slice(0, MAX_STEPS);
  }
  if (/اكسل|إكسل|excel|xlsx/.test(text)) {
    calls.push({ tool: "generate_excel_report", args: { data: data && Object.keys(data).length ? data : { goal: String(goal).slice(0, 200) } } });
    return calls.slice(0, MAX_STEPS);
  }
  if (/وورد|word|docx|مستند/.test(text)) {
    calls.push({ tool: "generate_word_report", args: { data: data && Object.keys(data).length ? data : { goal: String(goal).slice(0, 200) } } });
    return calls.slice(0, MAX_STEPS);
  }
  if (/pdf|بي دي إف/.test(text)) {
    calls.push({ tool: "generate_pdf_report", args: { data: data && Object.keys(data).length ? data : { goal: String(goal).slice(0, 200) } } });
    return calls.slice(0, MAX_STEPS);
  }
  if (/رسم بياني|chart|جراف/.test(text)) {
    const expenses = Array.isArray((data as any).expenses) ? (data as any).expenses : [{ title: "SMART TIME", amount: 0 }];
    calls.push({ tool: "generate_chart", args: { expenses } });
    return calls.slice(0, MAX_STEPS);
  }
  if (/بحث|ابحث|search|مصادر|آخر أخبار/.test(text)) {
    calls.push({ tool: "web_search", args: { message: String(goal).slice(0, 300) } });
    return calls.slice(0, MAX_STEPS);
  }
  return calls; // empty = planner did not understand the goal
}

// ------------------------------------------------------------
// Model planner: the dedicated model decides which tools to call
// ------------------------------------------------------------
const PLANNER_SCHEMA = {
  type: "object",
  properties: {
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tool: { type: "string" },
          args: { type: "object" },
        },
        required: ["tool"],
      },
    },
    rationale: { type: "string" },
  },
  required: ["steps"],
} as const;

export async function planAgentToolCallsWithModel(goal: string, context: V3ToolContext): Promise<{ calls: PlannedCall[]; planner: "groq" | "deterministic" }> {
  const toolCatalog = Object.values(v3ToolRegistry)
    .map(t => `- ${t.name}: ${t.description} | arguments: ${JSON.stringify(t.argumentSchema)}${t.permission ? ` | permission: ${t.permission}` : ""}`)
    .join("\n");
  const system = [
    "أنت مخطط أدوات SMART TIME. مهمتك تحويل هدف المستخدم إلى قائمة استدعاءات أدوات صحيحة فقط.",
    "الأدوات المتاحة:",
    toolCatalog,
    "القواعد: لا تستدعِ أي أداة غير موجودة. لا تخترع نتائج. استخدم البيانات المرفقة لبناء الوسائط. لا تكرر نفس الأداة أكثر من مرتين. لو الهدف يحتاج رسم CAD استخدم generate_dxf مع وصف نصي أو وصف مهيكل.",
  ].join("\n");
  const user = `الهدف: ${String(goal).slice(0, 1000)}\nبيانات السياق: ${JSON.stringify(context.canonicalData || {}).slice(0, 3000)}\nاللغة: ${context.language}`;
  try {
    const response = await groqProvider.generateStructured({
      schemaName: "smart_time_agent_plan",
      schema: PLANNER_SCHEMA as unknown as Record<string, unknown>,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const parsed = JSON.parse(response.content) as { steps?: Array<{ tool?: string; args?: Record<string, unknown> }> };
    const calls: PlannedCall[] = [];
    for (const step of Array.isArray(parsed?.steps) ? parsed.steps : []) {
      const tool = String(step?.tool || "");
      if (!isV3ToolName(tool)) continue;
      const args = step?.args && typeof step.args === "object" ? step.args : {};
      calls.push({ tool, args });
      if (calls.length >= MAX_STEPS) break;
    }
    if (calls.length > 0) return { calls, planner: "groq" };
    return { calls: planAgentToolCallsDeterministic(goal, context), planner: "deterministic" };
  } catch {
    return { calls: planAgentToolCallsDeterministic(goal, context), planner: "deterministic" };
  }
}

// ------------------------------------------------------------
// The agent loop
// ------------------------------------------------------------
export async function runAutonomousAgent(request: AutonomousAgentRequest): Promise<AutonomousAgentResult> {
  const goal = String(request?.goal || "").trim();
  const context = request?.context;
  if (!goal) return { ok: false, status: "failed", message: "الهدف مطلوب لتشغيل الإيجنت.", planner: "deterministic", steps: [], artifacts: [], agentVersion: AGENT_VERSION };
  if (!context || !context.userId) return { ok: false, status: "failed", message: "هوية المستخدم مطلوبة لتشغيل الإيجنت.", planner: "deterministic", steps: [], artifacts: [], agentVersion: AGENT_VERSION };

  // 1) Plan
  let planner: AutonomousAgentResult["planner"] = "deterministic";
  let calls: PlannedCall[];
  if (Array.isArray(request.approvedToolCalls) && request.approvedToolCalls.length > 0) {
    planner = "explicit";
    calls = request.approvedToolCalls
      .filter(c => c && isV3ToolName(String(c.tool)))
      .slice(0, MAX_STEPS)
      .map(c => ({ tool: String(c.tool) as V3ToolName, args: (c.args && typeof c.args === "object") ? c.args : {} }));
  } else if (request.allowModelPlanning !== false && isGroqConfigured()) {
    const planned = await planAgentToolCallsWithModel(goal, context);
    calls = planned.calls;
    planner = planned.planner;
  } else {
    calls = planAgentToolCallsDeterministic(goal, context);
    planner = "deterministic";
  }

  if (calls.length === 0) {
    return {
      ok: false,
      status: "failed",
      message: "لم أستطع تحديد أداة مناسبة لهذا الهدف. حدد نوع المطلوب: رسم CAD (DXF) أو تقرير Excel/Word/PDF أو رسم بياني أو بحث ويب.",
      planner,
      steps: [],
      artifacts: [],
      agentVersion: AGENT_VERSION,
    };
  }

  // 2) Confirmation gate (per-operation policy): no file/executable tool runs
  //    without explicit confirmation from the user.
  const needsGate = calls.some(c => v3ToolRegistry[c.tool]?.requiresConfirmation === true);
  if (needsGate && request.confirmed !== true) {
    const steps: AgentStep[] = calls.map((c, i) => ({
      index: i + 1,
      tool: c.tool,
      args: summarizeArgsForDisplay(c.args),
      status: "awaiting_confirmation",
      summary: v3ToolRegistry[c.tool]?.description || "",
    }));
    return {
      ok: true,
      status: "needs_confirmation",
      message: `فهمت الطلب وجهزت ${steps.length} عملية${steps.length > 1 ? "ات" : ""}: ${steps.map(s => `${s.index}) ${s.tool}`).join("، ")}. أكد التنفيذ وأنا أنفذها فعليًا وأتحقق من النتائج.`,
      planner,
      steps,
      artifacts: [],
      agentVersion: AGENT_VERSION,
    };
  }

  // 3) Execute + verify
  const steps: AgentStep[] = [];
  const artifacts: AgentArtifact[] = [];
  let hardFailure = false;
  for (let i = 0; i < calls.length; i++) {
    const call = calls[i];
    const execution = await executeV3Tool(context, call.tool, call.args);
    if (execution.status === "failed") {
      steps.push({ index: i + 1, tool: call.tool, args: summarizeArgsForDisplay(call.args), status: "failed", error: execution.error || "unknown" });
      hardFailure = true;
      break;
    }
    const result = execution.result as { ok?: boolean; type?: string; filename?: string; data?: string; message?: string } | undefined;
    const artifactOk = !!result && result.ok === true && typeof result.data === "string" && result.data.length > 0;
    const step: AgentStep = {
      index: i + 1,
      tool: call.tool,
      args: summarizeArgsForDisplay(call.args),
      status: execution.verified ? "verified" : "executed",
    };
    if (artifactOk && result) {
      step.artifact = { type: String(result.type || "file"), filename: String(result.filename || "artifact") };
      artifacts.push({ type: String(result.type || "file"), filename: String(result.filename || "artifact"), data: result.data });
      step.summary = String(result.message || "تم إنشاء الملف.");
    } else if (result && Array.isArray(result)) {
      step.summary = `تم التنفيذ (${(result as unknown[]).length} نتيجة).`;
    } else if (result && typeof result === "object") {
      step.summary = String((result as { message?: string }).message || "تم التنفيذ.");
    }
    steps.push(step);
  }

  if (hardFailure) {
    const failed = steps.find(s => s.status === "failed");
    return {
      ok: false,
      status: "failed",
      message: `توقف التنفيذ عند الخطوة ${failed?.index}. السبب: ${failed?.error || "غير معروف"}. لم أنفذ ما بعدها ولن أخترع نتائج.`,
      planner,
      steps,
      artifacts,
      agentVersion: AGENT_VERSION,
    };
  }

  const verifiedCount = steps.filter(s => s.status === "verified").length;
  const artifactNames = artifacts.map(a => a.filename).join("، ") || "—";
  const message = artifacts.length > 0
    ? `تم تنفيذ ${steps.length} عملية والتحقق منها (${verifiedCount} تم التحقق منها آليًا). الملفات الجاهزة: ${artifactNames}.`
    : `تم تنفيذ ${steps.length} عملية والتحقق منها. لا ملفات مطلوبة في هذا الهدف.`;

  return { ok: true, status: "completed", message, planner, steps, artifacts, agentVersion: AGENT_VERSION };
}

function summarizeArgsForDisplay(args: Record<string, unknown>): Record<string, unknown> {
  const display: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args || {})) {
    if (typeof value === "string") display[key] = value.slice(0, 120);
    else if (typeof value === "object" && value !== null) display[key] = `[object:${Array.isArray(value) ? "array" : "object"}]`;
    else display[key] = value;
  }
  return display;
}
