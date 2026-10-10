import type { Expense } from "../types";

export interface ExpenseImportResponse {
  source: "smart-time-finance-sqlite";
  imported: number;
  skipped: number;
  verified: number;
  verificationPassed: boolean;
  results: Array<{ id: string; status: "inserted" | "skipped" | "conflict"; reason: string }>;
  fetchedAt: string;
}

export async function importCanonicalExpenses(expenses: Expense[]): Promise<ExpenseImportResponse> {
  const response = await fetch("/api/finance/expenses/import", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ expenses }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const conflictMessage = Number(payload?.conflicts || 0) > 0 ? "يوجد تعارض في بعض المصروفات ويحتاج مراجعة." : "تعذر استيراد المصروفات.";
    throw new Error(String(payload?.error || conflictMessage));
  }
  return payload as ExpenseImportResponse;
}