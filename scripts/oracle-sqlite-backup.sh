#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

DB_PATH="${SMART_TIME_DB_PATH:-/home/ubuntu/smart-time-data/smart-time.db}"
BACKUP_DIR="${SMART_TIME_BACKUP_DIR:-/home/ubuntu/smart-time-backups}"
RETENTION_DAYS="${SMART_TIME_BACKUP_RETENTION_DAYS:-14}"

[[ -f "$DB_PATH" ]] || { echo "ERROR: configured SQLite database does not exist" >&2; exit 2; }
command -v sqlite3 >/dev/null || { echo "ERROR: sqlite3 CLI is required; install it during an approved server phase" >&2; exit 2; }
command -v sha256sum >/dev/null
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
tmp="$BACKUP_DIR/.smart-time-$stamp.db.tmp"
final="$BACKUP_DIR/smart-time-$stamp.db"
trap 'rm -f "$tmp"' EXIT

# SQLite .backup safely includes committed WAL content; never copy a live DB file directly.
sqlite3 "$DB_PATH" ".backup '$tmp'"
chmod 600 "$tmp"
integrity="$(sqlite3 "$tmp" 'PRAGMA integrity_check;')"
[[ "$integrity" == "ok" ]] || { echo "ERROR: backup integrity check failed" >&2; exit 3; }
sqlite3 "$tmp" 'PRAGMA foreign_key_check;' > "$tmp.foreign-key-check"
[[ ! -s "$tmp.foreign-key-check" ]] || { echo "ERROR: backup has foreign-key violations" >&2; exit 4; }
rm -f "$tmp.foreign-key-check"
mv "$tmp" "$final"
sha256sum "$final" > "$final.sha256"
chmod 600 "$final" "$final.sha256"
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'smart-time-*.db' -mtime +"$RETENTION_DAYS" -print -delete
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'smart-time-*.db.sha256' -mtime +"$RETENTION_DAYS" -print -delete
echo "BACKUP_OK path=$final integrity=ok sha256_file=$final.sha256"
echo "NOTE: configure an independently secured off-server copy before treating this as disaster recovery."
