export interface LicensePayload {
    key: string;
    email: string;
    plan: 'monthly' | 'annual' | 'lifetime' | 'trial';
    maxDevices: number;
    issuedAt: string;
    expiresAt: string | null;
    hardwareId?: string;
}
export declare class CryptoService {
    private static privateKey;
    private static publicKey;
    static initialize(): void;
    /**
     * Generates a new Ed25519 Key Pair for Asymmetric Cryptographic Signing
     */
    static generateKeyPair(): {
        publicKey: string;
        privateKey: string;
    };
    /**
     * Generates a secure human-readable license key: RAVN-XXXX-XXXX-XXXX-XXXX
     */
    static generateLicenseKey(): string;
    /**
     * Canonicalizes license payload into a deterministic string for signing
     */
    static canonicalizePayload(payload: LicensePayload): string;
    /**
     * Cryptographically signs payload with Ed25519 Private Key
     */
    static signPayload(payload: LicensePayload): {
        signature: string;
        canonical: string;
    };
    /**
     * Verifies an Ed25519 digital signature
     */
    static verifySignature(canonical: string, signatureBase64: string): boolean;
    /**
     * Returns current raw public key in base64
     */
    static getPublicKey(): string;
}
