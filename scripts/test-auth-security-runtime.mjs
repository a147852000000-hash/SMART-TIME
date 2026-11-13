import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import net from 'node:net';
import { DatabaseSync } from 'node:sqlite';

const root = process.cwd();
const tempDir = mkdtempSync(path.join(os.tmpdir(), 'smart-time-auth-test-'));
const dbPath = path.join(tempDir, 'auth-test.db');
let child;
let output = '';
let server;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const testResetSecret = 'test-only-secret-for-password-reset-hmac-2026-11';

async function freePort() {
  return await new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const port = socket.address().port;
      socket.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForServer(url) {
  for (let i = 0; i < 120; i++) {
    if (child.exitCode !== null) throw new Error(`Auth test server exited early.\n${output}`);
    try {
      const response = await fetch(`${url}/api/auth/me`);
      if (response.status === 401) return;
    } catch {}
    await sleep(250);
  }
  throw new Error(`Auth test server did not become ready.\n${output}`);
}

function passwordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}

async function request(url, route, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${url}${route}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

try {
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(port),
      SMART_TIME_DB_PATH: dbPath,
      TRIAL_MODE: 'false',
      SMS_PROVIDER: '',
      SMTP_HOST: '',
      SMTP_USER: '',
      SMTP_PASS: '',
      PASSWORD_RESET_HMAC_SECRET: testResetSecret,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  await waitForServer(baseUrl);

  const db = new DatabaseSync(dbPath);
  const now = new Date().toISOString();
  const ownerEmail = 'eng.mamdouh2009@gmail.com';
  const ownerPassword = 'Owner-Role-Test-Password-Only';
  const userPassword = 'Regular-User-Test-Password';
  const ownerId = 'auth-test-owner';
  const userId = 'auth-test-user';
  db.prepare(`INSERT INTO users (id,email,username,password_hash,display_name,created_at,phone_verified,activation_status,role)
    VALUES (?,?,?,?,?,?,0,'pending','user')`).run(ownerId, ownerEmail, 'auth_test_owner', passwordHash(ownerPassword), 'Auth Test Owner', now);
  db.prepare(`INSERT INTO users (id,email,username,password_hash,display_name,created_at,phone_verified,activation_status,role)
    VALUES (?,?,?,?,?,?,0,'pending','user')`).run(userId, 'auth-test-user@example.invalid', 'auth_test_user', passwordHash(userPassword), 'Auth Test User', now);

  const reserved = await request(baseUrl, '/api/auth/register', {
    method: 'POST',
    body: { name: 'Reserved Owner', username: 'reserved_owner', email: ownerEmail, password: 'Another-Password-123' },
  });
  assert.equal(reserved.status, 403, 'public registration must reserve the configured owner email');
  assert.equal(reserved.data.code, 'OWNER_EMAIL_RESERVED');

  const ownerLogin = await request(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: { identifier: ownerEmail, password: ownerPassword, role: 'admin' },
  });
  assert.equal(ownerLogin.status, 200);
  assert.equal(ownerLogin.data.requiresRoleChoice, true, 'owner must receive role choice even if client asks for a role');
  assert.ok(ownerLogin.data.roleChoiceTicket);
  const ticket = ownerLogin.data.roleChoiceTicket;

  const ticketAsSession = await request(baseUrl, '/api/auth/me', { token: ticket });
  assert.equal(ticketAsSession.status, 401, 'role-choice ticket must not authenticate ordinary API requests');

  const ownerSelection = await request(baseUrl, '/api/auth/select-role', {
    method: 'POST',
    token: ticket,
    body: { roleChoiceTicket: ticket, role: 'owner' },
  });
  assert.equal(ownerSelection.status, 200);
  assert.equal(ownerSelection.data.user.role, 'owner');
  const ownerToken = ownerSelection.data.token;

  const replay = await request(baseUrl, '/api/auth/select-role', {
    method: 'POST',
    token: ticket,
    body: { roleChoiceTicket: ticket, role: 'owner' },
  });
  assert.equal(replay.status, 401, 'role-choice ticket must be one-time');

  const ownerList = await request(baseUrl, '/api/owner/admins', { token: ownerToken });
  assert.equal(ownerList.status, 200);
  assert.ok(Array.isArray(ownerList.data.users));

  const activation = await request(baseUrl, '/api/auth/owner/activate', {
    method: 'POST',
    token: ownerToken,
    body: { userEmail: 'auth-test-user@example.invalid' },
  });
  assert.equal(activation.status, 200, 'only the authenticated owner session should activate accounts');

  const userLogin = await request(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: { identifier: 'auth_test_user', password: userPassword, role: 'owner' },
  });
  assert.equal(userLogin.status, 200);
  assert.equal(userLogin.data.user.role, 'user', 'a client-supplied role must not elevate a regular account');
  const userToken = userLogin.data.token;

  const forbiddenList = await request(baseUrl, '/api/owner/admins', { token: userToken });
  assert.equal(forbiddenList.status, 403);
  const forbiddenActivation = await request(baseUrl, '/api/auth/owner/activate', {
    method: 'POST',
    token: userToken,
    body: { userEmail: 'auth-test-user@example.invalid' },
  });
  assert.equal(forbiddenActivation.status, 403);

  const assign = await request(baseUrl, `/api/owner/admins/${userId}`, {
    method: 'PATCH',
    token: ownerToken,
    body: { action: 'assign' },
  });
  assert.equal(assign.status, 200);
  assert.equal(assign.data.role, 'admin');

  const adminLogin = await request(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: { identifier: 'auth_test_user', password: userPassword },
  });
  assert.equal(adminLogin.status, 200);
  assert.equal(adminLogin.data.user.role, 'admin');
  const adminForbidden = await request(baseUrl, '/api/owner/admins', { token: adminLogin.data.token });
  assert.equal(adminForbidden.status, 403, 'admin must not gain owner-only APIs');

  const remove = await request(baseUrl, `/api/owner/admins/${userId}`, {
    method: 'PATCH',
    token: ownerToken,
    body: { action: 'remove' },
  });
  assert.equal(remove.status, 200);
  assert.equal(remove.data.role, 'user');

  const userCannotAssign = await request(baseUrl, `/api/owner/admins/${userId}`, {
    method: 'PATCH',
    token: userToken,
    body: { action: 'assign' },
  });
  assert.equal(userCannotAssign.status, 403);

  const expiringLogin = await request(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: { identifier: ownerEmail, password: ownerPassword },
  });
  assert.equal(expiringLogin.data.requiresRoleChoice, true);
  db.prepare('UPDATE sessions SET expires_at=? WHERE id=?').run(new Date(Date.now() - 1000).toISOString(), expiringLogin.data.roleChoiceTicket);
  const expiredSelection = await request(baseUrl, '/api/auth/select-role', {
    method: 'POST',
    token: expiringLogin.data.roleChoiceTicket,
    body: { roleChoiceTicket: expiringLogin.data.roleChoiceTicket, role: 'owner' },
  });
  assert.equal(expiredSelection.status, 401, 'expired role-choice tickets must be rejected');

  // Password reset: unknown emails must not create accounts.
  const unknownReset = await request(baseUrl, '/api/auth/forgot-password', {
    method: 'POST',
    body: { email: 'not-registered@example.invalid' },
  });
  assert.equal(unknownReset.status, 404);
  assert.equal(unknownReset.data.code, 'EMAIL_NOT_REGISTERED');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM users WHERE email=?').get('not-registered@example.invalid').count, 0);
  const unknownResetSecond = await request(baseUrl, '/api/auth/forgot-password', {
    method: 'POST',
    body: { email: 'not-registered@example.invalid' },
  });
  const unknownResetThird = await request(baseUrl, '/api/auth/forgot-password', {
    method: 'POST',
    body: { email: 'not-registered@example.invalid' },
  });
  const unknownResetThrottled = await request(baseUrl, '/api/auth/forgot-password', {
    method: 'POST',
    body: { email: 'not-registered@example.invalid' },
  });
  assert.equal(unknownResetSecond.status, 404);
  assert.equal(unknownResetThird.status, 404);
  assert.equal(unknownResetThrottled.status, 429, 'password reset requests must be throttled per email');

  // Successful reset must invalidate every previously issued session for that account.
  const resetLoginA = await request(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: { identifier: 'auth_test_user', password: userPassword },
  });
  const resetLoginB = await request(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: { identifier: 'auth_test_user', password: userPassword },
  });
  assert.equal(resetLoginA.status, 200);
  assert.equal(resetLoginB.status, 200);
  const resetCode = '482961';
  db.prepare(`INSERT INTO password_resets(email,code_hash,expires_at,attempts,created_at)
    VALUES(?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET code_hash=excluded.code_hash,
    expires_at=excluded.expires_at,attempts=0,created_at=excluded.created_at`)
    .run('auth-test-user@example.invalid', crypto.createHmac('sha256', testResetSecret).update(resetCode).digest('hex'),
      new Date(Date.now() + 10 * 60_000).toISOString(), 0, new Date().toISOString());
  const passwordReset = await request(baseUrl, '/api/auth/reset-password', {
    method: 'POST',
    body: { email: 'auth-test-user@example.invalid', code: resetCode, newPassword: 'New-Password-After-Reset-2026' },
  });
  assert.equal(passwordReset.status, 200);
  assert.equal((await request(baseUrl, '/api/auth/me', { token: resetLoginA.data.token })).status, 401);
  assert.equal((await request(baseUrl, '/api/auth/me', { token: resetLoginB.data.token })).status, 401);
  assert.equal((await request(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: { identifier: 'auth_test_user', password: userPassword },
  })).status, 401);
  const loginWithNewPassword = await request(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: { identifier: 'auth_test_user', password: 'New-Password-After-Reset-2026' },
  });
  assert.equal(loginWithNewPassword.status, 200);

  db.close();
  console.log('Auth runtime integration tests passed: owner-role isolation, unknown-email non-creation, reset throttling, HMAC reset-code verification, password update, and session revocation.');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
    await Promise.race([new Promise((resolve) => child.once('exit', resolve)), sleep(5000)]);
    if (child.exitCode === null) child.kill('SIGKILL');
  }
  rmSync(tempDir, { recursive: true, force: true });
}
