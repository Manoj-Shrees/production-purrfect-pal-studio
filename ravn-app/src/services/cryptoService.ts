import crypto from 'crypto';
import { config } from '../config.js';

export interface LicensePayload {
  key: string;
  email: string;
  plan: 'monthly' | 'annual' | 'lifetime' | 'trial';
  maxDevices: number;
  issuedAt: string;
  expiresAt: string | null;
  hardwareId?: string;
}

export class CryptoService {
  private static privateKey: string = config.crypto.privateKey;
  private static publicKey: string = config.crypto.publicKey;

  static initialize() {
    // If keys not set in env, auto-generate ephemeral pair for testing/fallback
    if (!this.privateKey || !this.publicKey) {
      console.warn('[CryptoService] No Ed25519 keys found in environment. Generating dynamic key pair...');
      const { publicKey, privateKey } = this.generateKeyPair();
      this.privateKey = privateKey;
      this.publicKey = publicKey;
      console.log('[CryptoService] Public Key (Base64):', this.publicKey);
    }
  }

  /**
   * Generates a new Ed25519 Key Pair for Asymmetric Cryptographic Signing
   */
  static generateKeyPair(): { publicKey: string; privateKey: string } {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    // Also extract raw 32-byte public key in base64 for Swift CryptoKit
    const rawPublicKey = crypto.createPublicKey(publicKey).export({ type: 'spki', format: 'der' });
    // In SPKI DER format for Ed25519, the last 32 bytes are the raw public key
    const raw32Bytes = rawPublicKey.subarray(rawPublicKey.length - 32);
    const rawBase64 = raw32Bytes.toString('base64');

    return {
      publicKey: rawBase64,
      privateKey: privateKey,
    };
  }

  /**
   * Generates a secure human-readable license key: RAVN-XXXX-XXXX-XXXX-XXXX
   */
  static generateLicenseKey(): string {
    const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excludes ambiguous O, 0, I, 1
    const segments = 4;
    const segmentLength = 4;
    const parts: string[] = [];

    const randomBytes = crypto.randomBytes(segments * segmentLength);
    let byteIdx = 0;

    for (let i = 0; i < segments; i++) {
      let segment = '';
      for (let j = 0; j < segmentLength; j++) {
        segment += charset[randomBytes[byteIdx++] % charset.length];
      }
      parts.push(segment);
    }

    return `RAVN-${parts.join('-')}`;
  }

  /**
   * Canonicalizes license payload into a deterministic string for signing
   */
  static canonicalizePayload(payload: LicensePayload): string {
    return [
      `key=${payload.key.trim().toUpperCase()}`,
      `email=${payload.email.trim().toLowerCase()}`,
      `plan=${payload.plan}`,
      `maxDevices=${payload.maxDevices}`,
      `issuedAt=${payload.issuedAt}`,
      `expiresAt=${payload.expiresAt ?? 'never'}`,
      payload.hardwareId ? `hw=${payload.hardwareId}` : '',
    ].filter(Boolean).join('|');
  }

  /**
   * Cryptographically signs payload with Ed25519 Private Key
   */
  static signPayload(payload: LicensePayload): { signature: string; canonical: string } {
    if (!this.privateKey) {
      this.initialize();
    }

    const canonical = this.canonicalizePayload(payload);
    const signature = crypto.sign(null, Buffer.from(canonical, 'utf8'), this.privateKey);
    return {
      signature: signature.toString('base64'),
      canonical,
    };
  }

  /**
   * Verifies an Ed25519 digital signature
   */
  static verifySignature(canonical: string, signatureBase64: string): boolean {
    try {
      if (!this.publicKey) return false;

      // Construct SPKI DER buffer from 32-byte base64 public key
      const rawPublicKey = Buffer.from(this.publicKey, 'base64');
      const spkiHeader = Buffer.from([
        0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00
      ]);
      const spkiDer = Buffer.concat([spkiHeader, rawPublicKey]);

      const keyObject = crypto.createPublicKey({
        key: spkiDer,
        format: 'der',
        type: 'spki',
      });

      const signature = Buffer.from(signatureBase64, 'base64');
      return crypto.verify(null, Buffer.from(canonical, 'utf8'), keyObject, signature);
    } catch (err) {
      console.error('[CryptoService] Verification error:', err);
      return false;
    }
  }

  /**
   * Returns current raw public key in base64
   */
  static getPublicKey(): string {
    if (!this.publicKey) this.initialize();
    return this.publicKey;
  }
}
