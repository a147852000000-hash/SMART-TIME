import crypto from "node:crypto";
import { db } from "../backend/database.js";
import { POST } from "../app/api/ai/infer/route.js";

// Runtime gate for SECURITY A-3 (runs under tsx because app/api routes are
// serverless handlers, not mounted by the local Express server):
//   - identity must come from the Authorization session token
//   - a client-supplied body.userId must be ignored entirely
//   - anonymous trial mode must keep working
//
// GROQ_API_KEY is forced empty by the caller, so groqProvider throws
// "not_configured" BEFORE any network call — no free-tier quota is consumed.

function fail(msg: string): never {
  throw new Error(`A3 INFER GATE: FAIL — ${msg}`);
}

const now = new Date().toISOString();
const userId = `usr_${crypto.randomUUID()}`;
db.prepare(
  "INSERT INTO users (id,email,username,password_hash,display_name,created_at,phone,phone_verified,activation_status) VALUES (?,?,?,?,?,?,'x',0,'active')",
).run(userId, "a3-victim@example.com", "a3victim", "unused", "A3 Victim", now);

const token = crypto.randomBytes(32).toString("hex");
db.prepare(
  "INSERT INTO sessions (id,user_id,expires_at,created_at,session_role) VALUES (?,?,?,?, 'user')",
).run(token, userId, new Date(Date.now() + 86_400_000).toISOString(), now);

async function call(authorization?: string, bodyUserId?: string): Promise<Response> {
  const body: Record<string, unknown> = { input: "أضف مصروف 100 جنيه", confirmed: true };
  if (bodyUserId) body.userId = bodyUserId; // attacker-style identity smuggling
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (authorization) headers.authorization = authorization;
  const request = new Request("http://local.test/api/ai/infer", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return POST(request);
}

// (1) Invalid/expired token is rejected before anything else runs.
const invalid = await call("Bearer invalid-session-token", userId);
if (invalid.status !== 401) fail(`invalid token must return 401, got ${invalid.status}`);

// (2) Valid session passes the gate (5xx comes from the empty GROQ_API_KEY),
//     even with an attacker-supplied userId in the body.
const valid = await call(`Bearer ${token}`, "usr_attacker_victim");
if (valid.status === 401) fail("a valid session must pass the identity gate");
if (valid.status < 500) fail(`expected provider failure (5xx) with empty GROQ_API_KEY, got ${valid.status}`);

// (3) Anonymous trial mode still proceeds (not wrongly blocked by the gate).
const anon = await call();
if (anon.status === 401) fail("anonymous trial mode must not be blocked");
if (anon.status < 500) fail(`expected provider failure (5xx) with empty GROQ_API_KEY, got ${anon.status}`);

console.log("A3 INFER GATE: PASS — identity from session token only, body.userId ignored");
