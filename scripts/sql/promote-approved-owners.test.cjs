const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const sqlPath = path.join(__dirname, 'promote-approved-owners.sql');
const rawSql = fs.readFileSync(sqlPath, 'utf8');
// Dot commands are sqlite3 CLI directives. The remaining SQL is also executed against
// node:sqlite so the safety preconditions can be regression-tested in CI.
const sql = rawSql.split(/\r?\n/).filter(line => !/^\s*\.(bail|headers|mode|print)\b/i.test(line)).join('\n');

const approved = [
  'eng.mamdouh2009@gmail.com',
  'mamdouh.oracle.2026@gmail.com',
];

function setup(rows) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-time-owner-promotion-'));
  const dbPath = path.join(dir, 'test.db');
  const db = new DatabaseSync(dbPath);
  db.exec('CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL, role TEXT NOT NULL)');
  const insert = db.prepare('INSERT INTO users(id,email,role) VALUES(?,?,?)');
  rows.forEach((row, index) => insert.run(String(index + 1), row.email, row.role));
  return { dir, db };
}

test('owner promotion requires both approved accounts, updates exactly two rows, and does not auto-commit', () => {
  const fixture = setup(approved.map(email => ({ email, role: 'user' })));
  try {
    fixture.db.exec(sql);
    assert.equal(fixture.db.prepare('SELECT COUNT(*) AS n FROM users WHERE role = ?').get('owner').n, 2);
    fixture.db.exec('ROLLBACK');
    assert.equal(fixture.db.prepare('SELECT COUNT(*) AS n FROM users WHERE role = ?').get('user').n, 2, 'prepared promotion remains reversible until manually committed');
  } finally {
    fixture.db.close();
    fs.rmSync(fixture.dir, { recursive: true, force: true });
  }
});

test('owner promotion rolls back when an approved account is missing', () => {
  const fixture = setup([{ email: approved[0], role: 'user' }]);
  try {
    assert.throws(() => fixture.db.exec(sql), /exactly two approved accounts and exactly two role changes are required/);
    assert.equal(fixture.db.prepare('SELECT role FROM users WHERE email=?').get(approved[0]).role, 'user');
  } finally {
    fixture.db.close();
    fs.rmSync(fixture.dir, { recursive: true, force: true });
  }
});

test('owner promotion rolls back unless exactly two rows change', () => {
  const fixture = setup([{ email: approved[0], role: 'owner' }, { email: approved[1], role: 'user' }]);
  try {
    assert.throws(() => fixture.db.exec(sql), /exactly two approved accounts and exactly two role changes are required/);
    assert.equal(fixture.db.prepare('SELECT role FROM users WHERE email=?').get(approved[0]).role, 'owner');
    assert.equal(fixture.db.prepare('SELECT role FROM users WHERE email=?').get(approved[1]).role, 'user');
  } finally {
    fixture.db.close();
    fs.rmSync(fixture.dir, { recursive: true, force: true });
  }
});
