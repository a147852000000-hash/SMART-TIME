import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const database = fs.readFileSync(new URL('../backend/database.ts', import.meta.url), 'utf8');
const checks = [
  ['role is read from database users.role', /u\\.role as dbRole/.test(server)],
  ['session role is read from server-side session', /s\\.session_role as sessionRole/.test(server)],
  ['session role writes are server-side', /INSERT INTO sessions \\(id,user_id,expires_at,created_at,session_role\\)/.test(server)],
  ['temporary role tickets store a SHA-256 hash', /CREATE TABLE IF NOT EXISTS role_selection_tickets/.test(server) && /createHash\\('sha256'\\)\\.update\\(ticket\\)/.test(server)],
  ['role tickets expire after five minutes', /now\\.getTime\\(\\)\\+5\\*60_000/.test(server)],
  ['owner selection requires DB owner role', /String\\(row\\.role\\|\\|'user'\\)\\.toLowerCase\\(\\)!=='owner'/.test(server)],
  ['owner selection requires server-side allowlist', /OWNER_ROLE_EMAILS\\.has\\(String\\(row\\.email/.test(server)],
  ['role ticket is deleted before final session issue', /DELETE FROM role_selection_tickets WHERE ticket_hash=\\?/.test(server)],
  ['session_role migration exists', /ALTER TABLE sessions ADD COLUMN session_role TEXT NOT NULL DEFAULT 'user'/.test(database)],
  ['public user response includes server-selected role', /role:row\\.sessionRole\\|\\|row\\.role\\|\\|row\\.dbRole\\|\\|'user'/.test(server)],
];
for (const [label, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${label}`);
  assert.equal(passed, true, label);
}
console.log(`Role security static gate passed: ${checks.length}/${checks.length}`);
