#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

BACKUP_FILE="${1:-}"
[[ -n "$BACKUP_FILE" && -f "$BACKUP_FILE" ]] || { echo "Usage: $0 /path/to/smart-time-YYYYMMDDTHHMMSSZ.db" >&2; exit 2; }
command -v sqlite3 >/dev/null || { echo "ERROR: sqlite3 CLI is required; install it during an approved server phase" >&2; exit 2; }
command -v sha256sum >/dev/null

if [[ -f "$BACKUP_FILE.sha256" ]]; then
  (cd "$(dirname "$BACKUP_FILE")" && sha256sum -c "$(basename "$BACKUP_FILE").sha256")
else
  echo "ERROR: matching SHA-256 file missing" >&2; exit 3
fi

RESTORE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/smart-time-restore-test.XXXXXX")"
chmod 700 "$RESTORE_DIR"
trap 'rm -rf "$RESTORE_DIR"' EXIT
RESTORED="$RESTORE_DIR/restored.db"
# Restore into a new temporary path only; never point this script at the production path.
sqlite3 "$BACKUP_FILE" ".backup '$RESTORED'"
chmod 600 "$RESTORED"
integrity="$(sqlite3 "$RESTORED" 'PRAGMA integrity_check;')"
[[ "$integrity" == "ok" ]] || { echo "ERROR: restored database integrity check failed" >&2; exit 4; }
tables="$(sqlite3 "$RESTORED" "SELECT count(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")"
[[ "$tables" =~ ^[0-9]+$ && "$tables" -gt 0 ]] || { echo "ERROR: restored DB has no application tables" >&2; exit 5; }
foreign_keys="$(sqlite3 "$RESTORED" 'PRAGMA foreign_key_check;')"
[[ -z "$foreign_keys" ]] || { echo "ERROR: restored DB has foreign-key violations" >&2; exit 6; }
echo "RESTORE_TEST_OK source=$BACKUP_FILE integrity=ok application_tables=$tables foreign_key_check=ok"
echo "This validates a temporary restore copy; it does not replace the live database."
