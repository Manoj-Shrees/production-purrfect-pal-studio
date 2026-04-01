#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# backup.sh  —  MySQL → gzip → GitHub
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

# ── Pick the right dump binary ────────────────────────────────────────────────
# Alpine's mysql-client package now ships mariadb-dump as the real binary.
# mysqldump is a deprecated alias that prints a warning to stderr — on some
# versions that warning ends up inside the gzip stream, corrupting the file.
# Prefer mariadb-dump when it exists, fall back to mysqldump otherwise.
if command -v mariadb-dump > /dev/null 2>&1; then
  DUMP_BIN="mariadb-dump"
else
  DUMP_BIN="mysqldump"
fi
log "Using dump binary: $DUMP_BIN"

# ── Dump ─────────────────────────────────────────────────────────────────────
log "Running $DUMP_BIN → $FILEPATH ..."

# --ssl=FALSE:
#   The MySQL container uses a self-signed TLS certificate. Without this flag
#   the client enforces certificate chain validation, gets "self-signed
#   certificate in certificate chain", and exits before dumping a single byte.
#   Both containers are on the same private Docker bridge — no MITM risk.
#
# 2>/dev/null on the dump binary redirects deprecation warnings so they
# never contaminate the gzip stream.
"$DUMP_BIN" \
  -h "$MYSQL_HOST" \
  -u "$MYSQL_USER" \
  -p"$MYSQL_PASSWORD" \
  --ssl=FALSE \
  --single-transaction \
  --no-tablespaces \
  --routines \
  --triggers \
  "$MYSQL_DATABASE" 2>/dev/null | gzip > "$FILEPATH"

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