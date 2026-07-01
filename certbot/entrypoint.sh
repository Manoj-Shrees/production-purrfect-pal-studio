#!/bin/sh
set -e
trap exit TERM

mkdir -p /etc/letsencrypt/renewal-hooks/deploy
cp /deploy-hook.sh /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh

# 1. Clean up duplicate accounts to prevent Certbot from prompting interactively
ACCOUNTS_DIR="/etc/letsencrypt/accounts/acme-v02.api.letsencrypt.org/directory"
if [ -d "$ACCOUNTS_DIR" ]; then
  ACCOUNT_COUNT=$(find "$ACCOUNTS_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)
  if [ "$ACCOUNT_COUNT" -gt 1 ]; then
    echo "[Certbot] Multiple accounts detected ($ACCOUNT_COUNT). Cleaning up to prevent interactive prompts..."
    rm -rf "$ACCOUNTS_DIR"/*
  fi
fi

# 2. Clean up broken renewal configuration
RENEWAL_CONF="/etc/letsencrypt/renewal/purrfectpal.studio.conf"
if [ -f "$RENEWAL_CONF" ]; then
  if grep -q "{}" "$RENEWAL_CONF" || [ ! -s "$RENEWAL_CONF" ] || ! grep -q "archive_dir" "$RENEWAL_CONF"; then
    echo "[Certbot] Broken renewal configuration detected. Cleaning up purrfectpal.studio cert files..."
    rm -f "$RENEWAL_CONF"
    rm -rf /etc/letsencrypt/live/purrfectpal.studio
    rm -rf /etc/letsencrypt/archive/purrfectpal.studio
  fi
fi
# 3. Ensure dummy certificates exist so Nginx can start up successfully.
# We generate them with "-days 1" (expires in 1 day) so Nginx can boot.
# If we generate them, we set GENERATED_DUMMY=true to force-renew and replace them.
CERT_DIR="/etc/letsencrypt/live/purrfectpal.studio"
GENERATED_DUMMY=false
if [ ! -f "$CERT_DIR/fullchain.pem" ] || [ ! -f "$CERT_DIR/privkey.pem" ]; then
  echo "[Certbot] Certificate files not found. Generating dummy self-signed certificate..."
  mkdir -p "$CERT_DIR"
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout "$CERT_DIR/privkey.pem" \
    -out "$CERT_DIR/fullchain.pem" \
    -subj "/CN=purrfectpal.studio"
  GENERATED_DUMMY=true
fi

# Also check if the certificate currently on disk is a self-signed dummy.
# If it is self-signed, we want to force-renew it to get a real one.
if [ -f "$CERT_DIR/fullchain.pem" ]; then
  if ! openssl x509 -in "$CERT_DIR/fullchain.pem" -noout -issuer | grep -q -E "Let's Encrypt|ISRG|R3|R10|R11|E1|E2|DST Root"; then
    echo "[Certbot] Existing certificate is a self-signed dummy. Setting GENERATED_DUMMY=true to force-renew..."
    GENERATED_DUMMY=true
  fi
fi

echo '[Certbot] Ensuring certificate covers all current domains...'
if [ "$GENERATED_DUMMY" = true ]; then
  echo "[Certbot] Force-renewing to replace the temporary dummy certificate..."
  certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email suwasmgr77@gmail.com \
    --agree-tos \
    --no-eff-email \
    --non-interactive \
    --force-renewal \
    -d purrfectpal.studio \
    -d www.purrfectpal.studio \
    -d admin.purrfectpal.studio \
    -d www.admin.purrfectpal.studio \
    -d artist.purrfectpal.studio \
    -d www.artist.purrfectpal.studio \
    -d promotions.purrfectpal.studio \
    -d www.promotions.purrfectpal.studio \
    || echo '[Certbot] Cert obtain/expand failed — check nginx is serving /.well-known/acme-challenge/'
else
  certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email suwasmgr77@gmail.com \
    --agree-tos \
    --no-eff-email \
    --non-interactive \
    --expand \
    -d purrfectpal.studio \
    -d www.purrfectpal.studio \
    -d admin.purrfectpal.studio \
    -d www.admin.purrfectpal.studio \
    -d artist.purrfectpal.studio \
    -d www.artist.purrfectpal.studio \
    -d promotions.purrfectpal.studio \
    -d www.promotions.purrfectpal.studio \
    || echo '[Certbot] Cert obtain/expand failed — check nginx is serving /.well-known/acme-challenge/'
fi

while :; do
  certbot renew --quiet || true
  sleep 12h & wait $!
done