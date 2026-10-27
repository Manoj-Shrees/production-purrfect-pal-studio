#!/bin/sh
set -e

# ── Update & Rebuild ravn-api and sync licenses if docker is running ─────────
if command -v docker >/dev/null 2>&1; then
  echo "[init-certs] Ensuring database compatibility and provisioning licenses..."
  for DB in purrfectpalstudiodb ravn_db; do
    docker exec db-c mysql -u adminPPS -p'Toor@PPS@77admin*' $DB << 'EOF' || true
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

INSERT INTO customers (id, email, name)
VALUES 
  ('cust_keshar_rai', 'keesshhaarr1234@gmail.com', 'Keshar Rai'),
  ('cust_manoj_shrees', 'manojshrees77@gmail.com', 'Manoj Shrees')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO licenses (
  id, license_key, customer_id, subscription_id, plan_type,
  status, max_activations, signature, signed_payload, issued_at, expires_at
) VALUES 
  ('lic_keshar_rai', 'RAVN-2LBM-ZJ9Y-RJX9-96UK', 'cust_keshar_rai', NULL, 'lifetime', 'active', 2, 'mG2eCEXmr8W//LK73I+x2kNKUI60M+CCSEQseRY7wS17H7MuJ/G9gnpVquIPdWQhhcp2gz9Pps0+N7MR+DqfCA==', 'key=RAVN-2LBM-ZJ9Y-RJX9-96UK|email=keesshhaarr1234@gmail.com|plan=lifetime|maxDevices=2|issuedAt=2026-10-27T13:39:03.111Z|expiresAt=never', NOW(), NULL),
  ('lic_manoj_shrees', 'RAVN-7UGF-E896-NC3A-PW2M', 'cust_manoj_shrees', NULL, 'lifetime', 'active', 5, 'N+olxrJ26MwqvibwvuOhBKr16tIcmccvot94Wr8WsojoXELYi7pWTql+mb0VPAclxmm8FUobEWosXAYLLjnVBQ==', 'key=RAVN-7UGF-E896-NC3A-PW2M|email=manojshrees77@gmail.com|plan=lifetime|maxDevices=5|issuedAt=2026-10-27T13:39:03.119Z|expiresAt=never', NOW(), NULL)
ON DUPLICATE KEY UPDATE status = 'active', max_activations = VALUES(max_activations), signature = VALUES(signature), signed_payload = VALUES(signed_payload);
EOF
  done

  echo "[init-certs] Rebuilding ravn-api container with latest code..."
  docker compose up -d --build --force-recreate --no-deps ravn-api || true
fi

CERT_DIR="./letsencrypt/live/purrfectpal.studio"

if [ -f "$CERT_DIR/fullchain.pem" ] && [ -f "$CERT_DIR/privkey.pem" ]; then
  echo "[init-certs] Certificate already exists — skipping dummy generation."
  exit 0
fi

echo "[init-certs] No certificate found. Creating self-signed dummy so Nginx can start..."
mkdir -p "$CERT_DIR"

openssl req -x509 -nodes -newkey rsa:2048 -days 1   -keyout "$CERT_DIR/privkey.pem"   -out    "$CERT_DIR/fullchain.pem"   -subj   "/CN=purrfectpal.studio"

echo "[init-certs] ✅ Dummy certificate written to $CERT_DIR"
