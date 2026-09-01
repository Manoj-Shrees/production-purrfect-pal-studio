import crypto from 'crypto';
import { dbPool } from '../db/connection.js';
import { CryptoService } from './cryptoService.js';
export class LicenseService {
    /**
     * Generates and stores a new cryptographically signed license in MySQL
     */
    static async createLicense(options) {
        // 1. Ensure customer exists
        const customerId = `cust_${crypto.randomBytes(12).toString('hex')}`;
        await dbPool.execute(`INSERT INTO customers (id, email, name)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE name = COALESCE(VALUES(name), name)`, [customerId, options.email.toLowerCase().trim(), options.name ?? null]);
        // Get actual customer ID if existed
        const [custRows] = await dbPool.execute(`SELECT id FROM customers WHERE email = ?`, [options.email.toLowerCase().trim()]);
        const resolvedCustomerId = custRows[0]?.id ?? customerId;
        // 2. Determine expiration and max devices based on plan (Pro = 1 Mac, Ultra Lifetime = 2 Macs)
        let expiresAt = options.expiresAt ?? null;
        let maxDevices = options.maxDevices ?? (options.planType === 'lifetime' ? 2 : 1);
        if (options.planType === 'monthly') {
            const d = new Date();
            d.setMonth(d.getMonth() + 1);
            expiresAt = expiresAt ?? d;
            maxDevices = options.maxDevices ?? 1;
        }
        else if (options.planType === 'annual') {
            const d = new Date();
            d.setFullYear(d.getFullYear() + 1);
            expiresAt = expiresAt ?? d;
            maxDevices = options.maxDevices ?? 1;
        }
        else if (options.planType === 'lifetime') {
            expiresAt = null;
            maxDevices = options.maxDevices ?? 2;
        }
        else if (options.planType === 'trial') {
            const d = new Date();
            d.setDate(d.getDate() + 7);
            expiresAt = d;
            maxDevices = 1;
        }
        const licenseId = `lic_${crypto.randomBytes(16).toString('hex')}`;
        const licenseKey = CryptoService.generateLicenseKey();
        const issuedAt = new Date().toISOString();
        const payload = {
            key: licenseKey,
            email: options.email.toLowerCase().trim(),
            plan: options.planType,
            maxDevices,
            issuedAt,
            expiresAt: expiresAt ? expiresAt.toISOString() : null,
        };
        const { signature, canonical } = CryptoService.signPayload(payload);
        // 3. Insert into MySQL
        await dbPool.execute(`INSERT INTO licenses (
        id, license_key, customer_id, subscription_id, plan_type,
        status, max_activations, signature, signed_payload, issued_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`, [
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
        ]);
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
    static async activateLicense(options) {
        const key = options.licenseKey.trim().toUpperCase();
        const email = options.email.trim().toLowerCase();
        // 1. Fetch license and customer
        const [rows] = await dbPool.execute(`SELECT l.*, c.email as customer_email
       FROM licenses l
       JOIN customers c ON l.customer_id = c.id
       WHERE l.license_key = ?`, [key]);
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
            return { success: false, message: 'This license has expired. Please renew your subscription to continue.' };
        }
        // Check email match (if email provided)
        if (email && license.customer_email.toLowerCase() !== email) {
            await this.logAudit('activation_rejected_email_mismatch', key, options.deviceId, options.ipAddress ?? null, {
                providedEmail: email,
            });
            return { success: false, message: 'The provided email address does not match the registered license holder.' };
        }
        // 2. Check existing activations for this device
        const [activeRows] = await dbPool.execute(`SELECT * FROM license_activations WHERE license_id = ? AND device_id = ? AND is_active = TRUE`, [license.id, options.deviceId]);
        const isAlreadyActiveOnDevice = activeRows.length > 0;
        if (!isAlreadyActiveOnDevice) {
            // Check total active device count
            const [countRows] = await dbPool.execute(`SELECT COUNT(*) as count FROM license_activations WHERE license_id = ? AND is_active = TRUE`, [license.id]);
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
            await dbPool.execute(`INSERT INTO license_activations (id, license_id, device_id, device_name, os_version, app_version, ip_address, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)
         ON DUPLICATE KEY UPDATE is_active = TRUE, device_name = VALUES(device_name), os_version = VALUES(os_version), ip_address = VALUES(ip_address), last_ping_at = CURRENT_TIMESTAMP`, [
                activationId,
                license.id,
                options.deviceId,
                options.deviceName ?? 'Mac',
                options.osVersion ?? 'macOS',
                options.appVersion ?? '1.0.0',
                options.ipAddress ?? null,
            ]);
            // Update count
            await dbPool.execute(`UPDATE licenses SET activations_count = (SELECT COUNT(*) FROM license_activations WHERE license_id = ? AND is_active = TRUE) WHERE id = ?`, [license.id, license.id]);
        }
        else {
            // Update ping timestamp
            await dbPool.execute(`UPDATE license_activations SET last_ping_at = CURRENT_TIMESTAMP, ip_address = COALESCE(?, ip_address) WHERE license_id = ? AND device_id = ?`, [options.ipAddress ?? null, license.id, options.deviceId]);
        }
        // 3. Generate Machine-Locked Cryptographic Lease
        const leasePayload = {
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
            message: 'License activated successfully on this Mac!',
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
    static async deactivateLicense(licenseKey, deviceId) {
        const key = licenseKey.trim().toUpperCase();
        const [rows] = await dbPool.execute(`SELECT id FROM licenses WHERE license_key = ?`, [key]);
        if (rows.length === 0) {
            return { success: false, message: 'License key not found.' };
        }
        const licenseId = rows[0].id;
        await dbPool.execute(`UPDATE license_activations SET is_active = FALSE WHERE license_id = ? AND device_id = ?`, [licenseId, deviceId]);
        await dbPool.execute(`UPDATE licenses SET activations_count = (SELECT COUNT(*) FROM license_activations WHERE license_id = ? AND is_active = TRUE) WHERE id = ?`, [licenseId, licenseId]);
        await this.logAudit('license_deactivated', key, deviceId, null);
        return { success: true, message: 'Device deactivated successfully.' };
    }
    /**
     * Revokes a license key permanently
     */
    static async revokeLicense(licenseKey, reason) {
        const key = licenseKey.trim().toUpperCase();
        const [result] = await dbPool.execute(`UPDATE licenses SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP, revocation_reason = ? WHERE license_key = ?`, [reason, key]);
        await this.logAudit('license_revoked', key, null, null, { reason });
        return result.affectedRows > 0;
    }
    /**
     * Retrieves public license status, plan, signature validity, and active devices list
     */
    static async getLicenseDetails(licenseKey, email) {
        const key = licenseKey.trim().toUpperCase();
        const [rows] = await dbPool.execute(`SELECT l.*, c.email AS customer_email, c.name AS customer_name
       FROM licenses l
       LEFT JOIN customers c ON l.customer_id = c.id
       WHERE l.license_key = ?`, [key]);
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
        const [deviceRows] = await dbPool.execute(`SELECT device_id, device_name, os_version, app_version, activated_at, last_ping_at
       FROM license_activations
       WHERE license_id = ? AND is_active = TRUE
       ORDER BY activated_at DESC`, [license.id]);
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
            devices: deviceRows.map((d) => ({
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
    static async logAudit(eventType, licenseKey, deviceId, ipAddress, details) {
        try {
            await dbPool.execute(`INSERT INTO audit_logs (event_type, license_key, device_id, ip_address, details) VALUES (?, ?, ?, ?, ?)`, [eventType, licenseKey, deviceId, ipAddress, details ? JSON.stringify(details) : null]);
        }
        catch (err) {
            console.warn('[Audit] Failed to log audit record:', err);
        }
    }
}
