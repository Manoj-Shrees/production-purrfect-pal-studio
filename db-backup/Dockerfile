# ─────────────────────────────────────────────────────────────────────────────
# Dockerfile  —  db-backup
#
# FIX: Alpine's mysql-client package installs MariaDB's client binaries, not
# MySQL's. MariaDB's client does not ship caching_sha2_password.so, which is
# the default auth plugin for MySQL 8 users. Every connection attempt fails
# with "Plugin caching_sha2_password could not be loaded".
#
# Solution: use debian:bookworm-slim and install the official mysql-client
# from apt, which is the real MySQL 8 client and includes the plugin.
# ─────────────────────────────────────────────────────────────────────────────

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    default-mysql-client \
    cron \
    git \
    curl \
    ca-certificates \
    netcat-openbsd \
    tini \
 && rm -rf /var/lib/apt/lists/*

# Create backup output directory
RUN mkdir -p /backups && chmod 755 /backups

COPY backup.sh     /backup.sh
COPY entrypoint.sh /entrypoint.sh

RUN chmod +x /backup.sh /entrypoint.sh

ENTRYPOINT ["/usr/bin/tini", "--", "/entrypoint.sh"]