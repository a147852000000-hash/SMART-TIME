import { db } from "../../database.js";
import { getFinanceOverview } from "./financeProjection.js";

/** Phase 5.5 AI finance read adapter. AI transaction reads use finance_* canonical tables. */
export interface AiCanonicalTransaction {
  id: string; title: string; amount: number; category: string; date: string;
  paymentMethod: string; notes: string | null; createdAt: string; updatedAt: string;
  source: "finance_expenses" | "finance_fuel_records" | "finance_maintenance_records" | "finance_education_expenses";
}
export interface AiCanonicalState { transactions: AiCanonicalTransaction[]; budget: Record<string, unknown> | null; source: "smart-time-finance-sqlite"; }

function transactionFromExpense(row: any): AiCanonicalTransaction { return { ...row, source: "finance_expenses" }; }
function transactionFromFuel(row: any): AiCanonicalTransaction {
  return { id: String(row.id), title: "Fuel", amount: Number(row.totalCost || 0), category: "vehicle_fuel", date: String(row.date), paymentMethod: "cash", notes: row.notes ?? null, createdAt: String(row.createdAt), updatedAt: String(row.updatedAt), source: "finance_fuel_records" };
}
function transactionFromMaintenance(row: any): AiCanonicalTransaction {
  const type = String(row.systemType || "").toLowerCase() === "oil" ? "vehicle_oil" : "vehicle_maint";
  return { id: String(row.id), title: String(row.title || "Maintenance"), amount: Number(row.cost || 0), category: type, date: String(row.date), paymentMethod: "cash", notes: row.notes ?? null, createdAt: String(row.createdAt), updatedAt: String(row.updatedAt), source: "finance_maintenance_records" };
}
function transactionFromEducation(row: any): AiCanonicalTransaction {
  return { id: String(row.id), title: String(row.title || "Education"), amount: Number(row.amount || 0), category: String(row.category || "student"), date: String(row.date), paymentMethod: "cash", notes: row.notes ?? null, createdAt: String(row.createdAt), updatedAt: String(row.updatedAt), source: "finance_education_expenses" };
}

export function getAiCanonicalState(userId: string): AiCanonicalState {
  const overview = getFinanceOverview(userId);
  const transactions = [
    ...(overview.expenses as any[]).map(transactionFromExpense),
    ...(overview.fuelRecords as any[]).map(transactionFromFuel),
    ...(overview.maintenanceRecords as any[]).map(transactionFromMaintenance),
    ...(overview.educationExpenses as any[]).map(transactionFromEducation),
  ].sort((a, b) => `${b.date}:${b.createdAt}`.localeCompare(`${a.date}:${a.createdAt}`));
  // No canonical finance_budgets table exists in the Phase 5 schema yet. Keep the existing budget projection read for compatibility; later source consolidation owns its removal.
  const budget = db.prepare("SELECT user_id as userId, monthly_limit as monthlyLimit, currency, updated_at as updatedAt FROM ai_budgets WHERE user_id = ?").get(userId) as Record<string, unknown> | undefined;
  return { transactions, budget: budget || null, source: "smart-time-finance-sqlite" };
}

export function getCanonicalExpenseProjection(userId: string): AiCanonicalTransaction[] {
  return getAiCanonicalState(userId).transactions.filter((row) => row.source === "finance_expenses");
}

export function getLegacyAiTransactionProjection(userId: string): Array<Record<string, unknown>> {
  return db.prepare("SELECT id, title, amount, category, date, payment_method as paymentMethod, notes, created_at as createdAt FROM ai_transactions WHERE user_id = ? ORDER BY date DESC, created_at DESC").all(userId) as Array<Record<string, unknown>>;
}