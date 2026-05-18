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

const FROM = 'CourtDraw <hello@courtdraw.app>';
const APP_URL = process.env.PUBLIC_URL || 'https://courtdraw.app';

// ─── Shared layout helpers ────────────────────────────────────────────────────

const LOGO_SVG = `
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
</svg>`;

function layout({ label, labelColor = '#3b82f6', title, body, ctaText, ctaUrl, features, footerNote }) {
  const featureBlock = features ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
      <tr>
        ${features.map(f => `
        <td style="padding:10px 12px;background:#1a2d4a;border-radius:8px;text-align:center;">
          <span style="font-size:20px;">${f.icon}</span><br>
          <span style="font-size:12px;color:#94a3b8;font-weight:600;">${f.label}</span>
        </td>`).join('<td width="8"></td>')}
      </tr>
    </table>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a1628;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a1628;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

        <!-- Logo -->
        <tr><td align="center" style="padding-bottom:32px;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="padding-right:10px;vertical-align:middle;">${LOGO_SVG}</td>
            <td style="vertical-align:middle;">
              <span style="font-size:22px;font-weight:800;color:#f1f5f9;letter-spacing:-0.03em;">CourtDraw</span>
            </td>
          </tr></table>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:#0d1f3c;border:1px solid #1e3a5f;border-radius:16px;padding:40px 36px;">
          <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${labelColor};">${label}</p>
          <h1 style="margin:0 0 16px;font-size:28px;font-weight:800;color:#f1f5f9;letter-spacing:-0.02em;line-height:1.2;">${title}</h1>
          <div style="font-size:16px;line-height:1.7;color:#94a3b8;">${body}</div>

          <!-- CTA Button -->
          <table cellpadding="0" cellspacing="0" style="margin-top:28px;">
            <tr>
              <td style="background:${labelColor};border-radius:10px;">
                <a href="${ctaUrl}"
                   style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:-0.01em;">
                  ${ctaText}
                </a>
              </td>
            </tr>
          </table>

          ${featureBlock}
        </td></tr>

        <!-- Footer -->
        <tr><td align="center" style="padding-top:28px;">
          <p style="margin:0 0 6px;font-size:12px;color:#475569;">
            Questions? Reply to this email or reach us at
            <a href="mailto:hello@courtdraw.app" style="color:#3b82f6;text-decoration:none;">hello@courtdraw.app</a>
          </p>
          <p style="margin:0;font-size:11px;color:#334155;">
            © 2026 CourtDraw · ${footerNote}
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Templates ────────────────────────────────────────────────────────────────

const templates = {

  welcome: (email) => ({
    from: FROM,
    to: email,
    subject: 'Welcome to CourtDraw 🏀',
    html: layout({
      label: 'Account created',
      title: 'Welcome to CourtDraw!',
      body: `Your account is ready. Start building your tactics library — draw plays, annotate courts, and save diagrams for every sport.`,
      ctaText: 'Open the app →',
      ctaUrl: `${APP_URL}/courtdraw-app.html`,
      features: [
        { icon: '🏀', label: '37+ courts' },
        { icon: '✏️', label: 'Draw & annotate' },
        { icon: '📤', label: 'Export PNG' },
      ],
      footerNote: "You're receiving this because you created an account."
    })
  }),

  paymentConfirmed: (email) => ({
    from: FROM,
    to: email,
    subject: "You're now CourtDraw Pro ✦",
    html: layout({
      label: 'Pro plan activated',
      labelColor: '#f59e0b',
      title: 'Welcome to Pro!',
      body: `Your subscription is now active. Every court, unlimited saves, multi-phase plays, and clean PNG exports are all unlocked — go build something great.`,
      ctaText: 'Open the app →',
      ctaUrl: `${APP_URL}/courtdraw-app.html`,
      features: [
        { icon: '🏟', label: '37+ courts' },
        { icon: '💾', label: 'Unlimited saves' },
        { icon: '📐', label: 'Multi-phase plays' },
      ],
      footerNote: "You're receiving this because you subscribed to CourtDraw Pro."
    })
  }),

  clubWelcome: (email) => ({
    from: FROM,
    to: email,
    subject: 'CourtDraw Club is ready 🏟',
    html: layout({
      label: 'Club plan activated',
      labelColor: '#8b5cf6',
      title: 'Your club is live!',
      body: `All Pro features are unlocked, plus your shared team library, club branding on exports, and the coaching staff admin dashboard.<br><br>
             Head to Club Admin to set your club name and invite your coaches.`,
      ctaText: 'Open Club Admin →',
      ctaUrl: `${APP_URL}/club-admin.html`,
      features: [
        { icon: '👥', label: 'Invite coaches' },
        { icon: '📚', label: 'Shared library' },
        { icon: '🏷', label: 'Club branding' },
      ],
      footerNote: "You're receiving this because you subscribed to CourtDraw Club."
    })
  }),

  paymentFailed: (email) => ({
    from: FROM,
    to: email,
    subject: 'Action needed — payment issue ⚠️',
    html: layout({
      label: 'Payment failed',
      labelColor: '#ef4444',
      title: "We couldn't process your payment.",
      body: `Your Pro access is at risk. Please update your billing details to keep everything running — it only takes a moment.`,
      ctaText: 'Update billing →',
      ctaUrl: `${APP_URL}/courtdraw-app.html`,
      footerNote: "You're receiving this because of a billing issue on your CourtDraw account."
    })
  }),

  cancellation: (email) => ({
    from: FROM,
    to: email,
    subject: 'Your CourtDraw subscription has been cancelled',
    html: layout({
      label: 'Subscription cancelled',
      labelColor: '#64748b',
      title: "You've been downgraded to Free.",
      body: `Your subscription has been cancelled and your account is now on the Free plan. You'll keep access to one court of your choice and up to 3 saved tactics.<br><br>
             Changed your mind? You can resubscribe at any time — all your saved tactics will still be there.`,
      ctaText: 'Resubscribe →',
      ctaUrl: `${APP_URL}/#pricing`,
      footerNote: "You're receiving this because your CourtDraw subscription was cancelled."
    })
  }),

  cancellationScheduled: (email, endDate) => ({
    from: FROM,
    to: email,
    subject: 'Your CourtDraw subscription will end soon',
    html: layout({
      label: 'Cancellation confirmed',
      labelColor: '#64748b',
      title: 'Your cancellation is confirmed.',
      body: `We've received your cancellation request. Your Pro access will remain active until <strong>${endDate}</strong>, after which your account will move to the Free plan.<br><br>
             Changed your mind? You can reactivate your subscription at any time before that date — just log in and visit billing.`,
      ctaText: 'Reactivate subscription →',
      ctaUrl: `${APP_URL}/courtdraw-app.html`,
      footerNote: "You're receiving this because you cancelled your CourtDraw subscription."
    })
  })

};

// ─── Handler ──────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Auth: accept either an internal shared secret (server-to-server calls from webhook.js)
  // or a valid Firebase ID token (client-side calls, restricted to the 'welcome' template only).
  const secret = process.env.INTERNAL_SECRET;
  const hasValidSecret = secret && event.headers['x-internal-secret'] === secret;

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, body: 'Bad JSON' }; }
  const { template, email, templateData } = body;
  if (!templates[template]) return { statusCode: 400, body: 'Unknown template' };
  if (!email) return { statusCode: 400, body: 'Missing email' };

  if (!hasValidSecret) {
    // Fallback: require a valid Firebase ID token for client-side calls,
    // and restrict to the 'welcome' template only to prevent abuse.
    if (template !== 'welcome') return { statusCode: 401, body: 'Unauthorized' };
    const authHeader = event.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return { statusCode: 401, body: 'Unauthorized' };
    try { await admin.auth().verifyIdToken(idToken); }
    catch { return { statusCode: 401, body: 'Invalid token' }; }
  }

  try {
    await resend.emails.send(templates[template](email, ...(templateData ? Object.values(templateData) : [])));
    return { statusCode: 200, body: JSON.stringify({ sent: true }) };
  } catch (err) {
    return { statusCode: 500, body: `Email error: ${err.message}` };
  }
};
