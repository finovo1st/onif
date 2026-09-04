#!/bin/bash
# ==============================================================================
# FINOVO AUTOMATED PRODUCTION BACKUP SCRIPT
# ==============================================================================
# Creates compressed, timestamped backups of:
# 1. PostgreSQL Database (pg_dump)
# 2. Uploaded Media files (KYC documents, deposit receipts)
# 3. Automatic 14-day retention cleanup
# ==============================================================================

set -eo pipefail

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="${FINOVO_BACKUP_DIR:-/var/backups/finovo}"
PROJECT_DIR="${FINOVO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

mkdir -p "$BACKUP_DIR/db"
mkdir -p "$BACKUP_DIR/media"

echo "=================================================="
echo "[$(date)] Starting Finovo Production Backup..."
echo "=================================================="

# 1. Find the Database Container
DB_CONTAINER=$(docker compose -f "$PROJECT_DIR/docker-compose.prod.yml" ps -q db 2>/dev/null || docker ps -qf "name=finovo.*db" | head -n 1)

if [ -z "$DB_CONTAINER" ]; then
    echo "[ERROR] PostgreSQL container is not running! Cannot take backup."
    exit 1
fi

# 2. Database Backup
DB_FILE="$BACKUP_DIR/db/finovo_db_${TIMESTAMP}.sql.gz"
echo "[1/3] Dumping PostgreSQL database..."
docker exec "$DB_CONTAINER" pg_dump -U postgres -d investment_db --clean --if-exists | gzip > "$DB_FILE"

if [ -s "$DB_FILE" ]; then
    DB_SIZE=$(du -h "$DB_FILE" | cut -f1)
    echo "[SUCCESS] DB backup created: $DB_FILE ($DB_SIZE)"
else
    echo "[ERROR] Database backup failed or created empty file!"
    exit 1
fi

# 3. Media / KYC Documents Backup (Uses portable alpine container to snapshot volume)
MEDIA_FILE="$BACKUP_DIR/media/finovo_media_${TIMESTAMP}.tar.gz"
echo "[2/3] Archiving user media & KYC files..."

docker run --rm \
    -v finovo_media_data:/media_source:ro \
    -v "$BACKUP_DIR/media":/media_dest \
    alpine tar -czf "/media_dest/finovo_media_${TIMESTAMP}.tar.gz" -C /media_source . 2>/dev/null || \
docker run --rm \
    -v "${PROJECT_DIR##*/}_media_data":/media_source:ro \
    -v "$BACKUP_DIR/media":/media_dest \
    alpine tar -czf "/media_dest/finovo_media_${TIMESTAMP}.tar.gz" -C /media_source .

if [ -s "$MEDIA_FILE" ]; then
    MEDIA_SIZE=$(du -h "$MEDIA_FILE" | cut -f1)
    echo "[SUCCESS] Media backup created: $MEDIA_FILE ($MEDIA_SIZE)"
else
    echo "[WARNING] Media backup file was not created or media volume is empty."
fi

# 4. Retention Policy (Delete backups older than 14 days)
echo "[3/3] Enforcing 14-day retention policy..."
find "$BACKUP_DIR/db" -type f -name "finovo_db_*.sql.gz" -mtime +14 -delete
find "$BACKUP_DIR/media" -type f -name "finovo_media_*.tar.gz" -mtime +14 -delete

echo "=================================================="
echo "[$(date)] Backup Completed Successfully!"
echo "Database: $DB_FILE"
echo "Media:    $MEDIA_FILE"
echo "=================================================="
