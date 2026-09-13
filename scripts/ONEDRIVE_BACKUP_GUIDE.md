# Finovo Microsoft OneDrive Automated Backup Guide

This guide explains how to back up Finovo's PostgreSQL database and user media files to Microsoft OneDrive and perform disaster recovery.

---

## 1. Architecture Overview

Finovo provides automated scripts for server-side OneDrive backups and disaster recovery:

1. **`scripts/backup_onedrive.sh` (Server Backup Engine)**:
   - Uses **`rclone`** (recommended for headless servers) or a local mounted path.
   - Generates compressed PostgreSQL database dumps (`pg_dump` + `gzip`) and media archives (`.tar.gz`).
   - Copies archives to `FinovoBackups/db/` and `FinovoBackups/media/` on OneDrive.
   - Enforces an automated retention policy (deletes cloud backups older than 30 days).

2. **`scripts/install_backup_cron.sh` (Automated Daily Scheduling)**:
   - Installs a daily cron job (default 03:00 AM) with proper PATH, log rotation, and automated execution.

3. **`scripts/restore_onedrive.sh` (Disaster Recovery)**:
   - Interactively queries OneDrive for available database snapshots.
   - Downloads the chosen or latest snapshot.
   - Executes `scripts/restore.sh` to safely restore and run Django database migrations.

---

## 2. Setting Up on Linux / Production Servers (rclone)

### Step 1: Install `rclone`
On Ubuntu/Debian/Linux VPS:
```bash
curl https://rclone.org/install.sh | sudo bash
```

### Step 2: Configure Microsoft OneDrive Remote
Run the interactive configuration:
```bash
rclone config
```
Follow the prompts:
1. Enter `n` for **New remote**.
2. Name: `onedrive`
3. Storage: Select `Microsoft OneDrive` (usually option `31` or search `onedrive`).
4. `client_id` / `client_secret`: Press `Enter` to leave blank (uses default rclone app credentials).
5. Choose your account type:
   - `1` for OneDrive Personal or Multi-tenant
   - `2` for OneDrive for Business / Office 365
6. For headless Linux VPS without a desktop browser:
   - Select `n` for auto config (`Use auto config? n`).
   - Run `rclone authorize "onedrive"` on your local machine with a browser, then copy-paste the token into the server prompt.
7. Select drive: Choose `1` (Personal or Business Drive).
8. Confirm configuration: `y`.

Test your connection:
```bash
rclone lsd onedrive:
```

### Step 3: Run the Backup
Make the scripts executable:
```bash
chmod +x scripts/backup.sh scripts/backup_onedrive.sh scripts/restore_onedrive.sh scripts/restore.sh scripts/install_backup_cron.sh
```

Run manual backup:
```bash
./scripts/backup_onedrive.sh
```

### Step 4: Automate Daily via 1-Command Installer
To install an automated daily cron job running at 03:00 AM:
```bash
./scripts/install_backup_cron.sh
```
*(Or specify a custom time: `./scripts/install_backup_cron.sh "0 2 * * *"` for 2:00 AM)*

This installer:
- Configures full PATH so cron has access to Docker, rclone, and gzip.
- Directs logs to `/var/log/finovo/backup.log`.
- Automatically enforces 30-day retention on both the server and OneDrive.

---

## 3. Configuration Environment Variables

You can optionally configure settings in your `.env` file:

```env
# OneDrive Backup Settings
ONEDRIVE_REMOTE="onedrive"            # Name of rclone remote (default: onedrive)
ONEDRIVE_REMOTE_FOLDER="FinovoBackups"# Remote folder name in OneDrive
ONEDRIVE_RETENTION_DAYS=30            # Days to keep backups (0 to disable deletion)
ONEDRIVE_LOCAL_PATH=""                # (Optional) Local path if mounting OneDrive directly
```

---

## 4. Restoring from OneDrive

To restore your database from OneDrive snapshots:

### Interactive Menu:
```bash
./scripts/restore_onedrive.sh
```
Presents a numbered list of all database backups found in `FinovoBackups/db/` on OneDrive and asks you which one to restore.

### Restore the Newest Backup:
```bash
./scripts/restore_onedrive.sh --latest
```

### Restore a Specific File:
```bash
./scripts/restore_onedrive.sh finovo_db_20260914_030000.sql.gz
```
