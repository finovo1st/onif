#!/bin/bash
# ==============================================================================
# FINOVO BACKUP AUTOMATION INSTALLER (LINUX / CRON)
# ==============================================================================
# Automatically sets up a daily cron job to run backup_onedrive.sh at 03:00 AM.
# It ensures correct execution permissions, log directory creation, and PATH.
# ==============================================================================

set -eo pipefail

PROJECT_DIR="${FINOVO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
BACKUP_SCRIPT="$PROJECT_DIR/scripts/backup_onedrive.sh"
LOG_DIR="/var/log/finovo"
LOG_FILE="$LOG_DIR/backup.log"
CRON_TIME="${1:-0 3 * * *}"  # Default: Every day at 3:00 AM

echo "=================================================="
echo "Finovo Daily Backup Automation Installer"
echo "=================================================="

if [ ! -f "$BACKUP_SCRIPT" ]; then
    echo "[ERROR] Backup script not found at $BACKUP_SCRIPT"
    exit 1
fi

# Ensure all scripts are executable
chmod +x "$PROJECT_DIR"/scripts/*.sh

# Create log directory
sudo mkdir -p "$LOG_DIR" 2>/dev/null || mkdir -p "$LOG_DIR" 2>/dev/null || LOG_FILE="$PROJECT_DIR/backup.log"

# Define the cron command with full PATH so cron has access to docker, rclone, gzip
CRON_JOB="$CRON_TIME PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin /bin/bash $BACKUP_SCRIPT >> $LOG_FILE 2>&1"

# Check if cron job already exists
CURRENT_CRONTAB=$(crontab -l 2>/dev/null || true)

if echo "$CURRENT_CRONTAB" | grep -q "$BACKUP_SCRIPT"; then
    echo "[INFO] Existing Finovo backup cron job found. Updating..."
    NEW_CRONTAB=$(echo "$CURRENT_CRONTAB" | grep -v "$BACKUP_SCRIPT")
else
    NEW_CRONTAB="$CURRENT_CRONTAB"
fi

# Install updated crontab
(echo "$NEW_CRONTAB"; echo "$CRON_JOB") | crontab -

echo "[SUCCESS] Daily backup cron job installed!"
echo "Schedule: $CRON_TIME"
echo "Target:   $BACKUP_SCRIPT"
echo "Logs:     $LOG_FILE"
echo ""
echo "Active crontab:"
crontab -l | grep "$BACKUP_SCRIPT"
echo "=================================================="
