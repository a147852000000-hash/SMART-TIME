import crypto from "node:crypto";
import { db } from "../../database.js";

export const FINANCE_EXPENSE_TYPES = [
  "house",
  "medical",
  "personal",
  "student",
  "vehicle_fuel",
  "vehicle_maint",
  "vehicle_oil",
  "work",
] as const;

export type FinanceExpenseType = typeof FINANCE_EXPENSE_TYPES[number];

export interface CanonicalExpenseInput {
  id?: string;
  type: FinanceExpenseType;
  title: string;
  amount: number;
  category: string;
  date: string;
  paymentMethod: string;
  receiptUrl?: string;
  notes?: string | null;
  createdAt?: string;
}

export interface FinanceMutationResult {
  id: string;
  type: FinanceExpenseType;
  persisted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceMigrationResult {
  source: string;
  inserted: number;
  skipped: number;
  conflicts: number;
  verified: number;
  verificationPassed: boolean;
  records: Array<{ sourceId: string; targetId: string; status: "inserted" | "skipped" | "conflict"; reason: string }>;
}

function now(): string { return new Date().toISOString(); }
function text(value: unknown, max = 2000): string { return String(value ?? "").trim().slice(0, max); }
function id(prefix: string): string { return `${prefix}_${crypto.randomUUID()}`; }

export function ensureFinanceMutationSchema(): void {
  const columns = db.prepare("PRAGMA table_info(finance_expenses)").all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === "expense_type")) {
    db.exec("ALTER TABLE finance_expenses ADD COLUMN expense_type TEXT NOT NULL DEFAULT 'personal'");
  }
  db.exec("CREATE INDEX IF NOT EXISTS idx_finance_expenses_user_type_date ON finance_expenses(user_id, expense_type, date)");
}

function validate(input: CanonicalExpenseInput): void {
  if (!FINANCE_EXPENSE_TYPES.includes(input.type)) throw new Error("Invalid finance expense type");
  if (!text(input.title, 300)) throw new Error("Expense title is required");
  if (!Number.isFinite(Number(input.amount)) || Number(input.amount) < 0) throw new Error("Expense amount is invalid");
  if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(text(input.date, 100))) throw new Error("Expense date is invalid");
  if (!text(input.category, 100)) throw new Error("Expense category is required");
  if (!text(input.paymentMethod, 50)) throw new Error("Expense payment method is required");
}

function readExpense(userId: string, expenseId: string): any {
  return db.prepare(`SELECT id, expense_type as type, title, amount, currency, category, date,
    payment_method as paymentMethod, receipt_url as receiptUrl, notes,
    created_at as createdAt, updated_at as updatedAt
    FROM finance_expenses WHERE id=? AND user_id=?`).get(expenseId, userId) || null;
}

export function createCanonicalExpense(userId: string, input: CanonicalExpenseInput): FinanceMutationResult {
  ensureFinanceMutationSchema();
  const uid = text(userId, 200);
  if (!uid) throw new Error("userId is required");
  validate(input);
  const expenseId = text(input.id, 200) || id("exp");
  const createdAt = text(input.createdAt, 100) || now();
  const updatedAt = now();
  db.prepare(`INSERT INTO finance_expenses
    (id,user_id,expense_type,title,amount,currency,category,date,payment_method,receipt_url,notes,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(expenseId, uid, input.type, text(input.title, 300), Number(input.amount), "EGP",
      text(input.category, 100), text(input.date, 100), text(input.paymentMethod, 50),
      text(input.receiptUrl, 2000) || null, text(input.notes, 2000) || null, createdAt, updatedAt);
  const record = readExpense(uid, expenseId);
  if (!record) throw new Error("Canonical finance write verification failed");
  return { id: record.id, type: record.type, persisted: true, createdAt: record.createdAt, updatedAt: record.updatedAt };
}

export function updateCanonicalExpense(userId: string, expenseId: string, patch: Partial<CanonicalExpenseInput>): any {
  ensureFinanceMutationSchema();
  const uid = text(userId, 200);
  const current = readExpense(uid, text(expenseId, 200));
  if (!current) throw new Error("Expense not found for this user");
  const next: CanonicalExpenseInput = {
    type: (patch.type ?? current.type) as FinanceExpenseType,
    title: patch.title ?? current.title,
    amount: patch.amount ?? Number(current.amount),
    category: patch.category ?? current.category,
    date: patch.date ?? current.date,
    paymentMethod: patch.paymentMethod ?? current.paymentMethod,
    receiptUrl: patch.receiptUrl ?? current.receiptUrl ?? undefined,
    notes: patch.notes === undefined ? current.notes : patch.notes,
    createdAt: current.createdAt,
  };
  validate(next);
  const updatedAt = now();
  db.prepare(`UPDATE finance_expenses SET expense_type=?,title=?,amount=?,category=?,date=?,
    payment_method=?,receipt_url=?,notes=?,updated_at=? WHERE id=? AND user_id=?`)
    .run(next.type, text(next.title,300), Number(next.amount), text(next.category,100), text(next.date,100),
      text(next.paymentMethod,50), text(next.receiptUrl,2000) || null, text(next.notes,2000) || null,
      updatedAt, current.id, uid);
  const record = readExpense(uid, current.id);
  if (!record || record.type !== next.type || Number(record.amount) !== Number(next.amount)) {
    throw new Error("Canonical finance update verification failed");
  }
  return record;
}

export function deleteCanonicalExpense(userId: string, expenseId: string): void {
  ensureFinanceMutationSchema();
  const uid = text(userId, 200);
  const idValue = text(expenseId, 200);
  const current = readExpense(uid, idValue);
  if (!current) throw new Error("Expense not found for this user");
  db.prepare("DELETE FROM finance_expenses WHERE id=? AND user_id=?").run(idValue, uid);
  if (readExpense(uid, idValue)) throw new Error("Canonical finance delete verification failed");
}

function fingerprint(row: any): string {
  return [
    text(row.title).toLowerCase(),
    Number(row.amount ?? 0).toFixed(2),
    text(row.category).toLowerCase(),
    text(row.date),
    text(row.paymentMethod).toLowerCase(),
    text(row.notes).toLowerCase(),
  ].join("|");
}

export function inferFinanceExpenseType(category: unknown): FinanceExpenseType {
  const value = text(category, 100).toLowerCase();
  if (/fuel|بنزين|وقود/.test(value)) return "vehicle_fuel";
  if (/oil|زيت/.test(value)) return "vehicle_oil";
  if (/maint|service|صيانة/.test(value)) return "vehicle_maint";
  if (/medical|health|doctor|دواء|طب/.test(value)) return "medical";
  if (/education|student|school|lesson|تعليم|مدرسة|دروس/.test(value)) return "student";
  if (/work|business|شغل|عمل/.test(value)) return "work";
  if (/house|home|rent|bill|منزل|بيت|إيجار|فواتير/.test(value)) return "house";
  return "personal";
}

export function reconcileAiTransactionsToCanonical(userId: string): FinanceMigrationResult {
  ensureFinanceMutationSchema();
  const uid = text(userId, 200);
  if (!uid) throw new Error("userId is required");
  const sourceRows = db.prepare(`SELECT id,title,amount,category,date,
    payment_method as paymentMethod,notes,created_at as createdAt
    FROM ai_transactions WHERE user_id=? ORDER BY created_at ASC`).all(uid) as any[];
  const results: FinanceMigrationResult["records"] = [];
  let inserted = 0, skipped = 0, conflicts = 0, verified = 0;

  db.exec("BEGIN");
  try {
    for (const row of sourceRows) {
      const sourceId = text(row.id, 200);
      const sameId = readExpense(uid, sourceId);
      if (sameId) {
        if (fingerprint(sameId) === fingerprint(row)) {
          skipped++;
          results.push({ sourceId, targetId: sameId.id, status: "skipped", reason: "already canonical and identical" });
        } else {
          conflicts++;
          results.push({ sourceId, targetId: sameId.id, status: "conflict", reason: "same id contains different canonical content" });
        }
        continue;
      }
      const duplicate = db.prepare(`SELECT id FROM finance_expenses WHERE user_id=? AND title=? AND amount=? AND category=? AND date=? AND payment_method=? AND COALESCE(notes,'')=COALESCE(?,'') LIMIT 1`)
        .get(uid, text(row.title,300), Number(row.amount), text(row.category,100), text(row.date,100), text(row.paymentMethod,50), text(row.notes,2000)) as any;
      if (duplicate) {
        skipped++;
        results.push({ sourceId, targetId: String(duplicate.id), status: "skipped", reason: "content-equivalent canonical record already exists" });
        continue;
      }
      const targetId = `ai_${sourceId}`;
      const input: CanonicalExpenseInput = {
        id: targetId,
        type: inferFinanceExpenseType(row.category),
        title: text(row.title,300),
        amount: Number(row.amount),
        category: text(row.category,100) || "other",
        date: text(row.date,100),
        paymentMethod: text(row.paymentMethod,50) || "cash",
        notes: text(row.notes,2000) || null,
        createdAt: text(row.createdAt,100) || now(),
      };
      validate(input);
      createCanonicalExpense(uid, input);
      const verifiedRow = readExpense(uid, targetId);
      if (!verifiedRow) throw new Error(`AI transaction migration verification failed: ${sourceId}`);
      inserted++;
      verified++;
      results.push({ sourceId, targetId, status: "inserted", reason: "migrated from ai_transactions to canonical finance_expenses" });
    }
    db.exec("COMMIT");
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch {}
    throw error;
  }

  if (verified !== inserted) throw new Error("No-data-loss verification failed for AI transaction migration");
  return {
    source: "ai_transactions",
    inserted,
    skipped,
    conflicts,
    verified,
    verificationPassed: conflicts === 0 && verified === inserted,
    records: results,
  };
}


export function migrateLegacyExpensesToCanonical(userId: string, items: Array<CanonicalExpenseInput & { type?: FinanceExpenseType }>): FinanceMigrationResult {
  ensureFinanceMutationSchema();
  const uid = text(userId, 200);
  if (!uid) throw new Error("userId is required");
  const records: FinanceMigrationResult["records"] = [];
  let inserted = 0, skipped = 0, conflicts = 0, verified = 0;
  db.exec("BEGIN");
  try {
    for (const item of items) {
      const sourceId = text(item.id, 200);
      const type = item.type ?? inferFinanceExpenseType(item.category);
      const normalized = { ...item, type } as CanonicalExpenseInput;
      validate(normalized);
      const existing = readExpense(uid, sourceId);
      if (existing) {
        if (fingerprint(existing) === fingerprint(normalized)) {
          skipped++;
          records.push({ sourceId, targetId: existing.id, status: "skipped", reason: "already canonical and identical" });
        } else {
          conflicts++;
          records.push({ sourceId, targetId: existing.id, status: "conflict", reason: "same id contains different canonical content" });
        }
        continue;
      }
      const duplicate = db.prepare(`SELECT id FROM finance_expenses WHERE user_id=? AND title=? AND amount=? AND category=? AND date=? AND payment_method=? AND COALESCE(notes,'')=COALESCE(?,'') LIMIT 1`)
        .get(uid, text(normalized.title,300), Number(normalized.amount), text(normalized.category,100), text(normalized.date,100), text(normalized.paymentMethod,50), text(normalized.notes,2000)) as any;
      if (duplicate) {
        skipped++;
        records.push({ sourceId, targetId: String(duplicate.id), status: "skipped", reason: "content-equivalent canonical record already exists" });
        continue;
      }
      createCanonicalExpense(uid, normalized);
      if (!readExpense(uid, sourceId)) {
        const targetId = sourceId || id("legacy");
        if (!readExpense(uid, targetId)) throw new Error(`Legacy migration verification failed: ${sourceId}`);
      }
      const targetId = sourceId;
      if (!readExpense(uid, targetId)) throw new Error(`Legacy migration verification failed: ${sourceId}`);
      inserted++;
      verified++;
      records.push({ sourceId, targetId, status: "inserted", reason: "migrated from legacy finance data" });
    }
    db.exec("COMMIT");
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch {}
    throw error;
  }
  return { source: "legacy_storage", inserted, skipped, conflicts, verified, verificationPassed: conflicts === 0 && verified === inserted, records };
}



export interface CanonicalMonthlyIncomeInput {
  id?: string; month: string; salary: number; bonuses: number; otherIncome: number;
  otherIncomeNote?: string | null; sources?: unknown[]; createdAt?: string;
}
export interface CanonicalBankCertificateInput {
  id: string; bankName: string; certificateNumber?: string; duration: string; amount: number;
  annualRate?: number; annualProfit?: number; periodicProfit?: number; monthlyEquivalentProfit?: number;
  returnType?: string; issueDate: string; maturityDate: string; profitDate: string;
  profitAmount: number; profitFrequency: string; notes?: string | null; createdAt?: string;
}

export function upsertCanonicalMonthlyIncome(userId: string, items: CanonicalMonthlyIncomeInput[]): number {
  const uid = text(userId, 200);
  if (!uid) throw new Error("userId is required");
  if (!Array.isArray(items) || items.length > 240) throw new Error("Invalid monthly income list");
  const upsert = db.prepare(`INSERT INTO finance_monthly_income
    (id,user_id,month,salary,bonuses,other_income,other_income_note,sources_json,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(user_id,month) DO UPDATE SET salary=excluded.salary,bonuses=excluded.bonuses,
    other_income=excluded.other_income,other_income_note=excluded.other_income_note,
    sources_json=excluded.sources_json,updated_at=excluded.updated_at`);
  const timestamp = now();
  db.exec("BEGIN");
  try {
    for (const row of items) {
      const month = text(row.month, 7);
      if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Invalid income month");
      const salary = Number(row.salary || 0), bonuses = Number(row.bonuses || 0), other = Number(row.otherIncome || 0);
      if (![salary, bonuses, other].every((n) => Number.isFinite(n) && n >= 0)) throw new Error("Invalid income amounts");
      const sources = Array.isArray(row.sources) ? row.sources : [];
      if (sources.length > 1000) throw new Error("Too many income source records");
      const idValue = text(row.id, 200) || `income_${month}`;
      const createdAt = text(row.createdAt, 100) || timestamp;
      upsert.run(idValue, uid, month, salary, bonuses, other, text(row.otherIncomeNote, 1000) || null,
        JSON.stringify(sources), createdAt, timestamp);
    }
    db.exec("COMMIT");
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch {}
    throw error;
  }
  return items.length;
}

export function upsertCanonicalBankCertificates(userId: string, items: CanonicalBankCertificateInput[]): number {
  const uid = text(userId, 200);
  if (!uid) throw new Error("userId is required");
  if (!Array.isArray(items) || items.length > 500) throw new Error("Invalid certificate list");
  const upsert = db.prepare(`INSERT INTO finance_bank_certificates
    (id,user_id,bank_name,certificate_number,duration,amount,annual_rate,annual_profit,periodic_profit,
     monthly_equivalent_profit,return_type,issue_date,maturity_date,profit_date,profit_amount,
     profit_frequency,notes,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET bank_name=excluded.bank_name,certificate_number=excluded.certificate_number,
    duration=excluded.duration,amount=excluded.amount,annual_rate=excluded.annual_rate,
    annual_profit=excluded.annual_profit,periodic_profit=excluded.periodic_profit,
    monthly_equivalent_profit=excluded.monthly_equivalent_profit,return_type=excluded.return_type,
    issue_date=excluded.issue_date,maturity_date=excluded.maturity_date,profit_date=excluded.profit_date,
    profit_amount=excluded.profit_amount,profit_frequency=excluded.profit_frequency,notes=excluded.notes,
    updated_at=excluded.updated_at WHERE finance_bank_certificates.user_id=excluded.user_id`);
  const timestamp = now();
  db.exec("BEGIN");
  try {
    for (const row of items) {
      const idValue = text(row.id, 200), bank = text(row.bankName, 200), duration = text(row.duration, 100);
      const amount = Number(row.amount), profit = Number(row.profitAmount);
      if (!idValue || !bank || !duration || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(profit) || profit < 0) throw new Error("Invalid bank certificate");
      for (const date of [row.issueDate, row.maturityDate, row.profitDate]) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(text(date, 20))) throw new Error("Invalid certificate date");
      }
      if (!["monthly","quarterly","semiannual","annual","maturity"].includes(text(row.profitFrequency, 30))) throw new Error("Invalid certificate profit frequency");
      upsert.run(idValue, uid, bank, text(row.certificateNumber, 200) || null, duration, amount,
        Number.isFinite(Number(row.annualRate)) ? Number(row.annualRate) : null,
        Number.isFinite(Number(row.annualProfit)) ? Number(row.annualProfit) : null,
        Number.isFinite(Number(row.periodicProfit)) ? Number(row.periodicProfit) : null,
        Number.isFinite(Number(row.monthlyEquivalentProfit)) ? Number(row.monthlyEquivalentProfit) : null,
        text(row.returnType, 30) || null, row.issueDate, row.maturityDate, row.profitDate, profit,
        row.profitFrequency, text(row.notes, 2000) || null, text(row.createdAt, 100) || timestamp, timestamp);
    }
    db.exec("COMMIT");
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch {}
    throw error;
  }
  return items.length;
}

export function deleteCanonicalBankCertificate(userId: string, certificateId: string): void {
  const uid = text(userId, 200), idValue = text(certificateId, 200);
  if (!uid || !idValue) throw new Error("Invalid certificate identity");
  const result = db.prepare("DELETE FROM finance_bank_certificates WHERE id=? AND user_id=?").run(idValue, uid);
  if (Number(result.changes) !== 1) throw new Error("Bank certificate not found for this user");
}

export type CanonicalFinanceRecordKind = "fuel" | "maintenance" | "education";

const FINANCE_RECORD_TABLES: Record<CanonicalFinanceRecordKind, {
  table: string;
  amountColumn: string;
  editableColumns: Record<string, string>;
}> = {
  fuel: {
    table: "finance_fuel_records",
    amountColumn: "total_cost",
    editableColumns: { amount: "total_cost", date: "date", notes: "notes" },
  },
  maintenance: {
    table: "finance_maintenance_records",
    amountColumn: "cost",
    editableColumns: { systemType: "system_type", title: "title", amount: "cost", date: "date", notes: "notes" },
  },
  education: {
    table: "finance_education_expenses",
    amountColumn: "amount",
    editableColumns: { title: "title", amount: "amount", category: "category", date: "date", notes: "notes" },
  },
};

function financeRecordConfig(kind: string) {
  if (!Object.prototype.hasOwnProperty.call(FINANCE_RECORD_TABLES, kind)) {
    throw new Error("Unsupported finance record type");
  }
  return FINANCE_RECORD_TABLES[kind as CanonicalFinanceRecordKind];
}

export function updateCanonicalFinanceRecord(
  userId: string,
  kind: string,
  recordId: string,
  patch: Record<string, unknown>,
): any {
  const uid = text(userId, 200);
  const idValue = text(recordId, 200);
  if (!uid || !idValue) throw new Error("userId and recordId are required");
  const config = financeRecordConfig(kind);
  const current = db.prepare(`SELECT * FROM ${config.table} WHERE id=? AND user_id=?`).get(idValue, uid) as Record<string, unknown> | undefined;
  if (!current) throw new Error("Finance record not found for this user");

  const assignments: string[] = [];
  const values: Array<string | number | null> = [];
  for (const [inputKey, column] of Object.entries(config.editableColumns)) {
    if (!Object.prototype.hasOwnProperty.call(patch, inputKey)) continue;
    const value = patch[inputKey];
    if (inputKey === "amount") {
      const amount = Number(value);
      if (!Number.isFinite(amount) || amount < 0) throw new Error("Finance record amount is invalid");
      if (kind === "fuel") {
        const liters = Number(current.liters);
        if (!Number.isFinite(liters) || liters <= 0) throw new Error("Cannot update fuel total without a valid liters value");
        assignments.push("total_cost=?", "price_per_liter=?");
        values.push(amount, amount / liters);
        continue;
      }
      values.push(amount);
    } else if (inputKey === "date") {
      const date = text(value, 100);
      if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(date)) throw new Error("Finance record date is invalid");
      values.push(date);
    } else if (inputKey === "title" || inputKey === "category" || inputKey === "systemType") {
      const normalized = text(value, 300);
      if (!normalized) throw new Error(`Finance record ${inputKey} is required`);
      values.push(normalized);
    } else {
      values.push(value == null ? null : text(value, 2000) || null);
    }
    assignments.push(`${column}=?`);
  }
  if (!assignments.length) return current;
  assignments.push("updated_at=?");
  values.push(now(), idValue, uid);
  db.prepare(`UPDATE ${config.table} SET ${assignments.join(",")} WHERE id=? AND user_id=?`).run(...values);
  const updated = db.prepare(`SELECT * FROM ${config.table} WHERE id=? AND user_id=?`).get(idValue, uid);
  if (!updated) throw new Error("Finance record update verification failed");
  return updated;
}

export function deleteCanonicalFinanceRecord(userId: string, kind: string, recordId: string): void {
  const uid = text(userId, 200);
  const idValue = text(recordId, 200);
  if (!uid || !idValue) throw new Error("userId and recordId are required");
  const config = financeRecordConfig(kind);
  const current = db.prepare(`SELECT id FROM ${config.table} WHERE id=? AND user_id=?`).get(idValue, uid);
  if (!current) throw new Error("Finance record not found for this user");
  db.prepare(`DELETE FROM ${config.table} WHERE id=? AND user_id=?`).run(idValue, uid);
  if (db.prepare(`SELECT id FROM ${config.table} WHERE id=? AND user_id=?`).get(idValue, uid)) {
    throw new Error("Finance record delete verification failed");
  }
}
