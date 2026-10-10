/**
 * SMART TIME — Canonical Finance Contract — Phase 5.2
 *
 * Contract-only boundary.
 * This file defines the shared finance domain model used by the later
 * Repository/API unification phase. It intentionally contains no persistence
 * or transport implementation.
 */

export const EXPENSE_TYPES = [
  "house",
  "medical",
  "personal",
  "student",
  "vehicle_fuel",
  "vehicle_maint",
  "vehicle_oil",
  "work",
] as const;

export type ExpenseType = (typeof EXPENSE_TYPES)[number];

export interface Transaction {
  id: string;
  type: ExpenseType;
  amount: number;
  date: string;
  categoryId: string;
  note: string;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  type: ExpenseType;
  name: string;
  color: string;
  icon: string;
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
  amount: number;
  count: number;
}

export interface FinanceReportByMonth {
  month: string;
  amount: number;
  count: number;
}

export interface FinanceReportTotals {
  income: number;
  expenses: number;
  balance: number;
}

export interface FinanceReports {
  byType: FinanceReportByType[];
  byMonth: FinanceReportByMonth[];
  totals: FinanceReportTotals;
}
