#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# Certbot entrypoint — crash-safe, numbered-dir-safe
#
# Root cause this fixes:
#   Certbot creates purrfectpal.studio-0001, -0002, ... when old numbered dirs
#   still exist in /etc/letsencrypt/live|archive.  Nginx always reads from
#   purrfectpal.studio/ (no suffix), so a numbered cert is never loaded.
#
# Strategy:
#   • Purge ALL purrfectpal.studio* dirs (live, archive) AND renewal confs
#     before every certbot run → certbot always names the lineage cleanly.
#   • Keep dummy cert on disk until certbot SUCCEEDS.  If certbot fails,
#     re-write dummy and reload Nginx so it never stays cert-less.
# ─────────────────────────────────────────────────────────────────────────────
set -e
trap exit TERM

DOMAIN="purrfectpal.studio"
CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"
NGINX_CONTAINER="nginx-proxy"

# ── helpers ───────────────────────────────────────────────────────────────────

write_dummy() {
  echo "[Certbot] Writing self-signed dummy certificate..."
  mkdir -p "$CERT_DIR"
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout "$CERT_DIR/privkey.pem" \
    -out    "$CERT_DIR/fullchain.pem" \
    -subj   "/CN=${DOMAIN}"
  echo "[Certbot] Dummy cert written."
}

reload_nginx() {
  echo "[Certbot] Reloading Nginx..."
  docker exec "$NGINX_CONTAINER" nginx -s reload 2>/dev/null \
    || docker kill --signal=SIGHUP "$NGINX_CONTAINER" 2>/dev/null \
    || echo "[Certbot] ⚠️  Nginx reload skipped (container may still be starting)."
}

# Purge ALL numbered leftovers so certbot always creates the clean lineage name
purge_all_lineages() {
  echo "[Certbot] Purging all purrfectpal.studio* lineages..."
  rm -rf /etc/letsencrypt/live/${DOMAIN}
  rm -rf /etc/letsencrypt/live/${DOMAIN}-*
  rm -rf /etc/letsencrypt/archive/${DOMAIN}
  rm -rf /etc/letsencrypt/archive/${DOMAIN}-*
  rm -f  /etc/letsencrypt/renewal/${DOMAIN}.conf
  rm -f  /etc/letsencrypt/renewal/${DOMAIN}-*.conf
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
    echo "[Certbot] Multiple ACME accounts ($ACCOUNT_COUNT) — pruning extras..."
    rm -rf "$ACCOUNTS_DIR"/*
  fi
fi

# ── 2. Detect broken renewal config ──────────────────────────────────────────
RENEWAL_CONF="/etc/letsencrypt/renewal/${DOMAIN}.conf"
if [ -f "$RENEWAL_CONF" ]; then
  if grep -q "{}" "$RENEWAL_CONF" || [ ! -s "$RENEWAL_CONF" ] || ! grep -q "archive_dir" "$RENEWAL_CONF"; then
    echo "[Certbot] Broken renewal config detected — purging..."
    purge_all_lineages
  fi
fi

# ── 3. Determine cert state ───────────────────────────────────────────────────
NEED_REAL_CERT=false

if [ ! -f "$CERT_DIR/fullchain.pem" ] || [ ! -f "$CERT_DIR/privkey.pem" ]; then
  echo "[Certbot] No cert found — writing dummy so Nginx can start..."
  write_dummy
  NEED_REAL_CERT=true
elif ! openssl x509 -in "$CERT_DIR/fullchain.pem" -noout -issuer 2>/dev/null \
     | grep -q -E "Let's Encrypt|ISRG|R3|R10|R11|E1|E2|DST Root"; then
  echo "[Certbot] Cert on disk is self-signed dummy — will obtain real cert."
  NEED_REAL_CERT=true
fi

# ── 4. Wait for Nginx HTTP on port 80 ────────────────────────────────────────
echo "[Certbot] Waiting for Nginx port 80..."
WAIT=0
until wget -q --spider "http://${NGINX_CONTAINER}/" 2>/dev/null \
   || wget -q --spider "http://localhost/" 2>/dev/null \
   || [ "$WAIT" -ge 90 ]; do
  sleep 3
  WAIT=$((WAIT + 3))
done
echo "[Certbot] Nginx wait finished (${WAIT}s elapsed)."

# ── 5. Obtain real certificate ────────────────────────────────────────────────
do_certbot() {
  # Purge ALL numbered lineages so certbot uses the clean "purrfectpal.studio" name
  purge_all_lineages

  certbot certonly \
    --cert-name "${DOMAIN}" \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email suwasmgr77@gmail.com \
    --agree-tos \
    --no-eff-email \
    --non-interactive \
    --force-renewal \
    -d "${DOMAIN}" \
    -d "www.${DOMAIN}" \
    -d "admin.${DOMAIN}" \
    -d "www.admin.${DOMAIN}" \
    -d "artist.${DOMAIN}" \
    -d "www.artist.${DOMAIN}" \
    -d "promotions.${DOMAIN}" \
    -d "www.promotions.${DOMAIN}"
}

if [ "$NEED_REAL_CERT" = true ]; then
  echo "[Certbot] Obtaining real Let's Encrypt certificate..."

  if do_certbot; then
    echo "[Certbot] ✅ Real certificate obtained!"
    # Verify the cert landed in the right place (no numbered suffix)
    if [ -f "$CERT_DIR/fullchain.pem" ]; then
      echo "[Certbot] ✅ Certificate is at the correct path: $CERT_DIR"
      reload_nginx
    else
      # Certbot used a numbered suffix — find it and symlink
      ACTUAL=$(find /etc/letsencrypt/live -maxdepth 1 -name "${DOMAIN}-*" -type d 2>/dev/null | head -1)
      if [ -n "$ACTUAL" ]; then
        echo "[Certbot] ⚠️  Cert landed in $ACTUAL — creating symlink to $CERT_DIR..."
        # Remove whatever is there and create symlink
        rm -rf "$CERT_DIR"
        ln -sf "$ACTUAL" "$CERT_DIR"
        reload_nginx
      else
        echo "[Certbot] ❌ Cannot find cert directory! Re-writing dummy..."
        write_dummy
        reload_nginx
      fi
    fi
  else
    echo "[Certbot] ❌ Certificate obtain FAILED — re-writing dummy so Nginx stays up..."
    write_dummy
    reload_nginx
    echo "[Certbot] Will retry in 12h."
  fi
fi

# ── 6. Renewal loop ───────────────────────────────────────────────────────────
echo "[Certbot] Entering renewal loop (every 12h)..."
while :; do
  # Before each renewal, also purge numbered leftovers if renewal conf is broken
  if [ -f "$RENEWAL_CONF" ]; then
    if ! openssl x509 -in "$CERT_DIR/fullchain.pem" -noout 2>/dev/null; then
      echo "[Certbot] Renewal: cert missing or corrupt — re-obtaining..."
      NEED_REAL_CERT=true
      if do_certbot; then
        reload_nginx
      else
        write_dummy
        reload_nginx
      fi
    else
      certbot renew --quiet || true
    fi
  else
    echo "[Certbot] Renewal: no renewal conf found — re-obtaining..."
    if do_certbot; then
      reload_nginx
    else
      write_dummy
      reload_nginx
    fi
  fi
  sleep 12h & wait $!
done