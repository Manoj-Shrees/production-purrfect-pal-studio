#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# Certbot entrypoint  — crash-safe boot sequence
#
# Key design:
#   • Dummy cert is written FIRST so Nginx can always start.
#   • When certbot needs to obtain a real cert it deletes the dummy from DISK,
#     but Nginx is already running with it loaded in memory — it keeps serving
#     HTTP on port 80 (and the ACME challenge path) until the deploy hook
#     reloads it with the real cert.
#   • If certbot FAILS, the dummy is immediately re-written and Nginx is
#     reloaded so it never stays cert-less.  The next 12h sleep retries.
# ─────────────────────────────────────────────────────────────────────────────
set -e
trap exit TERM

CERT_DIR="/etc/letsencrypt/live/purrfectpal.studio"
NGINX_CONTAINER="nginx-proxy"

# ── helper: write a 1-day self-signed dummy cert ──────────────────────────────
write_dummy() {
  echo "[Certbot] Writing self-signed dummy certificate..."
  mkdir -p "$CERT_DIR"
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout "$CERT_DIR/privkey.pem" \
    -out    "$CERT_DIR/fullchain.pem" \
    -subj   "/CN=purrfectpal.studio"
  echo "[Certbot] Dummy cert written."
}

# ── helper: reload nginx gracefully ──────────────────────────────────────────
reload_nginx() {
  echo "[Certbot] Reloading Nginx..."
  docker kill --signal=SIGHUP "$NGINX_CONTAINER" 2>/dev/null \
    || docker exec "$NGINX_CONTAINER" nginx -s reload 2>/dev/null \
    || echo "[Certbot] ⚠️  Could not reload Nginx (not fatal)."
}

# ── install deploy hook ───────────────────────────────────────────────────────
mkdir -p /etc/letsencrypt/renewal-hooks/deploy
cp /deploy-hook.sh /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh

# ── 1. Clean up duplicate ACME accounts ──────────────────────────────────────
ACCOUNTS_DIR="/etc/letsencrypt/accounts/acme-v02.api.letsencrypt.org/directory"
if [ -d "$ACCOUNTS_DIR" ]; then
  ACCOUNT_COUNT=$(find "$ACCOUNTS_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)
  if [ "$ACCOUNT_COUNT" -gt 1 ]; then
    echo "[Certbot] Multiple ACME accounts ($ACCOUNT_COUNT) — pruning..."
    rm -rf "$ACCOUNTS_DIR"/*
  fi
fi

# ── 2. Clean up broken renewal config ────────────────────────────────────────
RENEWAL_CONF="/etc/letsencrypt/renewal/purrfectpal.studio.conf"
if [ -f "$RENEWAL_CONF" ]; then
  if grep -q "{}" "$RENEWAL_CONF" || [ ! -s "$RENEWAL_CONF" ] || ! grep -q "archive_dir" "$RENEWAL_CONF"; then
    echo "[Certbot] Broken renewal config — purging..."
    rm -f "$RENEWAL_CONF"
    rm -rf /etc/letsencrypt/live/purrfectpal.studio
    rm -rf /etc/letsencrypt/archive/purrfectpal.studio
  fi
fi

# ── 3. Ensure a cert (real or dummy) always exists ───────────────────────────
GENERATED_DUMMY=false

if [ ! -f "$CERT_DIR/fullchain.pem" ] || [ ! -f "$CERT_DIR/privkey.pem" ]; then
  write_dummy
  GENERATED_DUMMY=true
fi

# Is the cert on disk a self-signed dummy?
if [ "$GENERATED_DUMMY" = false ] && [ -f "$CERT_DIR/fullchain.pem" ]; then
  if ! openssl x509 -in "$CERT_DIR/fullchain.pem" -noout -issuer 2>/dev/null \
       | grep -q -E "Let's Encrypt|ISRG|R3|R10|R11|E1|E2|DST Root"; then
    echo "[Certbot] Cert on disk is self-signed dummy — will force-renew."
    GENERATED_DUMMY=true
  fi
fi

# ── 4. Wait for Nginx HTTP to be ready ───────────────────────────────────────
echo "[Certbot] Waiting for Nginx to serve on port 80..."
WAIT=0
until wget -q --spider "http://${NGINX_CONTAINER}/" 2>/dev/null \
   || wget -q --spider "http://localhost:80/" 2>/dev/null \
   || [ "$WAIT" -ge 90 ]; do
  sleep 3
  WAIT=$((WAIT + 3))
done

if [ "$WAIT" -ge 90 ]; then
  echo "[Certbot] ⚠️  Nginx not reachable after 90s — attempting certbot anyway."
else
  echo "[Certbot] Nginx is up (${WAIT}s). Proceeding with certificate request..."
fi

# ── 5. Certbot args (shared between force-renew and expand) ──────────────────
run_certbot() {
  MODE="$1"   # --force-renewal or --expand

  # Remove stale dummy from disk — Nginx is already running in memory with it,
  # so it keeps serving port 80 (ACME challenge) until reloaded by deploy hook.
  rm -rf "$CERT_DIR"
  rm -rf /etc/letsencrypt/archive/purrfectpal.studio
  rm -f  "$RENEWAL_CONF"

  certbot certonly \
    --cert-name purrfectpal.studio \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email suwasmgr77@gmail.com \
    --agree-tos \
    --no-eff-email \
    --non-interactive \
    "$MODE" \
    -d purrfectpal.studio \
    -d www.purrfectpal.studio \
    -d admin.purrfectpal.studio \
    -d www.admin.purrfectpal.studio \
    -d artist.purrfectpal.studio \
    -d www.artist.purrfectpal.studio \
    -d promotions.purrfectpal.studio \
    -d www.promotions.purrfectpal.studio
}

# ── 6. Obtain / expand real certificate ──────────────────────────────────────
if [ "$GENERATED_DUMMY" = true ]; then
  echo "[Certbot] Force-renewing to get real certificate..."
  if run_certbot --force-renewal; then
    echo "[Certbot] ✅ Real certificate obtained. Nginx will reload via deploy hook."
  else
    echo "[Certbot] ❌ Certificate obtain FAILED. Re-creating dummy so Nginx stays up..."
    write_dummy
    reload_nginx
    echo "[Certbot] Dummy restored. Will retry in 12h."
  fi
else
  echo "[Certbot] Expanding existing certificate if needed..."
  if run_certbot --expand; then
    echo "[Certbot] ✅ Certificate expanded/renewed."
  else
    echo "[Certbot] ⚠️  Expand failed — existing cert unchanged, continuing."
    # Re-write dummy just to be safe if archive was partially deleted
    if [ ! -f "$CERT_DIR/fullchain.pem" ]; then
      write_dummy
      reload_nginx
    fi
  fi
fi

# ── 7. Renewal loop (every 12h) ───────────────────────────────────────────────
echo "[Certbot] Entering 12h renewal loop..."
while :; do
  certbot renew --quiet || true
  sleep 12h & wait $!
done