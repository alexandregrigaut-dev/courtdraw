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

const FROM     = 'CourtDraw <hello@courtdraw.app>';
const REPLY_TO = 'hello@courtdraw.app';
const APP_URL  = process.env.PUBLIC_URL || 'https://courtdraw.app';

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
            Questions? Reply to this email or contact us at
            <a href="mailto:hello@courtdraw.app" style="color:#3b82f6;text-decoration:none;">hello@courtdraw.app</a>
          </p>
          <p style="margin:0;font-size:11px;color:#334155;">
            &copy; 2026 CourtDraw &middot; ${footerNote}
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// Strip HTML tags for the plain-text alternative.
// Sending only HTML with no text part is a strong spam signal.
function toPlainText({ title, body, ctaText, ctaUrl, features, footerNote }) {
  const bodyText = body
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<strong>(.*?)<\/strong>/gi, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const featureText = features
    ? '\n\n' + features.map(f => `  ${f.icon}  ${f.label}`).join('\n')
    : '';
  return [
    title,
    '─'.repeat(48),
    bodyText,
    featureText,
    '',
    `${ctaText}: ${ctaUrl}`,
    '',
    '─'.repeat(48),
    footerNote,
    'CourtDraw · hello@courtdraw.app',
  ].join('\n').trim();
}

// ─── Templates ────────────────────────────────────────────────────────────────

const templates = {

  welcome: (email) => {
    const data = {
      label: 'Account created',
      title: 'Welcome to CourtDraw',
      body: `Your account is ready. Start building your tactics library — draw plays, annotate courts, and save diagrams for every sport.`,
      ctaText: 'Open the app',
      ctaUrl: `${APP_URL}/courtdraw-app.html`,
      features: [
        { icon: '🏀', label: '38+ courts' },
        { icon: '✏️', label: 'Draw & annotate' },
        { icon: '📤', label: 'Export PNG' },
      ],
      footerNote: "You're receiving this because you created a CourtDraw account."
    };
    return {
      from: FROM,
      reply_to: REPLY_TO,
      to: email,
      subject: 'Welcome to CourtDraw',
      html: layout(data),
      text: toPlainText(data),
    };
  },

  paymentConfirmed: (email) => {
    const data = {
      label: 'Pro plan activated',
      labelColor: '#f59e0b',
      title: 'Your Pro subscription is active',
      body: `Every court, unlimited saves, multi-phase plays, and clean PNG exports are all unlocked. Go build something great.`,
      ctaText: 'Open the app',
      ctaUrl: `${APP_URL}/courtdraw-app.html`,
      features: [
        { icon: '🏟', label: '38+ courts' },
        { icon: '💾', label: 'Unlimited saves' },
        { icon: '📐', label: 'Multi-phase plays' },
      ],
      footerNote: "You're receiving this because you subscribed to CourtDraw Pro."
    };
    return {
      from: FROM,
      reply_to: REPLY_TO,
      to: email,
      subject: 'CourtDraw Pro is now active',
      html: layout(data),
      text: toPlainText(data),
    };
  },

  clubWelcome: (email) => {
    const data = {
      label: 'Club plan activated',
      labelColor: '#8b5cf6',
      title: 'Your CourtDraw Club is live',
      body: `All Pro features are unlocked, plus your shared team library, club branding on exports, and the coaching staff admin dashboard.<br><br>
             Head to Club Admin to set your club name and invite your coaches.`,
      ctaText: 'Open Club Admin',
      ctaUrl: `${APP_URL}/club-admin.html`,
      features: [
        { icon: '👥', label: 'Invite coaches' },
        { icon: '📚', label: 'Shared library' },
        { icon: '🏷', label: 'Club branding' },
      ],
      footerNote: "You're receiving this because you subscribed to CourtDraw Club."
    };
    return {
      from: FROM,
      reply_to: REPLY_TO,
      to: email,
      subject: 'Your CourtDraw Club is ready',
      html: layout(data),
      text: toPlainText(data),
    };
  },

  paymentFailed: (email) => {
    const data = {
      label: 'Payment failed',
      labelColor: '#ef4444',
      title: 'We could not process your payment',
      body: `Your Pro access is at risk. Please update your billing details to keep everything running — it only takes a moment.`,
      ctaText: 'Update billing',
      ctaUrl: `${APP_URL}/courtdraw-app.html`,
      footerNote: "You're receiving this because of a billing issue on your CourtDraw account."
    };
    return {
      from: FROM,
      reply_to: REPLY_TO,
      to: email,
      subject: 'CourtDraw — payment could not be processed',
      html: layout(data),
      text: toPlainText(data),
    };
  },

  cancellation: (email) => {
    const data = {
      label: 'Subscription cancelled',
      labelColor: '#64748b',
      title: 'Your subscription has been cancelled',
      body: `Your account is now on the Free plan. You will keep access to one court and up to 3 saved tactics.<br><br>
             Changed your mind? You can resubscribe at any time — all your saved tactics will still be there.`,
      ctaText: 'Resubscribe',
      ctaUrl: `${APP_URL}/#pricing`,
      footerNote: "You're receiving this because your CourtDraw subscription was cancelled."
    };
    return {
      from: FROM,
      reply_to: REPLY_TO,
      to: email,
      subject: 'Your CourtDraw subscription has been cancelled',
      html: layout(data),
      text: toPlainText(data),
    };
  },

  cancellationScheduled: (email, endDate, plan) => {
    const planName = plan === 'club' ? 'Club' : 'Pro';
    const data = {
      label: 'Cancellation confirmed',
      labelColor: '#64748b',
      title: 'Your cancellation is confirmed',
      body: `We have received your cancellation request. Your ${planName} access will remain active until <strong>${endDate}</strong>, after which your account will move to the Free plan.<br><br>
             Changed your mind? You can reactivate your subscription at any time before that date.`,
      ctaText: 'Manage subscription',
      ctaUrl: `${APP_URL}/courtdraw-app.html`,
      footerNote: `You're receiving this because you cancelled your CourtDraw ${planName} subscription.`
    };
    return {
      from: FROM,
      reply_to: REPLY_TO,
      to: email,
      subject: `Your CourtDraw ${planName} subscription will end soon`,
      html: layout(data),
      text: toPlainText(data),
    };
  },

  // Sent when a Pro trial checkout completes (no charge yet)
  proTrialStarted: (email) => {
    const data = {
      label: '3-day free trial started',
      labelColor: '#f59e0b',
      title: 'Your Pro trial has started',
      body: `You have 3 full days to explore every Pro feature — all 38+ courts, unlimited saves, multi-phase plays, clean PNG exports, video overlay, and the tactics library.<br><br>
             <strong>No charge until your trial ends.</strong> Cancel anytime before then and you won't be billed — no questions asked.<br><br>
             Head to the app and start building plays.`,
      ctaText: 'Open the app',
      ctaUrl: `${APP_URL}/courtdraw-app.html`,
      features: [
        { icon: '🏟', label: '38+ courts' },
        { icon: '💾', label: 'Unlimited saves' },
        { icon: '📐', label: 'Multi-phase plays' },
      ],
      footerNote: "You're receiving this because you started a CourtDraw Pro trial."
    };
    return {
      from: FROM,
      reply_to: REPLY_TO,
      to: email,
      subject: 'Your 3-day CourtDraw Pro trial has started',
      html: layout(data),
      text: toPlainText(data),
    };
  },

  // Sent when a Pro trial converts to a paid subscription (day 4 charge succeeds)
  proTrialConverted: (email) => {
    const data = {
      label: 'Pro plan active',
      labelColor: '#f59e0b',
      title: 'Your Pro subscription is now active',
      body: `Your 3-day trial is over and your Pro subscription is now active. All Pro features remain fully unlocked.<br><br>
             Manage your billing anytime from inside the app.`,
      ctaText: 'Open the app',
      ctaUrl: `${APP_URL}/courtdraw-app.html`,
      features: [
        { icon: '🏟', label: '38+ courts' },
        { icon: '💾', label: 'Unlimited saves' },
        { icon: '📐', label: 'Multi-phase plays' },
      ],
      footerNote: "You're receiving this because your CourtDraw Pro trial converted to a paid subscription."
    };
    return {
      from: FROM,
      reply_to: REPLY_TO,
      to: email,
      subject: 'CourtDraw Pro — your subscription is now active',
      html: layout(data),
      text: toPlainText(data),
    };
  },

  // Sent when a Club trial checkout completes (no charge yet)
  clubTrialStarted: (email) => {
    const data = {
      label: '7-day free trial started',
      labelColor: '#8b5cf6',
      title: 'Your Club trial has started',
      body: `You have 7 full days to explore every Club feature — shared tactic library, club branding on exports, presentation mode, and everything in Pro.<br><br>
             <strong>No charge until your trial ends.</strong> Cancel anytime before then and you won't be billed — no questions asked.<br><br>
             Head to Club Admin to set your club name and invite your coaches.`,
      ctaText: 'Open Club Admin',
      ctaUrl: `${APP_URL}/club-admin.html`,
      features: [
        { icon: '👥', label: 'Invite coaches' },
        { icon: '📚', label: 'Shared library' },
        { icon: '🏷', label: 'Club branding' },
      ],
      footerNote: "You're receiving this because you started a CourtDraw Club trial."
    };
    return {
      from: FROM,
      reply_to: REPLY_TO,
      to: email,
      subject: 'Your 7-day CourtDraw Club trial has started',
      html: layout(data),
      text: toPlainText(data),
    };
  },

  // Sent when a Club trial converts to a paid subscription (day 8 charge succeeds)
  clubTrialConverted: (email) => {
    const data = {
      label: 'Club plan active',
      labelColor: '#8b5cf6',
      title: 'Your Club subscription is now active',
      body: `Your 7-day trial is over and your annual Club subscription is now active. Your card has been charged €99/yr.<br><br>
             All Club features remain fully unlocked. Manage your billing anytime from the app.`,
      ctaText: 'Open Club Admin',
      ctaUrl: `${APP_URL}/club-admin.html`,
      features: [
        { icon: '👥', label: 'Invite coaches' },
        { icon: '📚', label: 'Shared library' },
        { icon: '🏷', label: 'Club branding' },
      ],
      footerNote: "You're receiving this because your CourtDraw Club trial converted to a paid subscription."
    };
    return {
      from: FROM,
      reply_to: REPLY_TO,
      to: email,
      subject: 'CourtDraw Club — your subscription is now active',
      html: layout(data),
      text: toPlainText(data),
    };
  }

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
