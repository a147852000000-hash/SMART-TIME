import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn, type ChildProcess } from 'node:child_process';
import { startSmtpTestServer } from './smtpTestServer.js';
import type { SmtpTestServer } from './smtpTestServer.js';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-time-auth-security-'));
const dbPath = path.join(tempDir, 'auth-test.sqlite');
let port = 0;
async function getAvailablePort(): Promise<number> {
  const probe = net.createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => resolve());
  });
  const address = probe.address();
  if (!address || typeof address === 'string') {
    await new Promise<void>(resolve => probe.close(() => resolve()));
    throw new Error('Could not allocate a local test port.');
  }
  const selectedPort = address.port;
  await new Promise<void>((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  return selectedPort;
}
const secret = crypto.randomBytes(48).toString('hex');
const ownerEmail = 'owner@example.test';
const secondOwnerEmail = 'owner-two@example.test';
const adminEmail = 'admin@example.test';
const userEmail = 'user@example.test';
const deleteEmail = 'delete-me@example.test';
const activationEmail = 'activate-me@example.test';
const failedDeleteEmail = 'failed-delete@example.test';
process.env.SMART_TIME_DB_PATH = dbPath;
process.env.JWT_SECRET = secret;
process.env.PASSWORD_RESET_HMAC_SECRET = secret;
process.env.PROGRAM_OWNER_ACTIVATION_KEY = secret;
process.env.OWNER_EMAILS = [ownerEmail, secondOwnerEmail].join(',');
process.env.TURNSTILE_ENFORCE = 'false';

let child: ChildProcess | undefined;
let db: any;
let serverOutput = '';
let smtpServer: SmtpTestServer | undefined;
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
  const smtp = await startSmtpTestServer();
  smtpServer = smtp;
  // Ask the OS for a free port after the SMTP sink is listening, preventing port collisions.
  port = await getAvailablePort();
  const database = await import('../database.js');
  db = database.db;
  const databaseFile = (db.prepare('PRAGMA database_list').all() as any[]).find(row => row.name === 'main')?.file;
  assert.ok(databaseFile, 'test database handle must expose its main SQLite file');
  assert.equal(path.resolve(databaseFile), path.resolve(dbPath), 'test database handle must use the expected temporary SQLite file');
  assert.equal(path.resolve(String(process.env.SMART_TIME_DB_PATH)), path.resolve(dbPath), 'test process DB path must match the child server path');

  const insertUser = db.prepare('INSERT INTO users (id,email,username,password_hash,display_name,created_at,role,activation_status) VALUES (?,?,?,?,?,?,?,?)');
  const reusableTestHash = passwordHash(password);
  const createdAt = () => new Date().toISOString();
  insertUser.run('test-owner', ownerEmail, 'testowner', reusableTestHash, 'Test Owner', createdAt(), 'owner', 'active');
  insertUser.run('test-owner-2', secondOwnerEmail, 'testowner2', reusableTestHash, 'Second Test Owner', createdAt(), 'owner', 'active');
  insertUser.run('test-admin', adminEmail, 'testadmin', reusableTestHash, 'Test Admin', createdAt(), 'admin', 'active');
  insertUser.run('test-user', userEmail, 'testuser', reusableTestHash, 'Test User', createdAt(), 'user', 'active');
  insertUser.run('test-user-2', 'other@example.test', 'otheruser', reusableTestHash, 'Other User', createdAt(), 'user', 'active');
  insertUser.run('test-delete-user', deleteEmail, 'deleteuser', reusableTestHash, 'Delete Test User', createdAt(), 'user', 'active');
  insertUser.run('test-activation-user', activationEmail, 'activateuser', reusableTestHash, 'Activation Test User', createdAt(), 'user', 'pending');
  insertUser.run('test-failed-delete-user', failedDeleteEmail, 'faileddeleteuser', reusableTestHash, 'Failed Delete User', createdAt(), 'user', 'active');
  db.prepare("UPDATE users SET phone=? WHERE id='test-delete-user'").run('+201000000000');
  for (let i = 0; i < 105; i++) {
    const suffix = String(i).padStart(3, '0');
    insertUser.run('page-user-' + suffix, 'page-user-' + suffix + '@example.test', 'pageuser' + suffix, reusableTestHash, 'Paging Test User ' + suffix, createdAt(), 'user', 'active');
  }

  const childEnv = {
    ...process.env,
    PASSWORD_RESET_HMAC_SECRET: secret,
    RATE_LIMIT_HASH_SECRET: secret,
    PROGRAM_OWNER_ACTIVATION_KEY: secret,
    PORT: String(port),
    SMART_TIME_DB_PATH: dbPath,
    JWT_SECRET: secret,
    OWNER_EMAILS: [ownerEmail, secondOwnerEmail].join(','),
    ALLOWED_ORIGINS: 'https://app.example.test',
    TURNSTILE_ENFORCE: 'false',
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: String(smtp.port),
    SMTP_SECURE: 'false',
    SMTP_USER: 'sender@example.test',
    SMTP_PASS: 'test-only-app-password',
    EMAIL_FROM: 'SMART-TIME Test <sender@example.test>',
  };
  assert.equal(path.resolve(String(childEnv.SMART_TIME_DB_PATH)), path.resolve(databaseFile), 'child server environment must point to the same SQLite file as the test handle');
  child = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: process.cwd(),
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
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

  const ownerHeaders = { authorization: `Bearer ${ownerSession.body.token}` };
  const firstPage = await request('/api/auth/owner/accounts?limit=3&offset=0', { headers: ownerHeaders });
  assert.equal(firstPage.status, 200, 'approved Owner can list accounts');
  assert.equal(firstPage.body.limit, 3);
  assert.equal(firstPage.body.offset, 0);
  assert.equal(firstPage.body.total, Number(db.prepare('SELECT COUNT(*) AS total FROM users').get().total));
  assert.equal(firstPage.body.users.length, 3);
  assert.deepEqual(Object.keys(firstPage.body.users[0]).sort(), ['displayName', 'email', 'id', 'role'].sort(), 'account list must expose only approved fields');
  const secondPage = await request('/api/auth/owner/accounts?limit=3&offset=3', { headers: ownerHeaders });
  assert.equal(secondPage.status, 200);
  assert.equal(secondPage.body.hasMore, true);
  assert.equal(new Set([...firstPage.body.users, ...secondPage.body.users].map((account: any) => account.id)).size, 6, 'adjacent pages must not repeat accounts');
  const expectedFirstSix = (db.prepare('SELECT id FROM users ORDER BY created_at ASC, id ASC LIMIT 6').all() as any[]).map(row => row.id);
  assert.deepEqual([...firstPage.body.users, ...secondPage.body.users].map((account: any) => account.id), expectedFirstSix, 'paging must use stable created_at/id ordering');
  const maxPage = await request('/api/auth/owner/accounts?limit=100&offset=0', { headers: ownerHeaders });
  assert.equal(maxPage.status, 200);
  assert.equal(maxPage.body.limit, 100, 'owner account list must allow the maximum page size of 100');
  assert.equal(maxPage.body.users.length, 100);
  assert.equal((await request('/api/auth/owner/accounts?limit=101', { headers: ownerHeaders })).status, 400, 'owner account list rejects limit above 100');
  assert.equal((await request('/api/auth/owner/accounts?limit=1.5', { headers: ownerHeaders })).status, 400, 'owner account list rejects fractional limit');
  assert.equal((await request('/api/auth/owner/accounts?offset=-1', { headers: ownerHeaders })).status, 400, 'owner account list rejects negative offset');
  assert.equal((await request('/api/auth/owner/accounts?offset=1e2', { headers: ownerHeaders })).status, 400, 'owner account list rejects non-integer syntax');
  assert.equal((await request('/api/auth/owner/accounts?search=' + 'x'.repeat(201), { headers: ownerHeaders })).status, 400, 'owner account list rejects search longer than 200 characters');
  const emailSearch = await request('/api/auth/owner/accounts?search=other%40example.test', { headers: ownerHeaders });
  assert.equal(emailSearch.status, 200);
  assert.deepEqual(emailSearch.body.users.map((account: any) => account.id), ['test-user-2'], 'owner list search must match email');
  const nameSearch = await request('/api/auth/owner/accounts?search=Test%20Owner', { headers: ownerHeaders });
  assert.equal(nameSearch.status, 200);
  assert.equal(nameSearch.body.users.some((account: any) => account.id === 'test-owner'), true, 'owner list search must match display name');
  for (const literal of ['%25', '%5F', '%5C']) {
    const escapedSearch = await request('/api/auth/owner/accounts?search=' + literal, { headers: ownerHeaders });
    assert.equal(escapedSearch.status, 200);
    assert.equal(escapedSearch.body.total, 0, 'literal LIKE metacharacter must not act as a wildcard');
  }

  for (const denied of [
    { label: 'normal user', token: userLogin.body.token },
    { label: 'admin', token: adminSession.body.token },
  ]) {
    const headers = { authorization: `Bearer ${denied.token}` };
    assert.equal((await request('/api/auth/owner/accounts', { headers })).status, 403, `${denied.label} cannot list accounts`);
    assert.equal((await request('/api/auth/owner/accounts/test-delete-user', { method: 'DELETE', headers })).status, 403, `${denied.label} cannot delete users`);
    for (const action of ['appoint', 'revoke']) {
      assert.equal((await post('/api/auth/owner/admin-role', { email: userEmail, action }, denied.token)).status, 403, `${denied.label} cannot ${action} Admin`);
    }
    assert.equal((await request('/api/auth/owner/admin-role/audit?limit=10', { headers })).status, 403, `${denied.label} cannot read role audit`);
    assert.equal((await post('/api/auth/owner/activate', { ownerEmail, activationKey: secret, userEmail: activationEmail }, denied.token)).status, 403, `${denied.label} cannot activate accounts by spoofing owner fields`);
  }

  assert.equal((await request('/api/auth/owner/accounts/no-such-account', { method: 'DELETE', headers: ownerHeaders })).status, 404, 'deleting a nonexistent id returns 404');
  assert.equal((await request('/api/auth/owner/accounts/bad%40id', { method: 'DELETE', headers: ownerHeaders })).status, 404, 'nonempty account ids use exact lookup and return 404 when absent');
  assert.equal((await request('/api/auth/owner/accounts/%20', { method: 'DELETE', headers: ownerHeaders })).status, 400, 'deletion rejects an empty account id');
  assert.equal((await request('/api/auth/owner/accounts/' + 'x'.repeat(201), { method: 'DELETE', headers: ownerHeaders })).status, 400, 'deletion rejects account ids longer than 200 characters');
  const selfDelete = await request('/api/auth/owner/accounts/test-owner', { method: 'DELETE', headers: ownerHeaders });
  assert.equal(selfDelete.status, 400, 'Owner cannot delete their own account');
  const protectedOwnerDelete = await request('/api/auth/owner/accounts/test-owner-2', { method: 'DELETE', headers: ownerHeaders });
  assert.equal(protectedOwnerDelete.status, 409, 'Owner cannot delete another Owner account');

  const noSessionActivation = await post('/api/auth/owner/activate', { ownerEmail, activationKey: secret, userEmail: activationEmail });
  assert.equal(noSessionActivation.status, 403, 'activation without a session is forbidden');
  const wrongActivationKey = await post('/api/auth/owner/activate', { ownerEmail, activationKey: 'wrong-key', userEmail: activationEmail }, ownerSession.body.token);
  assert.equal(wrongActivationKey.status, 403, 'approved Owner session without the correct key cannot activate');
  const missingActivationKey = await post('/api/auth/owner/activate', { ownerEmail, userEmail: activationEmail }, ownerSession.body.token);
  assert.equal(missingActivationKey.status, 403, 'approved Owner session without a key cannot activate');
  db.prepare("UPDATE users SET activation_status='pending' WHERE id='test-activation-user'").run();
  const approvedActivation = await post('/api/auth/owner/activate', { ownerEmail, activationKey: secret, userEmail: activationEmail }, ownerSession.body.token);
  assert.equal(approvedActivation.status, 200, 'approved Owner with the key can activate an account');
  const activationState = db.prepare('SELECT activation_status,activated_by FROM users WHERE id=?').get('test-activation-user') as any;
  assert.equal(activationState.activation_status, 'active');
  assert.equal(activationState.activated_by, ownerEmail);

  const deniedAdminAppointment = await post('/api/auth/owner/admin-role', { email: userEmail, action: 'appoint' }, adminSession.body.token);
  assert.equal(deniedAdminAppointment.status, 403, 'admins cannot appoint admins');
  const selfAppointment = await post('/api/auth/owner/admin-role', { email: ownerEmail, action: 'appoint' }, ownerSession.body.token);
  assert.equal(selfAppointment.status, 400, 'owner cannot self-appoint');
  assert.equal(selfAppointment.body.code, 'SELF_APPOINTMENT_FORBIDDEN');
  const protectedOwnerRole = await post('/api/auth/owner/admin-role', { email: secondOwnerEmail, action: 'revoke' }, ownerSession.body.token);
  assert.equal(protectedOwnerRole.status, 409, 'another Owner role is protected');
  assert.equal(protectedOwnerRole.body.code, 'OWNER_ROLE_PROTECTED');
  const missingAdminTarget = await post('/api/auth/owner/admin-role', { email: 'missing-admin@example.test', action: 'appoint' }, ownerSession.body.token);
  assert.equal(missingAdminTarget.status, 404, 'unknown target account is not found');
  assert.equal(missingAdminTarget.body.code, 'ACCOUNT_NOT_FOUND');
  const revokeNonAdmin = await post('/api/auth/owner/admin-role', { email: 'other@example.test', action: 'revoke' }, ownerSession.body.token);
  assert.equal(revokeNonAdmin.status, 409, 'revoking a non-Admin is rejected');
  assert.equal(revokeNonAdmin.body.code, 'NOT_ADMIN');
  const selectedForAppointment = firstPage.body.users.find((account: any) => account.id === 'test-user')
    || (await request('/api/auth/owner/accounts?search=user%40example.test', { headers: ownerHeaders })).body.users[0];
  assert.equal(selectedForAppointment.email, userEmail, 'Owner must appoint from a listed account');
  const appointUser = await post('/api/auth/owner/admin-role', { email: selectedForAppointment.email, action: 'appoint' }, ownerSession.body.token);
  if (appointUser.status !== 200) {
    console.error('appointUser unexpected response', { status: appointUser.status, body: appointUser.body });
  }
  assert.equal(appointUser.status, 200);
  assert.equal(appointUser.body.role, 'admin');
  const appointAlreadyAdmin = await post('/api/auth/owner/admin-role', { email: selectedForAppointment.email, action: 'appoint' }, ownerSession.body.token);
  assert.equal(appointAlreadyAdmin.status, 409, 'appointing an existing Admin is rejected');
  assert.equal(appointAlreadyAdmin.body.code, 'ALREADY_ADMIN');
  assert.equal(db.prepare('SELECT role FROM users WHERE id=?').get('test-user').role, 'admin');
  const promotedLogin = await post('/api/auth/login', { identifier: userEmail, password });
  assert.equal(promotedLogin.status, 200);
  assert.equal(promotedLogin.body.requiresRoleChoice, true, 'newly promoted account should be offered Admin role');
  const promotedAdminSession = await post('/api/auth/select-role', { roleChoiceTicket: promotedLogin.body.roleChoiceTicket, role: 'admin' });
  assert.equal(promotedAdminSession.status, 200);
  const secondAdminSessionId = 'extra-admin-session-for-revoke';
  db.prepare('INSERT INTO sessions(id,user_id,expires_at,created_at,session_role) VALUES(?,?,?,?,?)')
    .run(secondAdminSessionId, 'test-user', new Date(Date.now() + 60 * 60_000).toISOString(), new Date().toISOString(), 'admin');
  const revokeUser = await post('/api/auth/owner/admin-role', { email: selectedForAppointment.email, action: 'revoke' }, ownerSession.body.token);
  assert.equal(revokeUser.status, 200);
  assert.equal(revokeUser.body.sessionsRevoked, true);
  assert.equal(db.prepare('SELECT role FROM users WHERE id=?').get('test-user').role, 'user');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM sessions WHERE user_id=?').get('test-user').count, 0, 'revoking admin must immediately delete all target sessions');
  assert.equal((await request('/api/auth/me', { headers: { authorization: `Bearer ${promotedAdminSession.body.token}` } })).status, 401, 'revocation must invalidate a JWT Admin session');
  assert.equal((await request('/api/auth/me', { headers: { authorization: `Bearer ${secondAdminSessionId}` } })).status, 401, 'revocation must invalidate every legacy Admin session');
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

  // Revoking admin correctly deleted the prior sessions; establish a fresh user session for settings tests.
  const settingsLogin = await post('/api/auth/login', { identifier: userEmail, password });
  assert.equal(settingsLogin.status, 200);
  assert.equal(settingsLogin.body.user.role, 'user');
  const saved = await post('/api/user/settings', { settings: { theme: 'dark', locale: 'ar-EG' } }, settingsLogin.body.token);
  assert.equal(saved.status, 200);
  const loaded = await request('/api/user/settings', { headers: { authorization: `Bearer ${settingsLogin.body.token}` } });
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

  const deletionOwnerLogin = await post('/api/auth/login', { identifier: ownerEmail, password });
  assert.equal(deletionOwnerLogin.status, 200);
  const deletionOwnerSession = await post('/api/auth/select-role', { roleChoiceTicket: deletionOwnerLogin.body.roleChoiceTicket, role: 'owner' });
  assert.equal(deletionOwnerSession.status, 200);
  const deletionOwnerHeaders = { authorization: `Bearer ${deletionOwnerSession.body.token}` };
  const now = new Date().toISOString();

  db.prepare('INSERT INTO user_app_data(user_id,data_key,payload_json,updated_at) VALUES(?,?,?,?)')
    .run('test-delete-user', 'test-setting', '{"private":true}', now);
  db.prepare('INSERT INTO user_app_data(user_id,data_key,payload_json,updated_at) VALUES(?,?,?,?)')
    .run('test-failed-delete-user', 'rollback-setting', '{"mustRollback":true}', now);
  db.prepare('INSERT INTO ai_transactions(id,user_id,title,amount,category,date,created_at) VALUES(?,?,?,?,?,?,?)')
    .run('delete-ai-transaction', 'test-delete-user', 'test expense', 3, 'test', now, now);
  db.prepare('INSERT INTO trip_gift_claims(id,user_id,ip_hash,created_at) VALUES(?,?,?,?)')
    .run('delete-gift-claim', 'test-delete-user', 'test-only-ip-hash', now);
  db.prepare('INSERT INTO wallet_transactions(id,user_id,amount,type,balance_after,created_at) VALUES(?,?,?,?,?,?)')
    .run('delete-wallet-transaction', 'test-delete-user', 3, 'test', 0, now);
  db.prepare('INSERT INTO wallet_topups(id,user_id,amount,status,created_at) VALUES(?,?,?,?,?)')
    .run('delete-wallet-topup', 'test-delete-user', 3, 'pending', now);
  db.prepare('INSERT INTO password_resets(email,code_hash,expires_at,attempts,created_at) VALUES(?,?,?,?,?)')
    .run(deleteEmail, crypto.createHmac('sha256', secret).update('delete-code').digest('hex'), new Date(Date.now() + 60 * 60_000).toISOString(), 0, now);
  db.prepare('INSERT INTO password_reset_requests(email,window_started_at,request_count) VALUES(?,?,?)')
    .run(deleteEmail, now, 1);
  db.prepare('INSERT INTO phone_otps(phone,code_hash,expires_at,attempts,created_at) VALUES(?,?,?,?,?)')
    .run('+201000000000', crypto.createHash('sha256').update('123456').digest('hex'), new Date(Date.now() + 60 * 60_000).toISOString(), 0, now);
  db.prepare('INSERT INTO email_logs(id,recipient,purpose,status,provider,created_at) VALUES(?,?,?,?,?,?)')
    .run('delete-email-log', deleteEmail, 'password_reset', 'sent', 'local-test-sink', now);
  db.prepare('INSERT INTO conversations(id,title,type,creator_id,created_at,updated_at) VALUES(?,?,?,?,?,?)')
    .run('delete-test-room', 'Deletion test room', 'private', 'test-delete-user', now, now);
  db.prepare('INSERT INTO conversation_members(conversation_id,user_id,role,joined_at) VALUES(?,?,?,?)')
    .run('delete-test-room', 'test-delete-user', 'owner', now);
  db.prepare('INSERT INTO conversation_members(conversation_id,user_id,role,joined_at) VALUES(?,?,?,?)')
    .run('delete-test-room', 'test-user-2', 'member', now);
  db.prepare('INSERT INTO messages(id,conversation_id,sender_id,body,created_at) VALUES(?,?,?,?,?)')
    .run('delete-test-message', 'delete-test-room', 'test-delete-user', 'private test message', now);
  db.prepare('INSERT INTO saved_messages(user_id,message_id,saved_at) VALUES(?,?,?)')
    .run('test-user-2', 'delete-test-message', now);
  db.prepare('INSERT INTO message_reads(message_id,user_id,read_at) VALUES(?,?,?)')
    .run('delete-test-message', 'test-user-2', now);
  db.prepare('INSERT INTO role_audit_log(id,actor_user_id,actor_email,target_user_id,target_email,action,created_at) VALUES(?,?,?,?,?,?,?)')
    .run('delete-test-role-audit', 'test-owner', ownerEmail, 'test-delete-user', deleteEmail, 'admin_appointed', now);

  // Simulate canonical-schema tables absent in this database build; they must be skipped safely.
  for (const table of ['finance_expenses', 'finance_monthly_income', 'finance_bank_certificates', 'finance_fuel_records', 'finance_maintenance_records', 'finance_education_expenses']) {
    db.exec('DROP TABLE IF EXISTS ' + table);
  }
  const failureAuditBefore = Number(db.prepare('SELECT COUNT(*) AS count FROM user_deletion_audit').get().count);
  db.exec("CREATE TRIGGER fail_test_account_delete BEFORE DELETE ON users WHEN OLD.id='test-failed-delete-user' BEGIN SELECT RAISE(ABORT, 'injected deletion failure'); END");
  const failedDeleteResponse = await request('/api/auth/owner/accounts/test-failed-delete-user', { method: 'DELETE', headers: deletionOwnerHeaders });
  assert.equal(failedDeleteResponse.status, 500, 'injected failure returns a JSON server error');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM users WHERE id=?').get('test-failed-delete-user').count, 1, 'injected failure must roll back the user delete');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM user_app_data WHERE user_id=?').get('test-failed-delete-user').count, 1, 'injected failure must roll back earlier data cleanup');
  assert.equal(Number(db.prepare('SELECT COUNT(*) AS count FROM user_deletion_audit').get().count), failureAuditBefore, 'injected failure must roll back the audit insert');
  db.exec('DROP TRIGGER fail_test_account_delete');

  const deleteResponse = await request('/api/auth/owner/accounts/test-delete-user', { method: 'DELETE', headers: deletionOwnerHeaders });
  assert.equal(deleteResponse.status, 200, 'approved Owner can delete a non-owner account');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM users WHERE id=?').get('test-delete-user').count, 0, 'deleted user row must be removed');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM sessions WHERE user_id=?').get('test-delete-user').count, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM user_app_data WHERE user_id=?').get('test-delete-user').count, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM ai_transactions WHERE user_id=?').get('test-delete-user').count, 0);
  const deletedMessage = db.prepare('SELECT is_deleted,sender_name,sender_avatar,media_url FROM messages WHERE id=?').get('delete-test-message') as any;
  assert.equal(deletedMessage.is_deleted, 1, 'shared-room message must be soft-deleted, not physically removed');
  assert.equal(db.prepare('SELECT sender_id FROM messages WHERE id=?').get('delete-test-message').sender_id, 'deleted:' + crypto.createHmac('sha256', secret).update('deleted-user-id:test-delete-user').digest('hex'), 'soft-deleted message must not retain the deleted account id');
  assert.equal(deletedMessage.sender_name, null, 'deleted sender display name must be cleared');
  assert.equal(deletedMessage.sender_avatar, null, 'deleted sender avatar must be cleared');
  assert.equal(deletedMessage.media_url, null, 'deleted sender media must be cleared');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM saved_messages WHERE message_id=?').get('delete-test-message').count, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM message_reads WHERE message_id=?').get('delete-test-message').count, 0);
  assert.equal(db.prepare('SELECT creator_id FROM conversations WHERE id=?').get('delete-test-room').creator_id, null, 'shared room must not retain the deleted creator id');
  const retainedGiftClaim = db.prepare('SELECT user_id FROM trip_gift_claims WHERE id=?').get('delete-gift-claim');
  assert.notEqual(retainedGiftClaim.user_id, 'test-delete-user', 'abuse-prevention record must be pseudonymized');
  const retainedWallet = db.prepare('SELECT user_id FROM wallet_transactions WHERE id=?').get('delete-wallet-transaction');
  assert.notEqual(retainedWallet.user_id, 'test-delete-user', 'wallet history must be retained under a pseudonymous user id');
  const cancelledTopup = db.prepare('SELECT user_id,status FROM wallet_topups WHERE id=?').get('delete-wallet-topup');
  assert.notEqual(cancelledTopup.user_id, 'test-delete-user');
  assert.equal(cancelledTopup.status, 'cancelled', 'pending topup is cancelled during account deletion');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM password_resets WHERE lower(email)=lower(?)').get(deleteEmail).count, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM password_reset_requests WHERE lower(email)=lower(?)').get(deleteEmail).count, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM phone_otps WHERE phone=?').get('+201000000000').count, 0);
  assert.notEqual(db.prepare('SELECT recipient FROM email_logs WHERE id=?').get('delete-email-log').recipient, deleteEmail);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM role_audit_log WHERE id=?').get('delete-test-role-audit').count, 1, 'security history remains available');
  assert.notEqual(db.prepare('SELECT target_user_id FROM role_audit_log WHERE id=?').get('delete-test-role-audit').target_user_id, 'test-delete-user');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM user_deletion_audit').get().count, 1, 'every account deletion must be audited');
  const deletionAudit = db.prepare('SELECT deleted_user_id_hash,deleted_email_hash FROM user_deletion_audit').get();
  assert.equal(deletionAudit.deleted_user_id_hash, crypto.createHmac('sha256', secret).update('deleted-user-id:test-delete-user').digest('hex'));
  assert.equal(deletionAudit.deleted_email_hash, crypto.createHmac('sha256', secret).update('deleted-user-email:' + deleteEmail).digest('hex'));
  assert.equal(db.prepare('SELECT action FROM user_deletion_audit').get().action, 'user_deleted', 'deletion audit records its action');
  assert.equal(db.prepare('SELECT actor_user_id FROM user_deletion_audit').get().actor_user_id, 'test-owner', 'deletion audit records the actor id');
  assert.equal(db.prepare('SELECT actor_email FROM user_deletion_audit').get().actor_email, ownerEmail, 'deletion audit records the actor email');
  assert.equal(db.prepare('SELECT deleted_email_hash FROM user_deletion_audit').get().deleted_email_hash.includes(deleteEmail), false, 'audit must not store the deleted email in plain text');

  // Reset only the IP counter after confirming the test and child server share this SQLite file.
  // Distinct addresses isolate this test from the per-email limiter and make it order-independent.
  db.prepare('DELETE FROM password_reset_ip_requests').run();
  for (let i = 1; i <= 11; i++) {
    const result = await post('/api/auth/forgot-password', { email: `unknown-ip-independent-${i}@example.test` });
    assert.equal(result.status, i <= 10 ? 404 : 429, `request ${i} must reflect the per-IP limit independently of test order`);
  }

  console.log('AUTH_SECURITY_INTEGRATION_PASS: role escalation blocked; admin appointment/audit/revocation; exact-origin CORS; DB role authoritative; JWT session revocation; settings isolation; email/IP reset limits; reset token one-use.');
} catch (error) {
  console.error('AUTH_SECURITY_INTEGRATION_FAIL', error);
  // The child server's stdout/stderr are piped, so surface its sanitized diagnostics on failure.
  if (serverOutput) console.error('AUTH_SECURITY_SERVER_OUTPUT', serverOutput);
  if (child) child.kill('SIGTERM');
  if (db) { try { db.close(); } catch {} }
  fs.rmSync(tempDir, { recursive: true, force: true });
  process.exitCode = 1;
} finally {
  if (child && child.exitCode === null) child.kill('SIGTERM');
  if (db) { try { db.close(); } catch {} }
  if (smtpServer) await smtpServer.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
}
