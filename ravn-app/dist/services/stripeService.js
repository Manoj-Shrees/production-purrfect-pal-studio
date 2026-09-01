import Stripe from 'stripe';
import { config } from '../config.js';
import { dbPool } from '../db/connection.js';
import { LicenseService } from './licenseService.js';
export class StripeService {
    static stripeClient = new Stripe(config.stripe.secretKey, {
        apiVersion: '2025-01-27.acacia',
    });
    static SUPPORTED_CURRENCIES = {
        // North America
        usd: { code: 'usd', symbol: '$' },
        cad: { code: 'cad', symbol: 'CA$' },
        mxn: { code: 'mxn', symbol: 'MX$' },
        // Europe
        eur: { code: 'eur', symbol: '€' },
        gbp: { code: 'gbp', symbol: '£' },
        chf: { code: 'chf', symbol: 'CHF' },
        sek: { code: 'sek', symbol: 'kr' },
        nok: { code: 'nok', symbol: 'kr' },
        dkk: { code: 'dkk', symbol: 'kr' },
        pln: { code: 'pln', symbol: 'zł' },
        czk: { code: 'czk', symbol: 'Kč' },
        try: { code: 'try', symbol: '₺' },
        // Asia-Pacific & Oceania
        aud: { code: 'aud', symbol: 'A$' },
        nzd: { code: 'nzd', symbol: 'NZ$' },
        jpy: { code: 'jpy', symbol: '¥', isZeroDecimal: true },
        inr: { code: 'inr', symbol: '₹' },
        sgd: { code: 'sgd', symbol: 'S$' },
        hkd: { code: 'hkd', symbol: 'HK$' },
        twd: { code: 'twd', symbol: 'NT$' },
        krw: { code: 'krw', symbol: '₩', isZeroDecimal: true },
        myr: { code: 'myr', symbol: 'RM' },
        thb: { code: 'thb', symbol: '฿' },
        php: { code: 'php', symbol: '₱' },
        idr: { code: 'idr', symbol: 'Rp' },
        vnd: { code: 'vnd', symbol: '₫', isZeroDecimal: true },
        // Middle East & Africa
        aed: { code: 'aed', symbol: 'AED ' },
        sar: { code: 'sar', symbol: 'SAR ' },
        ils: { code: 'ils', symbol: '₪' },
        zar: { code: 'zar', symbol: 'R ' },
        // Latin America
        brl: { code: 'brl', symbol: 'R$' },
        ars: { code: 'ars', symbol: '$' },
        clp: { code: 'clp', symbol: 'CLP$', isZeroDecimal: true },
        cop: { code: 'cop', symbol: 'COP$' },
    };
    static PLAN_PRICES = {
        // North America
        usd: { monthly: 499, annual: 3999, lifetime: 7999, seat_addon: 1999 },
        cad: { monthly: 679, annual: 5499, lifetime: 10999, seat_addon: 2699 },
        mxn: { monthly: 9900, annual: 79900, lifetime: 159900, seat_addon: 39900 },
        // Europe
        eur: { monthly: 459, annual: 3699, lifetime: 7499, seat_addon: 1899 },
        gbp: { monthly: 399, annual: 3199, lifetime: 6499, seat_addon: 1599 },
        chf: { monthly: 449, annual: 3599, lifetime: 6999, seat_addon: 1799 },
        sek: { monthly: 5299, annual: 42999, lifetime: 85999, seat_addon: 21499 },
        nok: { monthly: 5499, annual: 43999, lifetime: 87999, seat_addon: 21999 },
        dkk: { monthly: 3499, annual: 27999, lifetime: 55999, seat_addon: 13999 },
        pln: { monthly: 1999, annual: 15999, lifetime: 31999, seat_addon: 7999 },
        czk: { monthly: 11500, annual: 92900, lifetime: 185900, seat_addon: 46500 },
        try: { monthly: 16900, annual: 134900, lifetime: 269900, seat_addon: 67900 },
        // Asia-Pacific & Oceania
        aud: { monthly: 749, annual: 5999, lifetime: 11999, seat_addon: 2999 },
        nzd: { monthly: 799, annual: 6499, lifetime: 12999, seat_addon: 3299 },
        jpy: { monthly: 750, annual: 5990, lifetime: 11990, seat_addon: 2990 },
        inr: { monthly: 41900, annual: 329900, lifetime: 669900, seat_addon: 169900 },
        sgd: { monthly: 669, annual: 5399, lifetime: 10799, seat_addon: 2699 },
        hkd: { monthly: 3899, annual: 31299, lifetime: 62499, seat_addon: 15699 },
        twd: { monthly: 15900, annual: 128000, lifetime: 256000, seat_addon: 64000 },
        krw: { monthly: 6800, annual: 54900, lifetime: 109000, seat_addon: 27900 },
        myr: { monthly: 2199, annual: 17999, lifetime: 35999, seat_addon: 8999 },
        thb: { monthly: 17900, annual: 144900, lifetime: 289900, seat_addon: 72900 },
        php: { monthly: 27900, annual: 224900, lifetime: 449900, seat_addon: 112900 },
        idr: { monthly: 7900000, annual: 63900000, lifetime: 127900000, seat_addon: 31900000 },
        vnd: { monthly: 125000, annual: 999000, lifetime: 1999000, seat_addon: 499000 },
        // Middle East & Africa
        aed: { monthly: 1849, annual: 14699, lifetime: 29399, seat_addon: 7399 },
        sar: { monthly: 1899, annual: 14999, lifetime: 29999, seat_addon: 7499 },
        ils: { monthly: 1899, annual: 14999, lifetime: 29999, seat_addon: 7499 },
        zar: { monthly: 8999, annual: 72999, lifetime: 145999, seat_addon: 36999 },
        // Latin America
        brl: { monthly: 2799, annual: 21999, lifetime: 43999, seat_addon: 9999 },
        ars: { monthly: 499900, annual: 3999900, lifetime: 7999900, seat_addon: 1999900 },
        clp: { monthly: 4800, annual: 38900, lifetime: 77900, seat_addon: 19500 },
        cop: { monthly: 1990000, annual: 15990000, lifetime: 31990000, seat_addon: 7990000 },
    };
    /**
     * Creates a Stripe Checkout Session for Monthly, Annual, Lifetime, or Seat Add-on in selected currency
     */
    static async createCheckoutSession(options) {
        const planInfo = config.stripe.plans[options.planTier];
        if (!planInfo) {
            throw new Error(`Invalid plan tier: ${options.planTier}`);
        }
        const rawCurrency = (options.currency || 'usd').toLowerCase().trim();
        const curr = this.SUPPORTED_CURRENCIES[rawCurrency] || this.SUPPORTED_CURRENCIES.usd;
        const isSubscription = options.planTier === 'monthly' || options.planTier === 'annual';
        const successUrl = options.successUrl || config.stripe.successUrl;
        const cancelUrl = options.cancelUrl || config.stripe.cancelUrl;
        // Use public CDN or GitHub URL if appBaseUrl is localhost so Stripe can render the logo
        let logoUrl = config.stripe.logoUrl;
        if (!logoUrl) {
            if (config.appBaseUrl && !config.appBaseUrl.includes('localhost') && !config.appBaseUrl.includes('127.0.0.1')) {
                logoUrl = `${config.appBaseUrl}/assets/app-icon.png`;
            }
            else {
                logoUrl = 'https://raw.githubusercontent.com/Manoj-Shrees/Ravn-Download-manager/main/ravn-backend/public/assets/app-icon.png';
            }
        }
        const productImages = logoUrl && (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) ? [logoUrl] : [];
        // Calculate exact unit amount in target currency
        const currencyPricing = this.PLAN_PRICES[curr.code] || this.PLAN_PRICES.usd;
        const unitAmount = currencyPricing[options.planTier] || planInfo.priceCents;
        const lineItems = [
            {
                price_data: {
                    currency: curr.code,
                    product_data: {
                        name: planInfo.name,
                        description: options.planTier === 'lifetime'
                            ? 'Ravn Ultra Lifetime Pass — 2 Macs Included • Own forever with lifetime updates.'
                            : options.planTier === 'annual'
                                ? 'Ravn Pro Annual Plan — 1 Mac Included (Transfer Anytime) • Includes 7-Day Free Trial & 33% discount.'
                                : options.planTier === 'seat_addon'
                                    ? 'Ravn Extra Mac Seat Add-on (+1 Mac Slot) — Expand your active machine limit.'
                                    : 'Ravn Pro Monthly Subscription — 1 Mac Included (Transfer Anytime) • Turbo 32 streams & full Media Studio.',
                        images: productImages.length > 0 ? productImages : undefined,
                    },
                    unit_amount: unitAmount,
                    ...(isSubscription
                        ? {
                            recurring: {
                                interval: options.planTier === 'annual' ? 'year' : 'month',
                                interval_count: 1,
                            },
                        }
                        : {}),
                },
                quantity: 1,
            },
        ];
        const sessionParams = {
            mode: isSubscription ? 'subscription' : 'payment',
            line_items: lineItems,
            customer_email: options.customerEmail,
            success_url: successUrl,
            cancel_url: cancelUrl,
            billing_address_collection: 'auto',
            allow_promotion_codes: true,
            tax_id_collection: {
                enabled: true,
            },
            invoice_creation: !isSubscription
                ? {
                    enabled: true,
                    invoice_data: {
                        description: `Ravn Download Manager — ${planInfo.name}`,
                        footer: 'Thank you for choosing Ravn Download Manager. For license support, visit https://ravn.app/activate.html',
                    },
                }
                : undefined,
            custom_text: {
                submit: {
                    message: '⚡️ Instant Delivery: Your cryptographic Ed25519 license key will be minted immediately.',
                },
                after_submit: {
                    message: 'You will be redirected back to 1-click activate Ravn on your Mac.',
                },
            },
            metadata: {
                planTier: options.planTier,
                app: 'Ravn Download Manager',
            },
            ...(isSubscription && options.planTier === 'annual'
                ? {
                    subscription_data: {
                        trial_period_days: 7,
                        metadata: { planTier: options.planTier },
                    },
                }
                : {}),
        };
        const session = await this.stripeClient.checkout.sessions.create(sessionParams);
        return {
            sessionId: session.id,
            checkoutUrl: session.url || '',
        };
    }
    /**
     * Creates a PaymentIntent or SetupIntent for custom in-page Stripe checkout
     */
    static async createPaymentIntent(options) {
        const rawCurrency = (options.currency || 'usd').toLowerCase().trim();
        const curr = this.SUPPORTED_CURRENCIES[rawCurrency] || this.SUPPORTED_CURRENCIES.usd;
        const currencyPricing = this.PLAN_PRICES[curr.code] || this.PLAN_PRICES.usd;
        const unitAmount = currencyPricing[options.planTier] || 499;
        // Find or create customer
        let customerId = '';
        const customers = await this.stripeClient.customers.list({ email: options.email, limit: 1 });
        if (customers.data.length > 0) {
            customerId = customers.data[0].id;
        }
        else {
            const newCustomer = await this.stripeClient.customers.create({
                email: options.email,
                metadata: { app: 'Ravn Download Manager' },
            });
            customerId = newCustomer.id;
        }
        const isSubscription = options.planTier === 'monthly' || options.planTier === 'annual';
        const paymentMethodOptions = {
            card: {
                request_three_d_secure: 'automatic',
            },
        };
        if (isSubscription) {
            // Create SetupIntent for subscriptions (enables card / Apple Pay / Google Pay saving with 7-day trial)
            const setupIntent = await this.stripeClient.setupIntents.create({
                customer: customerId,
                automatic_payment_methods: {
                    enabled: true,
                    allow_redirects: 'always',
                },
                payment_method_options: paymentMethodOptions,
                metadata: {
                    planTier: options.planTier,
                    email: options.email,
                    currency: curr.code,
                    app: 'Ravn Download Manager',
                },
            });
            return {
                clientSecret: setupIntent.client_secret || '',
                publishableKey: config.stripe.publishableKey,
                customerId,
                amount: unitAmount,
                currency: curr.code,
                isSubscription: true,
            };
        }
        else {
            // Create PaymentIntent for lifetime / seat add-on
            const paymentIntent = await this.stripeClient.paymentIntents.create({
                amount: unitAmount,
                currency: curr.code.toLowerCase(),
                customer: customerId,
                automatic_payment_methods: {
                    enabled: true,
                    allow_redirects: 'always',
                },
                payment_method_options: paymentMethodOptions,
                metadata: {
                    planTier: options.planTier,
                    email: options.email,
                    currency: curr.code,
                    app: 'Ravn Download Manager',
                },
                description: `Ravn Download Manager — ${config.stripe.plans[options.planTier]?.name || options.planTier}`,
            });
            return {
                clientSecret: paymentIntent.client_secret || '',
                publishableKey: config.stripe.publishableKey,
                customerId,
                amount: unitAmount,
                currency: curr.code,
                isSubscription: false,
            };
        }
    }
    /**
     * Confirms payment/setup intent and mints the cryptographic Ed25519 license key directly
     */
    static async confirmPaymentAndMintLicense(options) {
        let customerId = '';
        if (options.paymentIntentId) {
            const pi = await this.stripeClient.paymentIntents.retrieve(options.paymentIntentId);
            if (pi.status !== 'succeeded' && pi.status !== 'processing') {
                throw new Error(`Payment has not succeeded yet (status: ${pi.status})`);
            }
            customerId = typeof pi.customer === 'string' ? pi.customer : pi.customer?.id || '';
        }
        else if (options.setupIntentId) {
            const si = await this.stripeClient.setupIntents.retrieve(options.setupIntentId);
            if (si.status !== 'succeeded') {
                throw new Error(`Setup intent has not succeeded yet (status: ${si.status})`);
            }
            customerId = typeof si.customer === 'string' ? si.customer : si.customer?.id || '';
        }
        const planType = options.planTier === 'annual' ? 'annual' : options.planTier === 'lifetime' ? 'lifetime' : 'monthly';
        const maxDevices = options.planTier === 'lifetime' ? 2 : 1;
        const license = await LicenseService.createLicense({
            email: options.email,
            planType,
            maxDevices,
        });
        return {
            success: true,
            licenseKey: license.licenseKey,
            plan: planType,
            maxDevices,
            email: options.email,
            expiresAt: license.expiresAt ? license.expiresAt.toISOString() : null,
        };
    }
    /**
     * Processes Stripe Webhooks with cryptographic signature verification
     */
    static async handleWebhookEvent(rawBody, signatureHeader) {
        let event;
        try {
            event = this.stripeClient.webhooks.constructEvent(rawBody, signatureHeader, config.stripe.webhookSecret);
        }
        catch (err) {
            console.error(`[Stripe Webhook] Cryptographic signature validation failed: ${err.message}`);
            throw new Error(`Webhook Signature Error: ${err.message}`);
        }
        console.log(`[Stripe Webhook] Verified event received: ${event.type} (${event.id})`);
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object;
                await this.handleCheckoutSessionCompleted(session);
                break;
            }
            case 'customer.subscription.updated':
            case 'customer.subscription.created': {
                const subscription = event.data.object;
                await this.handleSubscriptionUpdated(subscription);
                break;
            }
            case 'customer.subscription.deleted': {
                const subscription = event.data.object;
                await this.handleSubscriptionDeleted(subscription);
                break;
            }
            case 'invoice.payment_succeeded': {
                const invoice = event.data.object;
                await this.handleInvoicePaymentSucceeded(invoice);
                break;
            }
            case 'invoice.payment_failed': {
                const invoice = event.data.object;
                await this.handleInvoicePaymentFailed(invoice);
                break;
            }
            default:
                console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
        }
        return { received: true, eventType: event.type };
    }
    /**
     * Provisions customer and cryptographic license on checkout completion
     */
    static async handleCheckoutSessionCompleted(session) {
        const email = session.customer_details?.email || session.customer_email;
        const name = session.customer_details?.name || 'Ravn Customer';
        const planTier = session.metadata?.planTier || 'monthly';
        const stripeCustomerId = session.customer;
        const stripeSubscriptionId = session.subscription;
        if (!email) {
            console.error('[Stripe Checkout] No email found in completed session:', session.id);
            return;
        }
        console.log(`[Stripe Checkout] Creating license for ${email} on plan ${planTier}...`);
        // 1. Link Stripe customer ID in MySQL
        await dbPool.execute(`INSERT INTO customers (id, email, name, stripe_customer_id)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE stripe_customer_id = VALUES(stripe_customer_id), name = VALUES(name)`, [`cust_${session.id.substring(8, 24)}`, email.toLowerCase().trim(), name, stripeCustomerId]);
        // 2. Generate signed cryptographic license
        const license = await LicenseService.createLicense({
            email,
            name,
            planType: planTier,
            subscriptionId: stripeSubscriptionId,
        });
        console.log(`[Stripe Checkout] SUCCESS: Issued license ${license.licenseKey} to ${email}`);
    }
    /**
     * Updates subscription period and extends license expiry
     */
    static async handleSubscriptionUpdated(subscription) {
        const stripeSubId = subscription.id;
        const status = subscription.status === 'active' || subscription.status === 'trialing' ? 'active' : 'past_due';
        const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null;
        if (periodEnd) {
            await dbPool.execute(`UPDATE licenses SET expires_at = ?, status = ? WHERE subscription_id = ?`, [periodEnd, status, stripeSubId]);
        }
    }
    /**
     * Suspends / expires license when subscription is canceled
     */
    static async handleSubscriptionDeleted(subscription) {
        const stripeSubId = subscription.id;
        console.log(`[Stripe Subscription] Subscription deleted: ${stripeSubId}. Revoking active license...`);
        await dbPool.execute(`UPDATE licenses SET status = 'expired', revocation_reason = 'Stripe subscription canceled' WHERE subscription_id = ?`, [stripeSubId]);
    }
    static async handleInvoicePaymentSucceeded(invoice) {
        const subId = invoice.subscription;
        if (subId) {
            const periodEnd = invoice.lines?.data[0]?.period?.end
                ? new Date(invoice.lines.data[0].period.end * 1000)
                : null;
            if (periodEnd) {
                await dbPool.execute(`UPDATE licenses SET expires_at = ?, status = 'active' WHERE subscription_id = ?`, [periodEnd, subId]);
            }
        }
    }
    static async handleInvoicePaymentFailed(invoice) {
        const subId = invoice.subscription;
        if (subId) {
            await dbPool.execute(`UPDATE licenses SET status = 'suspended', revocation_reason = 'Payment renewal failed' WHERE subscription_id = ?`, [subId]);
        }
    }
    /**
     * Creates Customer Billing Portal Session
     */
    static async createCustomerPortalSession(customerId, returnUrl) {
        const portal = await this.stripeClient.billingPortal.sessions.create({
            customer: customerId,
            return_url: returnUrl || config.appBaseUrl,
        });
        return { portalUrl: portal.url };
    }
    /**
     * Retrieves status and provisioned license key for a completed Checkout Session
     */
    static async getCheckoutSessionStatus(sessionId) {
        const session = await this.stripeClient.checkout.sessions.retrieve(sessionId);
        const email = session.customer_details?.email || session.customer_email || '';
        const planTier = session.metadata?.planTier || 'monthly';
        const status = session.status || 'open';
        if (session.payment_status === 'paid' || session.status === 'complete') {
            let [rows] = await dbPool.execute(`SELECT license_key, plan_type, status FROM licenses WHERE email = ? ORDER BY created_at DESC LIMIT 1`, [email.toLowerCase().trim()]);
            if (rows.length === 0) {
                await this.handleCheckoutSessionCompleted(session);
                [rows] = await dbPool.execute(`SELECT license_key, plan_type, status FROM licenses WHERE email = ? ORDER BY created_at DESC LIMIT 1`, [email.toLowerCase().trim()]);
            }
            const licenseKey = rows.length > 0 ? rows[0].license_key : undefined;
            return {
                status,
                customerEmail: email,
                licenseKey,
                planTier,
            };
        }
        return {
            status,
            customerEmail: email,
            planTier,
        };
    }
}
