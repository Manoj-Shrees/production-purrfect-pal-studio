#!/bin/sh
set -e

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [entrypoint] $*"; }

# ── Wait for MySQL ────────────────────────────────────────────────────────────
RETRIES=30
log "Waiting for MySQL at ${MYSQL_HOST}:3306 ..."
until nc -z "$MYSQL_HOST" 3306 2>/dev/null; do
  RETRIES=$((RETRIES - 1))
  [ "$RETRIES" -le 0 ] && log "ERROR: MySQL not ready. Exiting." && exit 1
  log "Not ready — retrying in 5s (${RETRIES} left) ..."
  sleep 5
done
sleep 3
log "MySQL is ready."

# ── Persist env vars for cron (quote values so sourcing is safe) ──────────────
log "Saving environment for cron ..."
printenv | grep -E '^(MYSQL_|GITHUB_|BACKUP_|RETENTION_)' | while IFS= read -r line; do
  key="${line%%=*}"
  val="${line#*=}"
  printf 'export %s="%s"\n' "$key" "$val"
done > /etc/backup-env
chmod 600 /etc/backup-env

# ── Write crontab ─────────────────────────────────────────────────────────────
CRON_EXPR="${BACKUP_CRON:-0 2 * * *}"
log "Scheduling backup: '$CRON_EXPR'"

cat > /etc/cron.d/db-backup <<EOF
SHELL=/bin/sh
$CRON_EXPR root . /etc/backup-env; /backup.sh >> /var/log/backup.log 2>&1

EOF
chmod 0644 /etc/cron.d/db-backup

# ── Run immediate backup ──────────────────────────────────────────────────────
log "Running initial backup now ..."
/backup.sh || log "WARNING: Initial backup failed."

# ── Start cron in foreground ──────────────────────────────────────────────────
log "Starting cron ..."
exec cron -f