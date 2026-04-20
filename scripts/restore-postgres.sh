#!/usr/bin/env bash
# Restore a Postgres dump created by backup-postgres.sh.
#
# Usage:
#   ./scripts/restore-postgres.sh /var/backups/bubu-postgres/backup_bubukleinanzeigen_20260101_030000.sql.gz
#
# WARNING: This drops and recreates the target database!

set -euo pipefail

POSTGRES_USER="${POSTGRES_USER:-bubu}"
POSTGRES_DB="${POSTGRES_DB:-bubukleinanzeigen}"
COMPOSE_PROJECT="${COMPOSE_PROJECT:-bubukleinanzeigen-saas}"

BACKUP_FILE="${1:-}"
if [[ -z "${BACKUP_FILE}" ]]; then
  echo "Usage: $0 <backup_file.sql.gz>" >&2
  exit 1
fi

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "Backup file not found: ${BACKUP_FILE}" >&2
  exit 1
fi

echo "[$(date -Iseconds)] Restoring ${BACKUP_FILE} → ${POSTGRES_DB}"
echo "WARNING: This will DROP and recreate the database. Press Ctrl+C within 10s to abort."
sleep 10

COMPOSE_CMD="docker compose -p ${COMPOSE_PROJECT} -f $(dirname "$0")/../docker-compose.prod.yml"

# Drop and recreate DB (connect via postgres superuser)
${COMPOSE_CMD} exec -T postgres psql -U "${POSTGRES_USER}" -c \
  "DROP DATABASE IF EXISTS ${POSTGRES_DB}; CREATE DATABASE ${POSTGRES_DB};"

# Restore
gunzip -c "${BACKUP_FILE}" | ${COMPOSE_CMD} exec -T postgres \
  psql -U "${POSTGRES_USER}" "${POSTGRES_DB}"

echo "[$(date -Iseconds)] Restore complete."
