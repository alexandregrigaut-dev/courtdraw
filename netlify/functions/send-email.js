const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

// "from" must be a verified domain in Resend (courtdraw.app → verify in Resend dashboard)
const FROM = 'CourtDraw <hello@courtdraw.app>';
const APP_URL = process.env.PUBLIC_URL || 'https://courtdraw.app';

const templates = {
  welcome: (email) => ({
    from: FROM,
    to: email,
    subject: 'Welcome to CourtDraw 🏀',
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a1628;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a1628;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

        <!-- Logo -->
        <tr><td align="center" style="padding-bottom:32px;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-right:10px;vertical-align:middle;">
                <svg width="36" height="36" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="28" height="28" rx="6" fill="#3b82f6"/>
                  <rect x="2" y="8.5" width="24" height="11" rx="1" fill="#1d4ed8"/>
                  <rect x="2" y="8.5" width="24" height="11" rx="1" stroke="white" stroke-width="0.9"/>
                  <line x1="14" y1="8.5" x2="14" y2="19.5" stroke="white" stroke-width="0.9"/>
                  <line x1="7.5" y1="9.8" x2="7.5" y2="18.2" stroke="white" stroke-width="0.75"/>
                  <line x1="20.5" y1="9.8" x2="20.5" y2="18.2" stroke="white" stroke-width="0.75"/>
                  <line x1="2" y1="9.8" x2="26" y2="9.8" stroke="white" stroke-width="0.75"/>
                  <line x1="2" y1="18.2" x2="26" y2="18.2" stroke="white" stroke-width="0.75"/>
                  <line x1="7.5" y1="14" x2="20.5" y2="14" stroke="white" stroke-width="0.75"/>
                  <line x1="2" y1="14" x2="2.7" y2="14" stroke="white" stroke-width="0.75"/>
                  <line x1="26" y1="14" x2="25.3" y2="14" stroke="white" stroke-width="0.75"/>
                </svg>
              </td>
              <td style="vertical-align:middle;">
                <span style="font-size:22px;font-weight:800;color:#f1f5f9;letter-spacing:-0.03em;">CourtDraw</span>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:#0d1f3c;border:1px solid #1e3a5f;border-radius:16px;padding:40px 36px;">

          <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#3b82f6;">Account created</p>
          <h1 style="margin:0 0 16px;font-size:28px;font-weight:800;color:#f1f5f9;letter-spacing:-0.02em;line-height:1.2;">Welcome to CourtDraw!</h1>
          <p style="margin:0 0 28px;font-size:16px;line-height:1.6;color:#94a3b8;">
            Your account is ready. Start building your tactics library — draw plays, annotate courts, and save unlimited diagrams for every sport.
          </p>

          <!-- CTA Button -->
          <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
            <tr>
              <td style="background:#3b82f6;border-radius:10px;">
                <a href="${APP_URL}/courtdraw-app.html"
                   style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:-0.01em;">
                  Open the app →
                </a>
              </td>
            </tr>
          </table>

          <!-- Feature pills -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
            <tr>
              <td style="padding:10px 12px;background:#1a2d4a;border-radius:8px;width:30%;text-align:center;">
                <span style="font-size:20px;">🏀</span><br>
                <span style="font-size:12px;color:#94a3b8;font-weight:600;">37+ courts</span>
              </td>
              <td width="8"></td>
              <td style="padding:10px 12px;background:#1a2d4a;border-radius:8px;width:30%;text-align:center;">
                <span style="font-size:20px;">✏️</span><br>
                <span style="font-size:12px;color:#94a3b8;font-weight:600;">Draw & annotate</span>
              </td>
              <td width="8"></td>
              <td style="padding:10px 12px;background:#1a2d4a;border-radius:8px;width:30%;text-align:center;">
                <span style="font-size:20px;">📤</span><br>
                <span style="font-size:12px;color:#94a3b8;font-weight:600;">Export PNG</span>
              </td>
            </tr>
          </table>

        </td></tr>

        <!-- Footer -->
        <tr><td align="center" style="padding-top:28px;">
          <p style="margin:0 0 6px;font-size:12px;color:#475569;">
            Questions? Reply to this email or reach us at
            <a href="mailto:hello@courtdraw.app" style="color:#3b82f6;text-decoration:none;">hello@courtdraw.app</a>
          </p>
          <p style="margin:0;font-size:11px;color:#334155;">
            © 2026 CourtDraw · You're receiving this because you created an account.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
  }),
  paymentConfirmed: (email) => ({
    from: FROM,
    to: email,
    subject: 'You\'re now CourtDraw Pro 🎉',
    html: `
      <h1>Welcome to CourtDraw Pro!</h1>
      <p>Your subscription is active. All 37+ courts, unlimited saves, and clean PNG exports are now unlocked.</p>
      <p><a href="${APP_URL}/courtdraw-app.html">Open the app →</a></p>
    `
  }),
  clubWelcome: (email) => ({
    from: FROM,
    to: email,
    subject: 'Welcome to CourtDraw Club 🏟',
    html: `
      <h1>Welcome to CourtDraw Club!</h1>
      <p>Your Club plan is active. All Pro features are unlocked, plus your shared team library, club branding on exports, and the admin dashboard.</p>
      <p>Head to your Club Admin dashboard to set your club name and invite your coaching staff:</p>
      <p><a href="${APP_URL}/club-admin.html">Open Club Admin →</a></p>
      <p style="color:#666;font-size:12px;">Questions? Reply to this email or contact hello@courtdraw.app</p>
    `
  }),
  paymentFailed: (email) => ({
    from: FROM,
    to: email,
    subject: 'Action needed — CourtDraw payment issue',
    html: `
      <h1>We couldn't process your payment</h1>
      <p>Please update your billing details to keep your Pro access.</p>
      <p><a href="${APP_URL}/courtdraw-app.html">Open CourtDraw →</a></p>
      <p style="color:#666;font-size:12px;">Need help? Contact hello@courtdraw.app</p>
    `
  })
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { template, email } = JSON.parse(event.body);
  if (!templates[template]) return { statusCode: 400, body: 'Unknown template' };
  if (!email) return { statusCode: 400, body: 'Missing email' };

  try {
    await resend.emails.send(templates[template](email));
    return { statusCode: 200, body: JSON.stringify({ sent: true }) };
  } catch (err) {
    return { statusCode: 500, body: `Email error: ${err.message}` };
  }
};
