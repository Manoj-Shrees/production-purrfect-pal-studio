#!/bin/sh
set -e
trap exit TERM

mkdir -p /etc/letsencrypt/renewal-hooks/deploy
cp /deploy-hook.sh /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh

echo '[Certbot] Ensuring certificate covers all current domains...'
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
  && /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh \
  || echo '[Certbot] Cert obtain/expand failed — check nginx is serving /.well-known/acme-challenge/'

while :; do
  certbot renew --quiet || true
  sleep 12h & wait $!
done