export declare const config: {
    port: number;
    nodeEnv: string;
    appBaseUrl: string;
    db: {
        host: string;
        port: number;
        user: string;
        password: string;
        database: string;
        connectionLimit: number;
    };
    redis: {
        host: string;
        port: number;
    };
    stripe: {
        secretKey: string;
        publishableKey: string;
        webhookSecret: string;
        logoUrl: string;
        successUrl: string;
        cancelUrl: string;
        plans: {
            monthly: {
                id: string;
                priceId: string;
                name: string;
                priceCents: number;
                maxDevices: number;
            };
            annual: {
                id: string;
                priceId: string;
                name: string;
                priceCents: number;
                maxDevices: number;
            };
            lifetime: {
                id: string;
                priceId: string;
                name: string;
                priceCents: number;
                maxDevices: number;
            };
            family: {
                id: string;
                priceId: string;
                name: string;
                priceCents: number;
                maxDevices: number;
            };
            seat_addon: {
                id: string;
                priceId: string;
                name: string;
                priceCents: number;
                maxDevices: number;
            };
        };
    };
    crypto: {
        privateKey: string;
        publicKey: string;
    };
    admin: {
        apiKey: string;
    };
};
