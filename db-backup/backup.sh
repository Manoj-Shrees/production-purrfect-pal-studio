#!/bin/sh
set -e

# ── Ensure a full PATH so cron's minimal environment finds all binaries ───────
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

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

# ── Delete old backups from repo using filename date (not mtime) ──────────────
# git clone sets mtime to NOW for all files so -mtime is unreliable.
# Filenames are backup_YYYYMMDD_HHMMSS.sql.gz — parse the date from the name.
# FIX: use -le instead of -lt so files dated exactly at the cutoff are included.
log "Pruning GitHub backups older than ${RETENTION} days (keeping newest old file as safety net) ..."

CUTOFF=$(date -d "-${RETENTION} days" '+%Y%m%d' 2>/dev/null || date -v-${RETENTION}d '+%Y%m%d')
log "Cutoff date: $CUTOFF"

TO_DELETE="/tmp/gh_files_to_delete.txt"
> "$TO_DELETE"

for f in "$CLONE_DIR"/backup_*.sql.gz; do
  [ -f "$f" ] || continue
  fname=$(basename "$f")
  file_date=$(echo "$fname" | sed 's/backup_\([0-9]\{8\}\)_.*/\1/')
  # FIX: was -lt, changed to -le so files exactly at the cutoff date are deleted
  case "$file_date" in
    [0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9])
      if [ "$file_date" -le "$CUTOFF" ]; then
        echo "$f" >> "$TO_DELETE"
      fi
      ;;
  esac
done

# Sort newest-first, skip line 1 (keep it as safety net), delete the rest
sort -r "$TO_DELETE" | tail -n +2 > /tmp/gh_confirmed_delete.txt

while IFS= read -r old_file; do
  log "Removing old backup from repo: $(basename "$old_file")"
  git rm --force "$old_file"
done < /tmp/gh_confirmed_delete.txt

# ── Write README with full run log ────────────────────────────────────────────
log "Writing README.md with run log ..."
cat > "$CLONE_DIR/README.md" <<EOF
# PurrfectPal Studio — DB Backup Log

**Latest backup:** \`$FILENAME\`
**Retention policy:** $RETENTION days (newest old file always preserved as safety net)
**Repo:** $GITHUB_REPO @ $BRANCH

---

## Last Run Log

\`\`\`
$(cat "$LOG_FILE")
\`\`\`
EOF

git add -A

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
# Local files have real mtimes so -mtime works correctly here.
# FIX: was -mtime +"$RETENTION" which requires >7 full 24h periods (misses day-
#      exact files). Using $((RETENTION - 1)) matches files >= RETENTION days old.
log "Pruning local backups older than ${RETENTION} days (keeping newest old file as safety net) ..."

LOCAL_DELETE="/tmp/local_files_to_delete.txt"
> "$LOCAL_DELETE"

find /backups -maxdepth 1 -name "*.sql.gz" -mtime +$((RETENTION - 1)) | sort -r > "$LOCAL_DELETE"

tail -n +2 "$LOCAL_DELETE" | while IFS= read -r old_file; do
  log "Removing local old backup: $(basename "$old_file")"
  rm -f "$old_file"
done

log "Local rotation done (keeping ${RETENTION} days + 1 safety file)"

log "=== Backup finished successfully ==="