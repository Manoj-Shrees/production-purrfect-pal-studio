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
sleep 3
log "MySQL is ready."

# ── Persist env vars for cron ─────────────────────────────────────────────────
# cron starts a clean shell with no Docker environment — every variable that
# backup.sh needs (MYSQL_*, GITHUB_*, BACKUP_*, RETENTION_DAYS) is missing
# when the scheduled job runs. Dumping them here means backup.sh can source
# this file and behave identically whether run manually or via cron.
log "Saving environment for cron ..."
printenv | grep -E '^(MYSQL_|GITHUB_|BACKUP_|RETENTION_)' > /etc/backup-env
chmod 600 /etc/backup-env   # readable only by root — contains credentials

# ── Write crontab ─────────────────────────────────────────────────────────────
CRON_EXPR="${BACKUP_CRON:-0 2 * * *}"
log "Scheduling backup: '$CRON_EXPR'"

# Source the env file before running the script so cron inherits all variables.
# Output goes to /proc/1/fd/1 (PID 1 = tini's stdout = docker logs).
cat > /etc/cron.d/db-backup <<EOF
SHELL=/bin/sh
$CRON_EXPR root . /etc/backup-env; /backup.sh >> /proc/1/fd/1 2>> /proc/1/fd/2
EOF
chmod 0644 /etc/cron.d/db-backup

# ── Run an immediate backup ───────────────────────────────────────────────────
log "Running initial backup now ..."
/backup.sh || log "WARNING: Initial backup failed — check logs above. Scheduled runs will still proceed."

log "Starting cron ..."
exec cron -f