#!/bin/bash
# ==============================================================================
# FINOVO ONEDRIVE OFF-SITE BACKUP SCRIPT
# ==============================================================================
# Performs full database and media backups and syncs archives to Microsoft OneDrive.
#
# Supported Upload Backends:
# 1. rclone (Recommended for Linux/Production VPS) - remote:path (e.g. onedrive:FinovoBackups)
# 2. Local/Mounted OneDrive directory (e.g. /mnt/onedrive or WSL /mnt/c/Users/.../OneDrive)
#
# Usage:
#   ./scripts/backup_onedrive.sh
#   ./scripts/backup_onedrive.sh --skip-local-backup  (Uploads existing backups without regenerating)
# ==============================================================================

set -eo pipefail

PROJECT_DIR="${FINOVO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

# Load .env if present
if [ -f "$PROJECT_DIR/.env" ]; then
    set -a
    # Source .env safely ignoring comments and blank lines
    eval "$(grep -v '^#' "$PROJECT_DIR/.env" | grep -v '^\s*$' | sed -e 's/\r$//' -e 's/^/export /')" 2>/dev/null || true
    set +a
fi

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="${FINOVO_BACKUP_DIR:-/var/backups/finovo}"
ONEDRIVE_REMOTE="${ONEDRIVE_REMOTE:-onedrive}"
ONEDRIVE_REMOTE_FOLDER="${ONEDRIVE_REMOTE_FOLDER:-FinovoBackups}"
ONEDRIVE_LOCAL_PATH="${ONEDRIVE_LOCAL_PATH:-}"
ONEDRIVE_RETENTION_DAYS="${ONEDRIVE_RETENTION_DAYS:-30}"
SKIP_LOCAL="${1:-}"

echo "=================================================="
echo "[$(date)] Starting Finovo OneDrive Backup Pipeline"
echo "=================================================="

# ------------------------------------------------------------------------------
# 1. Generate Local Backups
# ------------------------------------------------------------------------------
if [ "$SKIP_LOCAL" == "--skip-local-backup" ]; then
    echo "[INFO] Skipping local backup execution; utilizing existing files in $BACKUP_DIR"
else
    echo "[1/4] Running Finovo local backup generation..."
    if [ -f "$PROJECT_DIR/scripts/backup.sh" ]; then
        bash "$PROJECT_DIR/scripts/backup.sh"
    else
        echo "[ERROR] Local backup script not found at $PROJECT_DIR/scripts/backup.sh"
        exit 1
    fi
fi

# Locate latest generated or existing backup files
LATEST_DB=$(ls -t "$BACKUP_DIR/db"/finovo_db_*.sql.gz 2>/dev/null | head -n 1 || true)
LATEST_MEDIA=$(ls -t "$BACKUP_DIR/media"/finovo_media_*.tar.gz 2>/dev/null | head -n 1 || true)

if [ -z "$LATEST_DB" ] || [ ! -f "$LATEST_DB" ]; then
    echo "[ERROR] No database backup found in $BACKUP_DIR/db/"
    exit 1
fi

echo "[2/4] Identified backup archives to upload:"
echo "  - Database: $LATEST_DB ($(du -h "$LATEST_DB" | cut -f1))"
if [ -n "$LATEST_MEDIA" ] && [ -f "$LATEST_MEDIA" ]; then
    echo "  - Media:    $LATEST_MEDIA ($(du -h "$LATEST_MEDIA" | cut -f1))"
else
    echo "  - Media:    [None found, skipping media upload]"
fi

# ------------------------------------------------------------------------------
# 2. Upload to Microsoft OneDrive
# ------------------------------------------------------------------------------
echo "[3/4] Uploading archives to Microsoft OneDrive..."

# Backend Option A: rclone (Standard for Linux Servers)
if command -v rclone &> /dev/null; then
    echo "[INFO] Using rclone backend (remote: '${ONEDRIVE_REMOTE}:${ONEDRIVE_REMOTE_FOLDER}')"

    # Verify remote is configured
    if ! rclone listremotes | grep -q "^${ONEDRIVE_REMOTE}:"; then
        echo "[ERROR] rclone remote '${ONEDRIVE_REMOTE}:' is not configured!"
        echo "Run 'rclone config' to set up your Microsoft OneDrive account."
        echo "See scripts/ONEDRIVE_BACKUP_GUIDE.md for step-by-step instructions."
        exit 1
    fi

    echo "  -> Uploading database dump: $(basename "$LATEST_DB")..."
    rclone copy "$LATEST_DB" "${ONEDRIVE_REMOTE}:${ONEDRIVE_REMOTE_FOLDER}/db/" --progress

    if [ -n "$LATEST_MEDIA" ] && [ -f "$LATEST_MEDIA" ]; then
        echo "  -> Uploading media archive: $(basename "$LATEST_MEDIA")..."
        rclone copy "$LATEST_MEDIA" "${ONEDRIVE_REMOTE}:${ONEDRIVE_REMOTE_FOLDER}/media/" --progress
    fi

    # --------------------------------------------------------------------------
    # 3. Cloud Retention Policy
    # --------------------------------------------------------------------------
    if [ "$ONEDRIVE_RETENTION_DAYS" -gt 0 ]; then
        echo "[4/4] Enforcing OneDrive retention policy (${ONEDRIVE_RETENTION_DAYS} days)..."
        rclone delete "${ONEDRIVE_REMOTE}:${ONEDRIVE_REMOTE_FOLDER}/db" --min-age "${ONEDRIVE_RETENTION_DAYS}d" 2>/dev/null || true
        rclone delete "${ONEDRIVE_REMOTE}:${ONEDRIVE_REMOTE_FOLDER}/media" --min-age "${ONEDRIVE_RETENTION_DAYS}d" 2>/dev/null || true
        rclone rmdirs "${ONEDRIVE_REMOTE}:${ONEDRIVE_REMOTE_FOLDER}" --leave-root 2>/dev/null || true
    else
        echo "[4/4] Cloud retention enforcement disabled (ONEDRIVE_RETENTION_DAYS=0)."
    fi

# Backend Option B: Local / Mounted OneDrive directory
elif [ -n "$ONEDRIVE_LOCAL_PATH" ] && [ -d "$ONEDRIVE_LOCAL_PATH" ]; then
    echo "[INFO] Using local/mounted OneDrive directory: $ONEDRIVE_LOCAL_PATH"

    DEST_DIR="$ONEDRIVE_LOCAL_PATH/$ONEDRIVE_REMOTE_FOLDER"
    mkdir -p "$DEST_DIR/db"
    mkdir -p "$DEST_DIR/media"

    echo "  -> Copying database dump: $(basename "$LATEST_DB")..."
    cp "$LATEST_DB" "$DEST_DIR/db/"

    if [ -n "$LATEST_MEDIA" ] && [ -f "$LATEST_MEDIA" ]; then
        echo "  -> Copying media archive: $(basename "$LATEST_MEDIA")..."
        cp "$LATEST_MEDIA" "$DEST_DIR/media/"
    fi

    # --------------------------------------------------------------------------
    # 3. Cloud Retention Policy for local path
    # --------------------------------------------------------------------------
    if [ "$ONEDRIVE_RETENTION_DAYS" -gt 0 ]; then
        echo "[4/4] Enforcing OneDrive retention policy (${ONEDRIVE_RETENTION_DAYS} days)..."
        find "$DEST_DIR/db" -type f -name "finovo_db_*.sql.gz" -mtime +"$ONEDRIVE_RETENTION_DAYS" -delete 2>/dev/null || true
        find "$DEST_DIR/media" -type f -name "finovo_media_*.tar.gz" -mtime +"$ONEDRIVE_RETENTION_DAYS" -delete 2>/dev/null || true
    else
        echo "[4/4] Cloud retention enforcement disabled (ONEDRIVE_RETENTION_DAYS=0)."
    fi

else
    echo "[ERROR] Neither 'rclone' was found in PATH nor is 'ONEDRIVE_LOCAL_PATH' set to an existing folder."
    echo ""
    echo "To configure OneDrive backup, choose one of the following:"
    echo "  1. Install rclone (recommended for production servers):"
    echo "     curl https://rclone.org/install.sh | sudo bash"
    echo "     rclone config   # Setup remote named 'onedrive'"
    echo ""
    echo "  2. Or set ONEDRIVE_LOCAL_PATH in .env to your mounted OneDrive folder:"
    echo "     ONEDRIVE_LOCAL_PATH=/mnt/onedrive"
    echo ""
    echo "Refer to scripts/ONEDRIVE_BACKUP_GUIDE.md for detailed instructions."
    exit 1
fi

echo "=================================================="
echo "[$(date)] Finovo OneDrive Backup Completed Successfully!"
echo "Database: $(basename "$LATEST_DB")"
if [ -n "$LATEST_MEDIA" ] && [ -f "$LATEST_MEDIA" ]; then
    echo "Media:    $(basename "$LATEST_MEDIA")"
fi
echo "Remote Target: ${ONEDRIVE_REMOTE}:${ONEDRIVE_REMOTE_FOLDER}"
echo "=================================================="
