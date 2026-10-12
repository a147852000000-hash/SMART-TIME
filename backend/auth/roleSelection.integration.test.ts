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
process.env.PASSWORD_RESET_HMAC_SECRET = secret;
process.env.OWNER_EMAILS = ownerEmail;
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
    env: { ...process.env, PASSWORD_RESET_HMAC_SECRET: secret, PORT: String(port), SMART_TIME_DB_PATH: dbPath, JWT_SECRET: secret, OWNER_EMAILS: ownerEmail, ALLOWED_ORIGINS: 'https://app.example.test', TURNSTILE_ENFORCE: 'false', EMAIL_PROVIDER: '', SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '', RESEND_API_KEY: '', ALLOW_DEV_EMAIL_CODE: 'true' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverOutput = '';
  child.stdout?.on('data', chunk => { serverOutput = (serverOutput + String(chunk)).slice(-4000); });
  child.stderr?.on('data', chunk => { serverOutput = (serverOutput + String(chunk)).slice(-4000); });
  await waitForServer();

  const allowedOrigin = await request('/api/health', { headers: { origin: 'https://app.example.test' } });
  assert.equal(allowedOrigin.status, 200, 'exact configured frontend origin must pass CORS');
  const untrustedOrigin = await request('/api/health', { headers: { origin: 'https://attacker.vercel.app' } });
  assert.equal(untrustedOrigin.status, 403, 'unconfigured Vercel subdomains must be rejected');

  const userLogin = await post('/api/auth/login', { identifier: userEmail, password });
  assert.equal(userLogin.status, 200);
  assert.equal(userLogin.body.user.role, 'user');
  const forgedTicket = signTicket({ purpose: 'role_selection', sub: 'test-user', email: userEmail, actualRoleInDB: 'user', availableRoles: ['user'], iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 300 });
  const escalation = await post('/api/auth/select-role', { roleChoiceTicket: forgedTicket, role: 'owner' });
  assert.equal(escalation.status, 403, 'a normal DB user must not select owner');

  const adminLogin = await post('/api/auth/login', { identifier: adminEmail, password });
  assert.equal(adminLogin.status, 200);
  assert.equal(adminLogin.body.requiresRoleChoice, true, 'DB admins must receive role-choice ticket even when not in OWNER_EMAILS');
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

  const deniedAdminAppointment = await post('/api/auth/owner/admin-role', { email: userEmail, action: 'appoint' }, adminSession.body.token);
  assert.equal(deniedAdminAppointment.status, 403, 'admins cannot appoint admins');
  const selfAppointment = await post('/api/auth/owner/admin-role', { email: ownerEmail, action: 'appoint' }, ownerSession.body.token);
  assert.equal(selfAppointment.status, 400, 'owner cannot self-appoint');
  const appointUser = await post('/api/auth/owner/admin-role', { email: userEmail, action: 'appoint' }, ownerSession.body.token);
  if (appointUser.status !== 200) {
    console.error('appointUser unexpected response', { status: appointUser.status, body: appointUser.body });
  }
  assert.equal(appointUser.status, 200);
  assert.equal(appointUser.body.role, 'admin');
  assert.equal(db.prepare('SELECT role FROM users WHERE id=?').get('test-user').role, 'admin');
  const revokeUser = await post('/api/auth/owner/admin-role', { email: userEmail, action: 'revoke' }, ownerSession.body.token);
  assert.equal(revokeUser.status, 200);
  assert.equal(revokeUser.body.sessionsRevoked, true);
  assert.equal(db.prepare('SELECT role FROM users WHERE id=?').get('test-user').role, 'user');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM sessions WHERE user_id=?').get('test-user').count, 0, 'revoking admin must immediately delete all target sessions');
  const audit = await request('/api/auth/owner/admin-role/audit?limit=10', { headers: { authorization: `Bearer ${ownerSession.body.token}` } });
  assert.equal(audit.status, 200);
  assert.equal(audit.body.entries.filter((entry: any) => entry.target_email === userEmail).length, 2, 'appointment and revocation must be audited');
  const ownerDemotion = await post('/api/auth/owner/admin-role', { email: ownerEmail, action: 'revoke' }, ownerSession.body.token);
  assert.equal(ownerDemotion.status, 400, 'owner cannot change their own role');
  db.prepare('UPDATE users SET email=? WHERE id=?').run('renamed-owner@example.test', 'test-owner');
  const staleOwnerSession = await request('/api/auth/me', { headers: { authorization: `Bearer ${ownerSession.body.token}` } });
  assert.equal(staleOwnerSession.status, 401, 'owner JWT must be rejected after the account email changes');
  db.prepare('UPDATE users SET email=? WHERE id=?').run(ownerEmail, 'test-owner');
  
  // A DB admin remains an admin even when their email is not in the owner allowlist.
  db.prepare('INSERT INTO sessions(id,user_id,expires_at,created_at,session_role) VALUES(?,?,?,?,?)')
    .run('legacy-admin-session', 'test-admin', new Date(Date.now() + 60 * 60_000).toISOString(), new Date().toISOString(), 'admin');
  const validAdminWithoutOwnerAllowlist = await request('/api/auth/me', { headers: { authorization: 'Bearer legacy-admin-session' } });
  assert.equal(validAdminWithoutOwnerAllowlist.status, 200);
  assert.equal(validAdminWithoutOwnerAllowlist.body.user.role, 'admin');
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

  const token = '482619';
  db.prepare('INSERT INTO sessions(id,user_id,expires_at,created_at) VALUES(?,?,?,?)').run('pre-reset-session', 'test-user', new Date(Date.now() + 60 * 60_000).toISOString(), new Date().toISOString());
  db.prepare('INSERT INTO password_resets(email,code_hash,expires_at,attempts,created_at) VALUES(?,?,?,?,?)').run(userEmail, crypto.createHmac('sha256', secret).update(token).digest('hex'), new Date(Date.now() + 60 * 60_000).toISOString(), 0, new Date().toISOString());
  const reset = await post('/api/auth/reset-password', { email: userEmail, code: token, newPassword: 'UpdatedPassword!123' });
  assert.equal(reset.status, 200);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM sessions WHERE user_id=?').get('test-user').count, 0, 'password reset must revoke all existing sessions');
  const reuse = await post('/api/auth/reset-password', { email: userEmail, code: token, newPassword: 'AnotherPassword!123' });
  assert.equal(reuse.status, 400, 'reset token must be one-time');
  const oldPasswordLogin = await post('/api/auth/login', { identifier: userEmail, password });
  assert.equal(oldPasswordLogin.status, 401);
  const newPasswordLogin = await post('/api/auth/login', { identifier: userEmail, password: 'UpdatedPassword!123' });
  assert.equal(newPasswordLogin.status, 200);

  const concurrentToken = '583104';
  db.prepare('INSERT INTO password_resets(email,code_hash,expires_at,attempts,created_at) VALUES(?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET code_hash=excluded.code_hash,expires_at=excluded.expires_at,attempts=0,created_at=excluded.created_at')
    .run(userEmail, crypto.createHmac('sha256', secret).update(concurrentToken).digest('hex'), new Date(Date.now() + 60 * 60_000).toISOString(), 0, new Date().toISOString());
  const concurrentResults = await Promise.all([
    post('/api/auth/reset-password', { email: userEmail, code: concurrentToken, newPassword: 'ConcurrentPassword!123' }),
    post('/api/auth/reset-password', { email: userEmail, code: concurrentToken, newPassword: 'AnotherConcurrentPassword!123' }),
  ]);
  assert.equal(concurrentResults.filter(result => result.status === 200).length, 1, 'a reset token must be consumed by exactly one concurrent request');
  assert.equal(concurrentResults.filter(result => result.status === 400).length, 1, 'the competing reset request must be rejected');

  const unknownForgot = await post('/api/auth/forgot-password', { email: 'unknown@example.test' });
  assert.equal(unknownForgot.status, 404);
  assert.equal(unknownForgot.body.code, 'ACCOUNT_NOT_FOUND');
  assert.equal(unknownForgot.body.message, 'هذا البريد غير مسجل، أنشئ حساباً');
  assert.equal(unknownForgot.body.registerUrl, '/register', 'response must include the registration route');
  const knownForgot = await post('/api/auth/forgot-password', { email: userEmail });
  assert.equal(knownForgot.status, 200);
  assert.equal(knownForgot.body.ok, true);
  assert.equal(JSON.stringify(knownForgot.body).includes('code'), false, 'reset token must not be included in the API response');
  assert.equal(JSON.stringify(knownForgot.body).includes('a'.repeat(64)), false, 'reset token must not be included in the API response');
  const storedReset = db.prepare('SELECT code_hash, attempts FROM password_resets WHERE email=?').get(userEmail);
  assert.match(storedReset.code_hash, /^[a-f0-9]{64}$/i, 'database stores a fixed-length HMAC-SHA256 digest');
  assert.doesNotMatch(JSON.stringify(knownForgot.body), /\b\d{6}\b/, 'reset code must not be returned in the response');
  const serverSource = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf8');
  assert.match(serverSource, /crypto\.randomInt\(100000, 1000000\)/, 'reset code generation uses crypto.randomInt for six digits');
  assert.equal(serverSource.includes('storedHash.length!==providedHash.length'), true, 'buffer lengths must be checked before timingSafeEqual');
  assert.equal(serverSource.includes('storedHash.length!==providedHash.length'), true, 'buffer lengths must be checked before timingSafeEqual');
  assert.match(serverSource, /timingSafeEqual\(providedHash,storedHash\)/, 'reset path uses constant-time comparison');
  assert.match(serverSource, /Number\(reset\.attempts\|\|0\)>=5/, 'reset path caps attempts');
  assert.equal(serverSource.includes("function passwordResetHash(code:string){const secret=String(process.env.PASSWORD_RESET_HMAC_SECRET||'')"), true, 'reset hashes must be keyed by PASSWORD_RESET_HMAC_SECRET');
  assert.equal(serverSource.includes("return crypto.createHmac('sha256',secret).update(code).digest('hex')"), true, 'reset hash must use HMAC-SHA256');
  assert.equal((await post('/api/auth/forgot-password', { email: userEmail })).status, 200);
  const oldCode = '246810';
  const oldHash = crypto.createHmac('sha256', secret).update(oldCode).digest('hex');
  db.prepare('INSERT INTO password_resets(email,code_hash,expires_at,attempts,created_at) VALUES(?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET code_hash=excluded.code_hash,expires_at=excluded.expires_at,attempts=0,created_at=excluded.created_at')
    .run('other@example.test', oldHash, new Date(Date.now() + 60 * 60_000).toISOString(), 0, new Date().toISOString());
  assert.equal((await post('/api/auth/forgot-password', { email: 'other@example.test' })).status, 200);
  const replacementHash = db.prepare('SELECT code_hash FROM password_resets WHERE email=?').get('other@example.test').code_hash;
  assert.notEqual(replacementHash, oldHash, 'a new reset request replaces the previous stored HMAC');
  assert.equal((await post('/api/auth/reset-password', { email: 'other@example.test', code: oldCode, newPassword: 'AnotherPassword!123' })).status, 400, 'a new reset request invalidates the previous code');
  const mailSource = fs.readFileSync(path.join(process.cwd(), 'backend/auth/passwordResetEmail.ts'), 'utf8');
  assert.equal(mailSource.includes('error: message'), false, 'SMTP/provider error logs must not print raw provider error messages');
  assert.doesNotMatch(serverOutput, /\b\d{6}\b/, 'application logs must not contain six-digit reset codes');
  assert.match(serverSource, /PASSWORD_RESET_EMAIL_FAILED/, 'application mail-failure path logs a generic code only');
  // The earlier known-account requests are #1 and #2; make request #3 explicitly before asserting #4 is limited.
  assert.equal((await post('/api/auth/forgot-password', { email: userEmail })).status, 200);
  const rateLimited = await post('/api/auth/forgot-password', { email: userEmail });
  assert.equal(rateLimited.status, 429, 'fourth reset request in the 15-minute window must be rate limited');

  const wrongGuessToken = '694217';
  db.prepare('INSERT INTO password_resets(email,code_hash,expires_at,attempts,created_at) VALUES(?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET code_hash=excluded.code_hash,expires_at=excluded.expires_at,attempts=0,created_at=excluded.created_at')
    .run(userEmail, crypto.createHmac('sha256', secret).update(wrongGuessToken).digest('hex'), new Date(Date.now() + 60 * 60_000).toISOString(), 0, new Date().toISOString());
  for (let i = 0; i < 5; i++) {
    const wrongGuess = await post('/api/auth/reset-password', { email: userEmail, code: '111111', newPassword: 'AnotherPassword!123' });
    assert.equal(wrongGuess.status, 400, 'the first five wrong reset-token guesses must be rejected');
  }
  const sixthGuess = await post('/api/auth/reset-password', { email: userEmail, code: '111111', newPassword: 'AnotherPassword!123' });
  assert.equal(sixthGuess.status, 429, 'the sixth reset-token guess must be rate limited');

  // Per-IP limiter should stop a burst even when requests use distinct email addresses.
  for (let i = 0; i < 6; i++) {
    const result = await post('/api/auth/forgot-password', { email: `unknown-ip-test-${i}@example.test` });
    assert.equal(result.status, i < 4 ? 404 : 429, 'IP reset limit must apply independently of per-email limits');
  }

  console.log('AUTH_SECURITY_INTEGRATION_PASS: role escalation blocked; admin appointment/audit/revocation; exact-origin CORS; DB role authoritative; JWT session revocation; settings isolation; email/IP reset limits; reset token one-use.');
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
