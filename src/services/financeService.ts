import type { ExpenseType } from "../contracts/financeContract";
import { apiUrl } from "./apiConfig";
import { authHeaders, getStoredSession } from "./authService"; // [FIX batch8] كل طلبات المالية تحمل الهوية
import { StorageAdapter } from "./storageAdapter"; // [FIX phase4] كل الوصول للتخزين عبر المحوّل المركزي

export interface FinanceOverview {
  source: "smart-time-finance-sqlite";
  expenses: Array<Record<string, unknown>>;
  monthlyIncome: Array<Record<string, unknown>>;
  bankCertificates: Array<Record<string, unknown>>;
  fuelRecords: Array<Record<string, unknown>>;
  maintenanceRecords: Array<Record<string, unknown>>;
  educationExpenses: Array<Record<string, unknown>>;
  fetchedAt: string;
}

export async function fetchCanonicalFinanceOverview(): Promise<FinanceOverview> {
  try {
    const response = await fetch(apiUrl("/api/finance/overview"), {
      headers: { Accept: "application/json", ...authHeaders() },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(String(payload?.error || "تعذر قراءة بيانات التمويل."));
    const overview = payload as FinanceOverview;
    // [FIX data-2026-11] نجاح القراءة ← حدّث المرآة المحلية (أفضل جهد).
    writeMirror(overview);
    return overview;
  } catch (error) {
    // [FIX data-2026-11] "البيانات مش بتتخزن": لو الشبكة مقطوعة أو الخادم بطيء
    // نعرض آخر نسخة محفوظة محلياً بدل قائمة فارغة — البيانات لم تضيع، ما زالت
    // على الخادم وسيُعاد جلبها تلقائياً عند أول اتصال ناجح.
    const mirror = readMirror();
    if (mirror) {
      console.warn("[financeService] فشل جلب overview من الخادم — عرض المرآة المحلية:", error);
      return mirror;
    }
    throw error;
  }
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
  // [FIX batch8] كان يستدعي المسار الخام بلا ترويسة Authorization — كل عمليات
  // الحفظ/التعديل/الحذف كانت ترجع 401 (انهيار "الحفظ") وكنت تكسر داخل الـ APK
  // لأن المسار النسبي يصيب أصل التطبيق المحلي بدل السيرفر.
  const response = await fetch(apiUrl(path), {
    method,
    headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders() },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(payload?.error || "تعذر تنفيذ العملية المالية."));
  // [FIX perf-2026-11] أي عملية كتابة ناجحة تُحدّث المرآة المحلية فوراً حتى تبقى
  // القراءة الأخيرة متاحة لو انقطع الإنترنت قبل عملية القراءة التالية.
  mirrorMutation(payload);
  return payload;
}

// ---------- [FIX data-2026-11] مرآة محلية للبيانات المالية (قراءة بلا شبكة) ----------
// "البيانات مش بتتخزن": كل قوائم التمويل تُقرأ من الخادم فقط — أي انقطاع شبكة
// يجعل القوائم فارغة وكأن الحفظ ضاع. الآن آخر نسخة ناجحة تُخزَّن في localStorage
// لكل مستخدم على حدة، وعند فشل الاتصال تُعرض من المرآة بدل القائمة الفارغة.
const FINANCE_MIRROR_PREFIX = "smart_time_finance_mirror_";

function mirrorKey(): string | null {
  try {
    const session = getStoredSession();
    const uid = String(session?.user?.id || "").trim();
    return uid ? `${FINANCE_MIRROR_PREFIX}${uid}` : null;
  } catch {
    return null;
  }
}

function readMirror(): FinanceOverview | null {
  const key = mirrorKey();
  if (!key) return null;
  try {
    const raw = StorageAdapter.getRaw(key);
    return raw ? (JSON.parse(raw) as FinanceOverview) : null;
  } catch {
    return null;
  }
}

function writeMirror(overview: FinanceOverview): void {
  const key = mirrorKey();
  if (!key) return;
  try {
    StorageAdapter.setItem(key, JSON.stringify(overview));
  } catch {
    /* التخزين ممتلئ — نتجاهل بأمان، الخادم يبقى المصدر الأساسي */
  }
}

/** تُحدّث سجلًا واحدًا داخل المرآة بعد نجاح POST/PATCH/DELETE (أفضل جهد). */
function mirrorMutation(payload: FinanceMutationPayload): void {
  try {
    const record = payload.record as Record<string, unknown> | undefined;
    const id = String(payload.id || record?.id || "");
    if (!id) return;
    const mirror = readMirror();
    if (!mirror || !Array.isArray(mirror.expenses)) return;
    const deleted = payload.deleted === true;
    let list = mirror.expenses.filter((e) => String(e.id) !== id);
    if (!deleted && record) list = [...list, record];
    writeMirror({ ...mirror, expenses: list });
  } catch {
    /* المرآة تحسين اختياري — أي فشل لا يوقف الحفظ الفعلي */
  }
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
  reconcileCanonicalFinance,
};
