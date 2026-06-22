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
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM;

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
 * Sends a secure, production-ready verification code OTP to user email
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

  const smtpHost = process.env.SMTP_HOST!;
  const smtpPort = parseInt(process.env.SMTP_PORT!, 10);
  const smtpUser = process.env.SMTP_USER!;
  const smtpPass = process.env.SMTP_PASS!;
  const smtpFrom = process.env.SMTP_FROM!;
  const smtpSecure = process.env.SMTP_SECURE === 'true';

  console.log(`[Email Service] Attempting to deliver live registration OTP to ${recipientEmail} via SMTP Server: ${smtpHost}:${smtpPort}`);

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

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPass
    },
    tls: {
      rejectUnauthorized: false
    },
    lookup: (hostname, options, callback) => {
      dns.lookup(hostname, Object.assign({}, options, { family: 4 }), callback);
    }
  } as any);

  try {
    const info = await transporter.sendMail({
      from: smtpFrom,
      to: recipientEmail,
      subject: subjectText,
      text: plainText,
      html: htmlBody
    });

    console.log(`[Email Service Success] Successfully delivered message to ${recipientEmail} (ID: ${info.messageId})`);
    return {
      success: true,
      provider: 'SMTP',
      messageId: info.messageId
    };
  } catch (err: any) {
    console.error(`[Email Service SMTP Error] Failed to send email to ${recipientEmail}: ${err.message}`);
    throw new Error(`SMTP sending failed: ${err.message}`);
  }
}

/**
 * Compatibility wrapper to support legacy calls of sendOTPEmail
 */
export async function sendOTPEmail(email: string, otpCode: string, expiresMinutes: number = 5): Promise<boolean> {
  const result = await sendVerificationEmail(email, otpCode, expiresMinutes);
  return result.success;
}
