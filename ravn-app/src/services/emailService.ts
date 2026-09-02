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
        secure, // true for 465 (SSL), false for 587 (TLS)
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
   * Returns a plan tier badge styling & text
   */
  private static getPlanBadgeInfo(planType: string): { label: string; bg: string; color: string; border: string } {
    switch (planType?.toLowerCase()) {
      case 'lifetime':
      case 'ultra_lifetime':
        return { label: '👑 ULTRA LIFETIME', bg: 'rgba(168, 85, 247, 0.18)', color: '#c084fc', border: 'rgba(168, 85, 247, 0.35)' };
      case 'family':
      case 'family_pass':
        return { label: '👨‍👩‍👧‍👦 FAMILY PASS (5 MACS)', bg: 'rgba(236, 72, 153, 0.18)', color: '#f472b6', border: 'rgba(236, 72, 153, 0.35)' };
      case 'annual':
      case 'pro_annual':
        return { label: '⚡ ANNUAL PRO (BESTSELLER)', bg: 'rgba(16, 185, 129, 0.18)', color: '#34d399', border: 'rgba(16, 185, 129, 0.35)' };
      case 'trial':
        return { label: '⏱️ 7-DAY FREE TRIAL', bg: 'rgba(56, 189, 248, 0.18)', color: '#38bdf8', border: 'rgba(56, 189, 248, 0.35)' };
      case 'monthly':
      case 'pro_monthly':
      default:
        return { label: '🚀 PRO MONTHLY', bg: 'rgba(99, 102, 241, 0.18)', color: '#818cf8', border: 'rgba(99, 102, 241, 0.35)' };
    }
  }

  /**
   * Sends a receipt and cryptographic license delivery email after a successful purchase
   */
  static async sendPurchaseConfirmationEmail(options: SendPurchaseEmailOptions): Promise<boolean> {
    const { email, name, licenseKey, planType, maxDevices, expiresAt, amountPaid } = options;
    const recipientName = name || 'Ravn Creator';
    const readablePlan = this.formatPlanName(planType);
    const badge = this.getPlanBadgeInfo(planType);
    const expiryText = expiresAt
      ? new Date(expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : 'Lifetime Pass (Never Expires)';

    const downloadUrl = `${config.appBaseUrl}/assets/macos/Ravn-Universal.dmg`;
    const portalUrl = `${config.appBaseUrl}/activate.html`;
    const deepLinkUrl = `ravn://activate?key=${encodeURIComponent(licenseKey)}&email=${encodeURIComponent(email)}`;

    const htmlContent = `
<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta http-equiv="x-ua-compatible" content="ie=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Ravn License Key &amp; Order Confirmation</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; background-color: #07090e; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0; }
    .wrapper { width: 100%; table-layout: fixed; background-color: #07090e; padding-top: 30px; padding-bottom: 50px; }
    .main-table { max-width: 620px; margin: 0 auto; background-color: #0d121f; border-radius: 20px; overflow: hidden; border: 1px solid #1e293b; box-shadow: 0 25px 60px rgba(0, 0, 0, 0.7); }
    .header-td { background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%); padding: 44px 36px 36px; text-align: center; border-bottom: 1px solid rgba(99, 102, 241, 0.25); }
    .logo-container { display: inline-block; padding: 12px 24px; background: rgba(0, 0, 0, 0.45); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 50px; margin-bottom: 16px; }
    .logo-text { font-size: 22px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px; }
    .header-title { font-size: 24px; font-weight: 800; color: #ffffff; margin: 0 0 8px; letter-spacing: -0.4px; }
    .header-sub { font-size: 14px; color: #cbd5e1; margin: 0; line-height: 1.5; }
    .content-td { padding: 36px 36px 20px; }
    .greeting { font-size: 19px; font-weight: 700; color: #ffffff; margin-bottom: 14px; }
    .lead-text { font-size: 14.5px; color: #94a3b8; line-height: 1.65; margin-bottom: 28px; }
    
    /* Key Vault Box */
    .vault-card { background: linear-gradient(180deg, #101726 0%, #080c14 100%); border: 1px solid #2563eb; border-radius: 16px; padding: 26px 22px; text-align: center; margin-bottom: 30px; box-shadow: 0 0 35px rgba(37, 99, 235, 0.15); }
    .vault-tag { font-size: 11px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px; }
    .key-display { font-family: 'SF Mono', Monaco, Menlo, 'Courier New', monospace; font-size: 18px; font-weight: 900; color: #38bdf8; background: #030712; padding: 16px 20px; border-radius: 10px; border: 1px dashed #38bdf8; letter-spacing: 1px; word-break: break-all; margin-bottom: 16px; }
    
    /* 1-Click Action Button */
    .btn-deep-link { display: block; background: linear-gradient(135deg, #38bdf8 0%, #6366f1 100%); color: #ffffff !important; text-decoration: none; padding: 15px 28px; border-radius: 12px; font-weight: 800; font-size: 15px; text-align: center; box-shadow: 0 10px 25px rgba(99, 102, 241, 0.4); margin-bottom: 8px; }
    .btn-secondary { display: inline-block; background: #1e293b; color: #e2e8f0 !important; text-decoration: none; padding: 12px 22px; border-radius: 10px; font-weight: 700; font-size: 13.5px; border: 1px solid #334155; }
    
    /* Specs Table */
    .specs-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; background: #090e1a; border-radius: 14px; overflow: hidden; border: 1px solid #1e293b; }
    .specs-table td { padding: 13px 18px; font-size: 13.5px; border-bottom: 1px solid #151e2e; }
    .specs-table tr:last-child td { border-bottom: none; }
    .spec-label { color: #64748b; font-weight: 600; width: 42%; }
    .spec-value { color: #f8fafc; font-weight: 700; text-align: right; }
    
    /* Step Cards */
    .step-box { background: #090e1a; border: 1px solid #1e293b; border-radius: 14px; padding: 22px; margin-bottom: 30px; }
    .step-title { font-size: 14px; font-weight: 800; color: #ffffff; margin-bottom: 14px; }
    .step-item { display: flex; align-items: flex-start; margin-bottom: 12px; font-size: 13px; color: #cbd5e1; line-height: 1.55; }
    .step-num { display: inline-block; width: 22px; height: 22px; line-height: 22px; border-radius: 50%; background: #6366f1; color: #ffffff; font-weight: 800; text-align: center; font-size: 11px; margin-right: 12px; flex-shrink: 0; }
    
    /* Footer */
    .footer-td { background-color: #060910; padding: 30px 36px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #1e293b; line-height: 1.6; }
    .footer-link { color: #818cf8; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div class="wrapper">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center">
          <table role="presentation" class="main-table" width="100%" cellpadding="0" cellspacing="0" border="0">
            
            <!-- ── HERO HEADER ── -->
            <tr>
              <td class="header-td">
                <div class="logo-container">
                  <span class="logo-text">⚡️ RAVN</span>
                </div>
                <h1 class="header-title">License Key &amp; Order Receipt</h1>
                <p class="header-sub">Your high-speed gigabit download accelerator is ready for macOS</p>
              </td>
            </tr>

            <!-- ── CONTENT BODY ── -->
            <tr>
              <td class="content-td">
                <div class="greeting">Hi ${recipientName},</div>
                <div class="lead-text">
                  Thank you for your purchase! Your official cryptographic Ed25519 license key for <strong>${readablePlan}</strong> has been generated and securely registered to your email.
                </div>

                <!-- ── KEY VAULT CARD ── -->
                <div class="vault-card">
                  <div class="vault-tag">🔑 Your Cryptographic License Key</div>
                  <div class="key-display">${licenseKey}</div>
                  
                  <a href="${deepLinkUrl}" class="btn-deep-link">
                    ⚡️ 1-Click Activate in Ravn for Mac
                  </a>
                  <div style="font-size: 11.5px; color: #64748b; margin-top: 8px;">
                    Opens Ravn on your Mac and imports your license instantly.
                  </div>
                </div>

                <!-- ── SPECIFICATIONS TABLE ── -->
                <table class="specs-table" role="presentation">
                  <tr>
                    <td class="spec-label">Plan Tier</td>
                    <td class="spec-value">
                      <span style="display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 800; background: ${badge.bg}; color: ${badge.color}; border: 1px solid ${badge.border};">
                        ${badge.label}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td class="spec-label">Mac Devices Allowed</td>
                    <td class="spec-value">${maxDevices} Mac Seat${maxDevices > 1 ? 's' : ''}</td>
                  </tr>
                  <tr>
                    <td class="spec-label">Licensed Email</td>
                    <td class="spec-value">${email}</td>
                  </tr>
                  <tr>
                    <td class="spec-label">Access Duration</td>
                    <td class="spec-value">${expiryText}</td>
                  </tr>
                  ${amountPaid ? `<tr><td class="spec-label">Amount Billed</td><td class="spec-value" style="color: #34d399;">${amountPaid}</td></tr>` : ''}
                  <tr>
                    <td class="spec-label">Cryptography</td>
                    <td class="spec-value" style="font-size: 12px; color: #94a3b8;">Curve25519 / Ed25519 Asymmetric</td>
                  </tr>
                </table>

                <!-- ── 3-STEP QUICK START ── -->
                <div class="step-box">
                  <div class="step-title">🚀 Quick Start Guide (3 Easy Steps)</div>
                  
                  <div class="step-item">
                    <span class="step-num">1</span>
                    <div><strong>Download Ravn for macOS:</strong> Get the latest Apple Silicon &amp; Intel universal binary.</div>
                  </div>
                  
                  <div class="step-item">
                    <span class="step-num">2</span>
                    <div><strong>Open &amp; Activate:</strong> Click the "1-Click Activate" button above or paste your key into the Ravn app sidebar.</div>
                  </div>
                  
                  <div class="step-item" style="margin-bottom: 0;">
                    <span class="step-num">3</span>
                    <div><strong>Enjoy Pro Power:</strong> Unlock 48-segment downloads, VR converter, Media Studio, and theme studio.</div>
                  </div>
                </div>

                <!-- ── DOWNLOAD & PORTAL CTAS ── -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
                  <tr>
                    <td align="center" style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                      <a href="${downloadUrl}" class="btn-secondary">
                        📥 Download Ravn DMG
                      </a>
                      <a href="${portalUrl}" class="btn-secondary">
                        🌐 Manage Seats &amp; Devices
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- ── FOOTER ── -->
            <tr>
              <td class="footer-td">
                <p style="margin: 0 0 10px;">
                  Need assistance or have feedback? Contact us at <a href="mailto:support@purrfectpal.studio" class="footer-link">support@purrfectpal.studio</a>
                </p>
                <p style="margin: 0; font-size: 11.5px; color: #475569;">
                  © ${new Date().getFullYear()} Ravn by Purrfect Pal Studio. All rights reserved.<br>
                  You received this transactional email because you purchased a license for Ravn for macOS.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
    `;

    return this.sendMail({
      to: email,
      subject: `⚡️ Your Ravn License Key: ${readablePlan}`,
      html: htmlContent,
      text: `Hi ${recipientName},\n\nThank you for purchasing ${readablePlan}!\n\nYour Personal License Key:\n${licenseKey}\n\nSeats Allowed: ${maxDevices} Mac(s)\nDuration: ${expiryText}\n\n1-Click Mac Activation:\n${deepLinkUrl}\n\nDownload Ravn for macOS:\n${downloadUrl}\n\nManage Devices in Web Portal:\n${portalUrl}\n\nEnjoy high-speed downloads!\n— Ravn Team (support@purrfectpal.studio)`,
    });
  }

  /**
   * Sends a 7-day trial license email
   */
  static async sendTrialLicenseEmail(options: SendTrialEmailOptions): Promise<boolean> {
    const { email, name, licenseKey, expiresAt } = options;
    const recipientName = name || 'Ravn Creator';
    const expiryText = expiresAt
      ? new Date(expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : '7 Days from Activation';

    const downloadUrl = `${config.appBaseUrl}/assets/macos/Ravn-Universal.dmg`;
    const portalUrl = `${config.appBaseUrl}/activate.html`;
    const deepLinkUrl = `ravn://activate?key=${encodeURIComponent(licenseKey)}&email=${encodeURIComponent(email)}`;

    const htmlContent = `
<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta http-equiv="x-ua-compatible" content="ie=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Ravn 7-Day Free Trial License</title>
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; background-color: #07090e; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0; }
    .wrapper { width: 100%; table-layout: fixed; background-color: #07090e; padding-top: 30px; padding-bottom: 50px; }
    .main-table { max-width: 620px; margin: 0 auto; background-color: #0d121f; border-radius: 20px; overflow: hidden; border: 1px solid #1e293b; box-shadow: 0 25px 60px rgba(0, 0, 0, 0.7); }
    .header-td { background: linear-gradient(135deg, #022c22 0%, #064e3b 50%, #047857 100%); padding: 44px 36px 36px; text-align: center; border-bottom: 1px solid rgba(16, 185, 129, 0.3); }
    .logo-container { display: inline-block; padding: 12px 24px; background: rgba(0, 0, 0, 0.45); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 50px; margin-bottom: 16px; }
    .logo-text { font-size: 22px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px; }
    .header-title { font-size: 24px; font-weight: 800; color: #ffffff; margin: 0 0 8px; letter-spacing: -0.4px; }
    .header-sub { font-size: 14px; color: #a7f3d0; margin: 0; line-height: 1.5; }
    .content-td { padding: 36px 36px 20px; }
    .greeting { font-size: 19px; font-weight: 700; color: #ffffff; margin-bottom: 14px; }
    .lead-text { font-size: 14.5px; color: #94a3b8; line-height: 1.65; margin-bottom: 28px; }
    
    /* Key Vault Box */
    .vault-card { background: linear-gradient(180deg, #091717 0%, #050d0e 100%); border: 1px solid #059669; border-radius: 16px; padding: 26px 22px; text-align: center; margin-bottom: 30px; box-shadow: 0 0 35px rgba(16, 185, 129, 0.15); }
    .vault-tag { font-size: 11px; font-weight: 800; color: #34d399; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px; }
    .key-display { font-family: 'SF Mono', Monaco, Menlo, 'Courier New', monospace; font-size: 18px; font-weight: 900; color: #34d399; background: #030712; padding: 16px 20px; border-radius: 10px; border: 1px dashed #10b981; letter-spacing: 1px; word-break: break-all; margin-bottom: 16px; }
    
    /* 1-Click Action Button */
    .btn-deep-link { display: block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff !important; text-decoration: none; padding: 15px 28px; border-radius: 12px; font-weight: 800; font-size: 15px; text-align: center; box-shadow: 0 10px 25px rgba(16, 185, 129, 0.4); margin-bottom: 8px; }
    .btn-secondary { display: inline-block; background: #1e293b; color: #e2e8f0 !important; text-decoration: none; padding: 12px 22px; border-radius: 10px; font-weight: 700; font-size: 13.5px; border: 1px solid #334155; }
    
    /* Specs Table */
    .specs-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; background: #090e1a; border-radius: 14px; overflow: hidden; border: 1px solid #1e293b; }
    .specs-table td { padding: 13px 18px; font-size: 13.5px; border-bottom: 1px solid #151e2e; }
    .specs-table tr:last-child td { border-bottom: none; }
    .spec-label { color: #64748b; font-weight: 600; width: 42%; }
    .spec-value { color: #f8fafc; font-weight: 700; text-align: right; }
    
    /* Footer */
    .footer-td { background-color: #060910; padding: 30px 36px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #1e293b; line-height: 1.6; }
    .footer-link { color: #34d399; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div class="wrapper">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center">
          <table role="presentation" class="main-table" width="100%" cellpadding="0" cellspacing="0" border="0">
            
            <!-- ── HERO HEADER ── -->
            <tr>
              <td class="header-td">
                <div class="logo-container">
                  <span class="logo-text">⚡️ RAVN</span>
                </div>
                <h1 class="header-title">7-Day Free Trial Activated</h1>
                <p class="header-sub">Experience accelerated multi-segment downloads on macOS</p>
              </td>
            </tr>

            <!-- ── CONTENT BODY ── -->
            <tr>
              <td class="content-td">
                <div class="greeting">Hi ${recipientName},</div>
                <div class="lead-text">
                  Welcome to <strong>Ravn</strong>! Your 7-day full access trial license key has been minted and is ready to use on your Mac.
                </div>

                <!-- ── KEY VAULT CARD ── -->
                <div class="vault-card">
                  <div class="vault-tag">⏱️ Your 7-Day Trial License Key</div>
                  <div class="key-display">${licenseKey}</div>
                  
                  <a href="${deepLinkUrl}" class="btn-deep-link">
                    ⚡️ 1-Click Activate in Ravn for Mac
                  </a>
                  <div style="font-size: 11.5px; color: #64748b; margin-top: 8px;">
                    Opens Ravn on your Mac and activates your trial instantly.
                  </div>
                </div>

                <!-- ── SPECIFICATIONS TABLE ── -->
                <table class="specs-table" role="presentation">
                  <tr>
                    <td class="spec-label">Plan Tier</td>
                    <td class="spec-value">
                      <span style="display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 800; background: rgba(16, 185, 129, 0.18); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35);">
                        ⏱️ 7-DAY PRO TRIAL
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td class="spec-label">Trial Expiry</td>
                    <td class="spec-value">${expiryText}</td>
                  </tr>
                  <tr>
                    <td class="spec-label">Max Speed</td>
                    <td class="spec-value" style="color: #34d399;">80 MB/s (Pro Preview)</td>
                  </tr>
                  <tr>
                    <td class="spec-label">Parallel Segments</td>
                    <td class="spec-value">16 Connections / File</td>
                  </tr>
                  <tr>
                    <td class="spec-label">Features Included</td>
                    <td class="spec-value" style="font-size: 12px; color: #cbd5e1;">Media Studio, VR 3D, HLS Sniffer</td>
                  </tr>
                </table>

                <!-- ── DOWNLOAD & PORTAL CTAS ── -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
                  <tr>
                    <td align="center" style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                      <a href="${downloadUrl}" class="btn-secondary">
                        📥 Download Ravn DMG
                      </a>
                      <a href="${portalUrl}" class="btn-secondary">
                        🌐 Web License Portal
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- ── FOOTER ── -->
            <tr>
              <td class="footer-td">
                <p style="margin: 0 0 10px;">
                  Questions or feedback? Reach us at <a href="mailto:support@purrfectpal.studio" class="footer-link">support@purrfectpal.studio</a>
                </p>
                <p style="margin: 0; font-size: 11.5px; color: #475569;">
                  © ${new Date().getFullYear()} Ravn by Purrfect Pal Studio. All rights reserved.<br>
                  You received this email because a 7-day trial was requested with this email address.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
    `;

    return this.sendMail({
      to: email,
      subject: '⚡️ Your Ravn 7-Day Free Trial License Key',
      html: htmlContent,
      text: `Hi ${recipientName},\n\nWelcome to Ravn!\n\nYour 7-Day Free Trial License Key:\n${licenseKey}\n\nExpires: ${expiryText}\nIncludes: 16 parallel segments, 80 MB/s speed, Media Studio & VR Converter.\n\n1-Click Mac Activation:\n${deepLinkUrl}\n\nDownload Ravn for macOS:\n${downloadUrl}\n\nManage in Web Portal:\n${portalUrl}\n\nEnjoy!\n— Ravn Team (support@purrfectpal.studio)`,
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
