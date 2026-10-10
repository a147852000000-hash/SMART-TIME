import crypto from "node:crypto";
import { createCanonicalExpense, deleteCanonicalExpense, inferFinanceExpenseType, updateCanonicalExpense } from "./finance/financeRepository.js";
import { db } from "../database.js";
import type { SmartAiAction } from "./types.js";

export interface VerifiedToolResult {
  ok: boolean;
  operation: string;
  record: Record<string, unknown>;
  verification: Record<string, unknown>;
  error?: string;
}

function now() { return new Date().toISOString(); }
function id(prefix: string) { return `${prefix}_${crypto.randomUUID()}`; }
function amount(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Amount must be a positive number");
  return Math.round(n * 100) / 100;
}
function text(value: unknown, fallback = "") { return String(value ?? fallback).trim(); }

function readBudget(userId: string) {
  return db.prepare("SELECT user_id as userId, monthly_limit as monthlyLimit, currency, updated_at as updatedAt FROM ai_budgets WHERE user_id = ?").get(userId) as any || null;
}

function readTransaction(userId: string, transactionId: string) {
  return db.prepare("SELECT id, user_id as userId, title, amount, category, date, payment_method as paymentMethod, receipt_url as receiptUrl, notes, created_at as createdAt, updated_at as updatedAt FROM finance_expenses WHERE id = ? AND user_id = ?").get(transactionId, userId) as any || null;
}
function readTask(userId: string, taskId: string) {
  return db.prepare(`SELECT id, user_id as userId, title, completed, priority, category, due_date as dueDate, due_time as dueTime, note, created_at as createdAt, completed_at as completedAt
    FROM ai_tasks WHERE id = ? AND user_id = ?`).get(taskId, userId) as any || null;
}

function remainingBudget(userId: string) {
  const budget = readBudget(userId);
  if (!budget) return null;
  const row = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM ai_transactions WHERE user_id = ? AND substr(date, 1, 7) = substr(date('now'), 1, 7)").get(userId) as any;
  return Math.round((Number(budget.monthlyLimit) - Number(row?.total || 0)) * 100) / 100;
}

export function addTransaction(userId: string, payload: Record<string, unknown>): VerifiedToolResult {
  const uid = text(userId);
  if (!uid) throw new Error("userId is required");
  const title = text(payload.title);
  if (!title) throw new Error("Transaction title is required");
  const value = amount(payload.amount);
  const category = text(payload.category, "other");
  const date = text(payload.date, now().slice(0, 10));
  const paymentMethod = text(payload.paymentMethod, "cash");
  const notes = text(payload.notes);
  const created = createCanonicalExpense(uid, { id: text(payload.id) || undefined, type: inferFinanceExpenseType(category), title, amount: value, category, date, paymentMethod, receiptUrl: text(payload.receiptUrl) || undefined, notes: notes || null });
  const record = readTransaction(uid, created.id);
  if (!record) return { ok: false, operation: "addTransaction", record: {}, verification: {}, error: "Database read-back failed after canonical finance insert" };
  return { ok: true, operation: "addTransaction", record, verification: { persisted: true, transactionId: created.id, monthlyRemaining: remainingBudget(uid) } };
}
export function updateTransaction(userId: string, payload: Record<string, unknown>): VerifiedToolResult {
  const uid = text(userId);
  const transactionId = text(payload.id);
  if (!transactionId) throw new Error("Transaction id is required");
  const current = readTransaction(uid, transactionId);
  if (!current) throw new Error("Transaction not found for this user");
  const patch: Record<string, unknown> = {};
  for (const key of ["title", "amount", "category", "date", "paymentMethod", "receiptUrl", "notes"]) if (payload[key] !== undefined) patch[key] = payload[key];
  if (patch.amount !== undefined) patch.amount = amount(patch.amount);
  if (patch.title !== undefined && !text(patch.title)) throw new Error("Transaction title is required");
  if (patch.category !== undefined) patch.category = text(patch.category, current.category);
  if (patch.date !== undefined) patch.date = text(patch.date, current.date);
  if (patch.paymentMethod !== undefined) patch.paymentMethod = text(patch.paymentMethod, current.paymentMethod);
  if (patch.notes !== undefined) patch.notes = text(patch.notes) || null;
  const record = updateCanonicalExpense(uid, transactionId, { ...patch, type: patch.category === undefined ? inferFinanceExpenseType(current.category) : inferFinanceExpenseType(patch.category) });
  const verified = readTransaction(uid, transactionId);
  if (!verified || verified.id !== record.id) return { ok: false, operation: "updateTransaction", record: {}, verification: {}, error: "Database read-back failed after canonical finance update" };
  return { ok: true, operation: "updateTransaction", record: verified, verification: { persisted: true, transactionId } };
}
export function deleteTransaction(userId: string, transactionId: string): VerifiedToolResult {
  const uid = text(userId);
  const idValue = text(transactionId);
  if (!idValue) throw new Error("Transaction id is required");
  const current = readTransaction(uid, idValue);
  if (!current) throw new Error("Transaction not found for this user");
  deleteCanonicalExpense(uid, idValue);
  if (readTransaction(uid, idValue)) return { ok: false, operation: "deleteTransaction", record: {}, verification: {}, error: "Database read-back failed after canonical finance delete" };
  return { ok: true, operation: "deleteTransaction", record: current, verification: { persisted: true, deleted: true, transactionId: idValue } };
}
export function updateBudget(_userId: string, _payload: Record<string, unknown>): VerifiedToolResult {
  throw new Error("Budget mutations are read-only in Phase 5.6; use the canonical finance budget boundary when available.");
}
export function addTask(userId: string, payload: Record<string, unknown>): VerifiedToolResult {
  const uid = text(userId);
  const taskId = id("task");
  const title = text(payload.title);
  if (!title) throw new Error("Task title is required");
  db.prepare(`INSERT INTO ai_tasks (id,user_id,title,completed,priority,category,due_date,due_time,note,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(taskId, uid, title, 0, text(payload.priority, "medium"), text(payload.category, "general"), text(payload.dueDate) || null, text(payload.dueTime) || null, text(payload.note) || null, now());
  const record = readTask(uid, taskId);
  if (!record) return { ok: false, operation: "addTask", record: {}, verification: {}, error: "Database read-back failed after task insert" };
  return { ok: true, operation: "addTask", record, verification: { persisted: true, taskId } };
}

export function updateTask(userId: string, payload: Record<string, unknown>): VerifiedToolResult {
  const uid = text(userId);
  const taskId = text(payload.id);
  if (!taskId) throw new Error("Task id is required");
  const current = readTask(uid, taskId);
  if (!current) throw new Error("Task not found for this user");
  const completed = payload.completed === undefined ? Number(current.completed) : (payload.completed ? 1 : 0);
  const title = payload.title === undefined ? current.title : text(payload.title);
  const priority = payload.priority === undefined ? current.priority : text(payload.priority);
  const category = payload.category === undefined ? current.category : text(payload.category);
  const dueDate = payload.dueDate === undefined ? current.dueDate : (text(payload.dueDate) || null);
  const dueTime = payload.dueTime === undefined ? current.dueTime : (text(payload.dueTime) || null);
  const note = payload.note === undefined ? current.note : (text(payload.note) || null);
  const completedAt = completed ? (current.completedAt || now()) : null;
  db.prepare(`UPDATE ai_tasks SET title=?,completed=?,priority=?,category=?,due_date=?,due_time=?,note=?,completed_at=? WHERE id=? AND user_id=?`)
    .run(title, completed, priority, category, dueDate, dueTime, note, completedAt, taskId, uid);
  const record = readTask(uid, taskId);
  if (!record || Number(record.completed) !== completed || record.title !== title) return { ok: false, operation: "updateTask", record: {}, verification: {}, error: "Database read-back failed after task update" };
  return { ok: true, operation: "updateTask", record, verification: { persisted: true, taskId } };
}

export function executeToolAction(userId: string, action: SmartAiAction): VerifiedToolResult {
  if (!action) throw new Error("No executable action supplied");
  switch (action.type) {
    case "add_expense": return addTransaction(userId, action.payload);
    case "update_budget": return updateBudget(userId, action.payload);
    case "add_daily_task": return addTask(userId, action.payload);
    case "update_daily_task": return updateTask(userId, action.payload);
    default: throw new Error(`Unsupported tool action: ${(action as any).type}`);
  }
}
