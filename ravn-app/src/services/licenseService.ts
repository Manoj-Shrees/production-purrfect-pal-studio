import crypto from 'crypto';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { dbPool, redis } from '../db/connection.js';
import { CryptoService, LicensePayload } from './cryptoService.js';

export interface CreateLicenseOptions {
  email: string;
  name?: string;
  planType: 'monthly' | 'annual' | 'lifetime' | 'family' | 'trial';
  subscriptionId?: string;
  expiresAt?: Date | null;
  maxDevices?: number;
  deviceId?: string;
}

export interface ActivationOptions {
  licenseKey: string;
  email: string;
  deviceId: string;
  deviceName?: string;
  osVersion?: string;
  appVersion?: string;
  ipAddress?: string;
}

export class LicenseService {
  /**
   * Generates and stores a new cryptographically signed license in MySQL
   */
  static async createLicense(options: CreateLicenseOptions): Promise<{
    licenseKey: string;
    signature: string;
    signedPayload: string;
    expiresAt: Date | null;
  }> {
    const normalizedEmail = options.email.toLowerCase().trim();

    // ── Enforce 1 Trial per Email & Device ID ──
    if (options.planType === 'trial') {
      // 1. Check existing trial by Email Address
      const [existingTrials] = await dbPool.execute<RowDataPacket[]>(
        `SELECT l.* FROM licenses l
         JOIN customers c ON l.customer_id = c.id
         WHERE c.email = ? AND l.plan_type = 'trial'`,
        [normalizedEmail]
      );

      if (existingTrials.length > 0) {
        const existing = existingTrials[0];
        const isExpired = existing.expires_at ? new Date(existing.expires_at) < new Date() : false;
        if (isExpired || existing.status === 'expired' || existing.status === 'revoked') {
          throw new Error(`A 7-day free trial has already been used for ${normalizedEmail} and has expired. Please purchase a Pro license to continue.`);
        } else {
          // Return the existing active trial key within the 7 days
          return {
            licenseKey: existing.license_key,
            signature: existing.signature,
            signedPayload: existing.signed_payload,
            expiresAt: existing.expires_at ? new Date(existing.expires_at) : null,
          };
        }
      }

      // 2. Check existing trial by Device ID (Hardware UUID)
      if (options.deviceId && options.deviceId.trim()) {
        const cleanDeviceId = options.deviceId.trim();
        const [deviceTrials] = await dbPool.execute<RowDataPacket[]>(
          `SELECT l.* FROM license_activations la
           JOIN licenses l ON la.license_id = l.id
           WHERE la.device_id = ? AND l.plan_type = 'trial'`,
          [cleanDeviceId]
        );

        if (deviceTrials.length > 0) {
          const existing = deviceTrials[0];
          const isExpired = existing.expires_at ? new Date(existing.expires_at) < new Date() : false;
          if (isExpired || existing.status === 'expired' || existing.status === 'revoked') {
            throw new Error(`This Mac (Device ID: ${cleanDeviceId.substring(0, 8)}...) has already used its 7-day free trial. Please purchase a Pro license to continue.`);
          } else {
            return {
              licenseKey: existing.license_key,
              signature: existing.signature,
              signedPayload: existing.signed_payload,
              expiresAt: existing.expires_at ? new Date(existing.expires_at) : null,
            };
          }
        }
      }
    }

    // 1. Ensure customer exists
    const customerId = `cust_${crypto.randomBytes(12).toString('hex')}`;
    await dbPool.execute(
      `INSERT INTO customers (id, email, name)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE name = COALESCE(VALUES(name), name)`,
      [customerId, normalizedEmail, options.name ?? null]
    );

    // Get actual customer ID if existed
    const [custRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT id FROM customers WHERE email = ?`,
      [normalizedEmail]
    );
    const resolvedCustomerId = custRows[0]?.id ?? customerId;

    // 2. Determine expiration and max devices based on plan (Pro = 1 Mac, Ultra Lifetime = 2 Macs, Family = 5 Macs)
    let expiresAt: Date | null = options.expiresAt ?? null;
    let maxDevices = options.maxDevices ?? (options.planType === 'family' ? 5 : options.planType === 'lifetime' ? 2 : 1);

    if (options.planType === 'monthly') {
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
      expiresAt = expiresAt ?? d;
      maxDevices = options.maxDevices ?? 1;
    } else if (options.planType === 'annual') {
      const d = new Date();
      d.setFullYear(d.getFullYear() + 1);
      expiresAt = expiresAt ?? d;
      maxDevices = options.maxDevices ?? 1;
    } else if (options.planType === 'lifetime') {
      expiresAt = null;
      maxDevices = options.maxDevices ?? 2;
    } else if (options.planType === 'family') {
      expiresAt = null;
      maxDevices = options.maxDevices ?? 5;
    } else if (options.planType === 'trial') {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      expiresAt = d;
      maxDevices = 1;
    }

    const licenseId = `lic_${crypto.randomBytes(16).toString('hex')}`;
    const licenseKey = CryptoService.generateLicenseKey();
    const issuedAt = new Date().toISOString();

    const payload: LicensePayload = {
      key: licenseKey,
      email: options.email.toLowerCase().trim(),
      plan: options.planType,
      maxDevices,
      issuedAt,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
    };

    const { signature, canonical } = CryptoService.signPayload(payload);

    // 3. Insert into MySQL
    await dbPool.execute(
      `INSERT INTO licenses (
        id, license_key, customer_id, subscription_id, plan_type,
        status, max_activations, signature, signed_payload, issued_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`,
      [
        licenseId,
        licenseKey,
        resolvedCustomerId,
        options.subscriptionId ?? null,
        options.planType,
        maxDevices,
        signature,
        canonical,
        new Date(issuedAt),
        expiresAt,
      ]
    );

    // Audit Log
    await this.logAudit('license_created', licenseKey, null, null, {
      plan: options.planType,
      email: options.email,
      maxDevices,
    });

    return {
      licenseKey,
      signature,
      signedPayload: canonical,
      expiresAt,
    };
  }

  /**
   * Activates a license on a specific machine/device (Machine-Locking)
   */
  static async activateLicense(options: ActivationOptions): Promise<{
    success: boolean;
    message: string;
    token?: string;
    signature?: string;
    signedPayload?: string;
    plan?: string;
    expiresAt?: string | null;
    activationsRemaining?: number;
  }> {
    const key = options.licenseKey.trim().toUpperCase();
    const email = options.email.trim().toLowerCase();

    // 1. Fetch license and customer
    const [rows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT l.*, c.email as customer_email
       FROM licenses l
       JOIN customers c ON l.customer_id = c.id
       WHERE l.license_key = ?`,
      [key]
    );

    if (rows.length === 0) {
      await this.logAudit('activation_failed_not_found', key, options.deviceId, options.ipAddress ?? null);
      return { success: false, message: 'Invalid license key. Please check your key and try again.' };
    }

    const license = rows[0];

    // Check status
    if (license.status === 'revoked') {
      await this.logAudit('activation_rejected_revoked', key, options.deviceId, options.ipAddress ?? null);
      return { success: false, message: 'This license has been revoked. Reason: ' + (license.revocation_reason ?? 'Administrative action') };
    }

    if (license.status === 'expired' || (license.expires_at && new Date(license.expires_at) < new Date())) {
      await dbPool.execute(`UPDATE licenses SET status = 'expired' WHERE id = ?`, [license.id]);
      await this.logAudit('activation_rejected_expired', key, options.deviceId, options.ipAddress ?? null);
      const expiryStr = license.expires_at ? new Date(license.expires_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'earlier date';
      return {
        success: false,
        message: `This ${license.plan_type === 'trial' ? '7-Day Free Trial' : 'license'} expired on ${expiryStr}. Please upgrade to a Pro license to continue using Pro features.`
      };
    }

    // Check email match (if email provided)
    if (email && license.customer_email.toLowerCase() !== email) {
      await this.logAudit('activation_rejected_email_mismatch', key, options.deviceId, options.ipAddress ?? null, {
        providedEmail: email,
      });
      return { success: false, message: 'The provided email address does not match the registered license holder.' };
    }

    // ── Enforce 1 Trial per Hardware Device UUID ──
    if (license.plan_type === 'trial') {
      const [priorDeviceTrials] = await dbPool.execute<RowDataPacket[]>(
        `SELECT l.* FROM license_activations la
         JOIN licenses l ON la.license_id = l.id
         WHERE la.device_id = ? AND l.plan_type = 'trial' AND l.id != ?`,
        [options.deviceId.trim(), license.id]
      );
      if (priorDeviceTrials.length > 0) {
        const prev = priorDeviceTrials[0];
        const isExpired = prev.expires_at ? new Date(prev.expires_at) < new Date() : false;
        if (isExpired || prev.status === 'expired' || prev.status === 'revoked') {
          await this.logAudit('activation_rejected_trial_device_used', key, options.deviceId, options.ipAddress ?? null);
          return {
            success: false,
            message: 'This Mac has already used a 7-Day Free Trial that has expired. Please upgrade to Ravn Pro or Lifetime to continue.',
          };
        }
      }
    }

    // 2. Check existing activations for this device
    const [activeRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT * FROM license_activations WHERE license_id = ? AND device_id = ? AND is_active = TRUE`,
      [license.id, options.deviceId]
    );

    const isAlreadyActiveOnDevice = activeRows.length > 0;

    if (!isAlreadyActiveOnDevice) {
      // Check total active device count
      const [countRows] = await dbPool.execute<RowDataPacket[]>(
        `SELECT COUNT(*) as count FROM license_activations WHERE license_id = ? AND is_active = TRUE`,
        [license.id]
      );
      const activeCount = countRows[0].count;

      if (activeCount >= license.max_activations) {
        await this.logAudit('activation_rejected_limit_reached', key, options.deviceId, options.ipAddress ?? null, {
          activeCount,
          max: license.max_activations,
        });
        return {
          success: false,
          message: `Device seat limit reached (${activeCount}/${license.max_activations} active Macs). This license is active on ${license.max_activations} Macs. Please deactivate a device on the License Portal or purchase extra Mac seats.`,
        };
      }

      // Record new activation
      const activationId = `act_${crypto.randomBytes(12).toString('hex')}`;
      await dbPool.execute(
        `INSERT INTO license_activations (id, license_id, device_id, device_name, os_version, app_version, ip_address, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)
         ON DUPLICATE KEY UPDATE is_active = TRUE, device_name = VALUES(device_name), os_version = VALUES(os_version), ip_address = VALUES(ip_address), last_ping_at = CURRENT_TIMESTAMP`,
        [
          activationId,
          license.id,
          options.deviceId,
          options.deviceName ?? 'Mac',
          options.osVersion ?? 'macOS',
          options.appVersion ?? '1.0.0',
          options.ipAddress ?? null,
        ]
      );

      // Update count
      await dbPool.execute(
        `UPDATE licenses SET activations_count = (SELECT COUNT(*) FROM license_activations WHERE license_id = ? AND is_active = TRUE) WHERE id = ?`,
        [license.id, license.id]
      );
    } else {
      // Update ping timestamp
      await dbPool.execute(
        `UPDATE license_activations SET last_ping_at = CURRENT_TIMESTAMP, ip_address = COALESCE(?, ip_address) WHERE license_id = ? AND device_id = ?`,
        [options.ipAddress ?? null, license.id, options.deviceId]
      );
    }

    // 3. Generate Machine-Locked Cryptographic Lease
    const leasePayload: LicensePayload = {
      key: license.license_key,
      email: license.customer_email,
      plan: license.plan_type,
      maxDevices: license.max_activations,
      issuedAt: license.issued_at.toISOString(),
      expiresAt: license.expires_at ? license.expires_at.toISOString() : null,
      hardwareId: options.deviceId,
    };

    const { signature: leaseSignature, canonical: leaseCanonical } = CryptoService.signPayload(leasePayload);

    await this.logAudit('activation_success', key, options.deviceId, options.ipAddress ?? null, {
      plan: license.plan_type,
    });

    return {
      success: true,
      message: license.plan_type === 'trial'
        ? '7-Day Free Trial activated successfully on this Mac!'
        : 'License activated successfully on this Mac!',
      signature: leaseSignature,
      signedPayload: leaseCanonical,
      plan: license.plan_type,
      expiresAt: license.expires_at ? license.expires_at.toISOString() : null,
      activationsRemaining: Math.max(0, license.max_activations - (license.activations_count + (isAlreadyActiveOnDevice ? 0 : 1))),
    };
  }

  /**
   * Deactivates a license from a specific machine
   */
  static async deactivateLicense(licenseKey: string, deviceId: string): Promise<{ success: boolean; message: string }> {
    const key = licenseKey.trim().toUpperCase();

    const [rows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT id FROM licenses WHERE license_key = ?`,
      [key]
    );

    if (rows.length === 0) {
      return { success: false, message: 'License key not found.' };
    }

    const licenseId = rows[0].id;
    await dbPool.execute(
      `UPDATE license_activations SET is_active = FALSE WHERE license_id = ? AND device_id = ?`,
      [licenseId, deviceId]
    );

    await dbPool.execute(
      `UPDATE licenses SET activations_count = (SELECT COUNT(*) FROM license_activations WHERE license_id = ? AND is_active = TRUE) WHERE id = ?`,
      [licenseId, licenseId]
    );

    await this.logAudit('license_deactivated', key, deviceId, null);
    return { success: true, message: 'Device deactivated successfully.' };
  }

  /**
   * Revokes a license key permanently
   */
  static async revokeLicense(licenseKey: string, reason: string): Promise<boolean> {
    const key = licenseKey.trim().toUpperCase();
    const [result] = await dbPool.execute<ResultSetHeader>(
      `UPDATE licenses SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP, revocation_reason = ? WHERE license_key = ?`,
      [reason, key]
    );

    await this.logAudit('license_revoked', key, null, null, { reason });
    return result.affectedRows > 0;
  }

  /**
   * Retrieves public license status, plan, signature validity, and active devices list
   */
  static async getLicenseDetails(licenseKey: string, email?: string): Promise<{
    found: boolean;
    valid: boolean;
    licenseKey?: string;
    email?: string;
    plan?: string;
    status?: string;
    maxDevices?: number;
    activeDevicesCount?: number;
    activationsRemaining?: number;
    expiresAt?: string | null;
    devices?: Array<{
      deviceId: string;
      deviceName: string;
      osVersion: string;
      activatedAt: string;
      lastPingAt: string;
    }>;
    error?: string;
  }> {
    const key = licenseKey.trim().toUpperCase();
    const [rows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT l.*, c.email AS customer_email, c.name AS customer_name
       FROM licenses l
       LEFT JOIN customers c ON l.customer_id = c.id
       WHERE l.license_key = ?`,
      [key]
    );

    if (rows.length === 0) {
      return { found: false, valid: false, error: 'License key not found.' };
    }

    const license = rows[0];

    // Optional email validation if provided
    if (email && email.trim()) {
      const cleanEmail = email.trim().toLowerCase();
      if (license.customer_email && license.customer_email.toLowerCase() !== cleanEmail) {
        return { found: false, valid: false, error: 'The email address does not match this license record.' };
      }
    }

    // Get active devices list
    const [deviceRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT device_id, device_name, os_version, app_version, activated_at, last_ping_at
       FROM license_activations
       WHERE license_id = ? AND is_active = TRUE
       ORDER BY activated_at DESC`,
      [license.id]
    );

    const isExpired = license.expires_at ? new Date(license.expires_at) < new Date() : false;
    const isRevoked = license.status === 'revoked' || license.status === 'expired' || license.status === 'suspended';

    return {
      found: true,
      valid: !isExpired && !isRevoked,
      licenseKey: license.license_key,
      email: license.customer_email || '',
      plan: license.plan_type,
      status: isExpired ? 'expired' : license.status,
      maxDevices: license.max_activations,
      activeDevicesCount: deviceRows.length,
      activationsRemaining: Math.max(0, license.max_activations - deviceRows.length),
      expiresAt: license.expires_at ? new Date(license.expires_at).toISOString() : null,
      devices: deviceRows.map((d: any) => ({
        deviceId: d.device_id,
        deviceName: d.device_name || 'Mac',
        osVersion: d.os_version || 'macOS',
        activatedAt: d.activated_at ? new Date(d.activated_at).toISOString() : '',
        lastPingAt: d.last_ping_at ? new Date(d.last_ping_at).toISOString() : '',
      })),
    };
  }

  /**
   * Audit Logger helper
   */
  private static async logAudit(eventType: string, licenseKey: string | null, deviceId: string | null, ipAddress: string | null, details?: any) {
    try {
      await dbPool.execute(
        `INSERT INTO audit_logs (event_type, license_key, device_id, ip_address, details) VALUES (?, ?, ?, ?, ?)`,
        [eventType, licenseKey, deviceId, ipAddress, details ? JSON.stringify(details) : null]
      );
    } catch (err) {
      console.warn('[Audit] Failed to log audit record:', err);
    }
  }
}
