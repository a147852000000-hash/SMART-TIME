import type {
  Budget, Category, ExpenseType, FinanceReports, Income, Transaction,
} from "../types/finance";
import type { EducationExpense, Expense, FuelRecord, MaintenanceRecord } from "../types";
import { createCanonicalFinanceExpense, deleteCanonicalFinanceExpense, fetchCanonicalFinanceOverview, updateCanonicalFinanceExpense, type CanonicalExpenseInput, type FinanceOverview } from "../services/financeService";

export interface FinanceRepositorySnapshot {
  finance: FinanceOverview;
  smartAi: {
    transactions: Array<Record<string, unknown>>;
    budget: Record<string, unknown> | null;
  };
}

export type FinanceTransactionInput = Omit<Transaction, "id" | "createdAt" | "updatedAt">;

const EXPENSE_TYPES: ExpenseType[] = [
  "house", "medical", "personal", "student",
  "vehicle_fuel", "vehicle_maint", "vehicle_oil", "work",
];

function text(value: unknown, fallback = ""): string {
  return String(value ?? fallback).trim();
}
function number(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function expenseTypeFromValue(value: unknown, fallback: ExpenseType = "personal"): ExpenseType {
  const raw = text(value).toLowerCase();
  if (EXPENSE_TYPES.includes(raw as ExpenseType)) return raw as ExpenseType;
  if (/fuel|بنزين|وقود/.test(raw)) return "vehicle_fuel";
  if (/oil|زيت/.test(raw)) return "vehicle_oil";
  if (/vehicle|car|maintenance|maint|صيانة|سيارة|عربية/.test(raw)) return "vehicle_maint";
  if (/student|education|school|tuition|lesson|تعليم|مدرسة|طالب|دروس/.test(raw)) return "student";
  if (/medical|health|doctor|hospital|medicine|صحة|طبي|دكتور|مستشفى|دواء/.test(raw)) return "medical";
  if (/house|home|rent|utilities|bills|منزل|بيت|إيجار|فواتير/.test(raw)) return "house";
  if (/work|business|job|شغل|عمل/.test(raw)) return "work";
  return fallback;
}
function canonicalId(prefix: string, id: string): string {
  return prefix + ":" + id;
}
function mapFinanceExpenseToTransaction(row: Record<string, unknown>): Transaction {
  return {
    id: text(row.id), type: expenseTypeFromValue(row.type ?? row.category),
    amount: number(row.amount), date: text(row.date), categoryId: text(row.category, "other"),
    note: row.notes == null ? null : text(row.notes), source: "finance_sqlite",
    createdAt: text(row.createdAt ?? row.created_at, text(row.date)),
    updatedAt: text(row.updatedAt ?? row.updated_at, text(row.createdAt ?? row.date)),
  };
}
function mapFuelToTransaction(row: Record<string, unknown>): Transaction {
  return {
    id: canonicalId("fuel", text(row.id)), type: "vehicle_fuel", amount: number(row.totalCost),
    date: text(row.date), categoryId: "vehicle_fuel", note: row.notes == null ? null : text(row.notes),
    source: "finance_sqlite", createdAt: text(row.createdAt ?? row.created_at, text(row.date)),
    updatedAt: text(row.updatedAt ?? row.updated_at, text(row.createdAt ?? row.date)),
  };
}
function mapMaintenanceToTransaction(row: Record<string, unknown>): Transaction {
  const systemType = text(row.systemType ?? row.system_type);
  return {
    id: canonicalId("maintenance", text(row.id)),
    type: systemType === "oil" ? "vehicle_oil" : "vehicle_maint",
    amount: number(row.cost), date: text(row.date), categoryId: systemType || "vehicle_maint",
    note: row.notes == null ? null : text(row.notes), source: "finance_sqlite",
    createdAt: text(row.createdAt ?? row.created_at, text(row.date)),
    updatedAt: text(row.updatedAt ?? row.updated_at, text(row.createdAt ?? row.date)),
  };
}
function mapEducationToTransaction(row: Record<string, unknown>): Transaction {
  return {
    id: canonicalId("education", text(row.id)), type: "student", amount: number(row.amount),
    date: text(row.date), categoryId: text(row.category, "student"),
    note: row.notes == null ? null : text(row.notes), source: "finance_sqlite",
    createdAt: text(row.createdAt ?? row.created_at, text(row.date)),
    updatedAt: text(row.updatedAt ?? row.updated_at, text(row.createdAt ?? row.date)),
  };
}
function mapAiTransactionToTransaction(row: Record<string, unknown>): Transaction {
  return {
    id: canonicalId("ai", text(row.id)), type: expenseTypeFromValue(row.type ?? row.category),
    amount: number(row.amount), date: text(row.date), categoryId: text(row.category, "other"),
    note: row.notes == null ? null : text(row.notes), source: "smart_ai",
    createdAt: text(row.createdAt ?? row.created_at, text(row.date)),
    updatedAt: text(row.updatedAt ?? row.createdAt ?? row.date, text(row.date)),
  };
}
function mapLegacyExpenseToTransaction(row: Expense): Transaction {
  return {
    id: canonicalId("legacy", row.id), type: expenseTypeFromValue(row.category),
    amount: number(row.amount), date: text(row.date), categoryId: text(row.category, "other"),
    note: row.notes == null ? null : text(row.notes), source: "legacy_storage",
    createdAt: text(row.createdAt, text(row.date)), updatedAt: text(row.createdAt, text(row.date)),
  };
}
function mapLegacyFuelToTransaction(row: FuelRecord): Transaction {
  return {
    id: canonicalId("legacy-fuel", row.id), type: "vehicle_fuel", amount: number(row.totalCost),
    date: text(row.date), categoryId: "vehicle_fuel", note: row.notes == null ? null : text(row.notes),
    source: "legacy_storage", createdAt: text(row.date), updatedAt: text(row.date),
  };
}
function mapLegacyMaintenanceToTransaction(row: MaintenanceRecord): Transaction {
  return {
    id: canonicalId("legacy-maintenance", row.id),
    type: row.systemType === "oil" ? "vehicle_oil" : "vehicle_maint",
    amount: number(row.cost), date: text(row.date), categoryId: row.systemType,
    note: row.notes == null ? null : text(row.notes), source: "legacy_storage",
    createdAt: text(row.date), updatedAt: text(row.date),
  };
}
function mapLegacyEducationToTransaction(row: EducationExpense): Transaction {
  return {
    id: canonicalId("legacy-education", row.id), type: "student", amount: number(row.amount),
    date: text(row.date), categoryId: text(row.category, "student"),
    note: row.notes == null ? null : text(row.notes), source: "legacy_storage",
    createdAt: text(row.date), updatedAt: text(row.date),
  };
}
function mapMonthlyIncome(row: Record<string, unknown>): Income[] {
  const month = text(row.month);
  const parts: Array<[string, unknown]> = [["salary", row.salary], ["bonuses", row.bonuses], ["other_income", row.otherIncome ?? row.other_income]];
  return parts.filter(([, amount]) => number(amount) !== 0).map(([source, amount]) => ({
    id: canonicalId("income-" + source, text(row.id, month)),
    amount: number(amount), date: month, source,
  }));
}
function sourcePriority(source: Transaction["source"]): number {
  switch (source) {
    case "finance_sqlite": return 3;
    case "smart_ai": return 2;
    case "legacy_storage": return 1;
    default: return 0;
  }
}
function mergeById(items: Transaction[]): Transaction[] {
  const byId = new Map<string, Transaction>();
  for (const item of items) {
    if (!item.id) continue;
    const current = byId.get(item.id);
    if (!current || sourcePriority(item.source) > sourcePriority(current.source)) byId.set(item.id, item);
  }
  return [...byId.values()].sort((a, b) => (b.date + ":" + b.createdAt).localeCompare(a.date + ":" + a.createdAt));
}

export class FinanceRepository {
  static async getSnapshot(): Promise<FinanceRepositorySnapshot> {
    const finance = await fetchCanonicalFinanceOverview();
    return {
      finance,
      smartAi: {
        transactions: [],
        budget: null,
      },
    };
  }

  static async getTransactions(type?: ExpenseType): Promise<Transaction[]> {
    const finance = await fetchCanonicalFinanceOverview();
    const transactions = [
      ...finance.expenses.map(mapFinanceExpenseToTransaction),
      ...finance.fuelRecords.map(mapFuelToTransaction),
      ...finance.maintenanceRecords.map(mapMaintenanceToTransaction),
      ...finance.educationExpenses.map(mapEducationToTransaction),
    ];
    return type ? transactions.filter((item) => item.type === type) : transactions;
  }

  static async getCategories(): Promise<Category[]> {
    const transactions = await this.getTransactions();
    const seen = new Set<string>();
    return transactions.filter((item) => {
      const key = item.type + ":" + item.categoryId;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map((item) => ({
      id: item.categoryId, type: item.type, name: item.categoryId, color: null, icon: null,
    }));
  }

  static async getBudgets(): Promise<Budget[]> {
    const snapshot = await this.getSnapshot();
    const month = new Date().toISOString().slice(0, 7);
    const transactions = await this.getTransactions();
    const monthlyBudget = snapshot.smartAi.budget;
    if (!monthlyBudget) return [];
    const monthlyLimit = number(monthlyBudget.monthlyLimit ?? monthlyBudget.monthly_limit);
    return EXPENSE_TYPES.map((type) => ({
      id: canonicalId("ai-budget", type),
      type,
      month,
      limit: monthlyLimit,
      spent: transactions
        .filter((item) => item.type === type && item.date.startsWith(month))
        .reduce((sum, item) => sum + item.amount, 0),
    }));
  }

  static async getReports(): Promise<FinanceReports> {
    const [transactions, snapshot] = await Promise.all([this.getTransactions(), this.getSnapshot()]);
    const byType = EXPENSE_TYPES.map((type) => {
      const items = transactions.filter((item) => item.type === type);
      return { type, total: items.reduce((sum, item) => sum + item.amount, 0), count: items.length };
    });
    const months = new Map<string, { total: number; count: number }>();
    for (const item of transactions) {
      const key = item.date.slice(0, 7);
      const current = months.get(key) ?? { total: 0, count: 0 };
      current.total += item.amount; current.count += 1; months.set(key, current);
    }
    const income = snapshot.finance.monthlyIncome.flatMap(mapMonthlyIncome).reduce((sum, item) => sum + item.amount, 0);
    const expenses = transactions.reduce((sum, item) => sum + item.amount, 0);
    return {
      byType,
      byMonth: [...months.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([month, value]) => ({ month, ...value })),
      totals: { expenses, income, balance: income - expenses },
    };
  }

  static async addTransaction(transaction: FinanceTransactionInput): Promise<Record<string, unknown>> {
    const input: CanonicalExpenseInput = { type: transaction.type, title: transaction.note?.trim() || transaction.categoryId || transaction.type, amount: transaction.amount, category: transaction.categoryId || transaction.type, date: transaction.date, paymentMethod: "cash", notes: transaction.note };
    return createCanonicalFinanceExpense(input);
  }
  static async updateTransaction(transaction: Transaction): Promise<Record<string, unknown>> {
    const patch: Partial<CanonicalExpenseInput> = { type: transaction.type, title: transaction.note?.trim() || transaction.categoryId || transaction.type, amount: transaction.amount, category: transaction.categoryId || transaction.type, date: transaction.date, paymentMethod: "cash", notes: transaction.note };
    return updateCanonicalFinanceExpense(transaction.id, patch);
  }
  static async deleteTransaction(id: string): Promise<void> {
    await deleteCanonicalFinanceExpense(id);
  }
}

export const financeRepository = FinanceRepository;
