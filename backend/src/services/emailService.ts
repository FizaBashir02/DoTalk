import nodemailer from 'nodemailer';
import dns from 'dns';

// Ensure DNS lookup prefers IPv4 globally to circumvent ENETUNREACH IPv6 routing errors on platforms like Railway
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

export interface EmailDeliveryResult {
  success: boolean;
  provider: 'SMTP';
  messageId?: string;
}

/**
 * Validates the email configuration BEFORE attempting to send any email.
 */
export function validateEmailConfig(): { provider: 'SMTP' } {
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = process.env.SMTP_PORT || '587';
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || smtpUser;

  const missingParts: string[] = [];
  if (!smtpHost) missingParts.push('SMTP_HOST');
  if (!smtpPort) missingParts.push('SMTP_PORT');
  if (!smtpUser) missingParts.push('SMTP_USER');
  if (!smtpPass) missingParts.push('SMTP_PASS');
  if (!smtpFrom) missingParts.push('SMTP_FROM');

  if (missingParts.length > 0) {
    const errorMsg = `SMTP configuration is incomplete. Please configure missing environment secrets: ${missingParts.join(', ')}`;
    console.error(`[Email Service Config Error] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  return { provider: 'SMTP' };
}

/**
 * Validates format of email recipient
 */
export function validateEmailAddress(email: string): string {
  const emailTrimmed = email.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailTrimmed)) {
    const invalidEmailMsg = `Invalid Email Address Format: "${email}" is not valid.`;
    console.error(`[Email Service Input Error] ${invalidEmailMsg}`);
    throw new Error(invalidEmailMsg);
  }
  return emailTrimmed;
}

/**
 * Helper to build high-compatibility Nodemailer transport with forced IPv4
 */
function createSmtpTransporter(host: string, port: number, secure: boolean, user: string, pass: string) {
  return nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: port === 587,
    auth: {
      user,
      pass
    },
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 10000, // 10 seconds timeout
    greetingTimeout: 10000,
    socketTimeout: 15000,
    family: 4, // Natively direct nodemailer to prefer IPv4 sockets
    // Localized DNS lookup overrides for this SMTP connection ONLY - leaves other services untouched and clean!
    lookup: (hostname: string, options: any, callback: any) => {
      dns.lookup(hostname, { family: 4 }, callback);
    }
  } as any);
}

/**
 * Sends a secure, production-ready verification code OTP to user email with dynamic dual-port fallback resilience
 */
export async function sendVerificationEmail(
  email: string,
  otpCode: string,
  expiresMinutes: number = 5
): Promise<EmailDeliveryResult> {
  // 1. Ensure SMTP config is fully verified
  validateEmailConfig();

  // 2. Validate email recipient address
  const recipientEmail = validateEmailAddress(email);

  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const smtpUser = process.env.SMTP_USER!;
  const smtpPass = process.env.SMTP_PASS!;
  const smtpFrom = process.env.SMTP_FROM || smtpUser;
  // If SMTP_SECURE is explicitly "true", use secure connection. Otherwise, if port is 465, use secure. Otherwise false (e.g. for 587 STARTTLS).
  const smtpSecure = process.env.SMTP_SECURE === 'true' || (smtpPort === 465);

  const subjectText = 'Your DoTalk Verification Code';
  const plainText = `Hello,\n\nYour DoTalk verification code is:\n\n${otpCode}\n\nThis code expires in ${expiresMinutes} minutes.\n\nIf you did not request this, please ignore this email.`;
  
  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <div style="margin-bottom: 20px;">
        <h2 style="font-size: 20px; font-weight: 700; color: #1e293b; margin: 0;">Your DoTalk Verification Code</h2>
      </div>
      <div style="font-size: 15px; color: #334155; line-height: 1.6;">
        <p>Hello,</p>
        <p>Your verification code is:</p>
        <div style="margin: 24px 0; text-align: center; padding: 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
          <span style="font-size: 32px; font-weight: 800; letter-spacing: 4px; color: #1e293b; font-family: monospace;">${otpCode}</span>
        </div>
        <p>This code expires in <strong>${expiresMinutes} minutes</strong>.</p>
        <p style="color: #64748b; font-size: 13px; margin-top: 24px;">If you did not request this code, please ignore this email.</p>
      </div>
    </div>
  `;

  console.log(`[Email Service] SMTP SMTP Attempt: Sending verification code to <${recipientEmail}> via ${smtpHost}:${smtpPort} (Secure SSL/TLS: ${smtpSecure})`);

  // Attempt 1: primary configuration
  try {
    const transporter = createSmtpTransporter(smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass);
    const info = await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'DoTalk Verification'}" <${smtpFrom}>`,
      to: recipientEmail,
      subject: subjectText,
      text: plainText,
      html: htmlBody
    });

    console.log(`[Email Service Success] Successfully delivered message to ${recipientEmail} on main port ${smtpPort} (ID: ${info.messageId})`);
    return {
      success: true,
      provider: 'SMTP',
      messageId: info.messageId
    };
  } catch (primaryErr: any) {
    console.warn(`[Email Service SMTP Warning] Main delivery attempt on port ${smtpPort} failed: ${primaryErr.message}`);
    
    // Fallback: If port 465 failed, try port 587 (STARTTLS). If port 587 failed, try port 465.
    const fallbackPort = smtpPort === 465 ? 587 : 465;
    const fallbackSecure = fallbackPort === 465;
    
    console.log(`[Email Service Fallback] Initiating automated fallback SMTP attempt to <${recipientEmail}> via ${smtpHost}:${fallbackPort} (Secure: ${fallbackSecure})`);
    
    try {
      const fallbackTransporter = createSmtpTransporter(smtpHost, fallbackPort, fallbackSecure, smtpUser, smtpPass);
      const info = await fallbackTransporter.sendMail({
        from: `"${process.env.SMTP_FROM_NAME || 'DoTalk Verification'}" <${smtpFrom}>`,
        to: recipientEmail,
        subject: subjectText,
        text: plainText,
        html: htmlBody
      });
      
      console.log(`[Email Service Success] Fallback delivered message perfectly to ${recipientEmail} on port ${fallbackPort}! (ID: ${info.messageId})`);
      return {
        success: true,
        provider: 'SMTP',
        messageId: info.messageId
      };
    } catch (fallbackErr: any) {
      console.error(`[Email Service SMTP Error] Both primary port ${smtpPort} and fallback port ${fallbackPort} failed!`);
      console.error(`  - Primary Error: ${primaryErr.message}`);
      console.error(`  - Fallback Error: ${fallbackErr.message}`);
      console.error(`[Email Service SMTP Diagnostics] Host: ${smtpHost} | User: ${smtpUser}`);
      throw new Error(`SMTP sending failed: ${primaryErr.message} (Fallback failed: ${fallbackErr.message})`);
    }
  }
}

/**
 * Sends a general high-reliability test email (useful for dev verification) with dynamic dual-port fallback resilience
 */
export async function sendTestEmail(recipientEmail: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    validateEmailConfig();
    const cleanIn = validateEmailAddress(recipientEmail);
    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
    const smtpUser = process.env.SMTP_USER!;
    const smtpPass = process.env.SMTP_PASS!;
    const smtpFrom = process.env.SMTP_FROM || smtpUser;
    const smtpSecure = process.env.SMTP_SECURE === 'true' || (smtpPort === 465);

    const subject = 'SMTP Integration Connection Test Successful ✅';
    const text = `Hello,\n\nYour SMTP email delivery integration works perfectly with dynamic dual-port fallback and forced IPv4!`;
    const getHtml = (activePort: number, activeSecure: boolean) => `
      <div style="font-family: sans-serif; max-width: 500px; padding: 20px; border: 1px solid #10b981; border-radius: 8px; background-color: #ecfdf5;">
        <h2 style="color: #065f46; margin-top: 0;">SMTP Test Successful 🎉</h2>
        <p style="color: #047857;">Your Node.js background mail delivery is successfully configured and working with high-availability fallback.</p>
        <hr style="border: 0; border-top: 1px solid #a7f3d0; margin: 15px 0;" />
        <ul style="font-size: 13px; color: #065f46; padding-left: 20px;">
          <li><strong>SMTP Server:</strong> ${smtpHost}:${activePort}</li>
          <li><strong>Forced IPv4:</strong> Enabled (family 4)</li>
          <li><strong>TLS Secure Connection:</strong> ${activeSecure}</li>
          <li><strong>Authenticating Account:</strong> ${smtpUser}</li>
        </ul>
      </div>
    `;

    try {
      const transporter = createSmtpTransporter(smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass);
      const info = await transporter.sendMail({
        from: `SMTP Test <${smtpFrom}>`,
        to: cleanIn,
        subject,
        text,
        html: getHtml(smtpPort, smtpSecure)
      });
      return { success: true, messageId: info.messageId };
    } catch (primaryErr: any) {
      console.warn(`[Email Service Test SMTP Warning] Main attempt failed: ${primaryErr.message}. Trying fallback...`);
      const fallbackPort = smtpPort === 465 ? 587 : 465;
      const fallbackSecure = fallbackPort === 465;

      const fallbackTransporter = createSmtpTransporter(smtpHost, fallbackPort, fallbackSecure, smtpUser, smtpPass);
      const info = await fallbackTransporter.sendMail({
        from: `SMTP Test <${smtpFrom}>`,
        to: cleanIn,
        subject,
        text,
        html: getHtml(fallbackPort, fallbackSecure)
      });
      return { success: true, messageId: info.messageId };
    }
  } catch (err: any) {
    console.error(`[Email Service Test SMTP Error] Delivery failed on both primary and fallback ports:`, err);
    return { success: false, error: err.message };
  }
}

/**
 * Compatibility wrapper to support legacy calls of sendOTPEmail
 */
export async function sendOTPEmail(email: string, otpCode: string, expiresMinutes: number = 5): Promise<boolean> {
  const result = await sendVerificationEmail(email, otpCode, expiresMinutes);
  return result.success;
}
