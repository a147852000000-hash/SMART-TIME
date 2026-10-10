export const V2_ALLOWED_TOOLS = [
  "add_expense",
  "add_daily_task",
  "calendar.event.create",
  "finance.summary",
  "finance.compare",
  "finance.income.summary",
  "finance.fuel.summary",
] as const;

export type V2AllowedTool = typeof V2_ALLOWED_TOOLS[number];

export interface V2ValidatedOutput {
  tool: V2AllowedTool | "clarification" | "unsupported";
  arguments?: Record<string, unknown>;
  needs_clarification?: false;
  ask?: string;
  reason?: string;
}

export interface V2ValidationResult {
  valid: boolean;
  parsed?: V2ValidatedOutput;
  errors: string[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

export function validateV2Output(raw: string): V2ValidationResult {
  const errors: string[] = [];
  const text = String(raw ?? "").trim();
  if (!text) return { valid: false, errors: ["empty_output"] };
  if (/<think>|<\/think>/i.test(text)) errors.push("think_block_forbidden");
  if (text.startsWith("```") || text.endsWith("```")) errors.push("markdown_fence_forbidden");

  let value: unknown;
  try { value = JSON.parse(text); } catch { return { valid: false, errors: [...errors, "invalid_json"] }; }
  if (!isObject(value)) return { valid: false, errors: [...errors, "root_must_be_object"] };
  if (Object.keys(value).some((key) => !["tool", "arguments", "needs_clarification", "ask", "reason"].includes(key))) errors.push("schema_extra_field");
  if (typeof value.tool !== "string") return { valid: false, errors: [...errors, "tool_required"] };

  const tool = value.tool;
  if (tool === "unsupported") {
    if (!hasOnlyKeys(value, ["tool", "reason"]) || typeof value.reason !== "string" || !value.reason.trim()) errors.push("unsupported_schema_invalid");
  } else if (tool === "clarification") {
    if (!hasOnlyKeys(value, ["tool", "ask", "reason"]) || typeof value.ask !== "string" || !value.ask.trim() || typeof value.reason !== "string" || !value.reason.trim()) errors.push("clarification_schema_invalid");
  } else {
    if (!(V2_ALLOWED_TOOLS as readonly string[]).includes(tool)) errors.push("tool_not_allowlisted");
    if (!isObject(value.arguments)) errors.push("arguments_required");
    if (value.needs_clarification !== false) errors.push("needs_clarification_must_be_false");
    if (isObject(value.arguments)) {
      if (tool === "add_expense") {
        if (typeof value.arguments.amount !== "number" || !Number.isFinite(value.arguments.amount) || value.arguments.amount <= 0) errors.push("add_expense.amount_invalid");
        if (typeof value.arguments.category !== "string" || !value.arguments.category.trim()) errors.push("add_expense.category_required");
      } else if (tool === "add_daily_task" || tool === "calendar.event.create") {
        if (typeof value.arguments.title !== "string" || !String(value.arguments.title).trim()) errors.push("title_required");
      } else if (typeof value.arguments.period !== "string" || !value.arguments.period.trim()) errors.push("period_required");
    }
  }
  if (errors.length) return { valid: false, errors };
  return { valid: true, parsed: value as unknown as V2ValidatedOutput, errors: [] };
}