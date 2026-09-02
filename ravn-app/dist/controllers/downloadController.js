import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export class DownloadController {
    static releaseInfo = {
        version: '2.5.0',
        buildNumber: 250,
        releaseDate: '2026-09-02',
        minMacOSVersion: '14.0',
        downloadUrl: '/assets/macos/Ravn-Universal.dmg',
        dmgUrl: '/assets/macos/Ravn-Universal.dmg',
        appleSiliconUrl: '/assets/macos/Ravn-AppleSilicon.dmg',
        intelUrl: '/assets/macos/Ravn-Intel.dmg',
        fileSizeBytes: 19158045, // actual build size
        sha256: 'bf20d64f81a02d53d01737ef134cd4f836e0fab17e47730db0d0ad0e30a0faa7', // shasum -a 256 Ravn-Universal.dmg
        changelog: [
            '⚡️ Turbo 48-Stream Parallel Multi-Segment download engine with dual-probe fallback.',
            '✨ 16 Artisan Glassmorphic Themes & Custom Spectrum Palette Studio.',
            '🎧 9 Acoustic Soundscape Profiles with fluid dynamic waveform visualizer.',
            '🎬 Media Studio: FFmpeg GPU Transcoder, ProRes 422, Stem Splitter & Spatial 3D VR Converter.',
            '🔐 Ed25519 Asymmetric Cryptographic Licensing with Apple CryptoKit offline mathematical verification.',
            '📁 Smart Category Folder Routing & Eco-Battery aware throttling.',
            '📡 RSS Auto-download Feeds with RegEx smart pattern matching.'
        ],
    };
    /**
     * GET /api/v1/app/version
     * Returns latest version metadata and changelog for macOS auto-updater
     */
    static getVersionInfo(_req, res) {
        res.status(200).json({
            success: true,
            data: DownloadController.releaseInfo,
        });
    }
    /**
     * GET /api/v1/app/check-update?currentVersion=2.4.0
     */
    static checkUpdate(req, res) {
        const currentVersion = req.query.currentVersion || '1.0.0';
        const isUpdateAvailable = currentVersion !== DownloadController.releaseInfo.version;
        res.status(200).json({
            success: true,
            updateAvailable: isUpdateAvailable,
            latestVersion: DownloadController.releaseInfo.version,
            releaseDate: DownloadController.releaseInfo.releaseDate,
            downloadUrl: DownloadController.releaseInfo.downloadUrl,
            changelog: DownloadController.releaseInfo.changelog,
            mandatory: false,
        });
    }
    /**
     * GET /download/:filename?
     * GET /assets/macos/:filename?
     * Streams the requested DMG or archive with proper binary content headers, or redirects to GitHub Releases
     */
    static downloadFile(req, res) {
        const rawParam = req.params.filename;
        let requestedFile = (typeof rawParam === 'string' ? rawParam : 'Ravn-Universal.dmg') || 'Ravn-Universal.dmg';
        if (!requestedFile.endsWith('.dmg') && !requestedFile.endsWith('.zip')) {
            requestedFile = 'Ravn-Universal.dmg';
        }
        const safeFilename = path.basename(requestedFile);
        // Check possible local paths
        const possiblePaths = [
            path.resolve(__dirname, '../../public/assets/macos', safeFilename),
            path.resolve(__dirname, '../../downloads', safeFilename),
            path.resolve(__dirname, '../../public/downloads', safeFilename),
        ];
        for (const localFilePath of possiblePaths) {
            if (fs.existsSync(localFilePath)) {
                res.setHeader('Content-Type', 'application/x-apple-diskimage');
                res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
                res.setHeader('Cache-Control', 'public, max-age=86400');
                const stream = fs.createReadStream(localFilePath);
                stream.pipe(res);
                return;
            }
        }
        // Direct fallback redirect to official GitHub releases
        return res.redirect(302, `https://github.com/Manoj-Shrees/Ravn-Download-manager/releases/latest/download/${safeFilename}`);
    }
}
