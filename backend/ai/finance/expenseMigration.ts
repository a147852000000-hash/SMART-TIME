import { db } from "../../database.js";

export interface ExpenseImportInput { id: string; title: string; amount: number; category: string; date: string; paymentMethod: string; receiptUrl?: string; notes?: string; createdAt?: string; }
export interface ExpenseImportResult { id: string; status: "inserted" | "skipped" | "conflict"; reason: string; }

function text(value: unknown, max = 1000): string { return String(value ?? "").trim().slice(0, max); }
function fingerprint(row: any): string { return [text(row.title).toLowerCase(), Number(row.amount ?? 0).toFixed(2), text(row.category).toLowerCase(), text(row.date), text(row.paymentMethod).toLowerCase(), text(row.notes).toLowerCase()].join("|"); }
function validateExpense(item: ExpenseImportInput): void {
  if (!text(item.id, 200) || !text(item.title, 300)) throw new Error("Expense id/title is required.");
  if (!Number.isFinite(Number(item.amount)) || Number(item.amount) < 0) throw new Error("Expense amount is invalid.");
  if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(text(item.date, 100))) throw new Error("Expense date is invalid.");
  if (!text(item.category, 100) || !text(item.paymentMethod, 50)) throw new Error("Expense category/payment method is required.");
}

export function importExpensesForUser(userId: string, items: ExpenseImportInput[]): ExpenseImportResult[] {
  if (!userId) throw new Error("userId is required.");
  if (!Array.isArray(items) || items.length === 0) return [];
  if (items.length > 1000) throw new Error("Too many expenses in one import.");
  const now = new Date().toISOString();
  const results: ExpenseImportResult[] = [];
  const insert = db.prepare("INSERT INTO finance_expenses (id,user_id,title,amount,currency,category,date,payment_method,receipt_url,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)");
  db.exec("BEGIN");
  try {
    const records = items;
    for (const item of records) {
      validateExpense(item);
      const id = text(item.id, 200);
      const existing = db.prepare("SELECT id,title,amount,category,date,payment_method as paymentMethod,notes FROM finance_expenses WHERE id=? AND user_id=?").get(id, userId) as any;
      if (existing) { const same = fingerprint(existing) === fingerprint(item); results.push({ id, status: same ? "skipped" : "conflict", reason: same ? "already canonical and identical" : "same id has different canonical content" }); continue; }
      const duplicate = db.prepare("SELECT id,title,amount,category,date,payment_method as paymentMethod,notes FROM finance_expenses WHERE user_id=? AND title=? AND amount=? AND category=? AND date=? AND payment_method=? AND COALESCE(notes,'')=COALESCE(?,'') LIMIT 1").get(userId,text(item.title,300),Number(item.amount),text(item.category,100),text(item.date,100),text(item.paymentMethod,50),text(item.notes,1000)) as any;
      if (duplicate) { results.push({ id, status: "skipped", reason: `content-equivalent canonical record: ${duplicate.id}` }); continue; }
      insert.run(id,userId,text(item.title,300),Number(item.amount),"EGP",text(item.category,100),text(item.date,100),text(item.paymentMethod,50),text(item.receiptUrl,2000)||null,text(item.notes,1000)||null,text(item.createdAt,100)||now,now);
      results.push({ id, status: "inserted", reason: "imported into canonical SQLite finance store" });
    }
    db.exec("COMMIT");
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch { /* preserve original error */ }
    throw error;
  }
  return results;
}