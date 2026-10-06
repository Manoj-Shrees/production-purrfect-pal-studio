import { Request, Response } from 'express';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { dbPool } from '../db/connection.js';
import { LicenseService } from '../services/licenseService.js';
import { config } from '../config.js';

export class AdminController {
  /**
   * Middleware to check ADMIN_API_KEY
   */
  static authMiddleware(req: Request, res: Response, next: () => void): void {
    const authHeader = req.headers['x-api-key'] || req.headers['authorization'];
    const expectedKey = config.admin.apiKey;

    if (!authHeader || (authHeader !== expectedKey && authHeader !== `Bearer ${expectedKey}`)) {
      res.status(401).json({ error: 'Unauthorized: Invalid administrative API key.' });
      return;
    }
    next();
  }

  /**
   * GET /api/v1/admin/reports/overview
   * Comprehensive high-level executive report for Ravn Download Manager
   */
  static async getOverviewReport(_req: Request, res: Response): Promise<void> {
    try {
      const [totalLic] = await dbPool.execute<RowDataPacket[]>('SELECT COUNT(*) as count FROM licenses');
      const [activeLic] = await dbPool.execute<RowDataPacket[]>('SELECT COUNT(*) as count FROM licenses WHERE status = "active"');
      const [expiredLic] = await dbPool.execute<RowDataPacket[]>('SELECT COUNT(*) as count FROM licenses WHERE status = "expired" OR (expires_at IS NOT NULL AND expires_at < NOW())');
      const [revokedLic] = await dbPool.execute<RowDataPacket[]>('SELECT COUNT(*) as count FROM licenses WHERE status = "revoked"');
      const [trialLic] = await dbPool.execute<RowDataPacket[]>('SELECT COUNT(*) as count FROM licenses WHERE plan_type = "trial"');
      
      const [activeDev] = await dbPool.execute<RowDataPacket[]>('SELECT COUNT(*) as count FROM license_activations WHERE is_active = TRUE');
      const [customers] = await dbPool.execute<RowDataPacket[]>('SELECT COUNT(*) as count FROM customers');
      const [activeSubs] = await dbPool.execute<RowDataPacket[]>('SELECT COUNT(*) as count FROM subscriptions WHERE status = "active"');

      // Plan breakdown
      const [planBreakdown] = await dbPool.execute<RowDataPacket[]>(
        'SELECT plan_type, COUNT(*) as count FROM licenses GROUP BY plan_type'
      );

      // Estimated MRR calculation: monthly ($4.99) + annual ($39.99 / 12 = $3.33)
      const [monthlyActive] = await dbPool.execute<RowDataPacket[]>(
        'SELECT COUNT(*) as count FROM licenses WHERE status = "active" AND plan_type = "monthly"'
      );
      const [annualActive] = await dbPool.execute<RowDataPacket[]>(
        'SELECT COUNT(*) as count FROM licenses WHERE status = "active" AND plan_type = "annual"'
      );
      const [lifetimeActive] = await dbPool.execute<RowDataPacket[]>(
        'SELECT COUNT(*) as count FROM licenses WHERE status = "active" AND plan_type = "lifetime"'
      );
      const [familyActive] = await dbPool.execute<RowDataPacket[]>(
        'SELECT COUNT(*) as count FROM licenses WHERE status = "active" AND plan_type = "family"'
      );

      const mrr = (monthlyActive[0]?.count || 0) * 4.99 + (annualActive[0]?.count || 0) * 3.33;
      const totalRevenueEst = (monthlyActive[0]?.count || 0) * 4.99 + (annualActive[0]?.count || 0) * 39.99 + (lifetimeActive[0]?.count || 0) * 79.99 + (familyActive[0]?.count || 0) * 129.99;

      // Recent 10 activations
      const [recentActivations] = await dbPool.execute<RowDataPacket[]>(
        `SELECT a.id, a.device_name, a.os_version, a.app_version, a.ip_address, a.activated_at, a.last_ping_at,
                l.license_key, l.plan_type, c.email as customer_email
         FROM license_activations a
         JOIN licenses l ON a.license_id = l.id
         JOIN customers c ON l.customer_id = c.id
         ORDER BY a.last_ping_at DESC LIMIT 10`
      );

      res.status(200).json({
        success: true,
        data: {
          metrics: {
            totalLicenses: totalLic[0].count,
            activeLicenses: activeLic[0].count,
            expiredLicenses: expiredLic[0].count,
            revokedLicenses: revokedLic[0].count,
            trialLicenses: trialLic[0].count,
            activeDevices: activeDev[0].count,
            totalCustomers: customers[0].count,
            activeSubscriptions: activeSubs[0].count,
            estimatedMRR: Math.round(mrr * 100) / 100,
            estimatedGrossRevenue: Math.round(totalRevenueEst * 100) / 100,
            systemHealth: 'OPERATIONAL',
            appVersion: '2.5.0'
          },
          planBreakdown: planBreakdown.reduce((acc, row) => {
            acc[row.plan_type] = row.count;
            return acc;
          }, {} as Record<string, number>),
          recentActivations
        }
      });
    } catch (err: any) {
      console.error('[AdminController.getOverviewReport] Error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/v1/admin/licenses
   * Searchable & filterable license ledger
   */
  static async getLicenses(req: Request, res: Response): Promise<void> {
    try {
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 25));
      const offset = (page - 1) * limit;
      const search = (req.query.search as string || '').trim();
      const statusFilter = (req.query.status as string || '').trim();
      const planFilter = (req.query.planType as string || '').trim();

      let whereClauses: string[] = ['1=1'];
      let params: any[] = [];

      if (search) {
        whereClauses.push('(l.license_key LIKE ? OR c.email LIKE ? OR c.name LIKE ?)');
        const searchWildcard = `%${search}%`;
        params.push(searchWildcard, searchWildcard, searchWildcard);
      }

      if (statusFilter && statusFilter !== 'all') {
        whereClauses.push('l.status = ?');
        params.push(statusFilter);
      }

      if (planFilter && planFilter !== 'all') {
        whereClauses.push('l.plan_type = ?');
        params.push(planFilter);
      }

      const whereSql = whereClauses.join(' AND ');

      const [countResult] = await dbPool.execute<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM licenses l JOIN customers c ON l.customer_id = c.id WHERE ${whereSql}`,
        params
      );
      const total = countResult[0].total;

      const [rows] = await dbPool.execute<RowDataPacket[]>(
        `SELECT l.id, l.license_key, l.plan_type, l.status, l.max_activations, l.activations_count,
                l.issued_at, l.expires_at, l.revoked_at, l.revocation_reason,
                c.id as customer_id, c.email as customer_email, c.name as customer_name
         FROM licenses l
         JOIN customers c ON l.customer_id = c.id
         WHERE ${whereSql}
         ORDER BY l.issued_at DESC
         LIMIT ? OFFSET ?`,
        [...params, limit.toString(), offset.toString()]
      );

      res.status(200).json({
        success: true,
        data: {
          licenses: rows,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
          }
        }
      });
    } catch (err: any) {
      console.error('[AdminController.getLicenses] Error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/v1/admin/devices
   * List of active and historical connected hardware machines
   */
  static async getDevices(req: Request, res: Response): Promise<void> {
    try {
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 30));
      const offset = (page - 1) * limit;
      const search = (req.query.search as string || '').trim();

      let whereSql = '1=1';
      let params: any[] = [];

      if (search) {
        whereSql += ' AND (a.device_name LIKE ? OR a.device_id LIKE ? OR a.ip_address LIKE ? OR c.email LIKE ? OR l.license_key LIKE ?)';
        const sw = `%${search}%`;
        params.push(sw, sw, sw, sw, sw);
      }

      const [countResult] = await dbPool.execute<RowDataPacket[]>(
        `SELECT COUNT(*) as total
         FROM license_activations a
         JOIN licenses l ON a.license_id = l.id
         JOIN customers c ON l.customer_id = c.id
         WHERE ${whereSql}`,
        params
      );
      const total = countResult[0].total;

      const [rows] = await dbPool.execute<RowDataPacket[]>(
        `SELECT a.id, a.device_id, a.device_name, a.os_version, a.app_version, a.ip_address,
                a.activated_at, a.last_ping_at, a.is_active,
                l.license_key, l.plan_type, l.status as license_status,
                c.email as customer_email, c.name as customer_name
         FROM license_activations a
         JOIN licenses l ON a.license_id = l.id
         JOIN customers c ON l.customer_id = c.id
         WHERE ${whereSql}
         ORDER BY a.last_ping_at DESC
         LIMIT ? OFFSET ?`,
        [...params, limit.toString(), offset.toString()]
      );

      res.status(200).json({
        success: true,
        data: {
          devices: rows,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
          }
        }
      });
    } catch (err: any) {
      console.error('[AdminController.getDevices] Error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/v1/admin/audit-logs
   * Security, telemetry, and license activation logs
   */
  static async getAuditLogs(req: Request, res: Response): Promise<void> {
    try {
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 40));
      const offset = (page - 1) * limit;

      const [countResult] = await dbPool.execute<RowDataPacket[]>('SELECT COUNT(*) as total FROM audit_logs');
      const total = countResult[0].total;

      const [rows] = await dbPool.execute<RowDataPacket[]>(
        `SELECT id, event_type, license_key, device_id, ip_address, details, created_at
         FROM audit_logs
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [limit.toString(), offset.toString()]
      );

      res.status(200).json({
        success: true,
        data: {
          logs: rows,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
          }
        }
      });
    } catch (err: any) {
      console.error('[AdminController.getAuditLogs] Error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/v1/admin/analytics
   * Platform OS distribution, plan distribution, and device metrics
   */
  static async getAnalytics(_req: Request, res: Response): Promise<void> {
    try {
      const [osDist] = await dbPool.execute<RowDataPacket[]>(
        `SELECT os_version, COUNT(*) as count
         FROM license_activations
         WHERE is_active = TRUE
         GROUP BY os_version
         ORDER BY count DESC`
      );

      const [appVersions] = await dbPool.execute<RowDataPacket[]>(
        `SELECT app_version, COUNT(*) as count
         FROM license_activations
         WHERE is_active = TRUE
         GROUP BY app_version
         ORDER BY count DESC`
      );

      const [plans] = await dbPool.execute<RowDataPacket[]>(
        `SELECT plan_type, COUNT(*) as count
         FROM licenses
         GROUP BY plan_type`
      );

      res.status(200).json({
        success: true,
        data: {
          osDistribution: osDist,
          appVersions,
          planDistribution: plans
        }
      });
    } catch (err: any) {
      console.error('[AdminController.getAnalytics] Error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/v1/admin/licenses/:id/reset-devices
   * Unbind all devices for a given license
   */
  static async resetDeviceActivations(req: Request, res: Response): Promise<void> {
    try {
      const licenseIdOrKey = req.params.id || req.body.licenseKey;

      if (!licenseIdOrKey) {
        res.status(400).json({ success: false, error: 'License ID or key is required.' });
        return;
      }

      const [licRows] = await dbPool.execute<RowDataPacket[]>(
        'SELECT id, license_key FROM licenses WHERE id = ? OR license_key = ?',
        [licenseIdOrKey, licenseIdOrKey]
      );

      if (licRows.length === 0) {
        res.status(404).json({ success: false, error: 'License not found.' });
        return;
      }

      const license = licRows[0];
      await dbPool.execute<ResultSetHeader>(
        'DELETE FROM license_activations WHERE license_id = ?',
        [license.id]
      );

      await dbPool.execute<ResultSetHeader>(
        'UPDATE licenses SET activations_count = 0 WHERE id = ?',
        [license.id]
      );

      // Log audit event
      await dbPool.execute(
        'INSERT INTO audit_logs (event_type, license_key, details) VALUES (?, ?, ?)',
        ['DEVICES_RESET_BY_ADMIN', license.license_key, JSON.stringify({ adminIp: req.ip })]
      );

      res.status(200).json({
        success: true,
        message: 'All device activations unlinked successfully.'
      });
    } catch (err: any) {
      console.error('[AdminController.resetDeviceActivations] Error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * DELETE /api/v1/admin/devices/:id
   * POST /api/v1/admin/devices/:id/unlink
   * Unlink/deactivate an individual hardware device activation
   */
  static async unlinkDevice(req: Request, res: Response): Promise<void> {
    try {
      const activationId = req.params.id;
      if (!activationId) {
        res.status(400).json({ success: false, error: 'Activation ID is required.' });
        return;
      }

      const [rows] = await dbPool.execute<RowDataPacket[]>(
        `SELECT a.id, a.license_id, a.device_id, a.device_name, l.license_key
         FROM license_activations a
         JOIN licenses l ON a.license_id = l.id
         WHERE a.id = ? OR a.device_id = ?`,
        [activationId, activationId]
      );

      if (rows.length === 0) {
        res.status(404).json({ success: false, error: 'Device activation not found.' });
        return;
      }

      const act = rows[0];
      await dbPool.execute<ResultSetHeader>('DELETE FROM license_activations WHERE id = ?', [act.id]);
      await dbPool.execute<ResultSetHeader>(
        'UPDATE licenses SET activations_count = GREATEST(0, activations_count - 1) WHERE id = ?',
        [act.license_id]
      );

      await dbPool.execute(
        'INSERT INTO audit_logs (event_type, license_key, device_id, details) VALUES (?, ?, ?, ?)',
        [
          'DEVICE_UNLINKED_BY_ADMIN',
          act.license_key,
          act.device_id,
          JSON.stringify({ adminIp: req.ip, activationId: act.id, deviceName: act.device_name })
        ]
      );

      res.status(200).json({
        success: true,
        message: `Device "${act.device_name || act.device_id}" successfully unlinked from license.`
      });
    } catch (err: any) {
      console.error('[AdminController.unlinkDevice] Error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/v1/admin/licenses/generate
   */
  static async generateManualLicense(req: Request, res: Response): Promise<void> {
    try {
      const { email, name, planType, maxDevices, expiresDays } = req.body;

      if (!email || !planType) {
        res.status(400).json({ error: 'email and planType (monthly, annual, lifetime, trial) are required.' });
        return;
      }

      let expiresAt: Date | null = null;
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
    } catch (err: any) {
      console.error('[AdminController.generateManualLicense] Error:', err);
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * POST /api/v1/admin/licenses/revoke
   */
  static async revokeLicense(req: Request, res: Response): Promise<void> {
    try {
      const { licenseKey, reason } = req.body;

      if (!licenseKey) {
        res.status(400).json({ error: 'licenseKey is required.' });
        return;
      }

      const success = await LicenseService.revokeLicense(licenseKey, reason || 'Revoked by admin');
      res.status(200).json({ success, message: success ? 'License revoked.' : 'License not found.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * GET /api/v1/admin/stats (Legacy endpoint kept for compatibility)
   */
  static async getStats(_req: Request, res: Response): Promise<void> {
    try {
      const [totalLic] = await dbPool.execute<RowDataPacket[]>('SELECT COUNT(*) as count FROM licenses');
      const [activeLic] = await dbPool.execute<RowDataPacket[]>('SELECT COUNT(*) as count FROM licenses WHERE status = "active"');
      const [activeDev] = await dbPool.execute<RowDataPacket[]>('SELECT COUNT(*) as count FROM license_activations WHERE is_active = TRUE');
      const [customers] = await dbPool.execute<RowDataPacket[]>('SELECT COUNT(*) as count FROM customers');

      res.status(200).json({
        totalLicenses: totalLic[0].count,
        activeLicenses: activeLic[0].count,
        activeDevices: activeDev[0].count,
        totalCustomers: customers[0].count,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}
