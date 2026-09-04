#!/bin/bash
# ==============================================================================
# FINOVO DISASTER RECOVERY & RESTORE SCRIPT
# ==============================================================================
# Restores a specified database dump into the active PostgreSQL container.
# Usage:
#   ./scripts/restore.sh /var/backups/finovo/db/finovo_db_YYYYMMDD_HHMMSS.sql.gz
# ==============================================================================

set -eo pipefail

BACKUP_FILE="$1"
PROJECT_DIR="${FINOVO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
    echo "Usage: $0 <path_to_backup_file.sql.gz>"
    echo "Example: $0 /var/backups/finovo/db/finovo_db_20260904_120000.sql.gz"
    exit 1
fi

echo "=================================================="
echo "WARNING: This will overwrite the current database!"
echo "Target Backup: $BACKUP_FILE"
echo "=================================================="
read -p "Are you sure you want to proceed with restore? (y/N): " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
    echo "Restore aborted."
    exit 0
fi

DB_CONTAINER=$(docker compose -f "$PROJECT_DIR/docker-compose.prod.yml" ps -q db 2>/dev/null || docker ps -qf "name=finovo.*db" | head -n 1)

if [ -z "$DB_CONTAINER" ]; then
    echo "[ERROR] Database container is not running. Start it with 'docker compose -f docker-compose.prod.yml up -d db' first."
    exit 1
fi

echo "[1/2] Decompressing and restoring database..."
gunzip -c "$BACKUP_FILE" | docker exec -i "$DB_CONTAINER" psql -U postgres -d investment_db

echo "[2/2] Running pending Django migrations..."
docker compose -f "$PROJECT_DIR/docker-compose.prod.yml" exec backend python manage.py migrate --noinput

echo "=================================================="
echo "[SUCCESS] Database restored successfully from: $BACKUP_FILE"
echo "=================================================="
