
##!/bin/sh
# Write cron job using env var
echo "${BACKUP_CRON:-0 2 * * *} /backup.sh >> /var/log/backup.log 2>&1" > /etc/crontabs/root
# Run crond in foreground
crond -f -l 2