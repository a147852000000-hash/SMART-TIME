/**
 * SMART TIME — Canonical Finance Contract
 * Phase 5.2
 *
 * Contract only. No repository/API implementation belongs here.
 */

export type ExpenseType =
  | "house"
  | "medical"
  | "personal"
  | "student"
  | "vehicle_fuel"
  | "vehicle_maint"
  | "vehicle_oil"
  | "work";

export type FinanceRecordSource =
  | "legacy_storage"
  | "finance_sqlite"
  | "smart_ai"
  | "migration"
  | "manual"
  | "import";

export interface Transaction {
  id: string;
  type: ExpenseType;
  amount: number;
  date: string;
  categoryId: string;
  note: string | null;
  source: FinanceRecordSource;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  type: ExpenseType;
  name: string;
  color: string | null;
  icon: string | null;
}

export interface Budget {
  id: string;
  type: ExpenseType;
  month: string;
  limit: number;
  spent: number;
}

export interface Income {
  id: string;
  amount: number;
  date: string;
  source: string;
}

export interface FinanceReportByType {
  type: ExpenseType;
  total: number;
  count: number;
}

export interface FinanceReportByMonth {
  month: string;
  total: number;
  count: number;
}

export interface FinanceReportTotals {
  expenses: number;
  income: number;
  balance: number;
}

export interface FinanceReports {
  byType: FinanceReportByType[];
  byMonth: FinanceReportByMonth[];
  totals: FinanceReportTotals;
}

/**
 * Aggregate contract surface used by the Phase 5 repository/API boundary.
 * This is a type-level contract only; it does not implement persistence.
 */
export interface FinanceContract {
  Transaction: Transaction;
  Category: Category;
  Budget: Budget;
  Income: Income;
  FinanceReports: FinanceReports;
}
