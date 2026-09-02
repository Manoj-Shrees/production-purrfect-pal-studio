import { Request, Response } from 'express';
import { StripeService } from '../services/stripeService.js';

export class StripeController {
  /**
   * POST /api/v1/checkout/create-session
   */
  static async createCheckoutSession(req: Request, res: Response): Promise<void> {
    try {
      const { planTier, email, currency, successUrl, cancelUrl } = req.body;

      if (!planTier || !['monthly', 'annual', 'lifetime', 'family', 'seat_addon'].includes(planTier)) {
        res.status(400).json({
          success: false,
          error: 'Valid planTier (monthly, annual, lifetime, family, seat_addon) is required.',
        });
        return;
      }

      const session = await StripeService.createCheckoutSession({
        planTier,
        customerEmail: email,
        currency,
        successUrl,
        cancelUrl,
      });

      res.status(200).json({
        success: true,
        sessionId: session.sessionId,
        checkoutUrl: session.checkoutUrl,
      });
    } catch (err: any) {
      console.error('[StripeController.createCheckoutSession] Error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/v1/checkout/config
   * Returns Stripe publishable key
   */
  static async getConfig(_req: Request, res: Response): Promise<void> {
    res.status(200).json({
      success: true,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_mock',
    });
  }

  /**
   * POST /api/v1/checkout/create-intent
   * Creates a PaymentIntent or SetupIntent for in-page Stripe Payment Element
   */
  static async createPaymentIntent(req: Request, res: Response): Promise<void> {
    try {
      const { planTier, email, currency } = req.body;

      if (!planTier || !['monthly', 'annual', 'lifetime', 'family', 'seat_addon'].includes(planTier)) {
        res.status(400).json({
          success: false,
          error: 'Valid planTier (monthly, annual, lifetime, family, seat_addon) is required.',
        });
        return;
      }

      if (!email || !email.includes('@')) {
        res.status(400).json({
          success: false,
          error: 'Valid customer email is required.',
        });
        return;
      }

      const intent = await StripeService.createPaymentIntent({
        planTier,
        email,
        currency,
      });

      res.status(200).json({
        success: true,
        ...intent,
      });
    } catch (err: any) {
      console.error('[StripeController.createPaymentIntent] Error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/v1/checkout/confirm-intent
   * Confirms payment and mints Ed25519 license key directly for in-page checkout
   */
  static async confirmIntent(req: Request, res: Response): Promise<void> {
    try {
      const { paymentIntentId, setupIntentId, email, planTier } = req.body;

      if (!email || !planTier) {
        res.status(400).json({
          success: false,
          error: 'email and planTier are required.',
        });
        return;
      }

      const license = await StripeService.confirmPaymentAndMintLicense({
        paymentIntentId,
        setupIntentId,
        email,
        planTier,
      });

      res.status(200).json(license);
    } catch (err: any) {
      console.error('[StripeController.confirmIntent] Error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/v1/webhooks/stripe
   * Handles raw Stripe webhooks with cryptographic signature verification
   */
  static async handleWebhook(req: Request, res: Response): Promise<void> {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      res.status(400).json({ error: 'Missing stripe-signature header' });
      return;
    }

    try {
      const rawBody = req.body; // Buffer from express.raw()
      const result = await StripeService.handleWebhookEvent(rawBody, signature);
      res.status(200).json(result);
    } catch (err: any) {
      console.error('[StripeController.handleWebhook] Failed:', err.message);
      res.status(400).json({ error: err.message });
    }
  }

  /**
   * POST /api/v1/billing/portal
   */
  static async createPortalSession(req: Request, res: Response): Promise<void> {
    try {
      const { customerId, returnUrl } = req.body;
      if (!customerId) {
        res.status(400).json({ success: false, error: 'customerId is required' });
        return;
      }
      const portal = await StripeService.createCustomerPortalSession(customerId, returnUrl);
      res.status(200).json({ success: true, portalUrl: portal.portalUrl });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/v1/checkout/session-status
   */
  static async getSessionStatus(req: Request, res: Response): Promise<void> {
    try {
      const sessionId = req.query.session_id as string;
      if (!sessionId) {
        res.status(400).json({ success: false, error: 'session_id query parameter is required' });
        return;
      }

      const statusData = await StripeService.getCheckoutSessionStatus(sessionId);
      res.status(200).json({
        success: true,
        ...statusData,
      });
    } catch (err: any) {
      console.error('[StripeController.getSessionStatus] Error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
}
