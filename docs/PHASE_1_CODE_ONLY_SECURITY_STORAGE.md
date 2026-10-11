# Phase 1 — Code-only security and storage preparation

Status: prepared in GitHub only. These files have not been executed on Oracle. No server, Caddy, PM2, Docker/LiveKit, network rule, secret, or production database was changed by these scripts/docs.

## Exact CORS allowlist

`server.ts` now accepts exact origins from `ALLOWED_ORIGINS`, comma-separated. There is no default wildcard and no wildcard `*.vercel.app`. In production, an unset/empty allowlist permits requests with no Origin header (for non-browser/server-to-server clients) but rejects any supplied Origin. Before a frontend cutover, set the exact HTTPS frontend origin(s) yourself in the server environment. Do not include paths or trailing slashes. Keep credentials disabled unless a separate reviewed requirement exists.

The final production frontend origin has not yet been confirmed. Configure it in the server environment only in the approved deployment phase; no secret or domain is embedded in code.

## Owner/admin policy

- `OWNER_EMAILS` defaults to empty; no implicit owner exists.
- Owner authorization requires DB role `owner` and an exact email in `OWNER_EMAILS`.
- Admin authorization is based on DB role `admin`; it does not require membership in `OWNER_EMAILS`.
- The owner-only `POST /api/auth/owner/admin-role` accepts `{ "email": "...", "action": "appoint" | "revoke" }`.
- Only an existing account can be appointed. Self-appointment/change is rejected. An owner cannot be demoted by this endpoint.
- Changes are recorded in `role_audit_log` with actor, target, action, and timestamp.
- Revoking an admin deletes all sessions for that target inside the same SQLite transaction. This invalidates elevated sessions immediately.
- Audit history is available through owner-only `GET /api/auth/owner/admin-role/audit?limit=50`.

## Persistent SQLite path

The server database module honors `SMART_TIME_DB_PATH`; the intended Oracle path is `/home/ubuntu/smart-time-data/smart-time.db`. The directory must be owned by the runtime account and mode 700; the database and backup files should be mode 600. Do not set this path or migrate production data until a full-schema review confirms the running application is compatible with the selected database.

## Legacy JSON migration

`scripts/migrate-legacy-json-to-sqlite.cjs` defaults to dry-run and refuses to overwrite an existing output file. First run it without `--apply`; inspect counts only. Its current importer is an auth-data importer, not a complete migration of all application data. It intentionally downgrades legacy roles to `user`; owner promotion is a separate reviewed SQL step. Preserve `users.json`, `reset-codes.json`, and all rollback backups.

## Owner promotion SQL

`scripts/sql/promote-approved-owners.sql` targets only the two explicitly approved owner emails. It does not create missing users or demote other users. Before execution, verify both accounts exist and inspect the transaction's affected rows. If either account is missing or unexpected rows would change, rollback and stop.

## Daily backup and restore verification

- `scripts/oracle-sqlite-backup.sh` creates a SQLite-consistent backup using the sqlite3 `.backup` command, verifies integrity and foreign keys, and writes SHA-256 metadata.
- `scripts/oracle-sqlite-restore-test.sh` checks the checksum and restores a copy to a fresh temporary directory, then verifies integrity, application tables, and foreign keys. It does not touch the live database.
- A daily cron entry is only a proposal until an operator installs it during the approved deployment phase. Example after confirming paths and running a manual backup + restore test:
  `17 2 * * * SMART_TIME_DB_PATH=/home/ubuntu/smart-time-data/smart-time.db SMART_TIME_BACKUP_DIR=/home/ubuntu/smart-time-backups /home/ubuntu/smart-time-ai/scripts/oracle-sqlite-backup.sh >> /home/ubuntu/smart-time-backups/backup.log 2>&1`
- This is a local backup, not off-server disaster recovery. Before production approval, configure a separately secured off-server copy and test recovery from that copy. Do not place secrets in the crontab or logs.

## Required tests before Phase 1 closure

1. Add automated tests for admin appointment/revocation, owner protection, non-owner denial, self-target denial, audit rows, and session invalidation.
2. Run auth, password-reset, Turnstile, migration, lint, build, and relevant Chat/Voice/Video suites in CI.
3. Test CORS for exact allowed origin, unknown origin, wildcard Vercel subdomain, absent Origin, and OPTIONS.
4. Verify frontend LiveKit URL and document whether it uses `ws://` or `wss://`; do not change LiveKit/network in Phase 1.
5. Review `trust proxy` and rate limiting against spoofed `X-Forwarded-For` through the actual reverse proxy.
6. Do not declare production ready based on code presence alone.
