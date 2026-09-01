# 🚀 Ravn Production Server & Licensing Backend Deployment Guide

This guide details how to deploy the **Ravn Software Distribution & Licensing Stack** (Nginx + Node.js + MySQL 8.0 + Redis + Stripe + Ed25519 Cryptographic Licensing) straight to any production Linux VPS or Cloud Server (AWS EC2, DigitalOcean, Hetzner, Linode, Vultr) with zero errors.

---

## 📋 Architecture Overview

| Component | Technology | Default Port | Role |
| :--- | :--- | :--- | :--- |
| **Reverse Proxy & Web Store** | Nginx 1.27 Alpine | `80` / `443` (`8080` local) | SSL Termination, Rate Limiting, Static Assets, DMG Downloads |
| **REST API Backend** | Node.js 22 + TypeScript | `3000` (Internal) | Licensing, Stripe Checkout, Webhooks, Updates |
| **Primary Database** | MySQL 8.0 | `3306` (Internal) | Customers, Plans, Licenses, Hardware Activations, Audit Logs |
| **Caching & Rate Limiting** | Redis 7.0 Alpine | `6379` (Internal) | High-speed cache, activation quotas, token verification |

---

## ⚡️ Quick Start (1-Click Deployment)

### 1. Navigate to Backend Directory
```bash
cd ravn-backend
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Edit `.env` and fill in your Stripe API keys:
```bash
nano .env
```
Key settings:
- `STRIPE_SECRET_KEY`: `sk_live_...` (or `sk_test_...` for sandbox)
- `STRIPE_WEBHOOK_SECRET`: `whsec_...`
- `APP_BASE_URL`: `https://yourdomain.com` (or `http://your-server-ip:8080`)
- `ADMIN_API_KEY`: Generate a secure random string (e.g. `openssl rand -hex 24`)

### 3. Run the Automated Deployment Script
```bash
./deploy.sh
```
This script will automatically:
1. Verify Docker & Docker Compose installation.
2. Install npm dependencies and compile TypeScript.
3. Generate the **Ed25519 Private/Public Keypair** and embed in `.env`.
4. Build the multi-stage production Docker containers.
5. Initialize the MySQL database schema (`database/schema.sql`).
6. Verify service health and display access URLs.

---

## 🌐 Setting Up Custom Domain & Free SSL (Let's Encrypt)

If deploying to a domain (e.g. `https://ravn.app` or `https://licensing.yourdomain.com`):

### 1. Point DNS Records
Add an **A Record** pointing `yourdomain.com` to your server's Public IPv4 address.

### 2. Install Certbot
```bash
sudo apt update && sudo apt install -y certbot python3-certbot-nginx
```

### 3. Obtain Free Wildcard / Domain Certificate
```bash
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com
```

### 4. Update Nginx SSL Paths
In `nginx/nginx.conf`, enable the HTTPS server block:
```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # ... remaining configuration ...
}
```

Then reload Nginx:
```bash
docker compose exec ravn-nginx nginx -s reload
```

---

## 💳 Stripe Webhook Configuration

1. Log into your [Stripe Dashboard](https://dashboard.stripe.com/webhooks).
2. Click **Add Endpoint**.
3. **Endpoint URL**: `https://yourdomain.com/api/v1/webhooks/stripe`
4. **Events to listen for**:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy the **Signing Secret** (`whsec_...`) into your `.env` file under `STRIPE_WEBHOOK_SECRET`.
6. Restart the API container:
   ```bash
   docker compose restart ravn-api
   ```

---

## 📦 Distributing the macOS DMG Installer

To host the `.dmg` file directly on your own server:

1. Create a `downloads/` directory:
   ```bash
   mkdir -p downloads
   ```
2. Copy your built `Ravn.dmg` or `Ravn-Universal.dmg` into `downloads/`:
   ```bash
   cp /path/to/Ravn.dmg downloads/Ravn-Universal.dmg
   ```
Users visiting `https://yourdomain.com/download/Ravn-Universal.dmg` or clicking **Download** on the landing page will immediately receive the file with native streaming headers.

---

## 🔐 Administrative Commands & License Management

### 1. Check System Stats
```bash
curl -X GET http://localhost:8080/api/v1/admin/stats \
  -H "x-api-key: your_admin_api_key_here"
```
**Response**:
```json
{
  "totalLicenses": 142,
  "activeLicenses": 139,
  "activeDevices": 210,
  "totalCustomers": 135
}
```

### 2. Manually Generate a License Key (Comp / VIP / Giveaway)
```bash
curl -X POST http://localhost:8080/api/v1/admin/licenses/generate \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_admin_api_key_here" \
  -d '{
    "email": "vip@example.com",
    "name": "VIP Tester",
    "planType": "lifetime",
    "maxDevices": 10
  }'
```
**Response**:
```json
{
  "success": true,
  "message": "License key generated successfully.",
  "license": {
    "licenseKey": "RAVN-7X9K-B4M2-Q8W1",
    "signature": "...",
    "expiresAt": null
  }
}
```

### 3. Revoke a Compromised License Key
```bash
curl -X POST http://localhost:8080/api/v1/admin/licenses/revoke \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_admin_api_key_here" \
  -d '{
    "licenseKey": "RAVN-7X9K-B4M2-Q8W1",
    "reason": "Payment disputed / fraudulent key sharing"
  }'
```

---

## 🗄 Database Backup & Automated Maintenance

### 1. Manual Backup
```bash
docker compose exec ravn-mysql mysqldump -u ravn_user -pravn_super_secret_password_2026 ravn_db > ravn_db_backup_$(date +%F).sql
```

### 2. Automated Nightly Backup Cron
Add to `crontab -e`:
```cron
0 3 * * * cd /path/to/ravn-backend && docker compose exec -T ravn-mysql mysqldump -u ravn_user -pravn_super_secret_password_2026 ravn_db | gzip > /backups/ravn_$(date +\%F).sql.gz
```

---

## 🛠 Useful Server Operations

| Task | Command |
| :--- | :--- |
| **View Live Logs** | `docker compose logs -f` |
| **View API Logs only** | `docker compose logs -f ravn-api` |
| **Restart Stack** | `docker compose restart` |
| **Stop All Containers** | `docker compose down` |
| **Rebuild without Cache** | `docker compose build --no-cache && docker compose up -d` |
| **Check Container Status** | `docker compose ps` |
