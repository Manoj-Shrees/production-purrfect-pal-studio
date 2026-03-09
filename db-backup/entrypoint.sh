#!/bin/sh
echo "${BACKUP_CRON:-0 2 * * *} /backup.sh >> /var/log/backup.log 2>&1" > /etc/crontabs/root
crond -f -l 2
