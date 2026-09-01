import { Request, Response } from 'express';
export declare class LicenseController {
    /**
     * POST /api/v1/license/activate
     */
    static activate(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/v1/license/deactivate
     */
    static deactivate(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/v1/license/lookup
     * Returns license details, plan, active devices, and signature status for the web portal
     */
    static lookup(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/v1/license/public-key
     * Returns the server's Ed25519 public key for client-side offline verification
     */
    static getPublicKey(_req: Request, res: Response): Promise<void>;
    /**
     * POST /api/v1/license/start-trial
     * Instantly provisions an Ed25519-signed 7-day trial license without requiring payment
     */
    static startTrial(req: Request, res: Response): Promise<void>;
}
