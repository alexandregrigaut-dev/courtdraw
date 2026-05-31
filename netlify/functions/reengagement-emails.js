/**
 * reengagement-emails.js — Netlify Scheduled Function
 * Runs daily at 10:00 UTC (offset from drip-emails at 09:00).
 *
 * Sends two re-engagement emails to registered users who have been inactive
 * for at least 7 days after account creation.
 *
 * Email 1 — "Empty sessions" (emailSentEmptySessions)
 *   Trigger: zero session plans created (sessionsCount === 0 or missing)
 *   Copy:    Pro/Club → start a session CTA
 *            Free     → upsell: upgrade to unlock sessions
 *
 * Email 2 — "Zero plays" (emailSentZeroPlays)
 *   Trigger: zero plays drawn (recentActivity empty or missing)
 *   Copy:    same for all plans — "You haven't drawn in a while."
 *
 * Send-once guard: Firestore flags emailSentEmptySessions / emailSentZeroPlays
 * Staggering: if a user qualifies for both, Email 2 fires first; Email 1 only
 *   fires on a subsequent cron run ≥24h later.
 * Active-check: conditions are re-evaluated at send time — if the user created
 *   plays or sessions between runs, the remaining email is automatically skipped.
 *
 * Firestore fields read/written on users/<uid>:
 *   plan                  — 'free' | 'pro' | 'club'
 *   recentActivity[]      — written by the app on each play save
 *   sessionsCount         — written by the app on session save/delete
 *   emailSentZeroPlays    — boolean flag + timestamp, prevents re-send
 *   emailSentZeroPlaysSentAt — ms timestamp, used for 24h stagger
 *   emailSentEmptySessions — boolean flag, prevents re-send
 */

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

const db = admin.firestore();

const DAY_MS    = 24 * 60 * 60 * 1000;
const MIN_AGE   = 7 * DAY_MS;   // account must be at least 7 days old
const STAGGER   = DAY_MS;       // minimum gap between Email 2 → Email 1

async function sendEmail(email, template, isPaid) {
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.INTERNAL_SECRET) headers['x-internal-secret'] = process.env.INTERNAL_SECRET;

  // reengageZeroPlays takes an isPaid boolean as second arg via templateData
  const body = { template, email };
  if (template === 'reengageZeroPlays') body.templateData = { _isPaid: isPaid };

  const res = await fetch(`${process.env.PUBLIC_URL}/.netlify/functions/send-email`, {
    method: 'POST', headers, body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`send-email ${res.status}: ${text}`);
  }
}

exports.handler = async () => {
  const now = Date.now();
  let processed = 0, sent = 0, skipped = 0;

  const log = (msg) => console.log(`[reengagement] ${msg}`);

  try {
    let pageToken;
    do {
      const result = await admin.auth().listUsers(1000, pageToken);
      pageToken = result.pageToken;

      for (const user of result.users) {
        // Hard exclusion: must have an email address (anonymous/guest users never have one)
        if (!user.email) { skipped++; continue; }

        // Account must be at least 7 days old
        const createdMs = new Date(user.metadata.creationTime).getTime();
        if (now - createdMs < MIN_AGE) { skipped++; continue; }

        processed++;

        let userData = {};
        try {
          const snap = await db.collection('users').doc(user.uid).get();
          userData = snap.exists ? snap.data() : {};
        } catch (e) {
          console.warn(`Firestore read failed for ${user.uid}:`, e.message);
          skipped++; continue;
        }

        const plan   = userData.plan || 'free';
        const isPaid = plan === 'pro' || plan === 'club';

        // ── Eligibility conditions (re-checked at send time) ────────────────
        const hasZeroPlays    = !Array.isArray(userData.recentActivity) || userData.recentActivity.length === 0;
        const hasZeroSessions = (userData.sessionsCount == null) || userData.sessionsCount === 0;

        // ── Send-once flags ─────────────────────────────────────────────────
        const alreadySentZeroPlays    = !!userData.emailSentZeroPlays;
        const alreadySentEmptySessions = !!userData.emailSentEmptySessions;

        // ── Determine what to send this run ─────────────────────────────────
        // Priority: Email 2 (zero plays) fires before Email 1 (empty sessions).
        // If a user qualifies for both, only Email 2 fires today; Email 1 will
        // fire on the next run that is ≥24h after Email 2 was sent.

        let sentAnything = false;

        // Email 2 — zero plays
        if (hasZeroPlays && !alreadySentZeroPlays) {
          try {
            await sendEmail(user.email, 'reengageZeroPlays', isPaid);
            await db.collection('users').doc(user.uid).set({
              emailSentZeroPlays: true,
              emailSentZeroPlaysSentAt: now,
              emailSentZeroPlaysplan: plan  // plan tier at send time
            }, { merge: true });
            sent++;
            sentAnything = true;
            log(`Sent reengageZeroPlays (${plan}) to ${user.email}`);
          } catch (e) {
            console.error(`Failed reengageZeroPlays for ${user.email}:`, e.message);
          }
        }

        // Email 1 — empty sessions
        // Only fire if:
        //   a) user still has zero sessions (active-check)
        //   b) not already sent
        //   c) either Email 2 was not applicable (user has plays) OR Email 2 was sent ≥24h ago
        if (hasZeroSessions && !alreadySentEmptySessions && !sentAnything) {
          const email2SentAt = userData.emailSentZeroPlaysSentAt || 0;
          const email2GapOk  = !userData.emailSentZeroPlays || (now - email2SentAt >= STAGGER);

          if (email2GapOk) {
            const template = isPaid ? 'reengageEmptySessionsPaid' : 'reengageEmptySessionsFree';
            try {
              await sendEmail(user.email, template, isPaid);
              await db.collection('users').doc(user.uid).set({
                emailSentEmptySessions: true,
                emailSentEmptySessionsSentAt: now,
                emailSentEmptySessionsPlan: plan  // plan tier at send time
              }, { merge: true });
              sent++;
              log(`Sent ${template} to ${user.email}`);
            } catch (e) {
              console.error(`Failed ${template} for ${user.email}:`, e.message);
            }
          }
        }
      }
    } while (pageToken);

    log(`Run complete. Processed: ${processed}, Sent: ${sent}, Skipped: ${skipped}`);
    return { statusCode: 200, body: JSON.stringify({ processed, sent, skipped }) };
  } catch (err) {
    console.error('[reengagement] Fatal error:', err.message);
    return { statusCode: 500, body: err.message };
  }
};
