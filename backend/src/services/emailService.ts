import { Resend } from 'resend';

// Helper to check if running in production mode
const isProduction = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT === 'production';

// Startup Validation (Lazy, informative warning to avoid stalling container bootstrap but providing highly visible diagnostics)
export function validateEmailConfig(): { provider: 'Resend' | 'MockFallback'; apiKey?: string; fromEmail?: string } {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  
  if (!apiKey || !fromEmail) {
    const missing = [];
    if (!apiKey) missing.push('RESEND_API_KEY');
    if (!fromEmail) missing.push('RESEND_FROM_EMAIL');
    
    console.warn(`\n================================================================`);
    console.warn(`⚠️  [DoTalk Resend Service] Configuration Incomplete!`);
    console.warn(`Missing environment variables: ${missing.join(', ')}`);
    console.warn(`Emails will default to the sandbox simulator debug layout in development.`);
    console.warn(`================================================================\n`);
    
    return { provider: 'MockFallback' };
  }
  
  return { provider: 'Resend', apiKey, fromEmail };
}

// Perform a graceful module load alert
setTimeout(() => {
  try {
    validateEmailConfig();
  } catch (e) {
    // Avoid crude exceptions blocking load
  }
}, 1000);

export interface EmailDeliveryResult {
  success: boolean;
  provider: 'Resend' | 'MockFallback';
  messageId?: string;
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
 * Sends a secure, production-ready verification code OTP to user email using physical Resend SDK
 */
export async function sendVerificationEmail(
  email: string,
  otpCode: string,
  expiresMinutes: number = 5
): Promise<EmailDeliveryResult> {
  // Validate recipient format
  const recipientEmail = validateEmailAddress(email);

  // Validate configuration and check mode
  const { provider, apiKey, fromEmail } = validateEmailConfig();

  const fromName = process.env.SMTP_FROM_NAME || 'DoTalk Messenger';
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

  if (provider === 'MockFallback') {
    if (isProduction) {
      // In strict production, throw a precise error so deployment failure is visible
      throw new Error('Resend is not configured! Please specify RESEND_API_KEY and RESEND_FROM_EMAIL in your production environment variables.');
    }
    console.log(`\n=============================================================`);
    console.log(`[Email Service Sandbox Mock]`);
    console.log(`TO: ${recipientEmail}`);
    console.log(`CODE: ${otpCode} (Valid for ${expiresMinutes} mins)`);
    console.log(`=============================================================\n`);
    return { success: true, provider: 'MockFallback', messageId: 'mock_' + Math.random().toString(36).substring(7) };
  }

  // Attempt Resend delivery using SDK with built-in retry logic
  let attempt = 0;
  const maxRetries = 3;
  let lastError: any = null;

  while (attempt < maxRetries) {
    try {
      console.log(`[Resend SDK] Send attempt ${attempt + 1}/${maxRetries} to <${recipientEmail}> (via ${fromEmail})...`);
      const resend = new Resend(apiKey);
      const emailResponse = await resend.emails.send({
        from: `"${fromName}" <${fromEmail}>`,
        to: recipientEmail,
        subject: subjectText,
        text: plainText,
        html: htmlBody,
      });

      if (emailResponse.error) {
        throw new Error(emailResponse.error.message || JSON.stringify(emailResponse.error));
      }

      console.log(`[Resend SDK Success] Verification email successfully processed (ID: ${emailResponse.data?.id})`);
      return {
        success: true,
        provider: 'Resend',
        messageId: emailResponse.data?.id || undefined,
      };
    } catch (err: any) {
      lastError = err;
      attempt++;
      console.warn(`[Resend SDK Try ${attempt} Failed]: ${err.message || err}`);
      if (attempt < maxRetries) {
        const delay = 1000 * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`Resend email delivery failed after ${maxRetries} attempts. Last error: ${lastError?.message || lastError}`);
}

/**
 * Sends a generic testing email to verify Resend status (called from admin/developer routes)
 */
export async function sendTestEmail(recipientEmail: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const recipient = validateEmailAddress(recipientEmail);
    const { provider, apiKey, fromEmail } = validateEmailConfig();
    const fromName = process.env.SMTP_FROM_NAME || 'DoTalk Messenger';

    if (provider === 'MockFallback') {
      if (isProduction) {
        throw new Error('Resend is not configured! Please configure RESEND_API_KEY and RESEND_FROM_EMAIL.');
      }
      return { success: true, messageId: 'mock_test_id' };
    }

    const resend = new Resend(apiKey);
    const emailResponse = await resend.emails.send({
      from: `"${fromName}" <${fromEmail}>`,
      to: recipient,
      subject: 'Resend Integration Status Successful ✅',
      text: `Hello,\n\nYour production Resend API integration is fully functional and successfully configured!`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; padding: 20px; border: 1px solid #10b981; border-radius: 8px; background-color: #ecfdf5;">
          <h2 style="color: #065f46; margin-top: 0;">Resend HTTPS Setup Active 🎉</h2>
          <p style="color: #047857;">Web-API based email notifications are working perfectly over secure HTTPS port 443.</p>
          <hr style="border: 0; border-top: 1px solid #a7f3d0; margin: 15px 0;" />
          <ul style="font-size: 13px; color: #065f46; padding-left: 20px;">
            <li><strong>Provider:</strong> Resend REST SDK</li>
            <li><strong>Verified Sender:</strong> ${fromEmail}</li>
            <li><strong>Sender Display Name:</strong> ${fromName}</li>
          </ul>
        </div>
      `,
    });

    if (emailResponse.error) {
      throw new Error(emailResponse.error.message);
    }

    return { success: true, messageId: emailResponse.data?.id || undefined };
  } catch (err: any) {
    console.error('[Resend SDK Test Error] Failure sending test email:', err.message || err);
    return { success: false, error: err.message || err };
  }
}

/**
 * Compatibility wrapper to support legacy calls of sendOTPEmail
 */
export async function sendOTPEmail(email: string, otpCode: string, expiresMinutes: number = 5): Promise<boolean> {
  const result = await sendVerificationEmail(email, otpCode, expiresMinutes);
  return result.success;
}
