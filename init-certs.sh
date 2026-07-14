#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# init-certs.sh
#
# Run this ONCE before `docker compose up` on a fresh server or after clearing
# letsencrypt data.  It creates a self-signed dummy certificate on the HOST so
# Nginx can start immediately, even before Certbot has obtained a real cert.
#
# The Certbot container detects the dummy (via openssl issuer check) and
# force-renews with a real Let's Encrypt cert automatically.
#
# Usage:
#   chmod +x init-certs.sh
#   ./init-certs.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

echo "[env-fix] Ensuring EMAIL_USER and EMAIL_PASS are in .env..."
mkdir -p ./admin-app
if [ -f .env ]; then
  # Forcefully update to correct credentials by stripping any old entries
  sed -i.bak '/^EMAIL_USER=/d' .env 2>/dev/null || sed -i '' '/^EMAIL_USER=/d' .env 2>/dev/null || true
  sed -i.bak '/^EMAIL_PASS=/d' .env 2>/dev/null || sed -i '' '/^EMAIL_PASS=/d' .env 2>/dev/null || true
  rm -f .env.bak 2>/dev/null || true
fi
printf '\nEMAIL_USER=noreply@purrfectpal.studio\nEMAIL_PASS=Toor@77@MTS@77*\n' >> .env
echo "[env-fix] EMAIL_USER and EMAIL_PASS forcefully updated in .env"
echo "[env-fix] Done" > ./admin-app/smtp-diagnostics.txt

CERT_DIR="./letsencrypt/live/purrfectpal.studio"

if [ -f "$CERT_DIR/fullchain.pem" ] && [ -f "$CERT_DIR/privkey.pem" ]; then
  echo "[init-certs] Certificate already exists — skipping dummy generation."
  echo "[init-certs] If you want to force-regenerate, delete $CERT_DIR first."
  exit 0
fi

echo "[init-certs] No certificate found. Creating self-signed dummy so Nginx can start..."
mkdir -p "$CERT_DIR"

openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
  -keyout "$CERT_DIR/privkey.pem" \
  -out    "$CERT_DIR/fullchain.pem" \
  -subj   "/CN=purrfectpal.studio"

echo "[init-certs] ✅ Dummy certificate written to $CERT_DIR"
echo "[init-certs] Now run: docker compose up -d"
echo "[init-certs] The Certbot container will replace this dummy with a real cert automatically."
