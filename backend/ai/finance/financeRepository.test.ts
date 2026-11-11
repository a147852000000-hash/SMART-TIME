import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "smart-time-finance-migration-"));
process.env.SMART_TIME_DB_PATH = path.join(tempDir, "finance-test.sqlite");

let db: any;
try {
  ({ db } = await import("../../database.js"));
  const { getFinanceOverview } = await import("./financeProjection.js");
  const { migrateLegacyExpensesToCanonical } = await import("./financeRepository.js");

  const result = migrateLegacyExpensesToCanonical("finance-test-user", [{
    type: "medical",
    title: "Clinic visit",
    amount: 125,
    category: "doctor",
    date: "2026-11-11",
    paymentMethod: "cash",
  }]);

  assert.equal(result.inserted, 1);
  assert.equal(result.verified, 1);
  assert.equal(result.verificationPassed, true);
  assert.equal(result.records.length, 1);
  const generatedId = result.records[0].targetId;
  assert.match(generatedId, /^legacy_/);

  const persisted = db.prepare(
    "SELECT id, expense_type FROM finance_expenses WHERE user_id=? AND id=?"
  ).get("finance-test-user", generatedId) as { id: string; expense_type: string } | undefined;
  assert.ok(persisted, "missing source IDs must still persist under a generated canonical ID");
  assert.equal(persisted.expense_type, "medical");

  const overview = getFinanceOverview("finance-test-user");
  assert.equal((overview.expenses[0] as any).type, "medical", "finance overview must expose the canonical expense type");

  const withId = migrateLegacyExpensesToCanonical("finance-test-user", [{
    id: "legacy-source-42",
    type: "work",
    title: "Office supplies",
    amount: 35,
    category: "office",
    date: "2026-11-10",
    paymentMethod: "cash",
  }]);
  assert.equal(withId.inserted, 1);
  assert.equal(withId.records[0].targetId, "legacy-source-42");

  process.stdout.write("Finance migration tests passed.\n");
} finally {
  try { db?.close(); } catch {}
  fs.rmSync(tempDir, { recursive: true, force: true });
}
