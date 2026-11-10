import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../config/logger';

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (transporter) return transporter;

  if (env.SMTP_USER && env.SMTP_PASS) {
    const cleanPass = env.SMTP_PASS.replace(/\s+/g, '');
    const isPort587 = Number(env.SMTP_PORT) === 587;
    const isPort465 = Number(env.SMTP_PORT) === 465;
    const isSecure = isPort465 || (!isPort587 && env.SMTP_SECURE);

    if (env.SMTP_HOST) {
      transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: isSecure,
        auth: {
          user: env.SMTP_USER,
          pass: cleanPass,
        },
      });
    } else {
      // Default to Gmail if SMTP_HOST is not specified
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: env.SMTP_USER,
          pass: cleanPass,
        },
      });
    }
  }

  return transporter;
}

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: SendMailOptions): Promise<{ success: boolean }> {
  const mailTransporter = getTransporter();

  if (!mailTransporter) {
    logger.warn(
      `[MAIL SERVICE] SMTP credentials not configured in .env. Email to <${options.to}> was simulated in console.`,
    );
    // eslint-disable-next-line no-console
    console.log('\n================================================================');
    // eslint-disable-next-line no-console
    console.log(`📧 [EMAIL SIMULATION]`);
    // eslint-disable-next-line no-console
    console.log(`To: ${options.to}`);
    // eslint-disable-next-line no-console
    console.log(`Subject: ${options.subject}`);
    // eslint-disable-next-line no-console
    console.log(`Content:\n${options.text || options.html}`);
    // eslint-disable-next-line no-console
    console.log('================================================================\n');
    return { success: true };
  }

  try {
    let fromAddress = env.EMAIL_FROM || env.SMTP_USER;
    if (fromAddress && !fromAddress.includes('@') && env.SMTP_USER) {
      fromAddress = `"${fromAddress}" <${env.SMTP_USER}>`;
    }

    const info = await mailTransporter.sendMail({
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
    logger.info({ messageId: info.messageId, to: options.to }, '[MAIL SERVICE] Email sent successfully');
    return { success: true };
  } catch (err: any) {
    logger.error({ err: err?.message, to: options.to }, '[MAIL SERVICE] Failed to send email via SMTP transport');
    // Still log fallback to console in dev mode so developer is not blocked
    // eslint-disable-next-line no-console
    console.log('\n================================================================');
    // eslint-disable-next-line no-console
    console.log(`⚠️ [EMAIL SMTP FAILED - FALLBACK CONSOLE OUTPUT]`);
    // eslint-disable-next-line no-console
    console.log(`To: ${options.to}`);
    // eslint-disable-next-line no-console
    console.log(`Subject: ${options.subject}`);
    // eslint-disable-next-line no-console
    console.log(`Content:\n${options.text || options.html}`);
    // eslint-disable-next-line no-console
    console.log('================================================================\n');
    return { success: false };
  }
}

export async function sendPasswordResetEmail(
  toEmail: string,
  resetUrl: string,
  userName = 'User',
): Promise<{ success: boolean }> {
  const subject = 'Reset Your Password - Sabir Plastic Store';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; margin: 0; padding: 20px; color: #334155; }
    .container { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
    .header { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 32px 24px; text-align: center; border-bottom: 2px solid #f59e0b; }
    .header h1 { color: #f8fafc; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
    .header p { color: #94a3b8; margin: 6px 0 0; font-size: 13px; }
    .content { padding: 32px 28px; line-height: 1.6; }
    .greeting { font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
    .text { font-size: 14px; color: #475569; margin-bottom: 24px; }
    .btn-wrap { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #0f172a !important; text-decoration: none; font-size: 15px; font-weight: 700; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 14px rgba(245, 158, 11, 0.4); }
    .btn:hover { background: #d97706; }
    .fallback { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-top: 24px; word-break: break-all; font-size: 12px; color: #64748b; }
    .fallback a { color: #2563eb; text-decoration: none; }
    .warning { font-size: 12px; color: #64748b; border-left: 3px solid #f59e0b; padding-left: 10px; margin-top: 24px; }
    .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Sabir Plastic Store</h1>
      <p>Enterprise Resource Planning (ERP)</p>
    </div>
    <div class="content">
      <div class="greeting">Hello ${userName},</div>
      <div class="text">
        We received a request to reset the password for your account. Click the button below to choose a new password.
      </div>
      <div class="btn-wrap">
        <a href="${resetUrl}" class="btn" target="_blank">Reset Password</a>
      </div>
      <div class="warning">
        <strong>Important:</strong> This password reset link is valid for <strong>1 hour</strong>. If you did not request this password reset, please ignore this email or contact your administrator immediately.
      </div>
      <div class="fallback">
        If the button above does not work, copy and paste this link into your web browser:<br>
        <a href="${resetUrl}">${resetUrl}</a>
      </div>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} Sabir Plastic Store. All rights reserved.<br>
      This is an automated system email. Please do not reply directly to this message.
    </div>
  </div>
</body>
</html>
  `;

  const text = `Hello ${userName},

We received a request to reset the password for your Sabir Plastic Store account.

Please visit the following link to reset your password:
${resetUrl}

This link is valid for 1 hour. If you did not request a password reset, you can safely ignore this email.

Sabir Plastic Store ERP`;

  return await sendEmail({
    to: toEmail,
    subject,
    html,
    text,
  });
}
