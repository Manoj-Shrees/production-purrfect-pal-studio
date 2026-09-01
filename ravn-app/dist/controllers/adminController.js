import { dbPool } from '../db/connection.js';
import { LicenseService } from '../services/licenseService.js';
import { config } from '../config.js';
export class AdminController {
    /**
     * Middleware to check ADMIN_API_KEY
     */
    static authMiddleware(req, res, next) {
        const authHeader = req.headers['x-api-key'] || req.headers['authorization'];
        const expectedKey = config.admin.apiKey;
        if (!authHeader || authHeader !== expectedKey && authHeader !== `Bearer ${expectedKey}`) {
            res.status(401).json({ error: 'Unauthorized: Invalid administrative API key.' });
            return;
        }
        next();
    }
    /**
     * POST /api/v1/admin/licenses/generate
     */
    static async generateManualLicense(req, res) {
        try {
            const { email, name, planType, maxDevices, expiresDays } = req.body;
            if (!email || !planType) {
                res.status(400).json({ error: 'email and planType (monthly, annual, lifetime, trial) are required.' });
                return;
            }
            let expiresAt = null;
            if (expiresDays && expiresDays > 0) {
                expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + expiresDays);
            }
            const license = await LicenseService.createLicense({
                email,
                name: name || 'Direct License Customer',
                planType,
                maxDevices: maxDevices ? parseInt(maxDevices, 10) : undefined,
                expiresAt,
            });
            res.status(201).json({
                success: true,
                message: 'License key generated successfully.',
                license,
            });
        }
        catch (err) {
            console.error('[AdminController.generateManualLicense] Error:', err);
            res.status(500).json({ error: err.message });
        }
    }
    /**
     * POST /api/v1/admin/licenses/revoke
     */
    static async revokeLicense(req, res) {
        try {
            const { licenseKey, reason } = req.body;
            if (!licenseKey) {
                res.status(400).json({ error: 'licenseKey is required.' });
                return;
            }
            const success = await LicenseService.revokeLicense(licenseKey, reason || 'Revoked by admin');
            res.status(200).json({ success, message: success ? 'License revoked.' : 'License not found.' });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    /**
     * GET /api/v1/admin/stats
     */
    static async getStats(_req, res) {
        try {
            const [totalLic] = await dbPool.execute('SELECT COUNT(*) as count FROM licenses');
            const [activeLic] = await dbPool.execute('SELECT COUNT(*) as count FROM licenses WHERE status = "active"');
            const [activeDev] = await dbPool.execute('SELECT COUNT(*) as count FROM license_activations WHERE is_active = TRUE');
            const [customers] = await dbPool.execute('SELECT COUNT(*) as count FROM customers');
            res.status(200).json({
                totalLicenses: totalLic[0].count,
                activeLicenses: activeLic[0].count,
                activeDevices: activeDev[0].count,
                totalCustomers: customers[0].count,
            });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
}
