export declare class StripeService {
    private static stripeClient;
    static readonly SUPPORTED_CURRENCIES: Record<string, {
        code: string;
        symbol: string;
        isZeroDecimal?: boolean;
    }>;
    static readonly PLAN_PRICES: Record<string, Record<'monthly' | 'annual' | 'lifetime' | 'family' | 'seat_addon', number>>;
    /**
     * Creates a Stripe Checkout Session for Monthly, Annual, Lifetime, Family, or Seat Add-on in selected currency
     */
    static createCheckoutSession(options: {
        planTier: 'monthly' | 'annual' | 'lifetime' | 'family' | 'seat_addon';
        customerEmail?: string;
        currency?: string;
        licenseKey?: string;
        successUrl?: string;
        cancelUrl?: string;
    }): Promise<{
        sessionId: string;
        checkoutUrl: string;
    }>;
    /**
     * Creates a PaymentIntent or SetupIntent for custom in-page Stripe checkout
     */
    static createPaymentIntent(options: {
        planTier: 'monthly' | 'annual' | 'lifetime' | 'family' | 'seat_addon';
        email: string;
        currency?: string;
    }): Promise<{
        clientSecret: string;
        publishableKey: string;
        customerId: string;
        amount: number;
        currency: string;
        isSubscription: boolean;
    }>;
    /**
     * Confirms payment/setup intent and mints the cryptographic Ed25519 license key directly
     */
    static confirmPaymentAndMintLicense(options: {
        paymentIntentId?: string;
        setupIntentId?: string;
        email: string;
        planTier: 'monthly' | 'annual' | 'lifetime' | 'family' | 'seat_addon';
    }): Promise<{
        success: boolean;
        licenseKey: string;
        plan: string;
        maxDevices: number;
        email: string;
        expiresAt: string | null;
    }>;
    /**
     * Processes Stripe Webhooks with cryptographic signature verification
     */
    static handleWebhookEvent(rawBody: Buffer, signatureHeader: string): Promise<{
        received: boolean;
        eventType: string;
    }>;
    /**
     * Provisions customer and cryptographic license on checkout completion
     */
    private static handleCheckoutSessionCompleted;
    /**
     * Updates subscription period and extends license expiry
     */
    private static handleSubscriptionUpdated;
    /**
     * Suspends / expires license when subscription is canceled
     */
    private static handleSubscriptionDeleted;
    private static handleInvoicePaymentSucceeded;
    private static handleInvoicePaymentFailed;
    /**
     * Creates Customer Billing Portal Session
     */
    static createCustomerPortalSession(customerId: string, returnUrl?: string): Promise<{
        portalUrl: string;
    }>;
    /**
     * Retrieves status and provisioned license key for a completed Checkout Session
     */
    static getCheckoutSessionStatus(sessionId: string): Promise<{
        status: string;
        customerEmail?: string;
        licenseKey?: string;
        planTier?: string;
    }>;
}
