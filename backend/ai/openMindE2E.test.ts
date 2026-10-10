import crypto from "node:crypto";
import { db } from "../database.js";
import { executeToolAction } from "./toolExecutor.js";
import { runOpenMindBrain } from "./openMindBrain.js";

const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const userId = `e2e_${crypto.randomUUID()}`;

try {
  let budgetMutationBlocked = false;
  try {
    executeToolAction(userId, { type: "update_budget", payload: { monthlyLimit: 5000, currency: "EGP" } });
  } catch (error) {
    budgetMutationBlocked = error instanceof Error &&
      error.message === "Budget mutations are read-only in Phase 5.6; use the canonical finance budget boundary when available.";
  }
  assert(budgetMutationBlocked, "legacy budget mutation must remain blocked by the Phase 5.6 guard");

  const first = await runOpenMindBrain({
    message: "صرفت 300 جنيه بنزين النهاردة",
    language: "ar",
    appContext: {},
    userId,
    confirmed: false,
  });
  assert(first.requiresConfirmation === true, "first turn must request confirmation");
  assert(first.action?.type === "add_expense", "first turn must produce an add_expense action");

  const second = await runOpenMindBrain({
    message: "صرفت 300 جنيه بنزين النهاردة",
    language: "ar",
    appContext: {},
    userId,
    confirmed: true,
  });
  assert(second.execution?.ok === true, "confirmed execution must succeed");
  assert((second.execution?.verification as any)?.persisted === true, "read-back verification must be true");
  assert(second.reply.includes("300"), "final reply must contain the verified amount");

  const row = db.prepare("SELECT amount,title FROM finance_expenses WHERE user_id = ? ORDER BY created_at DESC LIMIT 1").get(userId) as any;
  assert(row?.amount === 300 && row?.title === "بنزين", "canonical finance database read-back must contain the exact transaction");

  console.log("OPEN MIND E2E transaction scenario passed");
} finally {
  db.prepare("DELETE FROM finance_expenses WHERE user_id = ?").run(userId);
}
