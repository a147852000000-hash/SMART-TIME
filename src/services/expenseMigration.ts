import type { Expense } from "../types";

export type ExpenseMigrationAction = "import" | "skip" | "review";

export interface ExpenseMigrationCandidate {
  id: string;
  action: ExpenseMigrationAction;
  reason: string;
  local: Expense;
  canonical?: Record<string, unknown>;
}

export interface ExpenseMigrationPreview {
  domain: "expenses";
  source: "local-storage";
  target: "smart-time-finance-sqlite";
  generatedAt: string;
  candidates: ExpenseMigrationCandidate[];
  counts: { total: number; import: number; skip: number; review: number };
  safeToImport: boolean;
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function fingerprint(expense: Expense): string {
  return [
    normalizeText(expense.title).toLowerCase(),
    Number(expense.amount).toFixed(2),
    normalizeText(expense.category).toLowerCase(),
    normalizeText(expense.date),
    normalizeText(expense.paymentMethod).toLowerCase(),
    normalizeText(expense.notes).toLowerCase(),
  ].join("|");
}

function canonicalFingerprint(item: Record<string, unknown>): string {
  return [
    normalizeText(item.title).toLowerCase(),
    Number(item.amount ?? 0).toFixed(2),
    normalizeText(item.category).toLowerCase(),
    normalizeText(item.date),
    normalizeText(item.paymentMethod).toLowerCase(),
    normalizeText(item.notes).toLowerCase(),
  ].join("|");
}

export function buildExpenseMigrationPreview(
  local: Expense[],
  canonical: Array<Record<string, unknown>>,
): ExpenseMigrationPreview {
  const canonicalById = new Map(canonical.map((item) => [String(item.id ?? ""), item]));
  const canonicalByFingerprint = new Map<string, Record<string, unknown>>();
  for (const item of canonical) canonicalByFingerprint.set(canonicalFingerprint(item), item);

  const seen = new Set<string>();
  const candidates = local.map((expense): ExpenseMigrationCandidate => {
    if (seen.has(expense.id)) {
      return { id: expense.id, action: "review", reason: "duplicate local id", local: expense };
    }
    seen.add(expense.id);

    const byId = canonicalById.get(expense.id);
    if (byId) {
      const same = canonicalFingerprint(byId) === fingerprint(expense);
      return {
        id: expense.id,
        action: same ? "skip" : "review",
        reason: same ? "already canonical and identical" : "same id with different canonical content",
        local: expense,
        canonical: byId,
      };
    }

    const duplicate = canonicalByFingerprint.get(fingerprint(expense));
    if (duplicate) {
      return {
        id: expense.id,
        action: "skip",
        reason: "content-equivalent canonical record already exists",
        local: expense,
        canonical: duplicate,
      };
    }

    return { id: expense.id, action: "import", reason: "local record missing from canonical store", local: expense };
  });

  const counts = {
    total: candidates.length,
    import: candidates.filter((x) => x.action === "import").length,
    skip: candidates.filter((x) => x.action === "skip").length,
    review: candidates.filter((x) => x.action === "review").length,
  };

  return {
    domain: "expenses",
    source: "local-storage",
    target: "smart-time-finance-sqlite",
    generatedAt: new Date().toISOString(),
    candidates,
    counts,
    safeToImport: counts.import > 0 && counts.review === 0,
  };
}
