#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# Certbot entrypoint — rate-limit-safe, crash-safe
#
# LESSONS LEARNED (do not revert):
#  1. Never --force-renewal unless cert is genuinely missing/dummy/expired.
#     Repeated force-renewals exhaust the Let's Encrypt 5-cert/7-day limit.
#  2. Never purge valid numbered lineages (purrfectpal.studio-0001, -0002, …).
#     Certbot stores good certs there; purging wastes the rate-limit allowance.
#  3. If certbot lands a cert in a numbered dir, symlink it — don't re-issue.
#  4. On failure, always restore the dummy so Nginx never stays cert-less.
# ─────────────────────────────────────────────────────────────────────────────
set -e
trap exit TERM

DOMAIN="purrfectpal.studio"
CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"
NGINX_CONTAINER="nginx-proxy"

CERTBOT_DOMAINS="
  -d ${DOMAIN}
  -d www.${DOMAIN}
  -d admin.${DOMAIN}
  -d www.admin.${DOMAIN}
  -d artist.${DOMAIN}
  -d www.artist.${DOMAIN}
  -d promotions.${DOMAIN}
  -d www.promotions.${DOMAIN}
"

# ── helpers ───────────────────────────────────────────────────────────────────

write_dummy() {
  echo "[Certbot] Writing self-signed dummy certificate to $CERT_DIR ..."
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
    || echo "[Certbot] ⚠️  Nginx reload skipped (may still be starting)."
}

# Is the cert at a given path a real Let's Encrypt cert (not self-signed)?
is_real_cert() {
  openssl x509 -in "$1" -noout -issuer 2>/dev/null \
    | grep -q -E "Let's Encrypt|ISRG|R3|R10|R11|E1|E2|DST Root"
}

# Extracts all DNS alternative names from the certificate, one per line
get_cert_domains() {
  openssl x509 -in "$1" -text -noout \
    | grep -A 1 "Subject Alternative Name:" \
    | grep "DNS:" \
    | sed 's/DNS://g' \
    | tr -d ' ' \
    | tr ',' '\n'
}

# Extracts expected domains from the CERTBOT_DOMAINS variable
get_expected_domains() {
  echo "$CERTBOT_DOMAINS" | tr -s ' ' '\n' | grep -v '^-d' | grep -v '^$'
}

# Checks if the cert covers all domains in the expected list
cert_covers_all_domains() {
  local cert="$1"
  [ -f "$cert" ] || return 1
  
  local cert_domains
  cert_domains=$(get_cert_domains "$cert")
  
  for expected in $(get_expected_domains); do
    if ! echo "$cert_domains" | grep -qFx "$expected"; then
      echo "[Certbot] Domain '$expected' is missing from the certificate."
      return 1
    fi
  done
  return 0
}

# Find the best valid numbered lineage and symlink it to the canonical path.
# Returns 0 if a valid cert was found and linked, 1 otherwise.
link_best_numbered_cert() {
  BEST=""
  # Walk all numbered dirs and pick the one whose cert is real + not expired and covers all domains
  for DIR in /etc/letsencrypt/live/${DOMAIN}-*/; do
    [ -d "$DIR" ] || continue
    CERT="$DIR/fullchain.pem"
    [ -f "$CERT" ] || continue
    if is_real_cert "$CERT" && openssl x509 -in "$CERT" -noout -checkend 86400 2>/dev/null \
       && cert_covers_all_domains "$CERT"; then
      BEST="$DIR"
      break
    fi
  done

  if [ -n "$BEST" ]; then
    echo "[Certbot] Found valid cert in $BEST — symlinking to $CERT_DIR ..."
    rm -rf "$CERT_DIR"
    ln -sfn "$BEST" "$CERT_DIR"
    echo "[Certbot] ✅ Symlink created: $CERT_DIR → $BEST"
    return 0
  fi
  return 1
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
    KEEP=$(find "$ACCOUNTS_DIR" -mindepth 1 -maxdepth 1 -type d | head -1)
    find "$ACCOUNTS_DIR" -mindepth 1 -maxdepth 1 -type d | grep -v "^$KEEP$" | xargs rm -rf 2>/dev/null || true
  fi
fi

# ── 2. Determine cert state ───────────────────────────────────────────────────
# Priority:
#   A. Real LE cert at canonical path → nothing to do
#   B. Real LE cert in a numbered dir → symlink it
#   C. No cert / dummy cert → need to obtain
NEED_REAL_CERT=false

if [ -f "$CERT_DIR/fullchain.pem" ] && is_real_cert "$CERT_DIR/fullchain.pem" \
   && openssl x509 -in "$CERT_DIR/fullchain.pem" -noout -checkend 86400 2>/dev/null \
   && cert_covers_all_domains "$CERT_DIR/fullchain.pem"; then
  echo "[Certbot] ✅ Valid LE cert covering all domains already at $CERT_DIR — no action needed."
else
  echo "[Certbot] No valid cert at canonical path."

  # Try to rescue a numbered cert before writing dummy or calling certbot
  if link_best_numbered_cert; then
    echo "[Certbot] ✅ Rescued existing numbered cert — no new issuance needed."
    reload_nginx
  else
    echo "[Certbot] No valid numbered cert found either."
    # Ensure at least a dummy exists so Nginx can start
    if [ ! -f "$CERT_DIR/fullchain.pem" ] || [ ! -f "$CERT_DIR/privkey.pem" ]; then
      write_dummy
    fi
    NEED_REAL_CERT=true
  fi
fi

# ── 3. Wait for Nginx TCP port 80 ────────────────────────────────────────────
echo "[Certbot] Waiting for Nginx TCP port 80..."
WAIT=0
until nc -z "${NGINX_CONTAINER}" 80 2>/dev/null \
   || nc -z "localhost" 80 2>/dev/null \
   || [ "$WAIT" -ge 90 ]; do
  sleep 2
  WAIT=$((WAIT + 2))
done
if [ "$WAIT" -ge 90 ]; then
  echo "[Certbot] ⚠️  Nginx not reachable after 90s — continuing anyway."
else
  echo "[Certbot] ✅ Nginx is up (${WAIT}s)."
fi

# ── 4. Obtain real certificate (only when needed) ─────────────────────────────
do_certbot() {
  # Only purge broken/dummy files at the canonical path — NEVER numbered dirs
  if [ -f "$CERT_DIR/fullchain.pem" ] && ! is_real_cert "$CERT_DIR/fullchain.pem"; then
    echo "[Certbot] Removing dummy from canonical path before certbot run..."
    rm -rf "$CERT_DIR"
  fi
  
  # Always clear stale/broken renewal and archive folders to prevent "archive directory exists" failures
  echo "[Certbot] Cleaning stale archive and configuration files for ${DOMAIN}..."
  rm -rf "/etc/letsencrypt/archive/${DOMAIN}"
  rm -f "/etc/letsencrypt/renewal/${DOMAIN}.conf"

  # shellcheck disable=SC2086
  certbot certonly \
    --cert-name "${DOMAIN}" \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email suwasmgr77@gmail.com \
    --agree-tos \
    --no-eff-email \
    --non-interactive \
    --keep-until-expiring \
    $CERTBOT_DOMAINS
}

if [ "$NEED_REAL_CERT" = true ]; then
  echo "[Certbot] Requesting real Let's Encrypt certificate..."
  if do_certbot; then
    # Certbot might have used a numbered name — check and symlink if so
    if [ ! -f "$CERT_DIR/fullchain.pem" ] || ! is_real_cert "$CERT_DIR/fullchain.pem"; then
      if ! link_best_numbered_cert; then
        echo "[Certbot] ❌ Could not find cert after certbot run. Keeping dummy."
        write_dummy
      fi
    fi
    reload_nginx
    echo "[Certbot] ✅ Certificate in place."
  else
    echo "[Certbot] ❌ Certbot failed (possibly rate-limited). Keeping dummy cert."
    if [ ! -f "$CERT_DIR/fullchain.pem" ]; then
      write_dummy
      reload_nginx
    fi
    echo "[Certbot] Will retry in 12h."
  fi
fi

# ── 5. Renewal loop (every 12h) ───────────────────────────────────────────────
echo "[Certbot] Entering renewal loop (every 12h)..."
while :; do
  sleep 12h & wait $!

  echo "[Certbot] Running renewal check..."

  # Check if the cert at canonical path is real, valid for at least 30 days, and covers all domains
  if [ -f "$CERT_DIR/fullchain.pem" ] && is_real_cert "$CERT_DIR/fullchain.pem" \
     && openssl x509 -in "$CERT_DIR/fullchain.pem" -noout -checkend 2592000 2>/dev/null \
     && cert_covers_all_domains "$CERT_DIR/fullchain.pem"; then
    echo "[Certbot] Certificate is real, valid for at least 30 days, and covers all domains. No renewal needed."
  else
    echo "[Certbot] Certificate is missing, a dummy, or expiring/incomplete. Attempting renewal/obtain..."
    
    # Try to rescue a valid numbered cert first
    if link_best_numbered_cert; then
      # Double check if the rescued cert is valid for at least 30 days and covers all domains
      if openssl x509 -in "$CERT_DIR/fullchain.pem" -noout -checkend 2592000 2>/dev/null \
         && cert_covers_all_domains "$CERT_DIR/fullchain.pem"; then
        echo "[Certbot] Rescued cert is valid for at least 30 days. Skipping renewal."
        reload_nginx
        continue
      fi
    fi

    # Run do_certbot to obtain a new/renewed cert
    if do_certbot; then
      # If certbot succeeded but didn't write to the canonical path, check for numbered folders
      if [ ! -f "$CERT_DIR/fullchain.pem" ] || ! is_real_cert "$CERT_DIR/fullchain.pem"; then
        link_best_numbered_cert || true
      fi
      reload_nginx
      echo "[Certbot] ✅ Certificate successfully renewed."
    else
      echo "[Certbot] ❌ Renewal/obtain failed. Keeping existing/dummy certificate."
      if [ ! -f "$CERT_DIR/fullchain.pem" ]; then
        write_dummy
        reload_nginx
      fi
    fi
  fi
done