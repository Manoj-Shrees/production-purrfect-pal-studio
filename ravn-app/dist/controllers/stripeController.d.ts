import { Request, Response } from 'express';
export declare class StripeController {
    /**
     * POST /api/v1/checkout/create-session
     */
    static createCheckoutSession(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/v1/checkout/config
     * Returns Stripe publishable key
     */
    static getConfig(_req: Request, res: Response): Promise<void>;
    /**
     * POST /api/v1/checkout/create-intent
     * Creates a PaymentIntent or SetupIntent for in-page Stripe Payment Element
     */
    static createPaymentIntent(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/v1/checkout/confirm-intent
     * Confirms payment and mints Ed25519 license key directly for in-page checkout
     */
    static confirmIntent(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/v1/webhooks/stripe
     * Handles raw Stripe webhooks with cryptographic signature verification
     */
    static handleWebhook(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/v1/billing/portal
     */
    static createPortalSession(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/v1/checkout/session-status
     */
    static getSessionStatus(req: Request, res: Response): Promise<void>;
}
