import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const database = fs.readFileSync(new URL('../backend/database.ts', import.meta.url), 'utf8');
const checks = [
  ['role is read from database users.role', server.includes('u.role as dbRole')],
  ['session role is read from server-side session', server.includes('s.session_role as sessionRole')],
  ['session role writes are server-side', server.includes('INSERT INTO sessions (id,user_id,expires_at,created_at,session_role)')],
  ['temporary role tickets store a SHA-256 hash', server.includes('CREATE TABLE IF NOT EXISTS role_selection_tickets') && server.includes("createHash('sha256').update(ticket)")],
  ['role tickets expire after five minutes', server.includes('now.getTime()+5*60_000')],
  ['owner selection requires DB owner role', server.includes("String(row.role||'user').toLowerCase()!=='owner'")],
  ['owner selection requires server-side allowlist', server.includes('OWNER_ROLE_EMAILS.has(String(row.email')],
  ['role ticket is deleted before final session issue', server.includes('DELETE FROM role_selection_tickets WHERE ticket_hash=?')],
  ['session_role migration exists', database.includes("ALTER TABLE sessions ADD COLUMN session_role TEXT NOT NULL DEFAULT 'user'")],
  ['public user response includes server-selected role', server.includes("role:row.sessionRole||row.role||row.dbRole||'user'")],
];
for (const [label, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${label}`);
  assert.equal(passed, true, label);
}
console.log(`Role security static gate passed: ${checks.length}/${checks.length}`);
