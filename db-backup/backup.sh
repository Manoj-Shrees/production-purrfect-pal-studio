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
PREV_FILE=$(find /backups -maxdepth 1 -name "pps_full_backup_*.tar.gz.part_aa" | sort -r | head -n 1)
[ -n "$PREV_FILE" ] && PREVIOUS_BACKUP=$(basename "$PREV_FILE" .part_aa) || PREVIOUS_BACKUP="(none — first run)"
log "Previous backup: $PREVIOUS_BACKUP"

# ── Create new dump & archive uploads ─────────────────────────────────────────
FILENAME="pps_full_backup_$(date +%Y%m%d_%H%M%S).tar.gz"
FILEPATH="/backups/$FILENAME"
tempDbPath="/tmp/db_dump_$(date +%Y%m%d_%H%M%S).sql"

log "Running mysqldump → $tempDbPath ..."

mysqldump \
  -h "$MYSQL_HOST" \
  -u "$MYSQL_USER" \
  -p"$MYSQL_PASSWORD" \
  --skip-ssl \
  --single-transaction \
  --no-tablespaces \
  --routines \
  --triggers \
  "$MYSQL_DATABASE" > "$tempDbPath" 2>"$DUMP_STDERR"

if [ -s "$DUMP_STDERR" ]; then
  log "--- dump stderr ---"
  cat "$DUMP_STDERR" >> "$LOG_FILE"
  cat "$DUMP_STDERR"
  log "--- end dump stderr ---"
fi

log "Archiving database dump + uploads and splitting into 100MB chunks..."

if [ ! -d "/app/uploadedfiles" ]; then
  log "ERROR: /app/uploadedfiles directory is missing or volume not mounted."
  rm -f "$tempDbPath"
  exit 1
fi

tar -czf - -C /app uploadedfiles -C /tmp "$(basename "$tempDbPath")" | split -b 100M - "$FILEPATH.part_"

rm -f "$tempDbPath"

# ── Validate: refuse to push an empty/tiny backup ────────────────────────────
FILESIZE=0
for f in "$FILEPATH".part_*; do
  [ -f "$f" ] || continue
  sz=$(stat -c%s "$f" 2>/dev/null || stat -f%z "$f")
  FILESIZE=$((FILESIZE + sz))
done

if [ "$FILESIZE" -lt 100 ]; then
  log "ERROR: Backup is suspiciously small (${FILESIZE} bytes) — dump/archive likely failed."
  rm -f "$FILEPATH".part_*
  exit 1
fi
log "Dump and Archive complete: $FILENAME (${FILESIZE} bytes)"

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
cp "$FILEPATH".part_* "$CLONE_DIR/"
log "Copied $FILENAME chunks into repo clone."

# ── Delete ALL expired backups from the GitHub repo ──────────────────────────
log "Pruning GitHub repo: removing backups older than ${RETENTION} days ..."

CUTOFF=$(date -d "-${RETENTION} days" '+%Y%m%d' 2>/dev/null \
      || date -v-${RETENTION}d '+%Y%m%d')
log "Cutoff date: $CUTOFF (files with date <= this will be deleted)"

DELETED_COUNT=0
for f in "$CLONE_DIR"/pps_full_backup_*.tar.gz.part_aa; do
  [ -f "$f" ] || continue
  fname=$(basename "$f" .part_aa)
  # Extract YYYYMMDD from pps_full_backup_YYYYMMDD_HHMMSS.tar.gz
  file_date=$(echo "$fname" | sed 's/pps_full_backup_\([0-9]\{8\}\)_.*/\1/')
  case "$file_date" in
    [0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9])
      if [ "$file_date" -le "$CUTOFF" ]; then
        log "  → Deleting expired: $fname (date: $file_date)"
        git rm --force "$CLONE_DIR/${fname}".part_*
        DELETED_COUNT=$((DELETED_COUNT + 1))
      fi
      ;;
  esac
done
log "GitHub pruning done: $DELETED_COUNT file(s) removed."

# ── Write README tracking previous + current backup ──────────────────────────
log "Updating README.md ..."

# Count remaining files
REMAINING=$(find "$CLONE_DIR" -maxdepth 1 -name "pps_full_backup_*.tar.gz.part_aa" | wc -l | tr -d ' ')

cat > "$CLONE_DIR/README.md" << EOF
# PurrfectPal Studio — Full System Backup Repository

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
# 1. Download backup chunks from this repo, then combine them:
cat ${FILENAME}.part_* > ${FILENAME}

# 2. Extract the archive:
mkdir -p /tmp/restore_extract
tar -xzf ${FILENAME} -C /tmp/restore_extract

# 3. Restore database into running DB container:
docker exec -i db-c mysql \\
  -u adminPPS --password='Toor@PPS@77admin*' \\
  purrfectpalstudiodb < /tmp/restore_extract/db_dump_*.sql

# 4. Copy uploaded files back to uploads volume:
cp -R /tmp/restore_extract/uploadedfiles/* /app/uploadedfiles/
\`\`\`

---

## Last Run Log

\`\`\`
$(cat "$LOG_FILE")
\`\`\`
EOF

# ── Commit and push everything in one shot ────────────────────────────────────
git add -A

if git diff --quiet && git diff --cached --quiet; then
  log "Nothing to commit — backup may already exist on remote."
else
  COMMIT_MSG="full-backup: $FILENAME | prev: $PREVIOUS_BACKUP | pruned: ${DELETED_COUNT} expired"
  git commit -m "$COMMIT_MSG"
  git push origin "$BRANCH"
  log "Pushed to GitHub: $COMMIT_MSG"
fi

cd /tmp
rm -rf "$CLONE_DIR"

# ── Rotate old LOCAL backups ──────────────────────────────────────────────────
log "Pruning local /backups: removing files older than ${RETENTION} days ..."

LOCAL_DELETED=0
while IFS= read -r old_file; do
  [ -n "$old_file" ] || continue
  base_prefix=$(echo "$old_file" | sed 's/\.part_[a-z]\{2\}$//')
  if [ -f "$old_file" ]; then
    log "  → Deleting local: $(basename "$old_file")"
    rm -f "${base_prefix}".part_*
    LOCAL_DELETED=$((LOCAL_DELETED + 1))
  fi
done << LIST
$(find /backups -maxdepth 1 -name "pps_full_backup_*.tar.gz.part_aa" -mtime +$((RETENTION - 1)) | sort)
LIST

log "Local pruning done: $LOCAL_DELETED file(s) removed."
log "=== Backup finished successfully: $FILENAME ==="