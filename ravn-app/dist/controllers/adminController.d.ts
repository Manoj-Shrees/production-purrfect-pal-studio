import { Request, Response } from 'express';
export declare class AdminController {
    /**
     * Middleware to check ADMIN_API_KEY
     */
    static authMiddleware(req: Request, res: Response, next: () => void): void;
    /**
     * POST /api/v1/admin/licenses/generate
     */
    static generateManualLicense(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/v1/admin/licenses/revoke
     */
    static revokeLicense(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/v1/admin/stats
     */
    static getStats(_req: Request, res: Response): Promise<void>;
}
