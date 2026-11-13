#!/usr/bin/env node
/**
 * Batch 5 runtime gate — B-2, B-7, B-10, B-12, B-14.
 *
 * Spawns the real server (temp DB, GROQ_API_KEY empty, NODE_ENV=test) in
 * three configurations and runs tsx module scenarios for the seed-data and
 * Quran de-fabrication changes. No external service quota is consumed:
 * the GNews probe uses a deliberately invalid key, RapidAPI/Football keys
 * are absent, and the Turnstile missing-token path short-circuits before
 * any network call.
 */
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let failures = 0;

// Global watchdog: never let the gate hang the whole pipeline.
const watchdog = setTimeout(() => {
  console.log('FAIL watchdog timeout (240s) — a request or boot hung');
  process.exit(1);
}, 240_000);

function fetchT(url, init = {}) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
}

function check(condition, label) {
  if (condition) console.log(`PASS ${label}`);
  else {
    failures += 1;
    console.log(`FAIL ${label}`);
  }
}

let nextPort = 46391;

async function startServer(extraEnv = {}) {
  nextPort += 1;
  const port = String(nextPort);
  const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'batch5-')), 'db.sqlite');
  const child = spawn('npx', ['tsx', 'server.ts'], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      TRIAL_MODE: 'true',
      PORT: port,
      SMART_TIME_DB_PATH: dbPath,
      GROQ_API_KEY: '',
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const logs = [];
  const collect = (data) => logs.push(String(data));
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);

  // Wait (up to 20s) for the boot line; the configured port is the bound port.
  const bound = await new Promise((resolve) => {
    const started = Date.now();
    const timer = setInterval(() => {
      const text = logs.join('');
      if (text.includes(`0.0.0.0:${port}`)) {
        clearInterval(timer);
        resolve(Number(port));
      } else if (Date.now() - started > 20_000) {
        clearInterval(timer);
        resolve(null);
      }
    }, 150);
  });
  return {
    port: bound,
    logs: () => logs.join(''),
    stop: () => { try { child.kill('SIGKILL'); } catch {} },
  };
}

async function withServer(extraEnv, fn) {
  const server = await startServer(extraEnv);
  try {
    if (server.port === null) {
      console.log('--- server boot log ---');
      console.log(server.logs().slice(-1500));
      check(false, `server with ${JSON.stringify(extraEnv)} failed to boot`);
      return;
    }
    await fn(`http://127.0.0.1:${server.port}`, server);
  } finally {
    server.stop();
  }
}

async function getTrialToken(base) {
  const res = await fetchT(`${base}/api/trial/session`);
  const body = await res.json().catch(() => ({}));
  return body?.token || body?.session?.token || null;
}

// ---------------------------------------------------------------------------
// 1. tsx module scenarios: seed data neutrality (B-14) + Quran integrity (B-10)
// ---------------------------------------------------------------------------
console.log('== Seed data & Quran module scenarios (tsx) ==');
const scenarioRun = spawnSync('npx', ['tsx', 'scripts/test-batch5-scenarios.mts'], {
  cwd: ROOT,
  encoding: 'utf8',
  env: { ...process.env, NODE_ENV: 'test' },
});
const scenarioOutput = `${scenarioRun.stdout || ''}${scenarioRun.stderr || ''}`;
console.log(scenarioOutput.trim());
if (scenarioRun.status !== 0) failures += 1;
check(scenarioOutput.includes('BATCH5 MODULE SCENARIOS: PASS'), 'seed/quran module scenarios gate');

// ---------------------------------------------------------------------------
// 2. Server matrix
// ---------------------------------------------------------------------------
console.log('\n== Server matrices ==');

// --- Config A: no captcha, no paid keys --------------------------------------
await withServer({}, async (baseA) => {
  // B-2: without TURNSTILE_SECRET_KEY the login flow must not be blocked.
  const loginRes = await fetchT(`${baseA}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'nobody@example.com', password: 'wrong-password' }),
  });
  const loginBody = await loginRes.json().catch(() => ({}));
  check(
    loginRes.status === 401 && !String(loginBody.error || '').includes('Turnstile'),
    `B-2 login without captcha when secret unset -> credential error, not captcha (${loginRes.status})`
  );

  // B-2: register also skips captcha when unconfigured (bad input, not captcha).
  const regRes = await fetchT(`${baseA}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'x', username: 'x', email: 'bad', password: 'short' }),
  });
  const regBody = await regRes.json().catch(() => ({}));
  check(
    regRes.status >= 400 && !String(regBody.error || '').includes('Turnstile'),
    `B-2 register without captcha when secret unset -> validation error, not captcha (${regRes.status})`
  );

  // B-7: anonymous callers are rejected on quota-burning endpoints.
  const exAnon = await fetchT(`${baseA}/api/sports/exercises`);
  check(exAnon.status === 401, `B-7 anonymous /api/sports/exercises -> 401 (${exAnon.status})`);

  const sportsAnon = await fetchT(`${baseA}/api/live/sports`);
  check(sportsAnon.status === 401, `B-7 anonymous /api/live/sports -> 401 (${sportsAnon.status})`);

  // A signed-in session (trial session = real token) passes the auth gate;
  // the next error is the missing provider key, NOT the auth gate.
  const token = await getTrialToken(baseA);
  check(Boolean(token), 'trial session returns a real token');

  if (token) {
    const exAuth = await fetchT(`${baseA}/api/sports/exercises`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    check(exAuth.status === 503, `B-7 authed /api/sports/exercises passes gate -> 503 key missing (${exAuth.status})`);

    const sportsAuth = await fetchT(`${baseA}/api/live/sports`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const sportsBody = await sportsAuth.json().catch(() => ({}));
    check(
      sportsAuth.status === 200 && sportsBody.source === 'unconfigured',
      `B-7 authed /api/live/sports passes gate -> 200 unconfigured (${sportsAuth.status})`
    );

    const newsAuth = await fetchT(`${baseA}/api/live/news?lang=ar`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const newsBody = await newsAuth.json().catch(() => ({}));
    check(
      newsAuth.status === 200 && newsBody.source === 'google-news-rss',
      `news stays public with RSS fallback when GNews key absent (${newsAuth.status}, ${newsBody.source})`
    );
  }
});

// --- Config B: GNEWS_API_KEY set (invalid dummy) -----------------------------
await withServer({ GNEWS_API_KEY: 'dummy-invalid-key-batch5' }, async (baseB) => {
  const anonNews = await fetchT(`${baseB}/api/live/news?lang=ar`);
  const anonBody = await anonNews.json().catch(() => ({}));
  check(
    String(anonBody.source || '') !== 'gnews',
    `B-7 anonymous news NEVER touches the GNews key (source=${anonBody.source})`
  );
  const tokenB = await getTrialToken(baseB);
  if (tokenB) {
    const authNews = await fetchT(`${baseB}/api/live/news?lang=ar`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const authBody = await authNews.json().catch(() => ({}));
    // Dummy key is rejected by GNews -> RSS fallback; proves the branch is
    // reachable for sessions without consuming any real quota.
    check(
      String(authBody.source || '') === 'google-news-rss' && authBody.configured === true,
      `B-7 authed news tries GNews then falls back to RSS (source=${authBody.source}, configured=${authBody.configured})`
    );
  }
});

// --- Config C: TURNSTILE_SECRET_KEY set --------------------------------------
await withServer({ TURNSTILE_SECRET_KEY: 'dummy-secret-batch5' }, async (baseC, server) => {
  const noToken = await fetchT(`${baseC}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'nobody@example.com', password: 'wrong-password' }),
  });
  const noTokenBody = await noToken.json().catch(() => ({}));
  check(
    noToken.status === 400 && String(noTokenBody.error || '').includes('Turnstile'),
    `B-2 login without token when secret set -> 400 captcha (${noToken.status})`
  );
  const regNoToken = await fetchT(`${baseC}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'test', username: 'test', email: 'a@b.com', password: 'longenough1' }),
  });
  check(regNoToken.status === 400, `B-2 register without token when secret set -> 400 (${regNoToken.status})`);
  check(!server.logs().includes('غير مضبوط'), 'no "captcha disabled" warning when secret is set');
});

console.log('');
console.log(failures === 0 ? 'BATCH 5 GATE: PASS' : `BATCH 5 GATE: FAIL (${failures})`);
clearTimeout(watchdog);
if (failures > 0) process.exit(1);
