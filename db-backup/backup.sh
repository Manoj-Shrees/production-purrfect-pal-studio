#!/bin/sh
set -e

# ── Full PATH for cron's minimal environment ──────────────────────────────────
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

BRANCH="${GITHUB_BRANCH:-main}"
RETENTION="${RETENTION_DAYS:-7}"
DUMP_STDERR="/tmp/dump_stderr.log"

mkdir -p /backups
if [ ! -w /backups ]; then
  log "ERROR: /backups is not writable."
  exit 1
fi

# ── Find the previous newest local backup (before we create the new one) ──────
PREVIOUS_BACKUP=""
PREV_FILE=$(find /backups -maxdepth 1 -name "backup_*.sql.gz" | sort -r | head -n 1)
[ -n "$PREV_FILE" ] && PREVIOUS_BACKUP=$(basename "$PREV_FILE") || PREVIOUS_BACKUP="(none — first run)"
log "Previous backup: $PREVIOUS_BACKUP"

# ── Create new dump ───────────────────────────────────────────────────────────
FILENAME="backup_$(date +%Y%m%d_%H%M%S).sql.gz"
FILEPATH="/backups/$FILENAME"

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

# ── Validate: refuse to push an empty/tiny backup ────────────────────────────
FILESIZE=$(stat -c%s "$FILEPATH" 2>/dev/null || stat -f%z "$FILEPATH")
if [ "$FILESIZE" -lt 100 ]; then
  log "ERROR: Backup is suspiciously small (${FILESIZE} bytes) — dump likely failed."
  rm -f "$FILEPATH"
  exit 1
fi
log "Dump complete: $FILENAME (${FILESIZE} bytes)"

# ── Clone GitHub backup repo ──────────────────────────────────────────────────
CLONE_DIR="/tmp/gh-backup"
rm -rf "$CLONE_DIR"

log "Cloning backup repository ..."
git clone \
  --depth=1 \
  --branch "$BRANCH" \
  "https://${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git" \
  "$CLONE_DIR"

cd "$CLONE_DIR"
git config user.email "backup@purrfectpal.studio"
git config user.name  "DB Backup Bot"

# Sync any concurrent remote changes before we add our new file
git pull --rebase origin "$BRANCH" || true

# ── Copy new backup into the repo ────────────────────────────────────────────
cp "$FILEPATH" "$CLONE_DIR/"
log "Copied $FILENAME into repo clone."

# ── Delete ALL expired backups from the GitHub repo ──────────────────────────
# We do NOT keep a "safety net" expired file — the CURRENT backup is the
# safety net. Anything strictly older than RETENTION_DAYS is removed cleanly.
#
# Filenames: backup_YYYYMMDD_HHMMSS.sql.gz
# git clone sets mtime=NOW so we parse the date from the filename, not mtime.

log "Pruning GitHub repo: removing backups older than ${RETENTION} days ..."

CUTOFF=$(date -d "-${RETENTION} days" '+%Y%m%d' 2>/dev/null \
      || date -v-${RETENTION}d '+%Y%m%d')
log "Cutoff date: $CUTOFF (files with date <= this will be deleted)"

DELETED_COUNT=0
for f in "$CLONE_DIR"/backup_*.sql.gz; do
  [ -f "$f" ] || continue
  fname=$(basename "$f")
  # Extract YYYYMMDD from backup_YYYYMMDD_HHMMSS.sql.gz
  file_date=$(echo "$fname" | sed 's/backup_\([0-9]\{8\}\)_.*/\1/')
  case "$file_date" in
    [0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9])
      if [ "$file_date" -le "$CUTOFF" ]; then
        log "  → Deleting expired: $fname (date: $file_date)"
        git rm --force "$f"
        DELETED_COUNT=$((DELETED_COUNT + 1))
      fi
      ;;
  esac
done
log "GitHub pruning done: $DELETED_COUNT file(s) removed."

# ── Write README tracking previous + current backup ──────────────────────────
log "Updating README.md ..."

# Count remaining files (after deletions, before commit)
REMAINING=$(find "$CLONE_DIR" -maxdepth 1 -name "backup_*.sql.gz" | wc -l | tr -d ' ')

cat > "$CLONE_DIR/README.md" << EOF
# PurrfectPal Studio — DB Backup Repository

| | File |
|---|---|
| 🆕 **New backup** | \`$FILENAME\` |
| 🔙 **Previous backup** | \`$PREVIOUS_BACKUP\` |

**Retention policy:** $RETENTION days — all older files are deleted each run  
**Files currently in repo:** $REMAINING  
**Repo:** \`$GITHUB_REPO\` @ \`$BRANCH\`  
**Last run:** \`$(date '+%Y-%m-%d %H:%M:%S UTC')\`

---

## Restore Instructions

\`\`\`bash
# 1. Download a backup file from this repo, then:
gunzip backup_YYYYMMDD_HHMMSS.sql.gz

# 2. Restore into the running DB container
docker exec -i db-c mysql \\
  -u adminPPS --password='Toor@PPS@77admin*' \\
  purrfectpalstudiodb < backup_YYYYMMDD_HHMMSS.sql
\`\`\`

---

## Last Run Log

\`\`\`
$(cat "$LOG_FILE")
\`\`\`
EOF

# ── Commit and push everything in one shot ────────────────────────────────────
git add -A

if git diff --cached --quiet; then
  log "Nothing to commit — backup may already exist on remote."
else
  COMMIT_MSG="backup: $FILENAME | prev: $PREVIOUS_BACKUP | pruned: ${DELETED_COUNT} expired"
  git commit -m "$COMMIT_MSG"
  git push origin "$BRANCH"
  log "Pushed to GitHub: $COMMIT_MSG"
fi

cd /tmp
rm -rf "$CLONE_DIR"

# ── Rotate old LOCAL backups ──────────────────────────────────────────────────
# Local files have real mtimes so -mtime is reliable here.
# Delete ALL files older than RETENTION days — no safety net needed locally
# because the current run's file is already on disk.
log "Pruning local /backups: removing files older than ${RETENTION} days ..."

LOCAL_DELETED=0
# -mtime +N means strictly more than N*24h old.
# We want >= RETENTION days, so use +$((RETENTION - 1)).
while IFS= read -r old_file; do
  log "  → Deleting local: $(basename "$old_file")"
  rm -f "$old_file"
  LOCAL_DELETED=$((LOCAL_DELETED + 1))
done << LIST
$(find /backups -maxdepth 1 -name "backup_*.sql.gz" -mtime +$((RETENTION - 1)) | sort)
LIST

log "Local pruning done: $LOCAL_DELETED file(s) removed."
log "=== Backup finished successfully: $FILENAME ==="