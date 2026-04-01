#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# backup.sh  —  MySQL → gzip → GitHub
#
# Fixes applied:
#   1. set -e: any command failure now aborts the script immediately instead
#      of silently continuing and pushing an empty / corrupt file.
#   2. --single-transaction: consistent InnoDB snapshot without locking tables.
#   3. --no-tablespaces: the backup user (adminPPS) lacks the PROCESS privilege
#      required to dump tablespace info — this flag suppresses the error that
#      caused mysqldump to exit non-zero and produce a 0-byte file.
#   4. Empty-file guard: if mysqldump somehow produces an empty archive we
#      abort before touching GitHub.
#   5. Stale clone guard: /tmp/gh-backup is removed unconditionally before
#      cloning so a failed prior run never blocks the next one.
#   6. git pull --rebase before adding the new file so concurrent instances
#      or a dirty remote state don't cause a non-fast-forward push error.
#   7. Explicit exit codes and timestamped log lines throughout.
# ─────────────────────────────────────────────────────────────────────────────
set -e

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

log "=== Backup started ==="

# ── Validate required env vars ───────────────────────────────────────────────
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

# ── Ensure /backups is writable ───────────────────────────────────────────────
mkdir -p /backups
if [ ! -w /backups ]; then
  log "ERROR: /backups is not writable."
  exit 1
fi

# ── Dump ─────────────────────────────────────────────────────────────────────
log "Running mysqldump → $FILEPATH ..."
mysqldump \
  -h "$MYSQL_HOST" \
  -u "$MYSQL_USER" \
  -p"$MYSQL_PASSWORD" \
  --single-transaction \
  --no-tablespaces \
  --routines \
  --triggers \
  "$MYSQL_DATABASE" | gzip > "$FILEPATH"

# ── Guard: refuse to push an empty backup ────────────────────────────────────
FILESIZE=$(stat -c%s "$FILEPATH" 2>/dev/null || stat -f%z "$FILEPATH")
if [ "$FILESIZE" -lt 100 ]; then
  log "ERROR: Backup file is suspiciously small (${FILESIZE} bytes) — aborting push."
  rm -f "$FILEPATH"
  exit 1
fi
log "Dump complete: $FILENAME (${FILESIZE} bytes)"

# ── Rotate old local backups ─────────────────────────────────────────────────
find /backups -name "*.sql.gz" -mtime +"$RETENTION" -delete
log "Local rotation done (keeping ${RETENTION} days)"

# ── Push to GitHub ───────────────────────────────────────────────────────────
CLONE_DIR="/tmp/gh-backup"

# Always start fresh — a stale directory from a failed prior run would make
# git clone fail and the entire backup would be silently skipped.
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

# Pull any remote commits that arrived between our clone and now.
git pull --rebase origin "$BRANCH" || true

git add "$FILENAME"

# Only commit/push if there is actually something to push.
if git diff --cached --quiet; then
  log "Nothing to commit — file may already exist on remote."
else
  git commit -m "DB backup: $FILENAME"
  git push origin "$BRANCH"
  log "Pushed $FILENAME to GitHub (${GITHUB_REPO}@${BRANCH})"
fi

# ── Cleanup temp clone ───────────────────────────────────────────────────────
cd /tmp
rm -rf "$CLONE_DIR"

log "=== Backup finished successfully ==="