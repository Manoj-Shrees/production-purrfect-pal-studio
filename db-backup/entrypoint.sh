#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# entrypoint.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [entrypoint] $*"; }

# ── Wait for MySQL to accept TCP connections ──────────────────────────────────
RETRIES=30
log "Waiting for MySQL at ${MYSQL_HOST}:3306 (TCP) ..."
until nc -z "$MYSQL_HOST" 3306 2>/dev/null; do
  RETRIES=$((RETRIES - 1))
  if [ "$RETRIES" -le 0 ]; then
    log "ERROR: MySQL did not become ready in time. Exiting."
    exit 1
  fi
  log "MySQL not ready yet — retrying in 5 s (${RETRIES} attempts left) ..."
  sleep 5
done
# Extra grace period for grant tables to finish loading after port opens
sleep 3
log "MySQL is ready."

# ── Write crontab ─────────────────────────────────────────────────────────────
CRON_EXPR="${BACKUP_CRON:-0 2 * * *}"
log "Scheduling backup: '$CRON_EXPR'"

# Debian uses /etc/cron.d/ style — write a proper cron.d file
echo "$CRON_EXPR root /backup.sh >> /proc/1/fd/1 2>> /proc/1/fd/2" > /etc/cron.d/db-backup
chmod 0644 /etc/cron.d/db-backup

# ── Run an immediate backup so we know the config works ───────────────────────
log "Running initial backup now ..."
/backup.sh || log "WARNING: Initial backup failed — check logs above. Scheduled runs will still proceed."

log "Starting cron ..."
exec cron -f