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
MEDIA_FILE="${2:-}"
PROJECT_DIR="${FINOVO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

# Load .env to pick up custom DB credentials (POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB)
if [ -f "$PROJECT_DIR/.env" ]; then
    set -a
    eval "$(grep -v '^#' "$PROJECT_DIR/.env" | grep -v '^\s*$' | sed -e 's/\r$//' -e 's/^/export /')" 2>/dev/null || true
    set +a
fi

POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"
POSTGRES_DB="${POSTGRES_DB:-investment_db}"

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
    echo "Usage: $0 <path_to_backup_file.sql.gz> [path_to_media_archive.tar.gz]"
    echo "Example: $0 /var/backups/finovo/db/finovo_db_20260904_120000.sql.gz"
    exit 1
fi

# Extract timestamp from DB filename if media file not explicitly provided
if [ -z "$MEDIA_FILE" ]; then
    TIMESTAMP=$(echo "$(basename "$BACKUP_FILE")" | sed -nE 's/.*finovo_db_([0-9]+_[0-9]+)\.sql\.gz/\1/p' || true)
    if [ -n "$TIMESTAMP" ]; then
        POSSIBLE_MEDIA_PATHS=(
            "$(dirname "$BACKUP_FILE")/../media/finovo_media_${TIMESTAMP}.tar.gz"
            "$(dirname "$BACKUP_FILE")/finovo_media_${TIMESTAMP}.tar.gz"
            "/var/backups/finovo/media/finovo_media_${TIMESTAMP}.tar.gz"
            "$PROJECT_DIR/backups/media/finovo_media_${TIMESTAMP}.tar.gz"
        )
        for p in "${POSSIBLE_MEDIA_PATHS[@]}"; do
            if [ -f "$p" ]; then
                MEDIA_FILE="$p"
                break
            fi
        done
    fi
fi

echo "=================================================="
echo "WARNING: This will overwrite current database and restore media!"
echo "Database Backup: $BACKUP_FILE"
if [ -n "$MEDIA_FILE" ] && [ -f "$MEDIA_FILE" ]; then
    echo "Media Archive:   $MEDIA_FILE"
else
    echo "Media Archive:   [No matching media archive found]"
fi
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

echo "[1/3] Decompressing and restoring database..."
gunzip -c "$BACKUP_FILE" | docker exec -i -e PGPASSWORD="$POSTGRES_PASSWORD" "$DB_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"

# Restore Media Files if archive is available
if [ -n "$MEDIA_FILE" ] && [ -f "$MEDIA_FILE" ]; then
    echo "[2/3] Restoring media / KYC documents..."
    MEDIA_DIR_ABS="$(cd "$(dirname "$MEDIA_FILE")" && pwd)"
    MEDIA_BASE="$(basename "$MEDIA_FILE")"

    # Identify the docker compose media volume
    BACKEND_CONTAINER=$(docker compose -f "$PROJECT_DIR/docker-compose.prod.yml" ps -q backend 2>/dev/null || docker ps -qf "name=finovo.*backend" | head -n 1 || true)
    MEDIA_VOLUME=""
    if [ -n "$BACKEND_CONTAINER" ]; then
        MEDIA_VOLUME=$(docker inspect "$BACKEND_CONTAINER" --format '{{range .Mounts}}{{if eq .Destination "/app/media"}}{{.Name}}{{end}}{{end}}' 2>/dev/null || true)
    fi
    if [ -z "$MEDIA_VOLUME" ]; then
        MEDIA_VOLUME=$(docker volume ls -q | grep -E "(${PROJECT_DIR##*/}|finovo).*media_data" | head -n 1 || echo "${PROJECT_DIR##*/}_media_data")
    fi

    docker run --rm \
        -v "$MEDIA_VOLUME":/media_dest \
        -v "$MEDIA_DIR_ABS":/media_source:ro \
        alpine tar -xzf "/media_source/$MEDIA_BASE" -C /media_dest

    echo "[SUCCESS] Media archive restored to volume: $MEDIA_VOLUME"
else
    echo "[2/3] Skipping media restore (no media archive provided)."
fi

echo "[3/3] Running pending Django migrations..."
docker compose -f "$PROJECT_DIR/docker-compose.prod.yml" exec backend python manage.py migrate --noinput

echo "=================================================="
echo "[SUCCESS] Restore process completed successfully!"
echo "Database: $BACKUP_FILE"
if [ -n "$MEDIA_FILE" ] && [ -f "$MEDIA_FILE" ]; then
    echo "Media:    $MEDIA_FILE"
fi
echo "=================================================="
