#!/bin/sh
set -e

# ── Update & Rebuild ravn-api and sync licenses if docker is running ─────────
if command -v docker >/dev/null 2>&1; then
  echo "[init-certs] Rebuilding ravn-api container with latest code..."
  docker compose up -d --build --force-recreate --no-deps ravn-api || true

  echo "[init-certs] Provisioning Pro Lifetime Licenses into ravn_db..."
  docker exec db-c mysql -u adminPPS -p'Toor@PPS@77admin*' ravn_db << 'EOF' || true
INSERT INTO customers (id, email, name)
VALUES 
  ('cust_keshar_rai', 'keesshhaarr1234@gmail.com', 'Keshar Rai'),
  ('cust_manoj_shrees', 'manojshrees77@gmail.com', 'Manoj Shrees')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO licenses (
  id, license_key, customer_id, subscription_id, plan_type,
  status, max_activations, signature, signed_payload, issued_at, expires_at
) VALUES 
  ('lic_keshar_rai', 'RAVN-2LBM-ZJ9Y-RJX9-96UK', 'cust_keshar_rai', NULL, 'lifetime', 'active', 5, 'PSTJVvp0Cdi3ljjy+Ljq6B3zCoc1r+Lr5R8tsQ2f4sjS4cf9mRLM++LyjTZbl9eyW8t9Cp8dwe5TCw/irmopDA==', 'key=RAVN-2LBM-ZJ9Y-RJX9-96UK|email=keesshhaarr1234@gmail.com|plan=lifetime|maxDevices=5|issuedAt=2026-10-27T13:39:03.111Z|expiresAt=never', NOW(), NULL),
  ('lic_manoj_shrees', 'RAVN-7UGF-E896-NC3A-PW2M', 'cust_manoj_shrees', NULL, 'lifetime', 'active', 5, 'N+olxrJ26MwqvibwvuOhBKr16tIcmccvot94Wr8WsojoXELYi7pWTql+mb0VPAclxmm8FUobEWosXAYLLjnVBQ==', 'key=RAVN-7UGF-E896-NC3A-PW2M|email=manojshrees77@gmail.com|plan=lifetime|maxDevices=5|issuedAt=2026-10-27T13:39:03.119Z|expiresAt=never', NOW(), NULL)
ON DUPLICATE KEY UPDATE status = 'active', max_activations = 5;
EOF
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
