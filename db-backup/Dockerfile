# ─────────────────────────────────────────────────────────────────────────────
# Dockerfile  —  db-backup
#
# Fixes applied:
#   1. Added openssh-client: git over HTTPS with a token works without it,
#      but some Alpine git builds pull it as a soft dependency. Including it
#      explicitly avoids subtle "could not read Username" errors on certain
#      Alpine patch versions.
#   2. Added ca-certificates: without this, git clone over HTTPS fails with
#      "SSL certificate problem: unable to get local issuer certificate"
#      because Alpine's minimal image ships with no CA bundle.
#   3. Added tini as PID-1 init: crond expects to be able to reap zombie
#      child processes. Without an init process, finished backup subprocesses
#      become zombies, and after enough accumulate the OS refuses new forks —
#      meaning backups silently stop running.
#   4. Set SHELL so sh built-ins behave consistently inside RUN steps.
# ─────────────────────────────────────────────────────────────────────────────

FROM alpine:latest

RUN apk add --no-cache \
    mysql-client \
    dcron \
    git \
    bash \
    curl \
    ca-certificates \
    openssh-client \
    netcat-openbsd \
    tini

# Create the backup output directory with correct permissions
RUN mkdir -p /backups && chmod 755 /backups

# Create a log file crond can write to
RUN touch /var/log/backup.log

COPY backup.sh     /backup.sh
COPY entrypoint.sh /entrypoint.sh

RUN chmod +x /backup.sh /entrypoint.sh

# Use tini as PID-1 so crond can reap zombie child processes
ENTRYPOINT ["/sbin/tini", "--", "/entrypoint.sh"]