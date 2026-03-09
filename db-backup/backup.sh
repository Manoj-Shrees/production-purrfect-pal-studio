
#!/bin/sh
echo "=== Backup started at $(date) ==="
FILENAME="backup_$(date +%Y%m%d_%H%M%S).sql.gz"
FILEPATH="/backups/$FILENAME"
mysqldump -h "$MYSQL_HOST" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" | gzip > "$FILEPATH"
echo "Backup created: $FILENAME"
find /backups -name "*.sql.gz" -mtime +${RETENTION_DAYS:-14} -delete
echo "Old backups cleaned"
cd /tmp
rm -rf gh-backup
git clone https://${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git gh-backup
cp "$FILEPATH" gh-backup/
cd gh-backup
git config user.email "backup@purrfectpal.studio"
git config user.name "DB Backup Bot"
git add .
git commit -m "DB backup: $FILENAME"
git push origin ${GITHUB_BRANCH:-main}
echo "Pushed to GitHub"
