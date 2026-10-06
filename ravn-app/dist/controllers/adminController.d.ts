import { Request, Response } from 'express';
export declare class AdminController {
    /**
     * Middleware to check ADMIN_API_KEY
     */
    static authMiddleware(req: Request, res: Response, next: () => void): void;
    /**
     * GET /api/v1/admin/reports/overview
     * Comprehensive high-level executive report for Ravn Download Manager
     */
    static getOverviewReport(_req: Request, res: Response): Promise<void>;
    /**
     * GET /api/v1/admin/licenses
     * Searchable & filterable license ledger
     */
    static getLicenses(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/v1/admin/devices
     * List of active and historical connected hardware machines
     */
    static getDevices(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/v1/admin/audit-logs
     * Security, telemetry, and license activation logs
     */
    static getAuditLogs(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/v1/admin/analytics
     * Platform OS distribution, plan distribution, and device metrics
     */
    static getAnalytics(_req: Request, res: Response): Promise<void>;
    /**
     * POST /api/v1/admin/licenses/:id/reset-devices
     * Unbind all devices for a given license
     */
    static resetDeviceActivations(req: Request, res: Response): Promise<void>;
    /**
     * DELETE /api/v1/admin/devices/:id
     * POST /api/v1/admin/devices/:id/unlink
     * Unlink/deactivate an individual hardware device activation
     */
    static unlinkDevice(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/v1/admin/licenses/generate
     */
    static generateManualLicense(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/v1/admin/licenses/revoke
     */
    static revokeLicense(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/v1/admin/stats (Legacy endpoint kept for compatibility)
     */
    static getStats(_req: Request, res: Response): Promise<void>;
}
