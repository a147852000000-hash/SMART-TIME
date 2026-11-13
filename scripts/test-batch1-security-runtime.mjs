import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import WebSocket from "ws";

// Runtime gate for Batch 1 critical security fixes:
//   A-1  WebSocket join_room requires an authenticated user with conversation access
//   A-2  GET /api/chat/users requires a session and never exposes phone numbers
//   A-3  /api/ai/infer resolves identity from the session token, never from body.userId
//
// Free-tier rule: GROQ_API_KEY is forced empty so no external AI quota is consumed;
// the infer checks only exercise the identity gate and the fast local provider failure.

function fail(message) {
  throw new Error(`BATCH 1 SECURITY GATE: FAIL — ${message}`);
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "smart-time-batch1-"));
const dbPath = path.join(tempDir, "smart-time.db");
const port = 39200 + Math.floor(Math.random() * 500);
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
      GROQ_API_KEY: "",
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

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  const raw = await response.text();
  let body = null;
  try { body = raw ? JSON.parse(raw) : null; } catch {}
  return { response, body, raw };
}

function wsConnect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    ws.on("open", () => resolve(ws));
    ws.on("error", reject);
  });
}

function wsSend(ws, type, payload) {
  ws.send(JSON.stringify({ type, payload }));
}

function wsNext(ws, matchType, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${matchType}`)), timeoutMs);
    const onData = (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (msg?.type === matchType) {
        clearTimeout(timer);
        ws.off("message", onData);
        resolve(msg);
      }
    };
    ws.on("message", onData);
  });
}

try {
  await waitForHealth();

  async function register(n) {
    const reg = await request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `Batch1 User ${n}`,
        username: `batch1user${n}`,
        email: `batch1user${n}@example.com`,
        password: "Password!123",
      }),
    });
    if (reg.response.status !== 200 || !reg.body?.token) {
      fail(`register user${n}: HTTP ${reg.response.status} ${reg.raw}`);
    }
    return { token: reg.body.token, id: reg.body.user.id };
  }
  const u1 = await register(1);
  const u2 = await register(2);
  const u3 = await register(3);

  // ===== A-2: /api/chat/users =====
  const anonUsers = await request("/api/chat/users");
  if (anonUsers.response.status !== 401) {
    fail(`A-2: /api/chat/users accepted anonymous access: HTTP ${anonUsers.response.status}`);
  }

  const authedUsers = await request("/api/chat/users", {
    headers: { Authorization: `Bearer ${u1.token}` },
  });
  if (authedUsers.response.status !== 200) {
    fail(`A-2: /api/chat/users rejected a valid session: HTTP ${authedUsers.response.status}`);
  }
  if (!Array.isArray(authedUsers.body?.users) || authedUsers.body.users.length < 3) {
    fail("A-2: user directory did not list the registered users");
  }
  for (const u of authedUsers.body.users) {
    if ("phone" in u) fail(`A-2: directory still exposes a phone field for user ${u.id}`);
  }

  // ===== A-1: WebSocket join_room access control =====
  const wsUrl = `ws://127.0.0.1:${port}/ws/chat`;

  // (1) Anonymous socket cannot join any room.
  const anonWs = await wsConnect(wsUrl);
  wsSend(anonWs, "join_room", { roomId: "room_somewhere" });
  const anonErr = await wsNext(anonWs, "room_error");
  if (anonErr.payload?.roomId !== "room_somewhere") {
    fail("A-1: anonymous join did not target the requested room");
  }
  anonWs.close();

  // (2) A stranger cannot join a direct conversation they are not a member of.
  const room = await request("/api/chat/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${u1.token}` },
    body: JSON.stringify({ title: "Direct U1-U3", type: "direct", memberIds: [u3.id] }),
  });
  if (room.response.status !== 200 || !room.body?.roomId) {
    fail(`direct room create failed: HTTP ${room.response.status} ${room.raw}`);
  }
  const directRoomId = room.body.roomId;

  const strangerWs = await wsConnect(wsUrl);
  wsSend(strangerWs, "auth", { token: u2.token });
  await wsNext(strangerWs, "auth_success");
  wsSend(strangerWs, "join_room", { roomId: directRoomId });
  const strangerErr = await wsNext(strangerWs, "room_error");
  if (strangerErr.payload?.roomId !== directRoomId) {
    fail("A-1: stranger rejection did not target the direct room");
  }
  strangerWs.close();

  // (3) A legitimate member still joins their own direct conversation.
  const memberWs = await wsConnect(wsUrl);
  wsSend(memberWs, "auth", { token: u3.token });
  await wsNext(memberWs, "auth_success");
  wsSend(memberWs, "join_room", { roomId: directRoomId });
  const joined = await wsNext(memberWs, "joined_room");
  if (joined.payload?.roomId !== directRoomId) {
    fail("A-1: legitimate member could not join their direct room");
  }
  memberWs.close();

  // (4) Public rooms stay open to every authenticated non-banned user.
  const pub = await request("/api/chat/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${u1.token}` },
    body: JSON.stringify({ title: "Public Hall", type: "public" }),
  });
  if (pub.response.status !== 200 || !pub.body?.roomId) {
    fail(`public room create failed: HTTP ${pub.response.status} ${pub.raw}`);
  }
  const publicWs = await wsConnect(wsUrl);
  wsSend(publicWs, "auth", { token: u2.token });
  await wsNext(publicWs, "auth_success");
  wsSend(publicWs, "join_room", { roomId: pub.body.roomId });
  await wsNext(publicWs, "joined_room");
  publicWs.close();

  // ===== A-3: /api/ai/infer identity gate =====
  // The app/api handlers are serverless routes, not mounted by the local
  // Express server (a direct HTTP call here would 404), so the identity gate
  // is exercised directly against the route module by a tsx child process.
  // GROQ_API_KEY stays empty there, so no free-tier AI quota is consumed.
  const a3 = spawn(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["tsx", "scripts/test-a3-infer-gate.mts"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: "test",
        SMART_TIME_DB_PATH: path.join(tempDir, "a3-infer.db"),
        GROQ_API_KEY: "",
      },
      stdio: "inherit",
    },
  );
  const a3Code = await new Promise((resolve) => a3.on("close", resolve));
  if (a3Code !== 0) fail(`A-3: infer identity gate child test exited with ${a3Code}`);

  // Static assertion: a client-supplied userId is never read anymore.
  const routeSource = fs.readFileSync(
    new URL("../app/api/ai/infer/route.ts", import.meta.url),
    "utf8",
  );
  if (/body\?\.userId|body\.userId/.test(routeSource)) {
    fail("A-3: route still reads a client-supplied userId");
  }

  console.log("BATCH 1 SECURITY GATE: PASS — A-1, A-2, A-3 verified at runtime");
} finally {
  child.kill("SIGTERM");
}
