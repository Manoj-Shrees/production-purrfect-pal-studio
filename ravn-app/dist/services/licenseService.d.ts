export interface CreateLicenseOptions {
    email: string;
    name?: string;
    planType: 'monthly' | 'annual' | 'lifetime' | 'trial';
    subscriptionId?: string;
    expiresAt?: Date | null;
    maxDevices?: number;
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
export declare class LicenseService {
    /**
     * Generates and stores a new cryptographically signed license in MySQL
     */
    static createLicense(options: CreateLicenseOptions): Promise<{
        licenseKey: string;
        signature: string;
        signedPayload: string;
        expiresAt: Date | null;
    }>;
    /**
     * Activates a license on a specific machine/device (Machine-Locking)
     */
    static activateLicense(options: ActivationOptions): Promise<{
        success: boolean;
        message: string;
        token?: string;
        signature?: string;
        signedPayload?: string;
        plan?: string;
        expiresAt?: string | null;
        activationsRemaining?: number;
    }>;
    /**
     * Deactivates a license from a specific machine
     */
    static deactivateLicense(licenseKey: string, deviceId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Revokes a license key permanently
     */
    static revokeLicense(licenseKey: string, reason: string): Promise<boolean>;
    /**
     * Retrieves public license status, plan, signature validity, and active devices list
     */
    static getLicenseDetails(licenseKey: string, email?: string): Promise<{
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
    }>;
    /**
     * Audit Logger helper
     */
    private static logAudit;
}
