import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load ravn-backend/.env
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'production',
  appBaseUrl: process.env.APP_BASE_URL || 'https://ravn.purrfectpal.studio',

  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'ravn_user',
    password: process.env.DB_PASSWORD || 'ravn_super_secret_password_2026',
    database: process.env.DB_NAME || 'ravn_db',
    connectionLimit: 15,
  },

  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    logoUrl: process.env.STRIPE_LOGO_URL || '',
    successUrl: process.env.STRIPE_SUCCESS_URL || 'https://ravn.purrfectpal.studio/success.html?session_id={CHECKOUT_SESSION_ID}',
    cancelUrl: process.env.STRIPE_CANCEL_URL || 'https://ravn.purrfectpal.studio/index.html',
    plans: {
      monthly: {
        id: 'plan_monthly',
        priceId: process.env.STRIPE_PRICE_MONTHLY || 'price_monthly_sample',
        name: 'Ravn Pro Monthly',
        priceCents: 499,
        maxDevices: 1,
      },
      annual: {
        id: 'plan_annual',
        priceId: process.env.STRIPE_PRICE_ANNUAL || 'price_annual_sample',
        name: 'Ravn Pro Annual',
        priceCents: 3999,
        maxDevices: 1,
      },
      lifetime: {
        id: 'plan_lifetime',
        priceId: process.env.STRIPE_PRICE_LIFETIME || 'price_lifetime_sample',
        name: 'Ravn Ultra Lifetime',
        priceCents: 7999,
        maxDevices: 2,
      },
      seat_addon: {
        id: 'plan_seat_addon',
        priceId: process.env.STRIPE_PRICE_SEAT_ADDON || 'price_seat_addon_sample',
        name: 'Ravn Extra Mac Seat Add-on (+1 Mac)',
        priceCents: 1999,
        maxDevices: 1,
      },
    },
  },

  crypto: {
    privateKey: process.env.LICENSE_PRIVATE_KEY || '',
    publicKey: process.env.LICENSE_PUBLIC_KEY || '',
  },

  admin: {
    apiKey: process.env.ADMIN_API_KEY || 'ravn_master_admin_key_9988',
  },
};
