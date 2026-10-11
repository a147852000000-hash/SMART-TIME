# Oracle ↔ GitHub cutover runbook (SAFE / no automatic production writes)

## Status and safety boundary

This branch hardens password reset and adds a dry-run-first importer. It does **not** access Oracle over SSH, change Caddy/PM2, or modify production data. The live Oracle service must be backed up and tested by an operator with shell access before any cutover.

Do not delete `users.json`, `reset-codes.json`, or the old `index.cjs`. Do not point the importer at the production SQLite path. Do not change `TRIAL_MODE`, phone verification, or enable a new `JWT_SECRET` as part of this migration.

## 1. Read-only discovery on Oracle

Run on `ubuntu-server`:

```bash
sudo grep -nE 'smart-time-ai|reverse_proxy' /etc/caddy/Caddyfile
pm2 describe smart-time-ai | grep -E 'status|script path|exec cwd|interpreter|restarts|uptime'
cd /home/ubuntu/smart-time-ai
node -e 'const p=require("./package.json"); console.log(JSON.stringify({name:p.name,scripts:p.scripts,dependencies:Object.keys(p.dependencies||{})},null,2))'
find /home/ubuntu/smart-time-ai -maxdepth 2 -type f ! -name '.env*' ! -path '*/node_modules/*' -printf '%P\n' | sort
```

Never print `.env`, reset codes, full user records, or session tokens.

## 2. Create and verify backups before changing anything

```bash
set -e
cd /home/ubuntu
stamp=$(date +%Y%m%d-%H%M%S)
sudo tar --exclude='smart-time-ai/node_modules' --exclude='smart-time-ai/.git' \
  -czf "/home/ubuntu/smart-time-ai-backup-$stamp.tar.gz" smart-time-ai
chmod 600 "/home/ubuntu/smart-time-ai-backup-$stamp.tar.gz"
cp -a /home/ubuntu/smart-time-ai/users.json "/home/ubuntu/backup-users-$stamp.json"
cp -a /home/ubuntu/smart-time-ai/reset-codes.json "/home/ubuntu/backup-reset-$stamp.json"
chmod 600 "/home/ubuntu/backup-users-$stamp.json" "/home/ubuntu/backup-reset-$stamp.json"
sha256sum "/home/ubuntu/smart-time-ai-backup-$stamp.tar.gz" \
  "/home/ubuntu/backup-users-$stamp.json" "/home/ubuntu/backup-reset-$stamp.json"
```

Store the reported backup paths and hashes in the deployment record. Do not paste file contents into chat.

## 3. Dry-run migration (read-only)

After downloading this branch into a separate staging checkout on Oracle, run:

```bash
node scripts/migrate-legacy-json-to-sqlite.cjs \
  --users /home/ubuntu/smart-time-ai/users.json \
  --sessions /home/ubuntu/smart-time-ai/sessions.json
```

If there is no `sessions.json`, omit the `--sessions` argument. Dry-run mode reads JSON and prints only counts; it writes no files. Review the count summary against the source without displaying user details.

The importer hashes plaintext passwords using the same `salt:hash` scrypt format as `server.ts`. Accounts with no legacy password receive an unknown random password and must use email reset. Legacy owner/admin labels are **not** promoted automatically; review them separately to prevent privilege escalation.

## 4. Build a separate staging database, never overwrite an existing file

Choose a brand-new staging path and confirm it does not exist:

```bash
test ! -e /home/ubuntu/smart-time-ai/data/smart-time-migration-test.db
node scripts/migrate-legacy-json-to-sqlite.cjs \
  --users /home/ubuntu/smart-time-ai/users.json \
  --sessions /home/ubuntu/smart-time-ai/sessions.json \
  --apply --output /home/ubuntu/smart-time-ai/data/smart-time-migration-test.db
chmod 600 /home/ubuntu/smart-time-ai/data/smart-time-migration-test.db
```

The output is a staging auth database, not yet a complete replacement for the whole application's data. Before production use, compare the entire schema used by `backend/database.ts`, verify all application tables and related records, and test a copy of the DB with the exact built server version. Never configure `SMART_TIME_DB_PATH` to this file until that review passes.

## 4B. Build and run the GitHub server on localhost:3001 (no production cutover)

After the PR branch's CI is green, run the following on Oracle. This creates a separate checkout and a separate SQLite file; it does not stop or change the current PM2 service or Caddy. If the repository is private, use the server's existing authenticated Git setup rather than placing a token in the URL.

```bash
set -euo pipefail
LIVE=/home/ubuntu/smart-time-ai
STAGE=/home/ubuntu/smart-time-github-staging
BRANCH=feat/oracle-json-sqlite-unification
DB="$STAGE/data/oracle-migration-staging.db"

test -d "$LIVE"
test ! -e "$STAGE"
git clone --single-branch --branch "$BRANCH" \
  https://github.com/a147852000000-hash/SMART-TIME.git "$STAGE"
cd "$STAGE"

# Do NOT symlink or copy the live .env into staging; that would expose production credentials
# to the staging checkout and could send real email or call production integrations.
# Tests below use isolated test configuration. Configure a dedicated staging mail provider
# separately only when ready to perform an actual inbox-delivery check.

npm install --ignore-scripts --no-audit --no-fund
npm run test:password-reset-email
npm run test:auth-security
npm run test:turnstile
npm run test:legacy-json-migration
npm run lint
npm run build

MIGRATE_ARGS=(--users "$LIVE/users.json")
if [ -f "$LIVE/sessions.json" ]; then MIGRATE_ARGS+=(--sessions "$LIVE/sessions.json"); fi
node scripts/migrate-legacy-json-to-sqlite.cjs "${MIGRATE_ARGS[@]}"
mkdir -p "$STAGE/data"
test ! -e "$DB"
node scripts/migrate-legacy-json-to-sqlite.cjs "${MIGRATE_ARGS[@]}" --apply --output "$DB"
chmod 600 "$DB"

# Run in the foreground, restricted to loopback. Use a new staging-only JWT secret and
# suppress outbound email by default; never load production credentials into this process.
STAGING_JWT_SECRET="$(openssl rand -hex 48)"
NODE_ENV=production HOST=127.0.0.1 PORT=3001 SMART_TIME_DB_PATH="$DB" \
  JWT_SECRET="$STAGING_JWT_SECRET" TURNSTILE_ENFORCE=false \
  EMAIL_PROVIDER= ALLOW_DEV_EMAIL_CODE=true node dist/server.cjs
```

Keep this SSH terminal open. From a second SSH terminal, test only localhost:

```bash
curl -fsS http://127.0.0.1:3001/api/health
curl -sS -o /tmp/smart-time-reset-check.json -w 'HTTP %{http_code}\n' \
  -H 'Content-Type: application/json' \
  -d '{"email":"definitely-not-registered-20261011@example.invalid"}' \
  http://127.0.0.1:3001/api/auth/forgot-password
cat /tmp/smart-time-reset-check.json
rm -f /tmp/smart-time-reset-check.json
```

The expected unknown-email response is HTTP 404 with `EMAIL_NOT_REGISTERED`. Do not test a real email until the staging mail provider is confirmed. Do not open port 3001 in Oracle security rules. Stop the staging process with Ctrl+C in its first terminal. The production service remains unchanged.

The staging database contains only the migrated authentication users/sessions initially; the GitHub server initializes the rest of its application schema when it starts. This does **not** migrate unrelated application data stored outside those JSON files. Do not switch Caddy/PM2 until all required data stores have been inventoried and migrated.

## 5. Required pre-cutover checks

- `npm ci`, `npm run lint`, `npm run build`, and repository CI all pass.
- Staging DB user count equals the source JSON record count; duplicate or invalid emails stop migration.
- Test login for a known migrated account and password; verify a passwordless legacy account can recover via email.
- Test unknown email response: HTTP 404 and `EMAIL_NOT_REGISTERED` with `البريد غير مسجل، يجب التسجيل أولاً`.
- Test registered email reset delivery to a real inbox; ensure token never appears in API response or logs.
- Test invalid token, expired token, sixth guess, and fourth request within 15 minutes.
- Test a normal user attempting owner/admin selection returns 403.
- Restart only the staging process and confirm users and reset-request limits persist.
- Verify Caddy config and the actual upstream port before switching.

## 6. Cutover / rollback

No production cutover is authorized by this runbook alone. The cutover operator must confirm a complete backup, a schema-compatible full database, successful staging tests, and a written rollback command before stopping the old process. Keep the original JSON files and old entry file unchanged until post-cutover verification and a separately scheduled retention decision.
