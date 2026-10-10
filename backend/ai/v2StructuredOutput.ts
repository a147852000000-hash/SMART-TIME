export const V2_TOOL_NAMES = [
  "add_expense",
  "add_daily_task",
  "calendar.event.create",
  "finance.summary",
  "finance.compare",
  "finance.income.summary",
  "finance.fuel.summary",
] as const;

export type V2ToolName = typeof V2_TOOL_NAMES[number];

export type V2StructuredOutput =
  | {
      tool: V2ToolName;
      arguments: Record<string, unknown>;
      needs_clarification: false;
    }
  | {
      tool: "clarification";
      ask: string;
      reason: string;
    }
  | {
      tool: "unsupported";
      reason: string;
    };

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

export function parseV2StructuredOutput(raw: string): V2StructuredOutput {
  const cleaned = raw
    .trim()
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  if (!cleaned || cleaned.includes("<think>") || cleaned.includes("</think>")) {
    throw new Error("V2 output contains empty text or hidden reasoning.");
  }

  let value: unknown;
  try {
    value = JSON.parse(cleaned);
  } catch {
    throw new Error("V2 output is not valid JSON.");
  }

  if (!isObject(value) || typeof value.tool !== "string") {
    throw new Error("V2 output must be a JSON object with a tool field.");
  }

  if (value.tool === "unsupported") {
    if (typeof value.reason !== "string" || !value.reason.trim()) {
      throw new Error("Unsupported output requires a reason.");
    }
    return { tool: "unsupported", reason: value.reason.trim() };
  }

  if (value.tool === "clarification") {
    if (typeof value.ask !== "string" || !value.ask.trim()) {
      throw new Error("Clarification output requires ask.");
    }
    if (typeof value.reason !== "string" || !value.reason.trim()) {
      throw new Error("Clarification output requires reason.");
    }
    return { tool: "clarification", ask: value.ask.trim(), reason: value.reason.trim() };
  }

  if (!V2_TOOL_NAMES.includes(value.tool as V2ToolName)) {
    throw new Error(`Unknown V2 tool: ${value.tool}`);
  }

  if (!isObject(value.arguments)) {
    throw new Error("Tool output requires an arguments object.");
  }

  if (value.needs_clarification !== false) {
    throw new Error("Executable V2 tool calls must set needs_clarification=false.");
  }

  switch (value.tool) {
    case "add_expense":
      if (typeof value.arguments.amount !== "number" || !Number.isFinite(value.arguments.amount) || value.arguments.amount <= 0) {
        throw new Error("add_expense.amount must be a positive number.");
      }
      if (typeof value.arguments.category !== "string" || !value.arguments.category.trim()) {
        throw new Error("add_expense.category is required.");
      }
      break;
    case "add_daily_task":
      if (typeof value.arguments.title !== "string" || !value.arguments.title.trim()) {
        throw new Error("add_daily_task.title is required.");
      }
      if (typeof value.arguments.when !== "string" || !value.arguments.when.trim()) {
        throw new Error("add_daily_task.when is required.");
      }
      break;
    case "calendar.event.create":
      if (typeof value.arguments.title !== "string" || !value.arguments.title.trim()) {
        throw new Error("calendar.event.create.title is required.");
      }
      if (typeof value.arguments.when !== "string" || !value.arguments.when.trim()) {
        throw new Error("calendar.event.create.when is required.");
      }
      break;
    default:
      if (typeof value.arguments.period !== "string" || !value.arguments.period.trim()) {
        throw new Error(`${value.tool}.period is required.`);
      }
  }

  return value as V2StructuredOutput;
}

export function isV2ToolName(value: string): value is V2ToolName {
  return (V2_TOOL_NAMES as readonly string[]).includes(value);
}
