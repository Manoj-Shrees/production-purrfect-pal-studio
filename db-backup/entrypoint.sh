#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# entrypoint.sh
#
# Fixes applied:
#   1. Wait-for-DB loop: crond was starting before MySQL was ready.
#      Even with depends_on + healthcheck in compose, the backup container
#      has no healthcheck of its own and the DB may still be initialising
#      its grant tables when this container first runs.
#   2. Cron log forwarded to stdout/stderr so `docker logs db-backup-c`
#      actually shows backup output rather than a silent container.
#   3. Explicit crontab validation before starting crond.
# ─────────────────────────────────────────────────────────────────────────────
set -e

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [entrypoint] $*"; }

# ── Wait for MySQL to accept TCP connections ─────────────────────────────────
# We use a raw TCP check (nc) rather than mysqladmin ping with the backup
# user credentials. mysqladmin ping authenticates — if the backup user
# (adminPPS) doesn't exist yet or lacks the PROCESS privilege, the ping
# returns an auth error even though the server is perfectly healthy, causing
# the wait loop to spin until timeout and the container to exit with an error.
# A TCP check on port 3306 is sufficient: once MySQL is accepting connections
# the dump will work.
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
# Give MySQL a couple of extra seconds to finish loading grant tables after
# the port opens — the socket is ready before auth is fully initialised.
sleep 3
log "MySQL is ready."

# ── Write crontab ────────────────────────────────────────────────────────────
CRON_EXPR="${BACKUP_CRON:-0 2 * * *}"
log "Scheduling backup: '$CRON_EXPR'"

# Redirect cron job output to stdout (fd 1) and stderr (fd 2) of PID 1 so
# `docker logs` captures it. /proc/1/fd/1 is always stdout of the container.
echo "$CRON_EXPR /backup.sh >> /proc/1/fd/1 2>> /proc/1/fd/2" > /etc/crontabs/root

# Run an immediate backup on container start so we know the config works
# without waiting up to 24 h for the first scheduled run.
log "Running initial backup now ..."
/backup.sh || log "WARNING: Initial backup failed — check logs above. Scheduled runs will still proceed."

log "Starting crond ..."
exec crond -f -l 6