import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";

function fail(message: string): never {
  throw new Error(`PHASE 2 DATABASE GATE: FAIL — ${message}`);
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "smart-time-phase2-"));
const dbPath = path.join(tempDir, "smart-time.db");

function boot(): Record<string, unknown> {
  const output = execFileSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["tsx", "backend/database.phase2.probe.ts"],
    {
      cwd: process.cwd(),
      env: { ...process.env, SMART_TIME_DB_PATH: dbPath },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  ).trim();

  try {
    return JSON.parse(output) as Record<string, unknown>;
  } catch {
    fail(`database boot probe returned invalid JSON: ${output}`);
  }
}

try {
  const firstBoot = boot();
  const secondBoot = boot();

  if (firstBoot.integrity_check !== "ok" || secondBoot.integrity_check !== "ok") {
    fail("database integrity check did not return ok on both boots");
  }

  if (firstBoot.table_count !== secondBoot.table_count) {
    fail(`non-idempotent boot changed table count: ${firstBoot.table_count} -> ${secondBoot.table_count}`);
  }

  const db = new DatabaseSync(dbPath);

  const expectedTables = [
    "service_status",
    "api_cache",
    "users",
    "sessions",
    "trip_gift_claims",
    "conversations",
    "conversation_members",
    "messages",
    "saved_messages",
    "message_reads",
    "ride_requests",
    "ride_quotes",
    "voice_dna_profiles",
    "voice_dna_public_keys",
    "voice_dna_sync_packages",
    "voice_dna_recovery_envelopes",
    "voice_dna_recovery_samples",
    "voice_dna_shares",
    "phone_otps",
    "password_resets",
    "wallet_topups",
    "wallet_transactions",
    "wallet_admin_actions",
    "ai_transactions",
    "ai_budgets",
    "ai_tasks",
    "ai_events",
    "ai_event_reminders",
    "finance_expenses",
    "finance_monthly_income",
    "finance_bank_certificates",
    "finance_fuel_records",
    "finance_maintenance_records",
    "finance_education_expenses",
  ];

  const actualTables = new Set(
    (db.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    `).all() as Array<{ name: string }>).map((row) => row.name),
  );

  const missingTables = expectedTables.filter((table) => !actualTables.has(table));
  if (missingTables.length) {
    fail(`missing expected tables: ${missingTables.join(", ")}`);
  }

  const canonicalIndexes = [
    "idx_ai_transactions_user_date",
    "idx_ai_tasks_user",
    "idx_ai_events_user_start",
    "idx_ai_events_user_end",
    "idx_ai_events_reminders",
    "idx_finance_expenses_user_date",
    "idx_finance_income_user_month",
    "idx_finance_certificates_user_maturity",
    "idx_finance_fuel_user_vehicle_date",
    "idx_finance_maintenance_user_vehicle_date",
    "idx_finance_education_user_student_date",
  ];

  const actualIndexes = new Set(
    (db.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'index'
    `).all() as Array<{ name: string }>).map((row) => row.name),
  );

  const missingIndexes = canonicalIndexes.filter((index) => !actualIndexes.has(index));
  if (missingIndexes.length) {
    fail(`missing canonical indexes: ${missingIndexes.join(", ")}`);
  }

  const canarySuffix = `phase2-${Date.now()}`;

  db.exec("BEGIN");
  try {
    db.prepare(`
      INSERT INTO ai_transactions
        (id, user_id, title, amount, category, date, payment_method, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      canarySuffix,
      "phase2-test-user",
      "Phase 2 canary",
      123.45,
      "test",
      "2026-10-01",
      "cash",
      "integrity",
      "2026-10-01T00:00:00.000Z",
    );

    db.prepare(`
      INSERT INTO ai_tasks
        (id, user_id, title, completed, priority, category, due_date, due_time, note, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      canarySuffix,
      "phase2-test-user",
      "Phase 2 task",
      0,
      "medium",
      "test",
      "2026-10-02",
      "10:00",
      "integrity",
      "2026-10-01T00:00:00.000Z",
    );

    db.prepare(`
      INSERT INTO ai_events
        (id, user_id, title, start_at, timezone, category, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      canarySuffix,
      "phase2-test-user",
      "Phase 2 event",
      "2026-10-03T10:00:00.000Z",
      "Africa/Cairo",
      "test",
      "2026-10-01T00:00:00.000Z",
      "2026-10-01T00:00:00.000Z",
    );

    db.prepare(`
      INSERT INTO finance_expenses
        (id, user_id, title, amount, currency, category, date, payment_method, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      canarySuffix,
      "phase2-test-user",
      "Phase 2 expense",
      222.22,
      "EGP",
      "test",
      "2026-10-01",
      "cash",
      "2026-10-01T00:00:00.000Z",
      "2026-10-01T00:00:00.000Z",
    );

    db.prepare(`
      INSERT INTO finance_monthly_income
        (id, user_id, month, salary, bonuses, other_income, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      canarySuffix,
      "phase2-test-user",
      "2026-10",
      10000,
      500,
      250,
      "2026-10-01T00:00:00.000Z",
      "2026-10-01T00:00:00.000Z",
    );

    db.prepare(`
      INSERT INTO ai_budgets
        (user_id, monthly_limit, currency, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(
      "phase2-test-user",
      5000,
      "EGP",
      "2026-10-01T00:00:00.000Z",
    );

    const checks = [
      db.prepare("SELECT amount FROM ai_transactions WHERE id = ?").get(canarySuffix),
      db.prepare("SELECT due_date FROM ai_tasks WHERE id = ?").get(canarySuffix),
      db.prepare("SELECT timezone FROM ai_events WHERE id = ?").get(canarySuffix),
      db.prepare("SELECT amount FROM finance_expenses WHERE id = ?").get(canarySuffix),
      db.prepare("SELECT salary FROM finance_monthly_income WHERE id = ?").get(canarySuffix),
      db.prepare("SELECT monthly_limit FROM ai_budgets WHERE user_id = ?").get("phase2-test-user"),
    ];

    if (checks.some((row) => !row)) {
      fail("one or more canonical write/read canaries failed");
    }

    db.exec("ROLLBACK");
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch {}
    throw error;
  }

  const integrity = db.prepare("PRAGMA integrity_check").get() as { integrity_check: string };
  if (integrity.integrity_check !== "ok") {
    fail(`post-canary integrity_check=${integrity.integrity_check}`);
  }

  const rollbackRows = [
    db.prepare("SELECT 1 AS found FROM ai_transactions WHERE id = ?").get(canarySuffix),
    db.prepare("SELECT 1 AS found FROM ai_tasks WHERE id = ?").get(canarySuffix),
    db.prepare("SELECT 1 AS found FROM ai_events WHERE id = ?").get(canarySuffix),
    db.prepare("SELECT 1 AS found FROM finance_expenses WHERE id = ?").get(canarySuffix),
    db.prepare("SELECT 1 AS found FROM finance_monthly_income WHERE id = ?").get(canarySuffix),
    db.prepare("SELECT 1 AS found FROM ai_budgets WHERE user_id = ?").get("phase2-test-user"),
  ];

  if (rollbackRows.some((row) => row)) {
    fail("transaction rollback did not remove phase2 canary rows");
  }

  db.close();
  console.log("PHASE 2 DATABASE GATE: PASS");
  console.log(`tables: ${actualTables.size}`);
  console.log("idempotent boot: PASS");
  console.log("canonical indexes: PASS");
  console.log("read/write canaries: PASS");
  console.log("rollback: PASS");
  console.log("integrity_check: PASS");
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
