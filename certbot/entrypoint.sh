#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# Certbot entrypoint
#
# Boot order problem being solved:
#   Nginx starts → needs cert → cert doesn't exist → Nginx crashes → loop
#
# Strategy:
#   1. If no cert exists on the shared volume, write a self-signed dummy NOW
#      (before Nginx has even started, because we share the volume).
#   2. Signal Nginx to reload AFTER the dummy is in place.
#   3. Wait until Nginx is actually serving HTTP on port 80 (which means the
#      ACME /.well-known/acme-challenge/ path is ready) before running certbot.
#   4. Run certbot to get the real cert.
#   5. The deploy hook reloads Nginx with the real cert.
#   6. Loop every 12h for renewals.
# ─────────────────────────────────────────────────────────────────────────────
set -e
trap exit TERM

# ── Install deploy hook ───────────────────────────────────────────────────────
mkdir -p /etc/letsencrypt/renewal-hooks/deploy
cp /deploy-hook.sh /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh

# ── 1. Clean up duplicate accounts ───────────────────────────────────────────
ACCOUNTS_DIR="/etc/letsencrypt/accounts/acme-v02.api.letsencrypt.org/directory"
if [ -d "$ACCOUNTS_DIR" ]; then
  ACCOUNT_COUNT=$(find "$ACCOUNTS_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)
  if [ "$ACCOUNT_COUNT" -gt 1 ]; then
    echo "[Certbot] Multiple accounts ($ACCOUNT_COUNT). Pruning extras..."
    rm -rf "$ACCOUNTS_DIR"/*
  fi
fi

# ── 2. Clean up broken renewal configuration ──────────────────────────────────
RENEWAL_CONF="/etc/letsencrypt/renewal/purrfectpal.studio.conf"
if [ -f "$RENEWAL_CONF" ]; then
  if grep -q "{}" "$RENEWAL_CONF" || [ ! -s "$RENEWAL_CONF" ] || ! grep -q "archive_dir" "$RENEWAL_CONF"; then
    echo "[Certbot] Broken renewal config detected — purging..."
    rm -f "$RENEWAL_CONF"
    rm -rf /etc/letsencrypt/live/purrfectpal.studio
    rm -rf /etc/letsencrypt/archive/purrfectpal.studio
  fi
fi

# ── 3. Ensure a cert (real or dummy) exists BEFORE Nginx needs it ─────────────
CERT_DIR="/etc/letsencrypt/live/purrfectpal.studio"
GENERATED_DUMMY=false

if [ ! -f "$CERT_DIR/fullchain.pem" ] || [ ! -f "$CERT_DIR/privkey.pem" ]; then
  echo "[Certbot] No cert found — writing dummy so Nginx can start..."
  mkdir -p "$CERT_DIR"
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout "$CERT_DIR/privkey.pem" \
    -out    "$CERT_DIR/fullchain.pem" \
    -subj   "/CN=purrfectpal.studio"
  GENERATED_DUMMY=true
  echo "[Certbot] Dummy cert written. Nginx can now start."
fi

# ── 4. Detect if the cert on disk is a self-signed dummy ─────────────────────
if [ "$GENERATED_DUMMY" = false ] && [ -f "$CERT_DIR/fullchain.pem" ]; then
  if ! openssl x509 -in "$CERT_DIR/fullchain.pem" -noout -issuer \
       | grep -q -E "Let's Encrypt|ISRG|R3|R10|R11|E1|E2|DST Root"; then
    echo "[Certbot] Existing cert is self-signed dummy — will force-renew."
    GENERATED_DUMMY=true
  fi
fi

# ── 5. Wait for Nginx HTTP to be ready (ACME path must be reachable) ──────────
echo "[Certbot] Waiting for Nginx HTTP port 80 to become ready..."
WAIT=0
until wget -q --spider http://nginx/.well-known/acme-challenge/ 2>/dev/null \
   || wget -q --spider http://localhost:80/ 2>/dev/null \
   || [ "$WAIT" -ge 60 ]; do
  sleep 2
  WAIT=$((WAIT + 2))
done

if [ "$WAIT" -ge 60 ]; then
  echo "[Certbot] ⚠️  Nginx did not respond in 60s. Attempting certbot anyway..."
else
  echo "[Certbot] Nginx is up (after ${WAIT}s). Proceeding with certificate..."
fi

# ── 6. Obtain / renew the real certificate ────────────────────────────────────
CERTBOT_COMMON_ARGS="
  --cert-name purrfectpal.studio
  --webroot
  --webroot-path=/var/www/certbot
  --email suwasmgr77@gmail.com
  --agree-tos
  --no-eff-email
  --non-interactive
  -d purrfectpal.studio
  -d www.purrfectpal.studio
  -d admin.purrfectpal.studio
  -d www.admin.purrfectpal.studio
  -d artist.purrfectpal.studio
  -d www.artist.purrfectpal.studio
  -d promotions.purrfectpal.studio
  -d www.promotions.purrfectpal.studio
"

if [ "$GENERATED_DUMMY" = true ]; then
  echo "[Certbot] Force-renewing to replace dummy certificate..."
  # Remove dummy so Certbot can create clean symlinks
  rm -rf "$CERT_DIR"
  rm -rf /etc/letsencrypt/archive/purrfectpal.studio
  # shellcheck disable=SC2086
  certbot certonly $CERTBOT_COMMON_ARGS \
    --force-renewal \
    || echo "[Certbot] ⚠️  Cert obtain failed — Nginx will keep running on dummy until next retry."
else
  echo "[Certbot] Expanding / renewing existing certificate..."
  # shellcheck disable=SC2086
  certbot certonly $CERTBOT_COMMON_ARGS \
    --expand \
    || echo "[Certbot] ⚠️  Cert expand failed — existing cert unchanged."
fi

# ── 7. Renewal loop (every 12h) ───────────────────────────────────────────────
echo "[Certbot] Entering renewal loop (every 12h)..."
while :; do
  certbot renew --quiet || true
  sleep 12h & wait $!
done