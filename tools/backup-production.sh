#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-class-backend/.env.prod}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"

if ! command -v restic >/dev/null 2>&1; then
  echo "restic is required for incremental backups." >&2
  exit 1
fi

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

: "${RESTIC_REPOSITORY:=${BACKUP_DIRECTORY:-./var/backups}/restic}"
: "${RESTIC_PASSWORD:?RESTIC_PASSWORD is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${POSTGRES_USER:?POSTGRES_USER is required}"

export RESTIC_REPOSITORY RESTIC_PASSWORD

cleanup() {
  docker compose -f "$COMPOSE_FILE" exec -T backend sh -c 'rm -f /maintenance/maintenance.flag' >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

restic snapshots >/dev/null 2>&1 || restic init

docker compose -f "$COMPOSE_FILE" exec -T backend sh -c 'touch /maintenance/maintenance.flag'
sleep 10

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

docker compose -f "$COMPOSE_FILE" exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
  | restic backup --stdin --stdin-filename "classops-${STAMP}.sql"

docker compose -f "$COMPOSE_FILE" exec -T backend tar -C /data -cf - private-files staging-files \
  | restic backup --stdin --stdin-filename "classops-files-${STAMP}.tar"

restic forget --keep-daily "$RETENTION_DAYS" --prune
cleanup

echo "Backup completed: $STAMP"
