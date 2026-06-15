#!/bin/sh
set -e
trap exit TERM

mkdir -p /etc/letsencrypt/renewal-hooks/deploy
cp /deploy-hook.sh /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh

if [ ! -f /etc/letsencrypt/live/purrfectpal.studio/fullchain.pem ]; then
  echo '[Certbot] No cert found — obtaining for all domains...'
  certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email suwasmgr77@gmail.com \
    --agree-tos \
    --no-eff-email \
    --non-interactive \
    -d purrfectpal.studio \
    -d www.purrfectpal.studio \
    -d admin.purrfectpal.studio \
    -d www.admin.purrfectpal.studio \
    -d artist.purrfectpal.studio \
    -d www.artist.purrfectpal.studio \
    && /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh \
    || echo '[Certbot] Initial cert fetch failed — check nginx is serving /.well-known/acme-challenge/'
else
  echo '[Certbot] Cert already exists — skipping initial obtain'
fi

while :; do
  certbot renew --quiet || true
  sleep 12h & wait $!
done