import { Request, Response } from 'express';
import { LicenseService } from '../services/licenseService.js';
import { CryptoService } from '../services/cryptoService.js';
import { EmailService } from '../services/emailService.js';

export class LicenseController {
  /**
   * POST /api/v1/license/activate
   */
  static async activate(req: Request, res: Response): Promise<void> {
    try {
      const { licenseKey, email, deviceId, deviceName, osVersion, appVersion } = req.body;

      if (!licenseKey || !deviceId) {
        res.status(400).json({
          success: false,
          error: 'Missing required parameters: licenseKey and deviceId are required.',
        });
        return;
      }

      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';

      const result = await LicenseService.activateLicense({
        licenseKey,
        email: email || '',
        deviceId,
        deviceName,
        osVersion,
        appVersion,
        ipAddress,
      });

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.status(200).json(result);
    } catch (err: any) {
      console.error('[LicenseController.activate] Error:', err);
      res.status(500).json({ success: false, error: 'Internal activation error: ' + err.message });
    }
  }

  /**
   * POST /api/v1/license/deactivate
   */
  static async deactivate(req: Request, res: Response): Promise<void> {
    try {
      const { licenseKey, deviceId } = req.body;

      if (!licenseKey || !deviceId) {
        res.status(400).json({ success: false, error: 'licenseKey and deviceId are required.' });
        return;
      }

      const result = await LicenseService.deactivateLicense(licenseKey, deviceId);
      res.status(200).json(result);
    } catch (err: any) {
      console.error('[LicenseController.deactivate] Error:', err);
      res.status(500).json({ success: false, error: 'Deactivation error: ' + err.message });
    }
  }

  /**
   * POST /api/v1/license/lookup
   * Returns license details, plan, active devices, and signature status for the web portal
   */
  static async lookup(req: Request, res: Response): Promise<void> {
    try {
      const { licenseKey, email } = req.body;

      if (!licenseKey && !email) {
        res.status(400).json({ success: false, error: 'A license key or registered email address is required.' });
        return;
      }

      let result;
      if (licenseKey && String(licenseKey).trim()) {
        result = await LicenseService.getLicenseDetails(String(licenseKey).trim(), email ? String(email).trim() : undefined);
      } else if (email && String(email).trim()) {
        result = await LicenseService.getLicenseDetailsByEmail(String(email).trim());
      } else {
        res.status(400).json({ success: false, error: 'Please provide a valid license key or email.' });
        return;
      }

      if (!result.found) {
        res.status(404).json({ success: false, error: result.error || 'No active license found.' });
        return;
      }

      res.status(200).json({ success: true, ...result });
    } catch (err: any) {
      console.error('[LicenseController.lookup] Error:', err);
      res.status(500).json({ success: false, error: 'Lookup error: ' + err.message });
    }
  }

  /**
   * GET /api/v1/license/public-key
   * Returns the server's Ed25519 public key for client-side offline verification
   */
  static async getPublicKey(_req: Request, res: Response): Promise<void> {
    const publicKey = CryptoService.getPublicKey();
    res.status(200).json({
      algorithm: 'Ed25519',
      format: 'raw-32-base64',
      publicKey,
    });
  }

  /**
   * POST /api/v1/license/start-trial
   * Instantly provisions an Ed25519-signed 7-day trial license without requiring payment
   */
  static async startTrial(req: Request, res: Response): Promise<void> {
    try {
      const { email, name, deviceId } = req.body;
      if (!email || !email.includes('@')) {
        res.status(400).json({ success: false, error: 'A valid email address is required to receive your trial license.' });
        return;
      }

      const license = await LicenseService.createLicense({
        email: email.trim().toLowerCase(),
        name: name ? String(name).trim() : undefined,
        planType: 'trial',
        maxDevices: 1,
        deviceId: deviceId ? String(deviceId).trim() : undefined,
      });

      // Send 7-day trial email asynchronously
      EmailService.sendTrialLicenseEmail({
        email: email.trim().toLowerCase(),
        name: name ? String(name).trim() : undefined,
        licenseKey: license.licenseKey,
        expiresAt: license.expiresAt,
      }).catch(err => {
        console.error('[LicenseController.startTrial] Non-blocking email error:', err.message);
      });

      res.status(200).json({
        success: true,
        licenseKey: license.licenseKey,
        plan: 'trial',
        days: 7,
        expiresAt: license.expiresAt,
        message: 'Your 7-Day Free Trial license has been successfully minted and emailed to you.',
      });
    } catch (err: any) {
      console.error('[LicenseController.startTrial] Error:', err);
      res.status(500).json({ success: false, error: 'Could not generate trial license: ' + err.message });
    }
  }
}
