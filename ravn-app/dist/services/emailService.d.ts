export interface SendPurchaseEmailOptions {
    email: string;
    name?: string;
    licenseKey: string;
    planType: string;
    maxDevices: number;
    expiresAt?: Date | string | null;
    amountPaid?: string;
}
export interface SendTrialEmailOptions {
    email: string;
    name?: string;
    licenseKey: string;
    expiresAt?: Date | string | null;
}
export declare class EmailService {
    private static transporter;
    /**
     * Initializes or retrieves the nodemailer SMTP transporter
     */
    private static getTransporter;
    /**
     * Formats human-readable plan name
     */
    private static formatPlanName;
    /**
     * Returns a plan tier badge styling & text
     */
    private static getPlanBadgeInfo;
    /**
     * Sends a receipt and cryptographic license delivery email after a successful purchase
     */
    static sendPurchaseConfirmationEmail(options: SendPurchaseEmailOptions): Promise<boolean>;
    /**
     * Sends a 7-day trial license email
     */
    static sendTrialLicenseEmail(options: SendTrialEmailOptions): Promise<boolean>;
    /**
     * Internal sender helper with error suppression
     */
    private static sendMail;
}
