const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

const script = path.join(__dirname, 'migrate-legacy-json-to-sqlite.cjs');
function tempDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'smart-time-migration-test-')); }
function run(args) {
  return spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
}

test('dry run reports counts without writing a database or mutating source JSON', () => {
  const dir = tempDir();
  try {
    const users = path.join(dir, 'users.json');
    const sessions = path.join(dir, 'sessions.json');
    const output = path.join(dir, 'should-not-exist.db');
    const userSource = JSON.stringify([{ id: 'u1', email: 'person@example.com', name: 'Person', password: 'plain-secret', role: 'owner' }]);
    fs.writeFileSync(users, userSource, { mode: 0o600 });
    fs.writeFileSync(sessions, JSON.stringify([{ token: 'session-token', userId: 'u1', expiresAt: new Date(Date.now() + 60 * 60_000).toISOString() }]), { mode: 0o600 });
    const result = run(['--users', users, '--sessions', sessions]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /DRY_RUN_READ_ONLY/);
    assert.match(result.stdout, /"validUsers": 1/);
    assert.match(result.stdout, /"importableSessions": 1/);
    assert.match(result.stdout, /"legacyOwnerOrAdminRecordsRequiringManualReview": 1/);
    assert.equal(fs.existsSync(output), false);
    assert.equal(fs.readFileSync(users, 'utf8'), userSource);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('apply writes an isolated SQLite DB, hashes plaintext password, and downgrades legacy owner to user', () => {
  const dir = tempDir();
  try {
    const users = path.join(dir, 'users.json');
    const sessions = path.join(dir, 'sessions.json');
    const output = path.join(dir, 'staging.db');
    fs.writeFileSync(users, JSON.stringify([
      { id: 'u1', email: 'person@example.com', name: 'Person', password: 'plain-secret', role: 'owner' },
      { id: 'u2', email: 'reset@example.com', name: 'Reset Only', password: '', autoCreated: true }
    ]), { mode: 0o600 });
    fs.writeFileSync(sessions, JSON.stringify([{ token: 'session-token', userId: 'u1', expiresAt: new Date(Date.now() + 60 * 60_000).toISOString() }]), { mode: 0o600 });
    const result = run(['--users', users, '--sessions', sessions, '--apply', '--output', output]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /"verified": true/);
    const db = new DatabaseSync(output);
    try {
      const person = db.prepare('SELECT email,password_hash,role FROM users WHERE id=?').get('u1');
      assert.equal(person.email, 'person@example.com');
      assert.equal(person.role, 'user');
      assert.notEqual(person.password_hash, 'plain-secret');
      const [salt, hash] = person.password_hash.split(':');
      assert.match(salt, /^[a-f0-9]{32}$/);
      assert.match(hash, /^[a-f0-9]{128}$/);
      const resetOnly = db.prepare('SELECT password_hash,role FROM users WHERE id=?').get('u2');
      assert.equal(resetOnly.role, 'user');
      assert.notEqual(resetOnly.password_hash, '');
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 1);
    } finally { db.close(); }
    const second = run(['--users', users, '--apply', '--output', output]);
    assert.notEqual(second.status, 0);
    assert.match(second.stderr, /refusing to overwrite/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('invalid input stops without creating a database', () => {
  const dir = tempDir();
  try {
    const users = path.join(dir, 'users.json');
    const output = path.join(dir, 'staging.db');
    fs.writeFileSync(users, JSON.stringify([{ name: 'No email', password: 'x' }]), { mode: 0o600 });
    const result = run(['--users', users, '--apply', '--output', output]);
    assert.notEqual(result.status, 0);
    assert.equal(fs.existsSync(output), false);
    assert.match(result.stderr, /no valid email/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});


test('missing, invalid, and expired legacy sessions are never made valid during migration', () => {
  const dir = tempDir();
  try {
    const users = path.join(dir, 'users.json');
    const sessions = path.join(dir, 'sessions.json');
    fs.writeFileSync(users, JSON.stringify([{ id: 'u1', email: 'person@example.com', password: 'plain-secret' }]), { mode: 0o600 });
    fs.writeFileSync(sessions, JSON.stringify([
      { token: 'no-expiry', userId: 'u1' },
      { token: 'bad-expiry', userId: 'u1', expiresAt: 'not-a-date' },
      { token: 'expired', userId: 'u1', expiresAt: new Date(Date.now() - 60_000).toISOString() },
      { token: 'valid', userId: 'u1', expiresAt: new Date(Date.now() + 60 * 60_000).toISOString() },
    ]), { mode: 0o600 });
    const result = run(['--users', users, '--sessions', sessions]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /"importableSessions": 1/);
    assert.match(result.stdout, /"invalidOrOrphanSessionsSkipped": 3/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('duplicate normalized usernames and phone numbers stop before creating output', () => {
  const cases = [
    {
      rows: [
        { id: 'u1', email: 'one@example.com', username: 'SameName', password: 'secret1' },
        { id: 'u2', email: 'two@example.com', username: 'samename', password: 'secret2' },
      ],
      message: /Duplicate username detected/,
    },
    {
      rows: [
        { id: 'u1', email: 'one@example.com', phone: '+20 100-200-3000', password: 'secret1' },
        { id: 'u2', email: 'two@example.com', phone: '+201002003000', password: 'secret2' },
      ],
      message: /Duplicate phone detected/,
    },
  ];
  for (const item of cases) {
    const dir = tempDir();
    try {
      const users = path.join(dir, 'users.json');
      const output = path.join(dir, 'staging.db');
      fs.writeFileSync(users, JSON.stringify(item.rows), { mode: 0o600 });
      const result = run(['--users', users, '--apply', '--output', output]);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, item.message);
      assert.equal(fs.existsSync(output), false);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
});
