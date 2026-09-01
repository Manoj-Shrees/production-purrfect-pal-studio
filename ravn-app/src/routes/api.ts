import { Router } from 'express';
import express from 'express';
import { LicenseController } from '../controllers/licenseController.js';
import { StripeController } from '../controllers/stripeController.js';
import { AdminController } from '../controllers/adminController.js';
import { DownloadController } from '../controllers/downloadController.js';

export const apiRouter = Router();

// ── 1. Software Distribution & Updates ──
apiRouter.get('/v1/app/version', DownloadController.getVersionInfo);
apiRouter.get('/v1/app/check-update', DownloadController.checkUpdate);
apiRouter.get('/download/:filename?', DownloadController.downloadFile);
apiRouter.get('/v1/app/download/:filename?', DownloadController.downloadFile);

// ── 2. Public Licensing Endpoints (Client App) ──
apiRouter.post('/v1/license/activate', express.json(), LicenseController.activate);
apiRouter.post('/v1/license/deactivate', express.json(), LicenseController.deactivate);
apiRouter.post('/v1/license/lookup', express.json(), LicenseController.lookup);
apiRouter.get('/v1/license/public-key', LicenseController.getPublicKey);

// ── 3. Stripe Checkout & Customer Portal ──
apiRouter.get('/v1/checkout/config', StripeController.getConfig);
apiRouter.post('/v1/checkout/create-intent', express.json(), StripeController.createPaymentIntent);
apiRouter.post('/v1/checkout/confirm-intent', express.json(), StripeController.confirmIntent);
apiRouter.post('/v1/checkout/create-session', express.json(), StripeController.createCheckoutSession);
apiRouter.get('/v1/checkout/session-status', StripeController.getSessionStatus);
apiRouter.post('/v1/billing/portal', express.json(), StripeController.createPortalSession);

// ── 4. Stripe Webhooks (Uses raw body parser) ──
apiRouter.post(
  '/v1/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  StripeController.handleWebhook
);

// ── 5. Admin Protected Endpoints ──
apiRouter.post('/v1/admin/licenses/generate', express.json(), AdminController.authMiddleware, AdminController.generateManualLicense);
apiRouter.post('/v1/admin/licenses/revoke', express.json(), AdminController.authMiddleware, AdminController.revokeLicense);
apiRouter.get('/v1/admin/stats', AdminController.authMiddleware, AdminController.getStats);
