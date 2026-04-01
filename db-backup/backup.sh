#!/bin/sh
set -e

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

log "=== Backup started ==="

for VAR in MYSQL_HOST MYSQL_USER MYSQL_PASSWORD MYSQL_DATABASE GITHUB_TOKEN GITHUB_REPO; do
  eval "val=\$$VAR"
  if [ -z "$val" ]; then
    log "ERROR: Required environment variable $VAR is not set."
    exit 1
  fi
done

FILENAME="backup_$(date +%Y%m%d_%H%M%S).sql.gz"
FILEPATH="/backups/$FILENAME"
BRANCH="${GITHUB_BRANCH:-main}"
RETENTION="${RETENTION_DAYS:-14}"
DUMP_STDERR="/tmp/dump_stderr.log"

mkdir -p /backups
if [ ! -w /backups ]; then
  log "ERROR: /backups is not writable."
  exit 1
fi

# ── Pick dump binary ──────────────────────────────────────────────────────────
if command -v mariadb-dump > /dev/null 2>&1; then
  DUMP_BIN="mariadb-dump"
else
  DUMP_BIN="mysqldump"
fi
log "Using dump binary: $DUMP_BIN"

# ── Dump ──────────────────────────────────────────────────────────────────────
# stderr is captured to a temp file — NOT suppressed — so failures are logged.
# We try --skip-ssl first (correct MariaDB flag). If the dump still produces
# a tiny file we print the captured stderr so the exact error is visible.
log "Running $DUMP_BIN → $FILEPATH ..."

"$DUMP_BIN" \
  -h "$MYSQL_HOST" \
  -u "$MYSQL_USER" \
  -p"$MYSQL_PASSWORD" \
  --skip-ssl \
  --single-transaction \
  --no-tablespaces \
  --routines \
  --triggers \
  "$MYSQL_DATABASE" 2>"$DUMP_STDERR" | gzip > "$FILEPATH"

# Always print dump stderr so any warnings/errors are visible in docker logs
if [ -s "$DUMP_STDERR" ]; then
  log "--- dump stderr output ---"
  cat "$DUMP_STDERR"
  log "--- end dump stderr ---"
fi

# ── Guard: refuse to push an empty backup ────────────────────────────────────
FILESIZE=$(stat -c%s "$FILEPATH" 2>/dev/null || stat -f%z "$FILEPATH")
if [ "$FILESIZE" -lt 100 ]; then
  log "ERROR: Backup file is suspiciously small (${FILESIZE} bytes) — dump failed."
  rm -f "$FILEPATH"
  exit 1
fi
log "Dump complete: $FILENAME (${FILESIZE} bytes)"

# ── Rotate old local backups ─────────────────────────────────────────────────
find /backups -name "*.sql.gz" -mtime +"$RETENTION" -delete
log "Local rotation done (keeping ${RETENTION} days)"

# ── Push to GitHub ───────────────────────────────────────────────────────────
CLONE_DIR="/tmp/gh-backup"
rm -rf "$CLONE_DIR"

log "Cloning repository ..."
git clone \
  --depth=1 \
  --branch "$BRANCH" \
  "https://${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git" \
  "$CLONE_DIR"

cp "$FILEPATH" "$CLONE_DIR/"

cd "$CLONE_DIR"
git config user.email "backup@purrfectpal.studio"
git config user.name  "DB Backup Bot"

git pull --rebase origin "$BRANCH" || true

git add "$FILENAME"

if git diff --cached --quiet; then
  log "Nothing to commit — file may already exist on remote."
else
  git commit -m "DB backup: $FILENAME"
  git push origin "$BRANCH"
  log "Pushed $FILENAME to GitHub (${GITHUB_REPO}@${BRANCH})"
fi

cd /tmp
rm -rf "$CLONE_DIR"

log "=== Backup finished successfully ==="