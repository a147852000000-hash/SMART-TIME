import { db } from "../database.js";

export type CanonicalSmartAiContext = {
  profile: { name: string; currency: string; language: string };
  expenses: unknown[];
  monthlyIncome: unknown[];
  vehicles: unknown[];
  fuelRecords: unknown[];
  students: unknown[];
  lessons: unknown[];
  educationExpenses: unknown[];
  notes: unknown[];
  dailyTasks: unknown[];
  recentTrips: unknown[];
};

const EMPTY_CONTEXT: CanonicalSmartAiContext = {
  profile: { name: "", currency: "EGP", language: "ar" },
  expenses: [],
  monthlyIncome: [],
  vehicles: [],
  fuelRecords: [],
  students: [],
  lessons: [],
  educationExpenses: [],
  notes: [],
  dailyTasks: [],
  recentTrips: [],
};

db.exec(`
CREATE TABLE IF NOT EXISTS ai_context_snapshots (
  user_id TEXT PRIMARY KEY,
  context_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function sanitizeContext(input: unknown): CanonicalSmartAiContext {
  const source = isRecord(input) ? input : {};
  const profile = isRecord(source.profile) ? source.profile : {};
  const array = (key: keyof Omit<CanonicalSmartAiContext, "profile">) =>
    Array.isArray(source[key]) ? source[key].filter(isRecord) : [];

  return {
    profile: {
      name: String(profile.name ?? "").slice(0, 120),
      currency: String(profile.currency ?? "EGP").slice(0, 20),
      language: String(profile.language ?? "ar").slice(0, 10),
    },
    expenses: array("expenses"),
    monthlyIncome: array("monthlyIncome"),
    vehicles: array("vehicles"),
    fuelRecords: array("fuelRecords"),
    students: array("students"),
    lessons: array("lessons"),
    educationExpenses: array("educationExpenses"),
    notes: array("notes"),
    dailyTasks: array("dailyTasks"),
    recentTrips: array("recentTrips"),
  };
}

function mergeById(existing: unknown[], incoming: unknown[]) {
  const merged = new Map<string, Record<string, unknown>>();
  for (const value of existing) {
    if (isRecord(value) && typeof value.id === "string") merged.set(value.id, value);
  }
  for (const value of incoming) {
    if (isRecord(value) && typeof value.id === "string") merged.set(value.id, value);
  }
  return [...merged.values()];
}

export function getCanonicalSmartAiContext(userId: string): CanonicalSmartAiContext {
  const row = db.prepare("SELECT context_json as contextJson FROM ai_context_snapshots WHERE user_id = ?").get(userId) as { contextJson?: string } | undefined;
  if (!row?.contextJson) return { ...EMPTY_CONTEXT, profile: { ...EMPTY_CONTEXT.profile } };
  try {
    return sanitizeContext(JSON.parse(row.contextJson));
  } catch {
    return { ...EMPTY_CONTEXT, profile: { ...EMPTY_CONTEXT.profile } };
  }
}

export function syncCanonicalSmartAiContext(userId: string, incoming: unknown): CanonicalSmartAiContext {
  const row = db.prepare("SELECT context_json as contextJson FROM ai_context_snapshots WHERE user_id = ?").get(userId) as { contextJson?: string } | undefined;
  const next = sanitizeContext(incoming);

  // Safe one-way compatibility migration: initialize the canonical snapshot from
  // legacy client data only when no backend snapshot exists. Once initialized,
  // existing canonical records are never overwritten by stale localStorage data.
  if (!row?.contextJson) {
    db.prepare(`INSERT INTO ai_context_snapshots(user_id, context_json, updated_at) VALUES(?,?,?)`)
      .run(userId, JSON.stringify(next), new Date().toISOString());
    return next;
  }

  return getCanonicalSmartAiContext(userId);
}

export function applyCanonicalAiExecution(userId: string, execution: Record<string, unknown> | undefined) {
  if (!execution || execution.ok !== true || !isRecord(execution.record)) return;
  const context = getCanonicalSmartAiContext(userId);
  const operation = String(execution.operation || "");
  const record = execution.record;

  if (operation === "addTransaction") context.expenses = mergeById(context.expenses, [record]);
  if (operation === "addEducationExpense") context.educationExpenses = mergeById(context.educationExpenses, [record]);
  if (operation === "addFuelRecord") context.fuelRecords = mergeById(context.fuelRecords, [record]);
  if (operation === "addTask") context.dailyTasks = mergeById(context.dailyTasks, [record]);

  db.prepare("UPDATE ai_context_snapshots SET context_json = ?, updated_at = ? WHERE user_id = ?")
    .run(JSON.stringify(context), new Date().toISOString(), userId);
}
