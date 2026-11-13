import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";

// Runtime gate for Batch 2 fixes, exercised against the REAL production build
// (node dist/server.cjs, NODE_ENV=production):
//   B-1   production static serving points at dist/client (vite outDir)
//   B-4   CORS regex accepts localhost/127.0.0.1 with real ports
//   B-5   RSS template-literal RegExp keeps [\\s\\S] (news fallback parses tags)
//   phase3  /api/finance/overview exists, requires auth, returns canonical data
//   catchall  unknown /api paths return 404 JSON, never HTML with 200
//
// Free-tier rule: no external service is called; GROQ_API_KEY stays empty and
// the RSS check uses a local sample document, not the network.

function fail(message) {
  throw new Error(`BATCH 2 GATE: FAIL — ${message}`);
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "smart-time-batch2-"));
const dbPath = path.join(tempDir, "smart-time.db");
const port = 39700 + Math.floor(Math.random() * 200);
const base = `http://127.0.0.1:${port}`;
const child = spawn("node", ["dist/server.cjs"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(port),
    TRIAL_MODE: "true",
    SMART_TIME_DB_PATH: dbPath,
    GROQ_API_KEY: "",
  },
  stdio: "ignore",
});

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

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  const raw = await response.text();
  let body = null;
  try { body = raw ? JSON.parse(raw) : null; } catch {}
  return { response, body, raw };
}

try {
  await waitForHealth();

  // ===== B-1: production SPA is served from dist/client =====
  const root = await request("/");
  if (root.response.status !== 200) fail(`B-1: GET / returned ${root.response.status}`);
  if (!/text\/html/i.test(root.response.headers.get("content-type") || "")) {
    fail(`B-1: GET / did not return HTML (content-type: ${root.response.headers.get("content-type")})`);
  }
  if (!/id="root"/.test(root.raw)) fail('B-1: served HTML does not look like the SPA (missing id="root")');

  const deepLink = await request("/expenses/some/deep/route");
  if (deepLink.response.status !== 200 || !/text\/html/i.test(deepLink.response.headers.get("content-type") || "")) {
    fail(`B-1: SPA fallback for deep routes broken: HTTP ${deepLink.response.status}`);
  }

  // ===== catch-all: unknown /api paths answer 404 JSON =====
  const unknownApi = await request("/api/definitely-not-a-route");
  if (unknownApi.response.status !== 404) {
    fail(`catchall: unknown /api path returned ${unknownApi.response.status} (must be 404 JSON)`);
  }
  if (unknownApi.body?.error !== "Unknown API endpoint.") {
    fail("catchall: unknown /api path did not return the JSON 404 body");
  }

  // ===== B-4: CORS accepts localhost/127.0.0.1 with real ports =====
  const corsProbe = await request("/api/health", {
    headers: { Origin: "http://localhost:5173" },
  });
  if (corsProbe.response.headers.get("access-control-allow-origin") !== "http://localhost:5173") {
    fail("B-4: CORS still rejects http://localhost:5173");
  }
  const corsProbe2 = await request("/api/health", {
    headers: { Origin: "http://127.0.0.1:3000" },
  });
  if (corsProbe2.response.headers.get("access-control-allow-origin") !== "http://127.0.0.1:3000") {
    fail("B-4: CORS still rejects http://127.0.0.1:3000");
  }
  const corsProbe3 = await request("/api/health", {
    method: "OPTIONS",
    headers: { Origin: "http://localhost:5173" },
  });
  if (corsProbe3.response.status !== 204 || corsProbe3.response.headers.get("access-control-allow-origin") !== "http://localhost:5173") {
    fail("B-4: CORS preflight for localhost:5173 failed");
  }

  // ===== finance/overview: 401 without session, 200 with session + data =====
  const anonFinance = await request("/api/finance/overview");
  if (anonFinance.response.status !== 401) {
    fail(`finance: overview accepted missing auth: HTTP ${anonFinance.response.status}`);
  }

  const reg = await request("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Batch2 User",
      username: "batch2user",
      email: "batch2user@example.com",
      password: "Password!123",
    }),
  });
  if (reg.response.status !== 200 || !reg.body?.token) {
    fail(`register: HTTP ${reg.response.status} ${reg.raw}`);
  }
  const userId = reg.body.user.id;
  const token = reg.body.token;

  const db = new DatabaseSync(dbPath);
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO finance_expenses (id, user_id, title, amount, currency, category, date, payment_method, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
  ).run(`exp_${crypto.randomUUID()}`, userId, "قهوة", 45, "EGP", "طعام وشراب", "2026-11-13", "cash", now, now);
  db.close();

  const authedFinance = await request("/api/finance/overview", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (authedFinance.response.status !== 200) {
    fail(`finance: overview rejected a valid session: HTTP ${authedFinance.response.status} ${authedFinance.raw}`);
  }
  if (authedFinance.body?.source !== "smart-time-finance-sqlite") {
    fail(`finance: unexpected source: ${authedFinance.body?.source}`);
  }
  if (!Array.isArray(authedFinance.body?.expenses) || authedFinance.body.expenses.length !== 1) {
    fail(`finance: expenses array wrong: ${JSON.stringify(authedFinance.body?.expenses)?.slice(0, 200)}`);
  }
  if (authedFinance.body.expenses[0]?.title !== "قهوة") {
    fail("finance: inserted canonical expense did not come back");
  }
  for (const key of ["monthlyIncome", "bankCertificates", "fuelRecords", "maintenanceRecords", "educationExpenses"]) {
    if (!Array.isArray(authedFinance.body?.[key])) fail(`finance: missing array ${key}`);
  }

  // ===== B-5: RSS template-literal RegExp keeps [\\s\\S] =====
  const serverSource = fs.readFileSync(new URL("../server.ts", import.meta.url), "utf8");
  const fixedSnippet = "([\\\\s\\\\S]*?)</${tag}>";   // two backslashes in the file = survives string escaping
  const degradedSnippet = "([\\s\\S]*?)</${tag}>";    // one backslash in the file = degrades to [sS] at runtime
  const fullyDegradedSnippet = ">([sS]*?)<";          // already degraded in source
  if (!serverSource.includes(fixedSnippet)) fail("B-5: fixed RSS RegExp not found in server.ts source");
  if (serverSource.includes(degradedSnippet) || serverSource.includes(fullyDegradedSnippet)) {
    fail("B-5: a broken (string-degraded) RSS RegExp variant is still present in server.ts");
  }

  // Functional check with the exact fixed pattern against a local RSS sample.
  const sampleBlock = "<item><title>خبر تجريبي &amp; اختبار</title><link>https://example.com/news/1</link><source>مصدر</source><pubDate>Fri, 13 Nov 2026 07:00:00 GMT</pubDate><description>x</description></item>";
  const items = [...sampleBlock.matchAll(/<item>([\s\S]*?)<\/item>/g)];
  if (items.length !== 1) fail("B-5: sample <item> extraction failed");
  const stripXml = (value) => value.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
  const block = items[0][1];
  const get = (tag) => stripXml(block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))?.[1] || "");
  const title = get("title");
  const url = get("link");
  if (title !== "خبر تجريبي & اختبار") fail(`B-5: title parsed as "${title}"`);
  if (url !== "https://example.com/news/1") fail(`B-5: link parsed as "${url}"`);

  console.log("BATCH 2 GATE: PASS — B-1, B-4, B-5, finance/overview, /api 404 verified (production build)");
} finally {
  child.kill("SIGTERM");
}
