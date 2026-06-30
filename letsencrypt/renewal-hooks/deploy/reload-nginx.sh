#!/bin/sh
# This script is called by Certbot automatically after a successful renewal.
# It reloads Nginx inside its container so the new certificate is picked up
# without a full restart (which would cause a brief downtime).

set -e

echo "[Certbot Deploy Hook] Certificate renewed — reloading Nginx..."

docker exec nginx-proxy nginx -s reload

echo "[Certbot Deploy Hook] Nginx reloaded successfully."