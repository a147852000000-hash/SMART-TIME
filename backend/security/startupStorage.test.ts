import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const testSecret = 'test-only-rate-limit-secret-0123456789';
const resetSecret = 'test-only-password-reset-secret-0123456789';
const jwtSecret = 'test-only-jwt-secret-01234567890123456789';

function createTempDatabase(createSql?: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-time-startup-schema-'));
  const databasePath = path.join(dir, 'smart-time.db');
  if (createSql) {
    const db = new DatabaseSync(databasePath);
    try { db.exec(createSql); } finally { db.close(); }
  }
  return { dir, databasePath };
}

function runServer(databasePath: string, extraEnv: Record<string, string> = {}) {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 20_000,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      PORT: '0',
      SMART_TIME_DB_PATH: databasePath,
      JWT_SECRET: jwtSecret,
      PASSWORD_RESET_HMAC_SECRET: resetSecret,
      RATE_LIMIT_HASH_SECRET: testSecret,
      OWNER_EMAILS: '',
      TURNSTILE_ENFORCE: 'false',
      SMTP_HOST: '',
      SMTP_PORT: '',
      SMTP_USER: '',
      SMTP_PASS: '',
      ...extraEnv,
    },
  });
  return { ...result, output: String(result.stdout || '') + String(result.stderr || '') };
}

test('startup fails closed when role_audit_log columns are wrong', () => {
  const temp = createTempDatabase('CREATE TABLE role_audit_log (wrong_column TEXT);');
  try {
    const result = runServer(temp.databasePath);
    assert.notEqual(result.status, 0, 'the server must not start with an incompatible audit table');
    assert.match(result.output, /Failed to create or validate role_audit_log schema/);
    assert.match(result.output, /role_audit_log does not have the required schema/);
  } finally {
    fs.rmSync(temp.dir, { recursive: true, force: true });
  }
});

test('startup fails closed when password_reset_ip_requests columns are wrong', () => {
  const temp = createTempDatabase('CREATE TABLE password_reset_ip_requests (wrong_column TEXT);');
  try {
    const result = runServer(temp.databasePath);
    assert.notEqual(result.status, 0, 'the server must not start with an incompatible IP limiter table');
    assert.match(result.output, /Failed to create or validate password_reset_ip_requests schema/);
    assert.match(result.output, /password_reset_ip_requests does not have the required schema/);
  } finally {
    fs.rmSync(temp.dir, { recursive: true, force: true });
  }
});

test('startup fails clearly when RATE_LIMIT_HASH_SECRET is missing', () => {
  const temp = createTempDatabase();
  try {
    const result = runServer(temp.databasePath, { RATE_LIMIT_HASH_SECRET: '' });
    assert.notEqual(result.status, 0, 'rate limiting must not start with a hard-coded fallback secret');
    assert.match(result.output, /RATE_LIMIT_HASH_SECRET is required and must contain at least 32 characters/);
  } finally {
    fs.rmSync(temp.dir, { recursive: true, force: true });
  }
});

test('database startup enforces mode 700 on the data directory and 600 on the database', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-time-db-permissions-'));
  const dataDir = path.join(dir, 'data');
  const databasePath = path.join(dataDir, 'smart-time.db');
  try {
    fs.mkdirSync(dataDir, { recursive: true, mode: 0o755 });
    fs.chmodSync(dataDir, 0o755);
    const existingDb = new DatabaseSync(databasePath);
    existingDb.close();
    fs.chmodSync(databasePath, 0o644);

    const code = `import('./backend/database.ts').then(({ db }) => db.close()).catch(error => { console.error(error); process.exitCode = 1; });`;
    const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', code], {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 20_000,
      env: { ...process.env, SMART_TIME_DB_PATH: databasePath },
    });
    assert.equal(result.status, 0, String(result.stdout || '') + String(result.stderr || ''));
    assert.equal(fs.statSync(dataDir).mode & 0o777, 0o700, 'database directory must be private');
    assert.equal(fs.statSync(databasePath).mode & 0o777, 0o600, 'SQLite database must not be readable by other users');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
