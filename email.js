const nodemailer = require('nodemailer');

// Transport config — reads from .env
// For production: use SMTP (Gmail, SendGrid, AWS SES, etc.)
// For testing: logs emails to console if no SMTP configured
function createTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user, pass },
    });
  }

  // Gmail shorthand
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });
  }

  // Fallback: console transport (dev mode)
  return {
    sendMail: async (opts) => {
      console.log('\n📧 [DEV EMAIL — would send in production]');
      console.log('   To:', opts.to);
      console.log('   Subject:', opts.subject);
      console.log('   Link:', opts.text?.match(/https?:\/\/\S+/)?.[0] || '(see html)');
      console.log('');
      return { messageId: 'dev-' + Date.now() };
    }
  };
}

const FROM_NAME = process.env.EMAIL_FROM_NAME || 'InvestOS — JJ Family Office';
const FROM_ADDR = process.env.EMAIL_FROM || 'noreply@jjfo.com';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

async function sendInviteEmail({ to, name, inviterName, token, permissions }) {
  const transport = createTransport();
  const acceptUrl = `${APP_URL}/accept-invite?token=${token}`;

  const permList = Object.entries(permissions || {})
    .filter(([, v]) => v)
    .map(([k]) => k.charAt(0).toUpperCase() + k.slice(1))
    .join(', ') || 'No asset classes assigned yet';

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Helvetica Neue', Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 20px;">
  <div style="max-width: 520px; margin: 40px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <div style="background: #0a0e1a; padding: 28px 32px; text-align: center;">
      <div style="display: inline-flex; align-items: center; gap: 10px;">
        <div style="width: 32px; height: 32px; background: #3b82f6; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center;">
          <span style="color: white; font-size: 18px; font-weight: bold;">⟁</span>
        </div>
        <span style="color: white; font-size: 20px; font-weight: 600; letter-spacing: -0.02em;">InvestOS</span>
      </div>
      <div style="color: #555; font-size: 12px; margin-top: 4px; letter-spacing: 0.08em;">JJ FAMILY OFFICE PLATFORM</div>
    </div>

    <div style="padding: 36px 32px;">
      <h2 style="color: #111; font-size: 20px; font-weight: 600; margin: 0 0 8px;">You've been invited</h2>
      <p style="color: #666; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
        Hi ${name || 'there'},<br><br>
        <strong>${inviterName || 'The Admin'}</strong> has invited you to access the 
        <strong>JJ Family Office Investment Platform</strong>.
      </p>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px 20px; margin-bottom: 28px;">
        <div style="color: #888; font-size: 11px; letter-spacing: 0.08em; margin-bottom: 8px;">YOUR ACCESS</div>
        <div style="color: #333; font-size: 14px;"><strong>Email:</strong> ${to}</div>
        <div style="color: #333; font-size: 14px; margin-top: 4px;"><strong>Access to:</strong> ${permList}</div>
      </div>

      <a href="${acceptUrl}" style="display: block; background: #3b82f6; color: white; text-align: center; padding: 14px 24px; border-radius: 6px; text-decoration: none; font-size: 15px; font-weight: 500; margin-bottom: 20px;">
        Accept Invitation &amp; Set Password →
      </a>

      <p style="color: #999; font-size: 13px; line-height: 1.6; margin: 0;">
        This invitation link expires in <strong>48 hours</strong>. 
        If you did not expect this invitation, you can safely ignore this email.
      </p>
    </div>

    <div style="background: #f8fafc; padding: 16px 32px; border-top: 1px solid #eee;">
      <p style="color: #bbb; font-size: 12px; margin: 0;">
        If the button doesn't work, copy this link:<br>
        <a href="${acceptUrl}" style="color: #3b82f6; word-break: break-all;">${acceptUrl}</a>
      </p>
    </div>
  </div>
</body>
</html>`;

  await transport.sendMail({
    from: `"${FROM_NAME}" <${FROM_ADDR}>`,
    to,
    subject: `You've been invited to InvestOS — JJ Family Office`,
    text: `Hi ${name},\n\nYou've been invited to access the JJ Family Office Investment Platform.\n\nAccept your invitation here:\n${acceptUrl}\n\nThis link expires in 48 hours.`,
    html,
  });
}

async function sendPasswordResetEmail({ to, name, token }) {
  const transport = createTransport();
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;

  await transport.sendMail({
    from: `"${FROM_NAME}" <${FROM_ADDR}>`,
    to,
    subject: 'InvestOS — Password Reset Request',
    text: `Hi ${name},\n\nReset your password here:\n${resetUrl}\n\nThis link expires in 1 hour.`,
    html: `<p>Hi ${name},</p><p><a href="${resetUrl}">Reset your password</a></p><p>Link expires in 1 hour.</p>`,
  });
}

module.exports = { sendInviteEmail, sendPasswordResetEmail };
