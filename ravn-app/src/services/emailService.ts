import nodemailer from 'nodemailer';
import { config } from '../config.js';

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

export class EmailService {
  private static transporter: nodemailer.Transporter | null = null;

  /**
   * Initializes or retrieves the nodemailer SMTP transporter
   */
  private static getTransporter(): nodemailer.Transporter | null {
    if (this.transporter) {
      return this.transporter;
    }

    const { host, port, secure, user, pass } = config.email;

    if (!user || !pass) {
      console.warn('[EmailService] SMTP credentials not fully configured (EMAIL_USER or EMAIL_PASS missing). Emails will be logged to console.');
      return null;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure, // true for 465, false for 587
        auth: {
          user,
          pass,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      return this.transporter;
    } catch (err: any) {
      console.error('[EmailService] Failed to initialize nodemailer transporter:', err.message);
      return null;
    }
  }

  /**
   * Formats human-readable plan name
   */
  private static formatPlanName(planType: string): string {
    switch (planType?.toLowerCase()) {
      case 'annual':
      case 'pro_annual':
        return 'Ravn Pro Annual (1 Mac)';
      case 'lifetime':
      case 'ultra_lifetime':
        return 'Ravn Ultra Lifetime (2 Macs)';
      case 'family':
      case 'family_pass':
        return 'Ravn Family & Team Pass (5 Macs)';
      case 'seat_addon':
        return 'Ravn Extra Mac Seat Add-on (+1 Mac)';
      case 'trial':
        return 'Ravn 7-Day Free Trial';
      case 'monthly':
      case 'pro_monthly':
      default:
        return 'Ravn Pro Monthly (1 Mac)';
    }
  }

  /**
   * Sends a receipt and cryptographic license delivery email after a successful purchase
   */
  static async sendPurchaseConfirmationEmail(options: SendPurchaseEmailOptions): Promise<boolean> {
    const { email, name, licenseKey, planType, maxDevices, expiresAt, amountPaid } = options;
    const recipientName = name || 'Ravn Creator';
    const readablePlan = this.formatPlanName(planType);
    const expiryText = expiresAt
      ? new Date(expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : 'Lifetime License (Never Expires)';

    const downloadUrl = `${config.appBaseUrl}/assets/macos/Ravn-Universal.dmg`;
    const portalUrl = `${config.appBaseUrl}/activate.html`;
    const activateSchemeUrl = `ravn://activate?key=${encodeURIComponent(licenseKey)}`;

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Ravn License Key</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #f1f5f9; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 30px auto; background: #111827; border: 1px solid #1f2937; border-radius: 18px; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5); }
    .header { background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%); padding: 36px 30px; text-align: center; border-bottom: 1px solid #3730a3; }
    .logo-badge { display: inline-flex; align-items: center; gap: 10px; font-size: 26px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px; }
    .subtitle { color: #c7d2fe; font-size: 14px; margin-top: 6px; font-weight: 500; }
    .content { padding: 32px 30px; }
    .greeting { font-size: 18px; font-weight: 700; color: #ffffff; margin-bottom: 12px; }
    .message { color: #94a3b8; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }
    .key-card { background: #0f172a; border: 1px solid #334155; border-radius: 14px; padding: 22px; text-align: center; margin: 24px 0; }
    .key-label { font-size: 11px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
    .key-box { font-family: 'SF Mono', Monaco, Menlo, 'Courier New', monospace; font-size: 14px; font-weight: 800; color: #34d399; word-break: break-all; background: #030712; padding: 14px 18px; border-radius: 8px; border: 1px dashed #059669; user-select: all; }
    .meta-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .meta-table td { padding: 10px 0; font-size: 13.5px; border-bottom: 1px solid #1e293b; }
    .meta-label { color: #64748b; font-weight: 600; width: 40%; }
    .meta-val { color: #f8fafc; font-weight: 700; text-align: right; }
    .cta-row { text-align: center; margin: 30px 0 10px; }
    .btn-primary { display: inline-block; background: linear-gradient(135deg, #6366f1, #4f46e5); color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 800; font-size: 14px; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4); }
    .btn-secondary { display: inline-block; background: #1e293b; color: #cbd5e1 !important; text-decoration: none; padding: 12px 22px; border-radius: 10px; font-weight: 700; font-size: 13px; margin-left: 8px; border: 1px solid #334155; }
    .steps { background: #1e293b; border-radius: 12px; padding: 20px; margin: 24px 0; font-size: 13px; color: #cbd5e1; line-height: 1.6; }
    .steps ol { margin: 8px 0 0; padding-left: 20px; }
    .steps li { margin-bottom: 6px; }
    .footer { background: #090d16; padding: 24px 30px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #1e293b; }
    .footer a { color: #818cf8; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-badge">⚡ Ravn Download Accelerator</div>
      <div class="subtitle">Official Order Confirmation &amp; Cryptographic License Delivery</div>
    </div>
    
    <div class="content">
      <div class="greeting">Hi ${recipientName},</div>
      <div class="message">
        Thank you for purchasing <strong>${readablePlan}</strong>! Your ultra-fast gigabit download accelerator is now ready. Below is your official cryptographic license key.
      </div>

      <div class="key-card">
        <div class="key-label">Your Personal License Key</div>
        <div class="key-box">${licenseKey}</div>
      </div>

      <table class="meta-table">
        <tr>
          <td class="meta-label">Plan Tier</td>
          <td class="meta-val">${readablePlan}</td>
        </tr>
        <tr>
          <td class="meta-label">Seats Allowed</td>
          <td class="meta-val">${maxDevices} Mac Device${maxDevices > 1 ? 's' : ''}</td>
        </tr>
        <tr>
          <td class="meta-label">Licensed Email</td>
          <td class="meta-val">${email}</td>
        </tr>
        <tr>
          <td class="meta-label">Status / Expiry</td>
          <td class="meta-val">${expiryText}</td>
        </tr>
        ${amountPaid ? `<tr><td class="meta-label">Total Amount</td><td class="meta-val">${amountPaid}</td></tr>` : ''}
      </table>

      <div class="steps">
        <strong style="color: #ffffff;">How to Activate Ravn on your Mac:</strong>
        <ol>
          <li>Download and install <strong>Ravn for macOS</strong> if you haven't already.</li>
          <li>Launch Ravn and click <strong>"Activate Pro"</strong> or <strong>"License Portal"</strong> in the sidebar.</li>
          <li>Paste your license key above and click <strong>"Verify &amp; Activate"</strong>.</li>
          <li>Enjoy 32-segment gigabit downloads, unlimited streams, and video transcoding!</li>
        </ol>
      </div>

      <div class="cta-row">
        <a href="${downloadUrl}" class="btn-primary">Download Ravn for macOS</a>
        <a href="${portalUrl}" class="btn-secondary">Manage Seats in Portal</a>
      </div>
    </div>

    <div class="footer">
      <p>Need help or have questions? Contact our team at <a href="mailto:support@purrfectpal.studio">support@purrfectpal.studio</a></p>
      <p>© ${new Date().getFullYear()} Ravn by Purrfect Pal Studio. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;

    return this.sendMail({
      to: email,
      subject: `⚡ Your Ravn License Key: ${readablePlan}`,
      html: htmlContent,
      text: `Hi ${recipientName},\n\nThank you for purchasing ${readablePlan}!\n\nYour License Key: ${licenseKey}\n\nAllowed Seats: ${maxDevices} Mac(s)\nExpiry: ${expiryText}\n\nDownload Ravn: ${downloadUrl}\nManage License: ${portalUrl}\n\nEnjoy high-speed downloads!\n- Ravn Team`,
    });
  }

  /**
   * Sends a 7-day trial license email
   */
  static async sendTrialLicenseEmail(options: SendTrialEmailOptions): Promise<boolean> {
    const { email, name, licenseKey, expiresAt } = options;
    const recipientName = name || 'Creator';
    const expiryText = expiresAt
      ? new Date(expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : '7 Days from Activation';

    const downloadUrl = `${config.appBaseUrl}/assets/macos/Ravn-Universal.dmg`;
    const portalUrl = `${config.appBaseUrl}/activate.html`;

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Ravn 7-Day Free Trial</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #f1f5f9; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 30px auto; background: #111827; border: 1px solid #1f2937; border-radius: 18px; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5); }
    .header { background: linear-gradient(135deg, #064e3b 0%, #047857 50%, #059669 100%); padding: 36px 30px; text-align: center; border-bottom: 1px solid #059669; }
    .logo-badge { display: inline-flex; align-items: center; gap: 10px; font-size: 26px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px; }
    .subtitle { color: #a7f3d0; font-size: 14px; margin-top: 6px; font-weight: 500; }
    .content { padding: 32px 30px; }
    .greeting { font-size: 18px; font-weight: 700; color: #ffffff; margin-bottom: 12px; }
    .message { color: #94a3b8; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }
    .key-card { background: #0f172a; border: 1px solid #334155; border-radius: 14px; padding: 22px; text-align: center; margin: 24px 0; }
    .key-label { font-size: 11px; font-weight: 800; color: #34d399; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
    .key-box { font-family: 'SF Mono', Monaco, Menlo, 'Courier New', monospace; font-size: 14px; font-weight: 800; color: #34d399; word-break: break-all; background: #030712; padding: 14px 18px; border-radius: 8px; border: 1px dashed #059669; user-select: all; }
    .cta-row { text-align: center; margin: 30px 0 10px; }
    .btn-primary { display: inline-block; background: linear-gradient(135deg, #10b981, #059669); color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 800; font-size: 14px; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4); }
    .btn-secondary { display: inline-block; background: #1e293b; color: #cbd5e1 !important; text-decoration: none; padding: 12px 22px; border-radius: 10px; font-weight: 700; font-size: 13px; margin-left: 8px; border: 1px solid #334155; }
    .footer { background: #090d16; padding: 24px 30px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #1e293b; }
    .footer a { color: #34d399; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-badge">⚡ Ravn 7-Day Free Trial</div>
      <div class="subtitle">Full Accelerator Access Unlocked for 7 Days</div>
    </div>
    
    <div class="content">
      <div class="greeting">Hi ${recipientName},</div>
      <div class="message">
        Welcome to <strong>Ravn</strong>! Your 7-day full access trial key has been minted. You can now experience accelerated multi-segment downloads on your Mac.
      </div>

      <div class="key-card">
        <div class="key-label">Your 7-Day Trial License Key</div>
        <div class="key-box">${licenseKey}</div>
      </div>

      <div class="message" style="font-size: 13px; color: #94a3b8;">
        • <strong>Trial Expiry:</strong> ${expiryText}<br>
        • <strong>Includes:</strong> 16 parallel segments, 80 MB/s speed limit, and stream sniffer tools.
      </div>

      <div class="cta-row">
        <a href="${downloadUrl}" class="btn-primary">Download Ravn for macOS</a>
        <a href="${portalUrl}" class="btn-secondary">Open License Portal</a>
      </div>
    </div>

    <div class="footer">
      <p>Questions? Contact us at <a href="mailto:support@purrfectpal.studio">support@purrfectpal.studio</a></p>
      <p>© ${new Date().getFullYear()} Ravn by Purrfect Pal Studio. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;

    return this.sendMail({
      to: email,
      subject: '⚡ Your Ravn 7-Day Free Trial License Key',
      html: htmlContent,
      text: `Hi ${recipientName},\n\nYour Ravn 7-Day Free Trial License Key: ${licenseKey}\n\nExpires: ${expiryText}\n\nDownload Ravn for macOS: ${downloadUrl}\nLicense Portal: ${portalUrl}\n\nEnjoy!\n- Ravn Team`,
    });
  }

  /**
   * Internal sender helper with error suppression
   */
  private static async sendMail(options: { to: string; subject: string; html: string; text: string }): Promise<boolean> {
    const transporter = this.getTransporter();

    if (!transporter) {
      console.log(`[EmailService - DRY RUN] To: ${options.to} | Subject: ${options.subject}`);
      return false;
    }

    try {
      const info = await transporter.sendMail({
        from: config.email.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      console.log(`[EmailService] SUCCESS: Sent email to ${options.to} (MessageId: ${info.messageId})`);
      return true;
    } catch (err: any) {
      console.error(`[EmailService] ERROR sending email to ${options.to}:`, err.message);
      return false;
    }
  }
}
