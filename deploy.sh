#!/bin/bash

set -e

cd /app/production-purrfect-pal-studio || exit 1

echo "set git origin"
git remote set-url origin https://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@github.com/Manoj-Shrees/production-purrfect-pal-studio.git

echo "Pulling latest code..."
git pull origin main

echo "Pulling updated images..."
docker compose pull

echo "Recreating containers..."
docker compose up -d --force-recreate

echo "Cleanup..."
docker image prune -f
