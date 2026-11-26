import { web_search } from "./webSearch.js";
import { solve_emotional, solve_social, solve_economic } from "./problemSolver.js";
import {
  generate_excel_report,
  generate_word_report,
  generate_pdf_report,
  generate_chart,
  draw_plan,
} from "./reportGenerator.js";
import { buildDxf, dxfFromNaturalLanguage, type DxfDrawingDescription } from "./dxfGenerator.js";
import type { V3ToolContext, V3ToolName } from "./types.js";

// Per-operation confirmation policy: every tool that CREATES a file or
// artifact on the user's behalf requires explicit confirmation before it
// executes. Read-only tools (search, advisory solvers) do not.
const isDxfDescription = (value: unknown): value is DxfDrawingDescription =>
  !!value && typeof value === "object" && Array.isArray((value as DxfDrawingDescription).entities);

export type V3ArgumentSchema = Record<string, {
  type: "string" | "number" | "boolean" | "object" | "array";
  required?: boolean;
}>;

export interface V3ToolExecutionResult {
  ok: boolean;
  result?: unknown;
  error?: string;
}

export interface V3ToolDefinition {
  name: V3ToolName;
  description: string;
  requiresConfirmation: boolean;
  permission?: string;
  argumentSchema: V3ArgumentSchema;
  validate?: (args: Record<string, unknown>) => string | null;
  execute?: (
    context: V3ToolContext,
    args: Record<string, unknown>,
  ) => Promise<unknown> | unknown;
  verify?: (result: unknown) => boolean | Promise<boolean>;
}

const requireString = (name: string) => (args: Record<string, unknown>) =>
  typeof args[name] === "string" && String(args[name]).trim()
    ? null
    : `Missing or invalid argument: ${name}`;

const requireObject = (name: string) => (args: Record<string, unknown>) =>
  args[name] !== null && typeof args[name] === "object" && !Array.isArray(args[name])
    ? null
    : `Missing or invalid object argument: ${name}`;

const resultExists = (result: unknown) => result !== undefined && result !== null;

export const v3ToolRegistry: Record<V3ToolName, V3ToolDefinition> = {
  web_search: {
    name: "web_search",
    description: "بحث ويب بدون مفتاح API",
    requiresConfirmation: false,
    argumentSchema: { message: { type: "string", required: true } },
    validate: requireString("message"),
    execute: async (_context, args) => web_search(String(args.message), _context.language),
    verify: resultExists,
  },

  solve_emotional_problem: {
    name: "solve_emotional_problem",
    description: "حل مشكلة عاطفية",
    requiresConfirmation: false,
    argumentSchema: { message: { type: "string", required: true } },
    validate: requireString("message"),
    execute: async (context, args) => solve_emotional(context.userId, String(args.message)),
    verify: resultExists,
  },

  solve_social_problem: {
    name: "solve_social_problem",
    description: "حل مشكلة اجتماعية",
    requiresConfirmation: false,
    argumentSchema: { message: { type: "string", required: true } },
    validate: requireString("message"),
    execute: async (context, args) => solve_social(context.userId, String(args.message)),
    verify: resultExists,
  },

  solve_economic_problem: {
    name: "solve_economic_problem",
    description: "تحليل اقتصادي وتوفير",
    requiresConfirmation: false,
    permission: "expenses",
    argumentSchema: { message: { type: "string", required: true } },
    validate: requireString("message"),
    execute: async (context, args) => solve_economic(context.userId, String(args.message)),
    verify: resultExists,
  },

  generate_excel_report: {
    name: "generate_excel_report",
    description: "تقرير Excel",
    requiresConfirmation: true,
    permission: "reports",
    argumentSchema: { data: { type: "object", required: true } },
    validate: requireObject("data"),
    execute: async (_context, args) => generate_excel_report(args.data as Record<string, unknown>),
    verify: resultExists,
  },

  generate_word_report: {
    name: "generate_word_report",
    description: "تقرير Word",
    requiresConfirmation: true,
    permission: "reports",
    argumentSchema: { data: { type: "object", required: true } },
    validate: requireObject("data"),
    execute: async (_context, args) => generate_word_report(args.data as Record<string, unknown>),
    verify: resultExists,
  },

  generate_pdf_report: {
    name: "generate_pdf_report",
    description: "تقرير PDF",
    requiresConfirmation: true,
    permission: "reports",
    argumentSchema: { data: { type: "object", required: true } },
    validate: requireObject("data"),
    execute: async (_context, args) => generate_pdf_report(args.data as Record<string, unknown>),
    verify: resultExists,
  },

  generate_chart: {
    name: "generate_chart",
    description: "رسم بياني",
    requiresConfirmation: true,
    permission: "reports",
    argumentSchema: { expenses: { type: "array", required: true } },
    validate: (args) => Array.isArray(args.expenses) ? null : "Missing or invalid array argument: expenses",
    execute: async (_context, args) => generate_chart(args.expenses as unknown[]),
    verify: resultExists,
  },

  draw_plan: {
    name: "draw_plan",
    description: "رسم مخطط SVG",
    requiresConfirmation: true,
    permission: "reports",
    argumentSchema: { message: { type: "string", required: true } },
    validate: requireString("message"),
    execute: async (_context, args) => draw_plan(String(args.message)),
    verify: resultExists,
  },

  generate_dxf: {
    name: "generate_dxf",
    description: "توليد رسم CAD بصيغة DXF يفتح في AutoCAD — من وصف هندسي مهيكل أو وصف نصي",
    requiresConfirmation: true,
    permission: "cad",
    argumentSchema: {
      description: { type: "object", required: false },
      message: { type: "string", required: false },
    },
    validate: (args) =>
      isDxfDescription(args.description) || (typeof args.message === "string" && args.message.trim())
        ? null
        : "Missing argument: provide a structured description object or a message",
    execute: async (_context, args) =>
      isDxfDescription(args.description)
        ? buildDxf(args.description as DxfDrawingDescription)
        : dxfFromNaturalLanguage(String(args.message), _context.language),
    verify: (result) => !!result && (result as { ok?: boolean }).ok === true && !!(result as { data?: string }).data,
  },

  request_permissions: {
    name: "request_permissions",
    description: "طلب صلاحيات اختيارية",
    requiresConfirmation: false,
    argumentSchema: { permission: { type: "string", required: true } },
    validate: requireString("permission"),
  },
};

export function isV3ToolName(value: string): value is V3ToolName {
  return Object.prototype.hasOwnProperty.call(v3ToolRegistry, value);
}
