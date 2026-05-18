const { Resend } = require('resend');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    })
  });
}

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM    = 'CourtDraw <hello@courtdraw.app>';
const APP_URL = process.env.PUBLIC_URL || 'https://courtdraw.app';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let email;
  try {
    ({ email } = JSON.parse(event.body || '{}'));
  } catch {
    return { statusCode: 400, body: 'Bad JSON' };
  }

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return { statusCode: 400, body: 'Missing or invalid email' };
  }

  // Always return 200 regardless of whether the account exists (security best practice)
  try {
    const resetLink = await admin.auth().generatePasswordResetLink(email.trim().toLowerCase());

    await resend.emails.send({
      from: FROM,
      to: email,
      subject: 'Reset your CourtDraw password',
      html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reset your password</title></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">
        <!-- Header -->
        <tr><td style="background:#1e3a5f;padding:28px 36px;text-align:center;">
          <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
            <tr>
              <td>
                <svg width="32" height="32" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;">
                  <rect width="28" height="28" rx="6" fill="#3b82f6"/>
                  <rect x="2" y="8.5" width="24" height="11" rx="1" fill="#1d4ed8"/>
                  <rect x="2" y="8.5" width="24" height="11" rx="1" stroke="white" stroke-width="0.9"/>
                  <line x1="14" y1="8.5" x2="14" y2="19.5" stroke="white" stroke-width="0.9"/>
                  <line x1="7.5" y1="9.8" x2="7.5" y2="18.2" stroke="white" stroke-width="0.75"/>
                  <line x1="20.5" y1="9.8" x2="20.5" y2="18.2" stroke="white" stroke-width="0.75"/>
                </svg>
              </td>
              <td style="padding-left:10px;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">CourtDraw</td>
            </tr>
          </table>
        </td></tr>
        <!-- Label chip -->
        <tr><td style="padding:32px 36px 0;text-align:center;">
          <span style="display:inline-block;background:rgba(59,130,246,0.15);color:#60a5fa;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:4px 14px;border-radius:20px;border:1px solid rgba(59,130,246,0.3);">Password reset</span>
        </td></tr>
        <!-- Title -->
        <tr><td style="padding:20px 36px 0;text-align:center;">
          <h1 style="margin:0;font-size:26px;font-weight:800;color:#f1f5f9;letter-spacing:-0.5px;">Forgot your password?</h1>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:16px 36px 0;text-align:center;">
          <p style="margin:0;font-size:15px;color:#94a3b8;line-height:1.65;">No worries — click the button below to set a new one. This link expires in 1 hour.</p>
        </td></tr>
        <!-- CTA -->
        <tr><td style="padding:32px 36px;text-align:center;">
          <a href="${resetLink}" style="display:inline-block;background:#3b82f6;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:10px;letter-spacing:-0.2px;">Reset my password →</a>
        </td></tr>
        <!-- Divider -->
        <tr><td style="padding:0 36px;"><hr style="border:none;border-top:1px solid #334155;margin:0;"></td></tr>
        <!-- Footer note -->
        <tr><td style="padding:24px 36px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#475569;line-height:1.6;">If you didn't request a password reset, you can safely ignore this email — your password won't change.<br><br>
          <a href="${APP_URL}" style="color:#3b82f6;text-decoration:none;">courtdraw.app</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
    });
  } catch (err) {
    // If the account doesn't exist, Firebase throws — we swallow it silently
    // to avoid leaking which emails are registered.
    if (err.code !== 'auth/user-not-found' && err.code !== 'auth/email-not-found') {
      console.error('send-reset-email error:', err.message);
    }
  }

  // Always return success (don't reveal whether the account exists)
  return {
    statusCode: 200,
    body: JSON.stringify({ sent: true })
  };
};
