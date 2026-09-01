import { Request, Response } from 'express';
export interface AppReleaseInfo {
    version: string;
    buildNumber: number;
    releaseDate: string;
    minMacOSVersion: string;
    downloadUrl: string;
    appleSiliconUrl: string;
    intelUrl: string;
    dmgUrl: string;
    fileSizeBytes: number;
    sha256: string;
    changelog: string[];
}
export declare class DownloadController {
    private static releaseInfo;
    /**
     * GET /api/v1/app/version
     * Returns latest version metadata and changelog for macOS auto-updater
     */
    static getVersionInfo(_req: Request, res: Response): void;
    /**
     * GET /api/v1/app/check-update?currentVersion=2.4.0
     */
    static checkUpdate(req: Request, res: Response): void;
    /**
     * GET /download/:filename?
     * GET /assets/macos/:filename?
     * Streams the requested DMG or archive with proper binary content headers, or redirects to GitHub Releases
     */
    static downloadFile(req: Request, res: Response): void;
}
