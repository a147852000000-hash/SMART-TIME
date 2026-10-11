#!/usr/bin/env node
/**
 * Safe legacy JSON -> isolated SQLite migration for SMART-TIME.
 *
 * Default mode is READ-ONLY (dry run). --apply requires an explicit --output path.
 * It refuses to overwrite an existing SQLite file. Never point --output at the
 * production DB until the dry-run report and a separate restore test are reviewed.
 *
 * Usage:
 *   node scripts/migrate-legacy-json-to-sqlite.cjs --users /path/users.json
 *   node scripts/migrate-legacy-json-to-sqlite.cjs --users /path/users.json --sessions /path/sessions.json
 *   node scripts/migrate-legacy-json-to-sqlite.cjs --users /path/users.json --apply --output /tmp/smart-time-migration-test.db
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function has(name) { return process.argv.includes(name); }
function readJson(file, label) {
  if (!file) return [];
  const raw = fs.readFileSync(path.resolve(file), 'utf8');
  const parsed = JSON.parse(raw);
  const rows = Array.isArray(parsed) ? parsed
    : Array.isArray(parsed?.users) ? parsed.users
    : Array.isArray(parsed?.sessions) ? parsed.sessions
    : null;
  if (!rows) throw new Error(label + ' must be a JSON array (or an object containing the matching array).');
  return rows;
}
function first(obj, keys, fallback = '') {
  for (const key of keys) if (obj?.[key] !== undefined && obj?.[key] !== null && String(obj[key]).trim() !== '') return obj[key];
  return fallback;
}
function iso(value, fallback) {
  if (!value) return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d.toISOString();
}
function makePasswordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(String(password), salt, 64).toString('hex');
}
function isScryptHash(value) {
  const parts = String(value || '').split(':');
  return parts.length === 2 && /^[a-f0-9]{32}$/i.test(parts[0]) && /^[a-f0-9]{128}$/i.test(parts[1]);
}
function normalizeUser(row, index) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('Invalid user record at index ' + index);
  const email = String(first(row, ['email', 'Email'])).trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('User record ' + index + ' has no valid email; migration stopped without writing.');
  }
  const id = String(first(row, ['id', 'userId', 'user_id'], 'usr_' + crypto.randomUUID())).slice(0, 200);
  const usernameRaw = String(first(row, ['username', 'userName'], '')).trim().toLowerCase();
  const username = /^[a-z0-9_.-]{3,30}$/.test(usernameRaw) ? usernameRaw : null;
  const displayName = String(first(row, ['display_name', 'displayName', 'name', 'fullName'], email.split('@')[0])).slice(0, 160);
  const existingHash = String(first(row, ['password_hash', 'passwordHash'], ''));
  const rawPassword = String(first(row, ['password', 'pass', 'plainPassword'], ''));
  // Empty/auto-created legacy accounts receive an unknown random password. They can
  // regain access only through the secured email reset flow; no plaintext is carried over.
  const passwordHash = isScryptHash(existingHash) ? existingHash : makePasswordHash(rawPassword || crypto.randomBytes(32).toString('hex'));
  // Never carry owner/admin privileges across from a legacy JSON source automatically.
  // All migrated accounts start as least-privilege user; owner/admin promotion is a separate reviewed DB operation.
  const role = 'user';
  const createdAt = iso(first(row, ['created_at', 'createdAt', 'created', 'registeredAt']), new Date(0).toISOString());
  const phone = String(first(row, ['phone', 'mobile'], '')).trim() || null;
  const phoneVerified = ['true', '1', 'yes'].includes(String(first(row, ['phone_verified', 'phoneVerified'], 'false')).toLowerCase()) ? 1 : 0;
  const activationStatus = String(first(row, ['activation_status', 'activationStatus'], 'active')).slice(0, 40);
  const avatar = String(first(row, ['avatar', 'avatarUrl'], '')).trim() || null;
  return { id, email, username, passwordHash, displayName, avatar, createdAt, phone, phoneVerified, activationStatus, role };
}
function normalizeSession(row, index, usersByEmail) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('Invalid session record at index ' + index);
  let userId = String(first(row, ['user_id', 'userId', 'uid'], '')).trim();
  if (!userId) {
    const email = String(first(row, ['email', 'userEmail'], '')).trim().toLowerCase();
    userId = usersByEmail.get(email)?.id || '';
  }
  if (!userId) return null;
  const token = String(first(row, ['id', 'token', 'sessionToken', 'session_id'], '')).trim();
  if (!token) return null;
  const now = new Date().toISOString();
  return {
    id: token,
    userId,
    expiresAt: iso(first(row, ['expires_at', 'expiresAt', 'expiry']), new Date(Date.now() + 30 * 86400000).toISOString()),
    createdAt: iso(first(row, ['created_at', 'createdAt', 'created']), now),
  };
}
function main() {
  const usersFile = arg('--users');
  const sessionsFile = arg('--sessions');
  if (!usersFile) throw new Error('Required: --users /path/to/users.json');
  const rawUsers = readJson(usersFile, 'users.json');
  const users = rawUsers.map(normalizeUser);
  const emailSet = new Set();
  const idSet = new Set();
  for (const u of users) {
    if (emailSet.has(u.email)) throw new Error('Duplicate email detected (value hidden); migration stopped.');
    if (idSet.has(u.id)) throw new Error('Duplicate user id detected; migration stopped.');
    emailSet.add(u.email); idSet.add(u.id);
  }
  const usersByEmail = new Map(users.map(u => [u.email, u]));
  const rawSessions = readJson(sessionsFile, 'sessions.json');
  const sessions = rawSessions.map((row, index) => normalizeSession(row, index, usersByEmail)).filter(s => s && idSet.has(s.userId));
  const apply = has('--apply');
  const output = arg('--output');
  if (apply && !output) throw new Error('--apply requires --output with a NEW, isolated SQLite path.');
  if (!apply && output) throw new Error('--output is only accepted together with --apply.');
  if (apply && fs.existsSync(path.resolve(output))) throw new Error('Output already exists; refusing to overwrite any database.');
  const report = {
    mode: apply ? 'APPLY_TO_NEW_FILE' : 'DRY_RUN_READ_ONLY',
    inputUsers: rawUsers.length,
    validUsers: users.length,
    existingScryptHashesPreserved: rawUsers.filter(r => isScryptHash(first(r, ['password_hash', 'passwordHash'], ''))).length,
    legacyPasswordsHashed: rawUsers.filter(r => !isScryptHash(first(r, ['password_hash', 'passwordHash'], '')) && String(first(r, ['password', 'pass', 'plainPassword'], '')).length > 0).length,
    passwordlessLegacyAccountsGivenRandomUnknownPassword: rawUsers.filter(r => !isScryptHash(first(r, ['password_hash', 'passwordHash'], '')) && !String(first(r, ['password', 'pass', 'plainPassword'], '')).length).length,
    legacyOwnerOrAdminRecordsRequiringManualReview: rawUsers.filter(r => ['owner','admin'].includes(String(first(r, ['role','appRole'],'user')).toLowerCase())).length,
    inputSessions: rawSessions.length,
    importableSessions: sessions.length,
    invalidOrOrphanSessionsSkipped: rawSessions.length - sessions.length,
    legacyFilesModified: false,
    outputDatabase: apply ? path.resolve(output) : null,
  };
  if (!apply) {
    console.log(JSON.stringify(report, null, 2));
    console.log('DRY RUN ONLY: no database or input file was written.');
    return;
  }
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  const db = new DatabaseSync(path.resolve(output));
  try {
    db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
    db.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, username TEXT,
        password_hash TEXT NOT NULL, display_name TEXT, avatar TEXT,
        created_at TEXT NOT NULL, phone TEXT, phone_verified INTEGER NOT NULL DEFAULT 0,
        activation_status TEXT NOT NULL DEFAULT 'pending', role TEXT NOT NULL DEFAULT 'user',
        activated_by TEXT, activated_at TEXT, trip_free_searches INTEGER NOT NULL DEFAULT 0,
        trip_gift_claimed_at TEXT
      );
      CREATE UNIQUE INDEX idx_users_username ON users(username) WHERE username IS NOT NULL;
      CREATE UNIQUE INDEX idx_users_phone ON users(phone) WHERE phone IS NOT NULL;
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL, session_role TEXT NOT NULL DEFAULT 'user'
      );
      CREATE TABLE password_resets (
        email TEXT PRIMARY KEY, code_hash TEXT NOT NULL, expires_at TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
      );
      CREATE TABLE password_reset_requests (
        email TEXT PRIMARY KEY, window_started_at TEXT NOT NULL, request_count INTEGER NOT NULL DEFAULT 0
      );
    `);
    const insertUser = db.prepare(`INSERT INTO users (id,email,username,password_hash,display_name,avatar,created_at,phone,phone_verified,activation_status,role) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
    const insertSession = db.prepare('INSERT INTO sessions (id,user_id,expires_at,created_at) VALUES (?,?,?,?)');
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const u of users) insertUser.run(u.id,u.email,u.username,u.passwordHash,u.displayName,u.avatar,u.createdAt,u.phone,u.phoneVerified,u.activationStatus,u.role);
      for (const s of sessions) insertSession.run(s.id,s.userId,s.expiresAt,s.createdAt);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    const userCount = Number(db.prepare('SELECT COUNT(*) AS n FROM users').get().n);
    const sessionCount = Number(db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n);
    if (userCount !== users.length || sessionCount !== sessions.length) throw new Error('Post-write verification count mismatch.');
    report.writtenUsers = userCount;
    report.writtenSessions = sessionCount;
    report.verified = true;
    console.log(JSON.stringify(report, null, 2));
    console.log('IMPORTANT: this file is a migration staging database, not a production cutover. Verify schema and restore/login tests before configuring SMART_TIME_DB_PATH.');
  } finally {
    db.close();
  }
}
try { main(); } catch (error) {
  console.error('Migration stopped safely:', error instanceof Error ? error.message : 'unknown error');
  process.exitCode = 1;
}
