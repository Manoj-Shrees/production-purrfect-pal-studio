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
