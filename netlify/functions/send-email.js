const { Resend } = require('resend');
const admin = require('firebase-admin');
const crypto = require('crypto');

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

// ─── Unsubscribe links ─────────────────────────────────────────────────────────
// Every marketing email gets a signed, one-click unsubscribe link in its footer
// (and a List-Unsubscribe header for native Gmail/Outlook unsubscribe buttons).
// The signature is an HMAC over the recipient's email so links can't be forged
// or used to unsubscribe someone else. Verified server-side in unsubscribe.js.

const UNSUB_SECRET = process.env.INTERNAL_SECRET;

function signUnsubscribeToken(email) {
  return crypto.createHmac('sha256', UNSUB_SECRET || '').update(email).digest('hex').slice(0, 32);
}

function buildUnsubscribeUrl(email) {
  const normalized = String(email).trim().toLowerCase();
  const token = signUnsubscribeToken(normalized);
  return `${APP_URL}/api/unsubscribe?email=${encodeURIComponent(normalized)}&token=${token}`;
}

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

function layout({ label, labelColor = '#3b82f6', title, body, ctaText, ctaUrl, features, footerNote, unsubscribeUrl }) {
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
          <p style="margin:0 0 10px;font-size:11px;color:#334155;">
            &copy; 2026 CourtDraw &middot; ${footerNote}
          </p>
          <p style="margin:0;">
            <a href="${unsubscribeUrl}" style="font-size:11px;color:#64748b;text-decoration:underline;">Unsubscribe from these emails</a>
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
function toPlainText({ title, body, ctaText, ctaUrl, features, footerNote, unsubscribeUrl }) {
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
    '',
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join('\n').trim();
}

// Assembles the final Resend payload for a template: injects the signed
// unsubscribe link into the HTML/text footer and sets List-Unsubscribe
// headers so Gmail/Outlook/Yahoo show their native one-click unsubscribe button.
function buildEmail(email, subject, data) {
  const url = buildUnsubscribeUrl(email);
  const finalData = { ...data, unsubscribeUrl: url };
  return {
    from: FROM,
    reply_to: REPLY_TO,
    to: email,
    subject,
    html: layout(finalData),
    text: toPlainText(finalData),
    headers: {
      'List-Unsubscribe': `<mailto:${REPLY_TO}?subject=unsubscribe>, <${url}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
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
    return buildEmail(email, 'Welcome to CourtDraw', data);
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
    return buildEmail(email, 'CourtDraw Pro is now active', data);
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
    return buildEmail(email, 'Your CourtDraw Club is ready', data);
  },

  // Sent from the customer.subscription.trial_will_end webhook, 3 days out.
  // Stripe's built-in trial reminder is fixed at 7 days before trial end and
  // the trial is 7 days long, so its reminder lands on signup day and warns
  // nobody. This is the warning that actually arrives before the charge.
  // amountText is pre-formatted by the caller in the customer's own currency,
  // or empty when the price could not be read — checkout bills in five
  // currencies, so a guessed figure would be worse than none.
  trialEndingSoon: (email, endDate, amountText, planName) => {
    const charge = amountText
      ? `<strong>${amountText}</strong> will be charged on <strong>${endDate}</strong>.`
      : `Your subscription starts on <strong>${endDate}</strong>.`;
    const data = {
      label: 'Trial ending soon',
      labelColor: '#f59e0b',
      title: `Your ${planName} trial ends in 3 days`,
      body: `${charge}<br><br>
             Nothing to do if you want to keep going — it renews on its own and every play you have saved stays where it is.<br><br>
             If it is not for you, cancel before that date and you will not be charged.`,
      ctaText: 'Manage subscription',
      ctaUrl: `${APP_URL}/courtdraw-app.html?billing=1`,
      footerNote: "You're receiving this because your CourtDraw trial is ending soon."
    };
    return buildEmail(email, `Your CourtDraw ${planName} trial ends in 3 days`, data);
  },

  // ─── Dunning ────────────────────────────────────────────────────────────────
  // Three sends come out of one failing invoice: a notice on Stripe's second
  // and third attempts (differing by the retry date they name) and a final
  // notice once Stripe has stopped retrying. A middle template would only
  // repeat the notice, so there are two templates rather than three.
  //
  // Both name the plan from the user record. This used to be hardcoded to
  // "Pro" — and the great majority of revenue lost to failed payments has
  // been the €99 Club renewal, so the mail warning the highest-value
  // customers that their money was at risk named the wrong plan.
  //
  // Both also name the real amount. "Your €99 Club renewal did not go
  // through" is a sentence someone acts on; "your payment failed" is not.

  paymentFailed: (email, planName = 'Pro', amountText = '', retryDate = '') => {
    const amount = amountText ? `${amountText} ` : '';
    const nextTry = retryDate
      ? `We'll try again automatically on <strong>${retryDate}</strong>.`
      : `We'll try the card again automatically over the next few days.`;
    const data = {
      label: 'Payment failed',
      labelColor: '#ef4444',
      title: `We could not take your ${planName} payment`,
      body: `Your ${amount}${planName} renewal did not go through. That is usually an expired card or a bank limit rather than anything you did.<br><br>
             ${nextTry} If the card on file is out of date, updating it now is the quickest way to keep your account running.`,
      ctaText: 'Update card',
      // ?billing=1 opens the Stripe billing portal as soon as auth resolves.
      // Without it this button landed on the tactics board and left someone
      // whose card had just declined to find the account menu unaided.
      ctaUrl: `${APP_URL}/courtdraw-app.html?billing=1`,
      footerNote: "You're receiving this because of a billing issue on your CourtDraw account."
    };
    return buildEmail(email, `CourtDraw — your ${planName} payment did not go through`, data);
  },

  paymentFailedFinal: (email, planName = 'Pro', amountText = '') => {
    const amount = amountText ? `${amountText} ` : '';
    const data = {
      label: 'Final notice',
      labelColor: '#dc2626',
      title: 'Last attempt — the card was declined again',
      body: `That was the final automatic attempt at your ${amount}${planName} renewal, so no further retries are scheduled.<br><br>
             Your account will drop to the Free plan, which keeps one court and three saved tactics. <strong>Every play you have saved stays exactly where it is</strong> — putting a working card on file restores full access straight away, and nothing is lost in the meantime.`,
      ctaText: 'Update card and keep access',
      ctaUrl: `${APP_URL}/courtdraw-app.html?billing=1`,
      footerNote: "You're receiving this because the last payment on your CourtDraw account could not be collected."
    };
    return buildEmail(email, `Action needed — your CourtDraw ${planName} access is about to end`, data);
  },

  // Sent instead of 'cancellation' when Stripe ended the subscription itself
  // because the card kept failing. That is not a goodbye: the coach most
  // likely still wants the product and has a dead card, so the mail says what
  // actually happened rather than "sorry to see you go".
  //
  // The CTA goes to pricing, not the billing portal: Stripe has deleted the
  // subscription by this point, so there is nothing left in the portal to
  // update — they genuinely have to subscribe again.
  reactivateAfterFailure: (email, planName = 'Pro') => {
    const data = {
      label: 'Access paused',
      labelColor: '#f59e0b',
      title: 'Your plan has paused — the renewal could not be collected',
      body: `Your CourtDraw ${planName} subscription has ended because the renewal payment could not be taken, not because you cancelled.<br><br>
             Your account is on the Free plan for now: one court and three saved tactics. <strong>All of your saved plays are untouched</strong> and come straight back as soon as there is a working card on file.`,
      ctaText: `Restore ${planName}`,
      ctaUrl: `${APP_URL}/#pricing`,
      footerNote: "You're receiving this because your CourtDraw subscription ended after a failed payment."
    };
    return buildEmail(email, `Your CourtDraw ${planName} has paused — how to restore it`, data);
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
    return buildEmail(email, 'Your CourtDraw subscription has been cancelled', data);
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
    return buildEmail(email, `Your CourtDraw ${planName} subscription will end soon`, data);
  },

  // ── Anonymous email capture: first-visit welcome ─────────────────────────────
  anonWelcome: (email) => {
    const data = {
      label: 'Your play is saved',
      labelColor: '#22c55e',
      title: 'Create a free account to keep your plays',
      body: `You just drew your first play on CourtDraw. Nice work.<br><br>
             Create a free account and your plays sync across every device — phone, tablet, laptop. No more starting from scratch.<br><br>
             It takes 30 seconds and it's completely free.`,
      ctaText: 'Create my free account →',
      ctaUrl: `${APP_URL}/login.html?mode=register`,
      footerNote: "You're receiving this because you saved a play on CourtDraw."
    };
    return buildEmail(email, 'Your CourtDraw play is waiting for you', data);
  },

  // ── Drip email: Day 2 — Feature spotlight ───────────────────────────────────
  dripDay2: (email) => {
    const data = {
      label: 'Did you know?',
      labelColor: '#3b82f6',
      title: 'Your plays can come to life — step by step',
      body: `Most coaches draw their play once and call it done.<br><br>
             CourtDraw Pro lets you build it in <strong>phases</strong> — Phase 1 shows the initial positions, Phase 2 shows the first movement, Phase 3 shows the finish. Tap through them during a timeout so your players see exactly what to do.<br><br>
             There's also <strong>animated playback</strong> — hit play and watch the whole sequence run automatically.<br><br>
             Give it a try. Your first 7 days are free — no charge until day 8, cancel anytime.`,
      ctaText: 'Try Pro free for 7 days',
      ctaUrl: `${APP_URL}/#pricing`,
      features: [
        { icon: '📐', label: 'Phases' },
        { icon: '▶️',  label: 'Playback' },
        { icon: '🔗', label: 'Share link' },
      ],
      footerNote: "You're receiving this because you created a free CourtDraw account."
    };
    return buildEmail(email, 'Did you know CourtDraw can animate your plays?', data);
  },

  // ── Drip email: Day 5 — Urgency around save limit ────────────────────────────
  dripDay5: (email) => {
    const data = {
      label: 'You\'ve got 3 saves',
      labelColor: '#f59e0b',
      title: 'Coaches who upgraded say this changed their prep',
      body: `On the free plan you can save 3 plays. That fills up fast once you're building tactics for multiple opponents.<br><br>
             CourtDraw Pro gives you <strong>unlimited saves</strong> — every play, every sport, every opponent, organised in one place.<br><br>
             <strong>What coaches say after upgrading:</strong><br>
             <em>"I have a full library now — I load the right play in 10 seconds on the sideline."</em><br><br>
             Try Pro free for 7 days. No charge until day 8.`,
      ctaText: 'Start my 7-day free trial',
      ctaUrl: `${APP_URL}/#pricing`,
      features: [
        { icon: '💾', label: 'Unlimited saves' },
        { icon: '🏟', label: '38+ courts' },
        { icon: '📤', label: 'Clean exports' },
      ],
      footerNote: "You're receiving this because you created a free CourtDraw account."
    };
    return buildEmail(email, 'You\'ve got 3 saves — here\'s what coaches with Pro say', data);
  },

  // ── Drip email: Day 10 — Direct trial CTA ────────────────────────────────────
  dripDay10: (email) => {
    const data = {
      label: 'Your free trial is waiting',
      labelColor: '#10b981',
      title: 'Your 7-day Pro trial — no charge until day 8',
      body: `You've been using CourtDraw for a few days now. If you're serious about your coaching prep, Pro is worth trying.<br><br>
             <strong>Everything unlocked for 7 days — completely free:</strong><br>
             All 38+ courts, unlimited saves, phase animation, video overlay, clean PNG exports, 200+ play templates, and shareable board links.<br><br>
             Card required upfront. No charge until day 8. Cancel before then and you won't be billed — no questions asked.`,
      ctaText: 'Claim my free 7-day trial →',
      ctaUrl: `${APP_URL}/#pricing`,
      features: [
        { icon: '🏟', label: '38+ courts' },
        { icon: '💾', label: 'Unlimited saves' },
        { icon: '📹', label: 'Video overlay' },
      ],
      footerNote: "You're receiving this because you created a free CourtDraw account."
    };
    return buildEmail(email, 'Your 7-day CourtDraw Pro trial is waiting', data);
  },

  // Sent when a Pro trial checkout completes (no charge yet)
  proTrialStarted: (email) => {
    const data = {
      label: '7-day free trial started',
      labelColor: '#f59e0b',
      title: 'Your Pro trial has started',
      body: `You have 7 full days to explore every Pro feature — all 38+ courts, unlimited saves, multi-phase plays, clean PNG exports, video overlay, and the tactics library.<br><br>
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
    return buildEmail(email, 'Your 7-day CourtDraw Pro trial has started', data);
  },

  // Sent when a Pro trial converts to a paid subscription (day 8 charge succeeds)
  proTrialConverted: (email) => {
    const data = {
      label: 'Pro plan active',
      labelColor: '#f59e0b',
      title: 'Your Pro subscription is now active',
      body: `Your 7-day trial is over and your Pro subscription is now active. All Pro features remain fully unlocked.<br><br>
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
    return buildEmail(email, 'CourtDraw Pro — your subscription is now active', data);
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
    return buildEmail(email, 'Your 7-day CourtDraw Club trial has started', data);
  },

  // ── Weekly digest: Pro/Club user who saved plays last week ───────────────────
  weeklyDigestActive: (email, opts = {}) => {
    const { count = 1, spotlightName = 'Your latest play', spotlightSport = '', suggestionSport = null } = opts;
    const sportIcon = { Football: '⚽', Basketball: '🏀', Tennis: '🎾', Volleyball: '🏐', Handball: '🤾', Rugby: '🏉', 'American Football': '🏈', 'Ice Hockey': '🏒', Baseball: '⚾', Padel: '🏓', Pickleball: '🏓', Badminton: '🏸', Futsal: '⚽', Hockey: '🏑' };
    const icon = sportIcon[spotlightSport] || '📋';
    const suggestionLine = suggestionSport
      ? `<br><br>💡 <em>It's been a while since you drew a ${suggestionSport} play — your next session might be coming up.</em>`
      : '';
    const spotlight = `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border-radius:10px;background:#132238;border:1px solid #1e3a5f;overflow:hidden;">
        <tr>
          <td style="padding:16px 20px;vertical-align:middle;width:48px;font-size:28px;">${icon}</td>
          <td style="padding:16px 0 16px 4px;vertical-align:middle;">
            <div style="font-size:14px;font-weight:700;color:#f1f5f9;">${spotlightName}</div>
            <div style="font-size:12px;color:#64748b;margin-top:2px;">${spotlightSport}</div>
          </td>
          <td style="padding:16px 20px;vertical-align:middle;text-align:right;">
            <span style="font-size:11px;font-weight:700;color:#3b82f6;letter-spacing:0.05em;text-transform:uppercase;">Latest</span>
          </td>
        </tr>
      </table>`;
    const data = {
      label: 'Your week in CourtDraw',
      labelColor: '#3b82f6',
      title: `You saved ${count} ${count === 1 ? 'play' : 'plays'} this week`,
      body: `Good work. Here's your latest:${spotlight}Keep building — consistent prep is what separates good coaches from great ones.${suggestionLine}`,
      ctaText: 'Open the app →',
      ctaUrl: `${APP_URL}/courtdraw-app.html`,
      footerNote: "You're receiving this weekly digest because you have an active CourtDraw Pro subscription."
    };
    return buildEmail(email, `You saved ${count} ${count === 1 ? 'play' : 'plays'} this week — keep it up`, data);
  },

  // ── Weekly digest: Pro/Club user who saved nothing last week ─────────────────
  weeklyDigestLapsed: (email, opts = {}) => {
    const { lastPlayName = null, lastPlaySport = '', daysSince = null, suggestionSport = null } = opts;
    const sportIcon = { Football: '⚽', Basketball: '🏀', Tennis: '🎾', Volleyball: '🏐', Handball: '🤾', Rugby: '🏉', 'American Football': '🏈', 'Ice Hockey': '🏒', Baseball: '⚾', Padel: '🏓', Pickleball: '🏓', Badminton: '🏸', Futsal: '⚽', Hockey: '🏑' };
    const recapLine = lastPlayName
      ? `<br><br>Your last play was <strong>${lastPlayName}</strong>${lastPlaySport ? ` (${lastPlaySport})` : ''}${daysSince ? ` — ${daysSince} days ago` : ''}.`
      : '';
    const suggestionLine = suggestionSport
      ? `<br><br>💡 <em>You haven't drawn a ${suggestionSport} play in a while — if a session is coming up, now's a good time to prep.</em>`
      : '';
    const data = {
      label: 'Weekly check-in',
      labelColor: '#f59e0b',
      title: "Quiet week — what's on the schedule?",
      body: `No new plays saved last week.${recapLine}${suggestionLine}<br><br>Jump back in whenever you're ready — your library is waiting.`,
      ctaText: 'Open the app →',
      ctaUrl: `${APP_URL}/courtdraw-app.html`,
      footerNote: "You're receiving this weekly digest because you have an active CourtDraw Pro subscription."
    };
    return buildEmail(email, "Your CourtDraw plays are waiting — what's on this week?", data);
  },

  // ── Weekly digest: Free user re-engagement ───────────────────────────────────
  weeklyDigestFree: (email) => {
    const data = {
      label: 'Your saved plays',
      labelColor: '#3b82f6',
      title: 'Your 3 saves are waiting',
      body: `Your saved plays are ready whenever you need them — load one up and build on it before your next session.<br><br>
             On the free plan you get 3 saves. When you're ready to build a full library, Pro gives you unlimited saves, all 38+ courts, phase animation, and more. First 7 days are free.`,
      ctaText: 'Open the app →',
      ctaUrl: `${APP_URL}/courtdraw-app.html`,
      features: [
        { icon: '💾', label: 'Unlimited saves' },
        { icon: '🏟', label: '38+ courts' },
        { icon: '📐', label: 'Phase animation' },
      ],
      footerNote: "You're receiving this because you have a CourtDraw account."
    };
    return buildEmail(email, 'Your CourtDraw plays are waiting', data);
  },

  // ── Re-engagement: Email 1 — zero sessions, Pro/Club user ───────────────────
  reengageEmptySessionsPaid: (email) => {
    const data = {
      label: 'Training Sessions',
      labelColor: '#3b82f6',
      title: 'Chain 3 plays into a session plan',
      body: `You've been saving plays — now put them to work in a session.<br><br>
             In the app, tap <strong>Sessions</strong>, pick 3 plays from your library, set drill durations, and you'll have a full training plan ready to present on the sideline.<br><br>
             Your players will know exactly what's coming — no re-explaining between drills.`,
      ctaText: 'Start a session →',
      ctaUrl: `${APP_URL}/courtdraw-app.html#sessions`,
      features: [
        { icon: '📅', label: 'Session plans' },
        { icon: '▶️', label: 'Present mode' },
        { icon: '📤', label: 'PDF export' },
      ],
      footerNote: "You're receiving this because you have a CourtDraw account."
    };
    return buildEmail(email, 'Chain your plays into a session plan', data);
  },

  // ── Re-engagement: Email 1 — zero sessions, Free user (upsell) ──────────────
  reengageEmptySessionsFree: (email) => {
    const data = {
      label: 'Training Sessions',
      labelColor: '#3b82f6',
      title: 'Chain 3 plays into a session plan',
      body: `Session planning is one of the most-used Pro features — coaches chain 3–8 plays into a structured training plan, set drill durations, and present the whole session on the sideline.<br><br>
             On the free plan you can draw and save individual plays. Upgrade to Pro to chain them into session plans, animate the sequence, and export as a PDF.`,
      ctaText: 'Upgrade to unlock sessions →',
      ctaUrl: `${APP_URL}/#pricing`,
      features: [
        { icon: '📅', label: 'Session plans' },
        { icon: '▶️', label: 'Present mode' },
        { icon: '💾', label: 'Unlimited saves' },
      ],
      footerNote: "You're receiving this because you have a CourtDraw account."
    };
    return buildEmail(email, 'Chain your plays into a session plan — Pro feature', data);
  },

  // ── Re-engagement: Email 2 — zero plays, all users ──────────────────────────
  reengageZeroPlays: (email, isPaid) => {
    const ctaText = "Pick up where you left off →";
    const ctaUrl  = `${APP_URL}/courtdraw-app.html`;
    const data = {
      label: 'You haven\'t drawn in a while',
      labelColor: '#f59e0b',
      title: 'You haven\'t drawn in a while.',
      body: `Your board is ready whenever you are — pick a court, sketch your next play, and save it before your next session.<br><br>
             ${isPaid
               ? 'All your saved plays and settings are still there.'
               : 'On the free plan you can draw plays and save up to 3. When you\'re ready for more, Pro gives you unlimited saves, phase animation, and session planning.'}`,
      ctaText,
      ctaUrl,
      footerNote: "You're receiving this because you have a CourtDraw account."
    };
    return buildEmail(email, 'Your CourtDraw board is waiting', data);
  },

  // ── Broadcast: Community Library announcement ────────────────────────────────
  communityLibraryAnnouncement: (email, isPaid) => {
    const proNote = isPaid
      ? `You're on Pro or Club, so you can also <strong>publish your own plays</strong> directly to the library — shared with coaches worldwide. Hit the 🌐 Community button in the toolbar, load a play, customise it, and when you're ready, publish yours.`
      : `Pro and Club coaches can also <strong>publish their own plays</strong> to the library and share their system with coaches worldwide. Your first 7 days are free — no charge until day 8.`;
    const ctaText = isPaid ? 'Open the Community Library →' : 'Browse the Community Library →';
    const ctaUrl  = `${APP_URL}/courtdraw-app.html`;
    const data = {
      label: '🌐 New feature',
      labelColor: '#3b82f6',
      title: 'Your tactics library just got a lot bigger',
      body: `We just shipped the <strong>Community Library</strong> — a shared collection of 200+ ready-made plays across 12 sports, built into CourtDraw.<br><br>
             Open the app, hit the <strong>🌐 Community</strong> button in the toolbar, and you'll find plays for football, basketball, volleyball, tennis, handball, and more — all ready to load onto your board in one click.<br><br>
             No drawing from scratch. No starting from a blank court. Find a play you like, load it, and make it yours.<br><br>
             ${proNote}`,
      ctaText,
      ctaUrl,
      features: [
        { icon: '🌐', label: '200+ plays' },
        { icon: '⚡', label: 'Load in one click' },
        { icon: '✏️', label: 'Customise anything' },
      ],
      footerNote: "You're receiving this because you have a CourtDraw account."
    };
    return buildEmail(email, 'New: Browse 200+ plays in the Community Library 🌐', data);
  },

  // ── Broadcast: Android beta tester recruitment ───────────────────────────────
  androidTesterInvite: (email) => {
    const data = {
      label: '📱 Help us test',
      labelColor: '#22c55e',
      title: 'Help test the CourtDraw Android app? (2 minutes)',
      body: `We just built a CourtDraw app for Android and need a small group of testers before it can go live on the Play Store — Google requires at least 12 people to opt in and test for 14 days first.<br><br>
             If you're on Android, would you help?<br><br>
             1. Open the link below on your phone<br>
             2. Tap "Become a tester"<br>
             3. Install CourtDraw from the Play Store like any other app<br><br>
             That's it — no feedback required, just having it installed counts. Thank you!`,
      ctaText: 'Become a tester →',
      ctaUrl: 'https://play.google.com/apps/testing/app.courtdraw.twa',
      footerNote: "You're receiving this because you have a CourtDraw account."
    };
    return buildEmail(email, 'Help test the CourtDraw Android app? (2 minutes)', data);
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
    return buildEmail(email, 'CourtDraw Club — your subscription is now active', data);
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
