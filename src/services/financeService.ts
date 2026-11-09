import type { ExpenseType } from "../contracts/financeContract";
import { apiUrl } from "./apiConfig";
import { authHeaders } from "./authService";

export interface FinanceOverview {
  source: "smart-time-finance-sqlite";
  expenses: Array<Record<string, unknown>>;
  monthlyIncome: Array<Record<string, unknown>>;
  bankCertificates: Array<Record<string, unknown>>;
  carTripIncome: Array<Record<string, unknown>>;
  fuelRecords: Array<Record<string, unknown>>;
  maintenanceRecords: Array<Record<string, unknown>>;
  educationExpenses: Array<Record<string, unknown>>;
  students: Array<Record<string, unknown>>;
  associations: Array<Record<string, unknown>>;
  vehicleAccidents: Array<Record<string, unknown>>;
  fetchedAt: string;
}

export async function fetchCanonicalFinanceOverview(): Promise<FinanceOverview> {
  const response = await fetch(apiUrl("/api/finance/overview"), {
    credentials: "omit",
    headers: { Accept: "application/json", ...authHeaders() },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(payload?.error || "تعذر قراءة بيانات التمويل."));
  return payload as FinanceOverview;
}

export interface CanonicalExpenseQuery {
  type?: ExpenseType | ExpenseType[];
  from?: string;
  to?: string;
}

export interface CanonicalExpenseInput {
  id?: string;
  type: ExpenseType;
  title?: string;
  amount: number;
  category?: string;
  date: string;
  paymentMethod?: string;
  receiptUrl?: string;
  notes?: string | null;
  createdAt?: string;
}

interface FinanceMutationPayload {
  source?: string;
  record?: Record<string, unknown>;
  deleted?: boolean;
  id?: string;
  [key: string]: unknown;
}

async function financeMutation(path: string, method: string, body?: unknown): Promise<FinanceMutationPayload> {
  const response = await fetch(apiUrl(path), {
    method,
    credentials: "omit",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders() },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(payload?.error || "تعذر تنفيذ العملية المالية."));
  return payload;
}

export async function createCanonicalFinanceExpense(input: CanonicalExpenseInput): Promise<Record<string, unknown>> {
  const payload = await financeMutation("/api/finance/expenses", "POST", {
    ...input,
    title: input.title || input.category || input.type,
    category: input.category || input.type,
    paymentMethod: input.paymentMethod || "unknown",
  });
  return payload.record as Record<string, unknown>;
}

export const addExpense = createCanonicalFinanceExpense;

export async function getAllExpenses(): Promise<Array<Record<string, unknown>>> {
  const overview = await fetchCanonicalFinanceOverview();
  return overview.expenses || [];
}

export async function getExpenses(query: CanonicalExpenseQuery = {}): Promise<Array<Record<string, unknown>>> {
  const expenses = await getAllExpenses();
  const types = query.type ? (Array.isArray(query.type) ? query.type : [query.type]) : undefined;
  return expenses.filter((expense) => {
    const type = String(expense.type || "");
    const date = String(expense.date || "").slice(0, 10);
    return (!types || types.includes(type as ExpenseType))
      && (!query.from || date >= query.from)
      && (!query.to || date <= query.to);
  });
}

export async function updateCanonicalFinanceExpense(id: string, patch: Partial<CanonicalExpenseInput>): Promise<Record<string, unknown>> {
  const payload = await financeMutation(`/api/finance/expenses/${encodeURIComponent(id)}`, "PATCH", patch);
  return payload.record as Record<string, unknown>;
}

export async function deleteCanonicalFinanceExpense(id: string): Promise<void> {
  await financeMutation(`/api/finance/expenses/${encodeURIComponent(id)}`, "DELETE");
}

export async function updateCanonicalFinanceRecord(kind: "fuel" | "maintenance" | "education", id: string, patch: Record<string, unknown>): Promise<Record<string, unknown>> {
  const payload = await financeMutation(`/api/finance/records/${kind}/${encodeURIComponent(id)}`, "PATCH", patch);
  return payload.record as Record<string, unknown>;
}

export async function deleteCanonicalFinanceRecord(kind: "fuel" | "maintenance" | "education", id: string): Promise<void> {
  await financeMutation(`/api/finance/records/${kind}/${encodeURIComponent(id)}`, "DELETE");
}

export async function saveCanonicalMonthlyIncome(items: Array<Record<string, unknown>>): Promise<FinanceMutationPayload> {
  return financeMutation("/api/finance/income", "PUT", { items });
}

export async function saveCanonicalBankCertificates(items: Array<Record<string, unknown>>): Promise<FinanceMutationPayload> {
  return financeMutation("/api/finance/certificates", "PUT", { items });
}

export async function deleteCanonicalBankCertificate(id: string): Promise<void> {
  await financeMutation(`/api/finance/certificates/${encodeURIComponent(id)}`, "DELETE");
}

export async function saveCanonicalCarTripIncome(items: Array<Record<string, unknown>>): Promise<FinanceMutationPayload> {
  return financeMutation("/api/finance/car-trips", "PUT", { items });
}

export async function saveCanonicalFinanceUserRecords(
  kind: "students" | "associations" | "vehicle_accidents",
  items: Array<Record<string, unknown>>,
): Promise<FinanceMutationPayload> {
  return financeMutation(`/api/finance/user-records/${kind}`, "PUT", { items });
}

export async function reconcileCanonicalFinance(expenses: Array<CanonicalExpenseInput>): Promise<FinanceMutationPayload> {
  return financeMutation("/api/finance/migrate", "POST", { expenses, reconcileAiTransactions: true });
}

export const financeService = {
  fetchCanonicalFinanceOverview,
  createCanonicalFinanceExpense,
  addExpense,
  getAllExpenses,
  getExpenses,
  updateCanonicalFinanceExpense,
  deleteCanonicalFinanceExpense,
  updateCanonicalFinanceRecord,
  deleteCanonicalFinanceRecord,
  reconcileCanonicalFinance,
  saveCanonicalMonthlyIncome,
  saveCanonicalBankCertificates,
  deleteCanonicalBankCertificate,
  saveCanonicalCarTripIncome,
  saveCanonicalFinanceUserRecords,
};
