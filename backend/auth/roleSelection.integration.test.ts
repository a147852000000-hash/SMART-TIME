import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-time-auth-security-'));
const dbPath = path.join(tempDir, 'auth-test.sqlite');
const port = 43179 + Math.floor(Math.random() * 1000);
const secret = crypto.randomBytes(48).toString('hex');
const ownerEmail = 'owner@example.test';
const adminEmail = 'admin@example.test';
const userEmail = 'user@example.test';
process.env.SMART_TIME_DB_PATH = dbPath;
process.env.JWT_SECRET = secret;
process.env.OWNER_EMAILS = `${ownerEmail},${adminEmail}`;
process.env.TURNSTILE_ENFORCE = 'false';

let child: ChildProcess | undefined;
let db: any;
const password = 'TestPassword!123';
const passwordHash = (value: string) => {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(value, salt, 64).toString('hex')}`;
};
const signTicket = (payload: Record<string, unknown>) => {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}`;
  const signature = crypto.createHmac('sha256', secret).update(unsigned).digest('base64url');
  return `${unsigned}.${signature}`;
};
const request = async (url: string, init: RequestInit = {}) => {
  const response = await fetch(`http://127.0.0.1:${port}${url}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers || {}) },
  });
  return { status: response.status, body: await response.json().catch(() => ({})) as any };
};
const post = (url: string, body: unknown, token?: string) => request(url, {
  method: 'POST',
  body: JSON.stringify(body),
  headers: token ? { authorization: `Bearer ${token}` } : {},
});
const waitForServer = async () => {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (child?.exitCode !== null && child?.exitCode !== undefined) throw new Error(`Server exited early with code ${child.exitCode}`);
    try { const r = await request('/api/health'); if (r.status === 200) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Timed out waiting for the test server.');
};

try {
  const database = await import('../database.js');
  db = database.db;
  const insertUser = db.prepare('INSERT INTO users (id,email,username,password_hash,display_name,created_at,role,activation_status) VALUES (?,?,?,?,?,?,?,?)');
  insertUser.run('test-owner', ownerEmail, 'testowner', passwordHash(password), 'Test Owner', new Date().toISOString(), 'owner', 'active');
  insertUser.run('test-admin', adminEmail, 'testadmin', passwordHash(password), 'Test Admin', new Date().toISOString(), 'admin', 'active');
  insertUser.run('test-user', userEmail, 'testuser', passwordHash(password), 'Test User', new Date().toISOString(), 'user', 'active');
  insertUser.run('test-user-2', 'other@example.test', 'otheruser', passwordHash(password), 'Other User', new Date().toISOString(), 'user', 'active');

  child = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), SMART_TIME_DB_PATH: dbPath, JWT_SECRET: secret, OWNER_EMAILS: `${ownerEmail},${adminEmail}`, TURNSTILE_ENFORCE: 'false', EMAIL_PROVIDER: '', SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '', RESEND_API_KEY: '', ALLOW_DEV_EMAIL_CODE: 'false' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverOutput = '';
  child.stdout?.on('data', chunk => { serverOutput = (serverOutput + String(chunk)).slice(-4000); });
  child.stderr?.on('data', chunk => { serverOutput = (serverOutput + String(chunk)).slice(-4000); });
  await waitForServer();

  const userLogin = await post('/api/auth/login', { identifier: userEmail, password });
  assert.equal(userLogin.status, 200);
  assert.equal(userLogin.body.user.role, 'user');
  const forgedTicket = signTicket({ purpose: 'role_selection', sub: 'test-user', email: userEmail, actualRoleInDB: 'user', availableRoles: ['user'], iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 300 });
  const escalation = await post('/api/auth/select-role', { roleChoiceTicket: forgedTicket, role: 'owner' });
  assert.equal(escalation.status, 403, 'a normal DB user must not select owner');

  const adminLogin = await post('/api/auth/login', { identifier: adminEmail, password });
  assert.equal(adminLogin.status, 200);
  assert.equal(adminLogin.body.requiresRoleChoice, true);
  const adminEscalation = await post('/api/auth/select-role', { roleChoiceTicket: adminLogin.body.roleChoiceTicket, role: 'owner' });
  assert.equal(adminEscalation.status, 403, 'a DB admin must not select owner');
  const adminSession = await post('/api/auth/select-role', { roleChoiceTicket: adminLogin.body.roleChoiceTicket, role: 'admin' });
  assert.equal(adminSession.status, 200);
  assert.equal(adminSession.body.user.role, 'admin');

  const ownerLogin = await post('/api/auth/login', { identifier: ownerEmail, password });
  assert.equal(ownerLogin.status, 200);
  assert.deepEqual(ownerLogin.body.availableRoles, ['owner', 'admin', 'user']);
  const ownerSession = await post('/api/auth/select-role', { roleChoiceTicket: ownerLogin.body.roleChoiceTicket, role: 'owner' });
  assert.equal(ownerSession.status, 200);
  assert.equal(ownerSession.body.user.role, 'owner');
  const me = await request('/api/auth/me', { headers: { authorization: `Bearer ${ownerSession.body.token}` } });
  assert.equal(me.status, 200);
  await post('/api/auth/logout', {}, ownerSession.body.token);
  const revoked = await request('/api/auth/me', { headers: { authorization: `Bearer ${ownerSession.body.token}` } });
  assert.equal(revoked.status, 401, 'logout must revoke JWT-backed sessions');

  const saved = await post('/api/user/settings', { settings: { theme: 'dark', locale: 'ar-EG' } }, userLogin.body.token);
  assert.equal(saved.status, 200);
  const loaded = await request('/api/user/settings', { headers: { authorization: `Bearer ${userLogin.body.token}` } });
  assert.deepEqual(loaded.body.settings, { theme: 'dark', locale: 'ar-EG' });
  const otherLogin = await post('/api/auth/login', { identifier: 'other@example.test', password });
  const isolated = await request('/api/user/settings', { headers: { authorization: `Bearer ${otherLogin.body.token}` } });
  assert.deepEqual(isolated.body.settings, {}, 'settings must be isolated by user id');

  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions(id,user_id,expires_at,created_at) VALUES(?,?,?,?)').run('pre-reset-session', 'test-user', new Date(Date.now() + 60 * 60_000).toISOString(), new Date().toISOString());
  db.prepare('INSERT INTO password_resets(email,code_hash,expires_at,attempts,created_at) VALUES(?,?,?,?,?)').run(userEmail, crypto.createHash('sha256').update(token).digest('hex'), new Date(Date.now() + 60 * 60_000).toISOString(), 0, new Date().toISOString());
  const reset = await post('/api/auth/reset-password', { email: userEmail, code: token, newPassword: 'UpdatedPassword!123' });
  assert.equal(reset.status, 200);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM sessions WHERE user_id=?').get('test-user').count, 0, 'password reset must revoke all existing sessions');
  const reuse = await post('/api/auth/reset-password', { email: userEmail, code: token, newPassword: 'AnotherPassword!123' });
  assert.equal(reuse.status, 400, 'reset token must be one-time');
  const oldPasswordLogin = await post('/api/auth/login', { identifier: userEmail, password });
  assert.equal(oldPasswordLogin.status, 401);
  const newPasswordLogin = await post('/api/auth/login', { identifier: userEmail, password: 'UpdatedPassword!123' });
  assert.equal(newPasswordLogin.status, 200);

  const unknownForgot = await post('/api/auth/forgot-password', { email: 'unknown@example.test' });
  const knownForgot = await post('/api/auth/forgot-password', { email: userEmail });
  assert.deepEqual(unknownForgot.body, knownForgot.body, 'forgot-password must not reveal account existence');
  assert.equal(unknownForgot.body.ok, true);

  console.log('AUTH_SECURITY_INTEGRATION_PASS: role escalation blocked; DB role authoritative; JWT session revocation; settings isolation; reset token one-use; generic forgot-password response.');
} catch (error) {
  console.error('AUTH_SECURITY_INTEGRATION_FAIL', error);
  if (child) child.kill('SIGTERM');
  if (db) { try { db.close(); } catch {} }
  fs.rmSync(tempDir, { recursive: true, force: true });
  process.exitCode = 1;
} finally {
  if (child && child.exitCode === null) child.kill('SIGTERM');
  if (db) { try { db.close(); } catch {} }
  fs.rmSync(tempDir, { recursive: true, force: true });
}
