#!/bin/bash
# ==============================================================================
# FINOVO ONEDRIVE DISASTER RECOVERY & RESTORE SCRIPT
# ==============================================================================
# Lists and downloads database backups directly from Microsoft OneDrive,
# then restores them into the active PostgreSQL container using restore.sh.
#
# Usage:
#   ./scripts/restore_onedrive.sh                     (Interactive menu of available backups)
#   ./scripts/restore_onedrive.sh --latest            (Restores the newest backup on OneDrive)
#   ./scripts/restore_onedrive.sh <filename_or_path>  (Restores a specific backup)
# ==============================================================================

set -eo pipefail

PROJECT_DIR="${FINOVO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

# Load .env if present
if [ -f "$PROJECT_DIR/.env" ]; then
    set -a
    eval "$(grep -v '^#' "$PROJECT_DIR/.env" | grep -v '^\s*$' | sed -e 's/\r$//' -e 's/^/export /')" 2>/dev/null || true
    set +a
fi

ONEDRIVE_REMOTE="${ONEDRIVE_REMOTE:-onedrive}"
ONEDRIVE_REMOTE_FOLDER="${ONEDRIVE_REMOTE_FOLDER:-FinovoBackups}"
ONEDRIVE_LOCAL_PATH="${ONEDRIVE_LOCAL_PATH:-}"
TMP_RESTORE_DIR="/tmp/finovo_onedrive_restore"
TARGET_FILE="$1"

mkdir -p "$TMP_RESTORE_DIR"

echo "=================================================="
echo "[$(date)] Finovo OneDrive Recovery & Restore"
echo "=================================================="

# Check if rclone is available or local path configured
USE_RCLONE=false
if command -v rclone &> /dev/null; then
    USE_RCLONE=true
elif [ -n "$ONEDRIVE_LOCAL_PATH" ] && [ -d "$ONEDRIVE_LOCAL_PATH" ]; then
    USE_RCLONE=false
else
    echo "[ERROR] Neither 'rclone' was found nor is 'ONEDRIVE_LOCAL_PATH' configured."
    echo "Refer to scripts/ONEDRIVE_BACKUP_GUIDE.md for setup instructions."
    exit 1
fi

# List available database backups
echo "[1/3] Querying available backups on OneDrive..."
AVAILABLE_BACKUPS=()

if [ "$USE_RCLONE" = true ]; then
    REMOTE_PATH="${ONEDRIVE_REMOTE}:${ONEDRIVE_REMOTE_FOLDER}/db"
    while IFS= read -r line; do
        if [[ -n "$line" ]]; then
            # rclone lsf lists filenames only
            AVAILABLE_BACKUPS+=("$line")
        fi
    done < <(rclone lsf "$REMOTE_PATH" --files-only 2>/dev/null | grep -E '^finovo_db_.*\.sql\.gz$' | sort -r)
else
    LOCAL_DB_DIR="$ONEDRIVE_LOCAL_PATH/$ONEDRIVE_REMOTE_FOLDER/db"
    while IFS= read -r line; do
        if [[ -n "$line" ]]; then
            AVAILABLE_BACKUPS+=("$(basename "$line")")
        fi
    done < <(ls -t "$LOCAL_DB_DIR"/finovo_db_*.sql.gz 2>/dev/null || true)
fi

if [ ${#AVAILABLE_BACKUPS[@]} -eq 0 ]; then
    echo "[ERROR] No database backups found on OneDrive in ${ONEDRIVE_REMOTE_FOLDER}/db."
    exit 1
fi

SELECTED_BACKUP=""

if [ "$TARGET_FILE" == "--latest" ] || [ -z "$TARGET_FILE" ]; then
    if [ "$TARGET_FILE" == "--latest" ]; then
        SELECTED_BACKUP="${AVAILABLE_BACKUPS[0]}"
        echo "[INFO] Selected latest backup: $SELECTED_BACKUP"
    else
        echo "Available backups on OneDrive:"
        for i in "${!AVAILABLE_BACKUPS[@]}"; do
            printf "  [%2d] %s\n" "$((i+1))" "${AVAILABLE_BACKUPS[$i]}"
        done
        echo ""
        read -p "Enter backup number to restore [1-${#AVAILABLE_BACKUPS[@]}] (Default: 1): " CHOICE
        CHOICE="${CHOICE:-1}"
        INDEX=$((CHOICE-1))
        if [ "$INDEX" -lt 0 ] || [ "$INDEX" -ge "${#AVAILABLE_BACKUPS[@]}" ]; then
            echo "[ERROR] Invalid selection."
            exit 1
        fi
        SELECTED_BACKUP="${AVAILABLE_BACKUPS[$INDEX]}"
    fi
else
    SELECTED_BACKUP="$(basename "$TARGET_FILE")"
fi

LOCAL_DOWNLOAD_FILE="$TMP_RESTORE_DIR/$SELECTED_BACKUP"
TIMESTAMP=$(echo "$SELECTED_BACKUP" | sed -nE 's/.*finovo_db_([0-9]+_[0-9]+)\.sql\.gz/\1/p')
MEDIA_BACKUP="finovo_media_${TIMESTAMP}.tar.gz"
LOCAL_MEDIA_FILE=""

# Download selected database backup
echo "[2/3] Fetching database backup from OneDrive: $SELECTED_BACKUP..."
if [ "$USE_RCLONE" = true ]; then
    rclone copyto "${ONEDRIVE_REMOTE}:${ONEDRIVE_REMOTE_FOLDER}/db/$SELECTED_BACKUP" "$LOCAL_DOWNLOAD_FILE" --progress
else
    cp "$ONEDRIVE_LOCAL_PATH/$ONEDRIVE_REMOTE_FOLDER/db/$SELECTED_BACKUP" "$LOCAL_DOWNLOAD_FILE"
fi

if [ ! -s "$LOCAL_DOWNLOAD_FILE" ]; then
    echo "[ERROR] Failed to fetch or empty backup file received."
    exit 1
fi

# Fetch corresponding media archive if it exists
if [ -n "$MEDIA_BACKUP" ]; then
    MEDIA_EXISTS=false
    if [ "$USE_RCLONE" = true ]; then
        if rclone lsf "${ONEDRIVE_REMOTE}:${ONEDRIVE_REMOTE_FOLDER}/media/$MEDIA_BACKUP" 2>/dev/null | grep -q "$MEDIA_BACKUP"; then
            MEDIA_EXISTS=true
        fi
    elif [ -f "$ONEDRIVE_LOCAL_PATH/$ONEDRIVE_REMOTE_FOLDER/media/$MEDIA_BACKUP" ]; then
        MEDIA_EXISTS=true
    fi

    if [ "$MEDIA_EXISTS" = true ]; then
        echo "  -> Fetching matching media archive: $MEDIA_BACKUP..."
        LOCAL_MEDIA_FILE="$TMP_RESTORE_DIR/$MEDIA_BACKUP"
        if [ "$USE_RCLONE" = true ]; then
            rclone copyto "${ONEDRIVE_REMOTE}:${ONEDRIVE_REMOTE_FOLDER}/media/$MEDIA_BACKUP" "$LOCAL_MEDIA_FILE" --progress
        else
            cp "$ONEDRIVE_LOCAL_PATH/$ONEDRIVE_REMOTE_FOLDER/media/$MEDIA_BACKUP" "$LOCAL_MEDIA_FILE"
        fi
    fi
fi

# Execute restore.sh
echo "[3/3] Passing downloaded backup to restore script..."
if [ -n "$LOCAL_MEDIA_FILE" ] && [ -s "$LOCAL_MEDIA_FILE" ]; then
    bash "$PROJECT_DIR/scripts/restore.sh" "$LOCAL_DOWNLOAD_FILE" "$LOCAL_MEDIA_FILE"
else
    bash "$PROJECT_DIR/scripts/restore.sh" "$LOCAL_DOWNLOAD_FILE"
fi

# Cleanup temporary downloaded files
rm -f "$LOCAL_DOWNLOAD_FILE" "$LOCAL_MEDIA_FILE"
echo "[CLEANUP] Temporary restore files cleared."
