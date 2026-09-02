#!/usr/bin/env bash
# ==============================================================================
# RAVN BACKEND & DISTRIBUTION SERVER — 1-CLICK PRODUCTION DEPLOYMENT SCRIPT
# ==============================================================================
set -e

echo ""
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║ 🚀 RAVN PRODUCTION BACKEND & DISTRIBUTION DEPLOYMENT                 ║"
echo "║    Nginx Reverse Proxy • MySQL 8.0 • Redis 7.0 • Node.js TypeScript   ║"
echo "║    Stripe Payments • Ed25519 Tamper-Proof Cryptographic Licensing    ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""

# 1. Check Docker Installation
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker is not installed. Please install Docker and Docker Compose before deploying."
    exit 1
fi

# 2. Check or Create .env
if [ ! -f ".env" ]; then
    echo "📋 .env not found. Creating from .env.example..."
    cp .env.example .env
fi

# 3. Verify Node & Install Dependencies if deploying on bare metal / local
if command -v npm &> /dev/null; then
    echo "📦 Checking dependencies..."
    npm install --silent
    npm run build
    
    # Run keygen if keys are empty in .env
    if ! grep -q "LICENSE_PRIVATE_KEY=" .env || grep -q 'LICENSE_PRIVATE_KEY=""' .env; then
        echo "🔐 Generating Production Ed25519 Cryptographic Keypair..."
        npm run keygen
    fi
fi

# 4. Build and Launch Docker Containers
echo ""
echo "🐳 Building and starting Docker container cluster..."
docker compose up -d --build

# 5. Health Check Loop
echo ""
echo "⏳ Waiting for cluster services to become healthy..."
MAX_RETRIES=30
RETRY_COUNT=0
HEALTHY=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        HEALTHY=true
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT+1))
    echo "   ... waiting for API & DB startup ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

if [ "$HEALTHY" = true ]; then
    echo ""
    echo "══════════════════════════════════════════════════════════════════════"
    echo "✅ DEPLOYMENT SUCCESSFUL! All services are active and healthy."
    echo "══════════════════════════════════════════════════════════════════════"
    echo ""
    echo "🌐 Distribution Storefront:  http://localhost:8080"
    echo "📥 Direct Download Link:    http://localhost:8080/download/Ravn-Universal.dmg"
    echo "📡 Health Check:            http://localhost:8080/health"
    echo "🔐 License Activation API:  http://localhost:8080/api/v1/license/activate"
    echo "💳 Stripe Checkout API:     http://localhost:8080/api/v1/checkout/create-session"
    echo "📊 Admin Metrics API:       http://localhost:8080/api/v1/admin/stats"
    echo ""
    echo "To view live logs:           docker compose logs -f"
    echo "To stop services:            docker compose down"
    echo "══════════════════════════════════════════════════════════════════════"
else
    echo ""
    echo "⚠️  Health check timed out. Displaying container logs:"
    docker compose logs --tail=40
    exit 1
fi
