#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

BACKUP_DIR="${SMART_TIME_BACKUP_DIR:-/home/ubuntu/smart-time-backups}"
RETENTION_DAYS="${SMART_TIME_BACKUP_RETENTION_DAYS:-14}"
APPLY=false

if [[ "${1:-}" == "--apply" ]]; then
  APPLY=true
elif [[ $# -gt 0 ]]; then
  echo "Usage: $0 [--apply]" >&2
  exit 2
fi

[[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] || { echo "ERROR: SMART_TIME_BACKUP_RETENTION_DAYS must be a non-negative integer" >&2; exit 2; }
[[ -d "$BACKUP_DIR" ]] || { echo "ERROR: dedicated backup directory does not exist" >&2; exit 2; }
BACKUP_DIR="$(cd "$BACKUP_DIR" && pwd -P)"
[[ "$BACKUP_DIR" != "/" && "$BACKUP_DIR" != "/home" && "$BACKUP_DIR" != "/home/ubuntu" ]] || {
  echo "ERROR: refusing retention cleanup on a broad directory that could contain approved rollback points" >&2
  exit 3
}

# Only artifacts created by oracle-sqlite-backup.sh are eligible. This script never
# recursively searches and never scans the live checkout or the approved rollback directory.
mapfile -d '' candidates < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'smart-time-*.db' -mtime +"$RETENTION_DAYS" -print0)

if ((${#candidates[@]} == 0)); then
  echo "RETENTION_OK no matching backups older than $RETENTION_DAYS days"
  exit 0
fi

for file in "${candidates[@]}"; do
  sidecar="$file.sha256"
  if [[ "$APPLY" == true ]]; then
    rm -f -- "$file" "$sidecar"
    printf 'DELETED_BACKUP %s\n' "$file"
  else
    printf 'DRY_RUN_WOULD_DELETE %s\n' "$file"
    [[ ! -f "$sidecar" ]] || printf 'DRY_RUN_WOULD_DELETE %s\n' "$sidecar"
  fi
done

if [[ "$APPLY" == true ]]; then
  echo "RETENTION_APPLIED dedicated_backup_dir=$BACKUP_DIR retention_days=$RETENTION_DAYS"
else
  echo "DRY RUN ONLY. Review this list, then pass --apply to delete these backup artifacts."
fi
