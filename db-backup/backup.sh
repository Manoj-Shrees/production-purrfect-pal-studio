#!/bin/sh
set -e

# ── Source persisted env vars when running from cron ─────────────────────────
[ -f /etc/backup-env ] && . /etc/backup-env

LOG_FILE="/tmp/backup_run.log"
> "$LOG_FILE"

log() {
  msg="[$(date '+%Y-%m-%d %H:%M:%S')] $*"
  echo "$msg"
  echo "$msg" >> "$LOG_FILE"
}

log "=== Backup started ==="

# ── Validate required env vars ────────────────────────────────────────────────
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
RETENTION="${RETENTION_DAYS:-7}"
DUMP_STDERR="/tmp/dump_stderr.log"

mkdir -p /backups
if [ ! -w /backups ]; then
  log "ERROR: /backups is not writable."
  exit 1
fi

# ── Dump ──────────────────────────────────────────────────────────────────────
log "Running mysqldump → $FILEPATH ..."

mysqldump \
  -h "$MYSQL_HOST" \
  -u "$MYSQL_USER" \
  -p"$MYSQL_PASSWORD" \
  --skip-ssl \
  --single-transaction \
  --no-tablespaces \
  --routines \
  --triggers \
  "$MYSQL_DATABASE" 2>"$DUMP_STDERR" | gzip > "$FILEPATH"

if [ -s "$DUMP_STDERR" ]; then
  log "--- dump stderr ---"
  cat "$DUMP_STDERR" >> "$LOG_FILE"
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

# ── Push to GitHub ────────────────────────────────────────────────────────────
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

# ── Delete old backups from repo, but keep the most recent old one ────────────
log "Pruning GitHub backups older than ${RETENTION} days (keeping last old file as safety net) ..."
find "$CLONE_DIR" -maxdepth 1 -name "*.sql.gz" -mtime +"$RETENTION" \
  | sort -r \
  | tail -n +2 \
  | while IFS= read -r old_file; do
      log "Removing old backup from repo: $(basename "$old_file")"
      git rm --force "$old_file"
    done

# ── Write README with full run log ────────────────────────────────────────────
log "Writing README.md with run log ..."
cat > "$CLONE_DIR/README.md" <<EOF
# PurrfectPal Studio — DB Backup Log

**Latest backup:** \`$FILENAME\`
**Retention policy:** $RETENTION days (last old file always preserved as safety net)
**Repo:** $GITHUB_REPO @ $BRANCH

---

## Last Run Log

\`\`\`
$(cat "$LOG_FILE")
\`\`\`
EOF

git add "$FILENAME" README.md

if git diff --cached --quiet; then
  log "Nothing to commit — file may already exist on remote."
else
  git commit -m "DB backup: $FILENAME (pruned files older than ${RETENTION}d)"
  git push origin "$BRANCH"
  log "Pushed $FILENAME to GitHub (${GITHUB_REPO}@${BRANCH})"
fi

cd /tmp
rm -rf "$CLONE_DIR"

# ── Rotate old local backups (only after successful GitHub push) ──────────────
# Keep the most recent old file as a safety net
log "Pruning local backups older than ${RETENTION} days (keeping last old file as safety net) ..."
find /backups -name "*.sql.gz" -mtime +"$RETENTION" \
  | sort -r \
  | tail -n +2 \
  | while IFS= read -r old_file; do
      log "Removing local old backup: $(basename "$old_file")"
      rm -f "$old_file"
    done
log "Local rotation done (keeping ${RETENTION} days + 1 safety file)"

log "=== Backup finished successfully ==="