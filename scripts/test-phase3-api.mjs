import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

function fail(message) {
  throw new Error(`PHASE 3 API GATE: FAIL — ${message}`);
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "smart-time-phase3-"));
const dbPath = path.join(tempDir, "smart-time.db");
const port = 39000 + Math.floor(Math.random() * 1000);
const base = `http://127.0.0.1:${port}`;
const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["tsx", "server.ts"],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      TRIAL_MODE: "true",
      SMART_TIME_DB_PATH: dbPath,
    },
    stdio: "ignore",
  },
);

async function waitForHealth() {
  const deadline = Date.now() + 25_000;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  fail(`server did not become healthy: ${lastError}`);
}

async function request(path, options) {
  const response = await fetch(`${base}${path}`, options);
  const raw = await response.text();
  let body = null;
  try { body = raw ? JSON.parse(raw) : null; } catch {}
  return { response, body, raw };
}

try {
  await waitForHealth();

  const health = await request("/api/health");
  if (health.response.status !== 200 || health.body?.status !== "ok") {
    fail(`/api/health unexpected response: ${health.response.status} ${health.raw}`);
  }

  const dbHealth = await request("/api/database/health");
  if (dbHealth.response.status !== 200 || dbHealth.body?.status !== "LIVE") {
    fail(`/api/database/health unexpected response: ${dbHealth.response.status} ${dbHealth.raw}`);
  }

  const unauthorizedStatus = await request("/api/ai/status");
  if (unauthorizedStatus.response.status !== 401) {
    fail(`protected /api/ai/status accepted missing auth: HTTP ${unauthorizedStatus.response.status}`);
  }

  const unauthorizedFinance = await request("/api/finance/overview");
  if (unauthorizedFinance.response.status !== 401) {
    fail(`protected /api/finance/overview accepted missing auth: HTTP ${unauthorizedFinance.response.status}`);
  }

  const trial = await request("/api/trial/session");
  if (trial.response.status !== 200 || !trial.body?.token || trial.body?.user?.id !== "smart-time-trial-user") {
    fail(`/api/trial/session failed: ${trial.response.status} ${trial.raw}`);
  }

  const token = trial.body.token;
  const authHeaders = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const aiStatus = await request("/api/ai/status", { headers: authHeaders });
  if (aiStatus.response.status !== 200 || aiStatus.body?.provider !== "smart-ai") {
    fail(`authorized /api/ai/status failed: ${aiStatus.response.status} ${aiStatus.raw}`);
  }

  const chat = await request("/api/ai/chat", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      language: "ar",
      message: "ايه حالتي؟",
      appContext: {
        profile: { timezone: "Africa/Cairo" },
        finances: {},
        tasks: [],
        calendar: [],
      },
    }),
  });
  if (chat.response.status !== 200 || !chat.body?.reply) {
    fail(`/api/ai/chat failed: ${chat.response.status} ${chat.raw}`);
  }

  const expense = await request("/api/finance/expenses", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      type: "personal",
      title: "Phase 3 API smoke",
      amount: 17.5,
      category: "test",
      date: "2026-10-01",
      paymentMethod: "cash",
      notes: "phase3-api-gate",
    }),
  });
  if (expense.response.status !== 201 || !expense.body?.record?.id) {
    fail(`/api/finance/expenses create failed: ${expense.response.status} ${expense.raw}`);
  }

  const expenseId = String(expense.body.record.id);
  const state = await request("/api/ai/state", { headers: authHeaders });
  if (state.response.status !== 200) {
    fail(`/api/ai/state failed: ${state.response.status} ${state.raw}`);
  }

  const found = Array.isArray(state.body?.transactions)
    && state.body.transactions.some((item) => String(item.id) === expenseId && Number(item.amount) === 17.5);
  if (!found) {
    fail("finance expense was created but not visible through /api/ai/state read-back");
  }

  const deleted = await request(`/api/finance/expenses/${encodeURIComponent(expenseId)}`, {
    method: "DELETE",
    headers: authHeaders,
  });
  if (deleted.response.status !== 200 || deleted.body?.deleted !== true) {
    fail(`/api/finance/expenses DELETE failed: ${deleted.response.status} ${deleted.raw}`);
  }

  const stateAfterDelete = await request("/api/ai/state", { headers: authHeaders });
  if (stateAfterDelete.response.status !== 200) {
    fail(`post-delete /api/ai/state failed: ${stateAfterDelete.response.status} ${stateAfterDelete.raw}`);
  }
  const stillFound = Array.isArray(stateAfterDelete.body?.transactions)
    && stateAfterDelete.body.transactions.some((item) => String(item.id) === expenseId);
  if (stillFound) {
    fail("deleted finance expense is still returned by /api/ai/state");
  }

  console.log("PHASE 3 API GATE: PASS");
  console.log("health: PASS");
  console.log("database health: PASS");
  console.log("auth boundaries: PASS");
  console.log("AI status/chat: PASS");
  console.log("finance create -> state read-back -> delete: PASS");
} finally {
  child.kill("SIGTERM");
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 3000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
  fs.rmSync(tempDir, { recursive: true, force: true });
}
