#!/usr/bin/env bash
# Daily Postgres dump — run as cron or call manually.
#
# Usage (manual):
#   ./scripts/backup-postgres.sh
#
# Cron (daily at 03:00 on the host):
#   0 3 * * * /path/to/bubukleinanzeigen-saas/scripts/backup-postgres.sh >> /var/log/bubu-backup.log 2>&1
#
# Environment variables (override defaults via .env.prod or shell):
#   POSTGRES_USER     default: bubu
#   POSTGRES_DB       default: bubukleinanzeigen
#   BACKUP_DIR        default: /var/backups/bubu-postgres
#   BACKUP_KEEP_DAYS  default: 14
#   COMPOSE_PROJECT   default: bubukleinanzeigen-saas (Docker Compose project name)

set -euo pipefail

POSTGRES_USER="${POSTGRES_USER:-bubu}"
POSTGRES_DB="${POSTGRES_DB:-bubukleinanzeigen}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/bubu-postgres}"
BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
COMPOSE_PROJECT="${COMPOSE_PROJECT:-bubukleinanzeigen-saas}"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="backup_${POSTGRES_DB}_${TIMESTAMP}.sql.gz"
DEST="${BACKUP_DIR}/${FILENAME}"

mkdir -p "${BACKUP_DIR}"

echo "[$(date -Iseconds)] Starting backup → ${DEST}"

# pg_dump runs inside the postgres container; output piped to gzip on host
docker compose \
  -p "${COMPOSE_PROJECT}" \
  -f "$(dirname "$0")/../docker-compose.prod.yml" \
  exec -T postgres \
  pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" \
  | gzip > "${DEST}"

SIZE=$(du -h "${DEST}" | cut -f1)
echo "[$(date -Iseconds)] Backup complete — ${DEST} (${SIZE})"

# Remove backups older than BACKUP_KEEP_DAYS days
find "${BACKUP_DIR}" -name "backup_${POSTGRES_DB}_*.sql.gz" -mtime "+${BACKUP_KEEP_DAYS}" -delete
echo "[$(date -Iseconds)] Pruned backups older than ${BACKUP_KEEP_DAYS} days"
