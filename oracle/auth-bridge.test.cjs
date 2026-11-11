"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { createAuthBridge } = require("./auth-bridge.cjs");

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "smart-time-auth-bridge-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const usersFile = path.join(dir, "users.json");
  const sessionsFile = path.join(dir, "sessions.json");
  const token = crypto.randomBytes(32).toString("base64url");
  const ownerEmail = "owner@example.test";
  const user = { id: "owner-1", email: ownerEmail, name: "Owner", role: "owner", activation_status: "active", authVersion: 2 };
  const sessionKey = crypto.createHash("sha256").update(token).digest("hex");
  const session = { userId: user.id, viewAs: "owner", authVersion: 2, createdAt: 1000, expiresAt: 5000 };
  fs.writeFileSync(usersFile, JSON.stringify({ owner: user, member: { id: "user-2", email: "user@example.test", role: "user", activation_status: "active", authVersion: 0 } }));
  fs.writeFileSync(sessionsFile, JSON.stringify({ [sessionKey]: session }));
  const bridge = createAuthBridge({ usersFile, sessionsFile, ownerEmail, now: () => 2000 });
  return { bridge, token, usersFile, sessionsFile, sessionKey };
}

test("authenticates a valid token and resolves the single owner role", t => {
  const { bridge, token } = fixture(t);
  const auth = bridge.authenticateToken(token);
  assert.equal(auth.user.id, "owner-1");
  assert.equal(auth.role, "owner");
  assert.equal(auth.isOwner, true);
});

test("rejects an expired session", t => {
  const { bridge, token, usersFile, sessionsFile } = fixture(t);
  const expired = createAuthBridge({
    usersFile,
    sessionsFile,
    ownerEmail: "owner@example.test",
    now: () => 9000,
  });
  assert.equal(bridge.authenticateToken(token).user.id, "owner-1");
  assert.equal(expired.authenticateToken(token), null);
});

test("rejects a session after authVersion changes", t => {
  const { bridge, token, usersFile } = fixture(t);
  const users = JSON.parse(fs.readFileSync(usersFile, "utf8"));
  users.owner.authVersion = 3;
  fs.writeFileSync(usersFile, JSON.stringify(users));
  assert.equal(bridge.authenticateToken(token), null);
});

test("rejects inactive accounts and malformed tokens", t => {
  const { bridge, token, usersFile } = fixture(t);
  const users = JSON.parse(fs.readFileSync(usersFile, "utf8"));
  users.owner.activation_status = "suspended";
  fs.writeFileSync(usersFile, JSON.stringify(users));
  assert.equal(bridge.authenticateToken(token), null);
  assert.equal(bridge.authenticateToken("short"), null);
});

test("fails closed when owner cardinality is not exactly one", t => {
  const { bridge, token, usersFile } = fixture(t);
  fs.writeFileSync(usersFile, JSON.stringify({ member: { id: "user-2", email: "user@example.test", role: "user", activation_status: "active", authVersion: 0 } }));
  assert.throws(() => bridge.authenticateToken(token), /exactly one configured owner/);
});
