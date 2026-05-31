/**
 * broadcast-community-library.js — One-time broadcast Netlify Function
 * Sends the Community Library announcement email to all registered users.
 *
 * Trigger manually (once) with:
 *   curl -X POST https://courtdraw.app/.netlify/functions/broadcast-community-library \
 *     -H "x-internal-secret: YOUR_INTERNAL_SECRET"
 *
 * Dry-run (counts users, sends nothing):
 *   curl -X POST https://courtdraw.app/.netlify/functions/broadcast-community-library \
 *     -H "x-internal-secret: YOUR_INTERNAL_SECRET" \
 *     -H "Content-Type: application/json" \
 *     -d '{"dryRun": true}'
 *
 * Send-once guard: sets emailSentCommunityLibrary: true on each user doc after
 * a successful send — re-running the function will skip those users.
 *
 * Rate limiting: sends in batches of 5 with a 200ms pause between batches
 * (~25 emails/sec max), well within Resend's limits.
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

const BATCH_SIZE  = 5;
const BATCH_DELAY = 200; // ms between batches
const APP_URL     = process.env.PUBLIC_URL || 'https://courtdraw.app';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function sendEmail(email, isPaid) {
  const headers = {
    'Content-Type': 'application/json',
    'x-internal-secret': process.env.INTERNAL_SECRET,
  };
  const res = await fetch(`${APP_URL}/.netlify/functions/send-email`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      template: 'communityLibraryAnnouncement',
      email,
      templateData: { isPaid },
    }),
  });
  if (!res.ok) throw new Error(`send-email ${res.status}: ${await res.text()}`);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  // Admin-only — requires INTERNAL_SECRET header
  const secret = process.env.INTERNAL_SECRET;
  if (!secret || event.headers['x-internal-secret'] !== secret) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  let dryRun = false;
  try { dryRun = !!(JSON.parse(event.body || '{}').dryRun); } catch {}

  const log = (msg) => console.log(`[broadcast-community-library] ${msg}`);
  log(dryRun ? 'DRY RUN — no emails will be sent' : 'LIVE RUN — sending emails');

  let sent = 0, skipped = 0, failed = 0, total = 0;
  const errors = [];

  try {
    let pageToken;
    do {
      const result = await admin.auth().listUsers(1000, pageToken);
      pageToken = result.pageToken;

      // Collect eligible users from this page
      const eligible = [];
      for (const user of result.users) {
        if (!user.email) { skipped++; continue; }

        let userData = {};
        try {
          const snap = await db.collection('users').doc(user.uid).get();
          userData = snap.exists ? snap.data() : {};
        } catch (e) {
          log(`Firestore read failed for ${user.uid}: ${e.message}`);
          skipped++; continue;
        }

        // Skip if already sent or explicitly unsubscribed
        if (userData.emailSentCommunityLibrary) { skipped++; continue; }
        if (userData.unsubscribed) { skipped++; continue; }

        total++;
        const isPaid = userData.plan === 'pro' || userData.plan === 'club';
        eligible.push({ uid: user.uid, email: user.email, isPaid });
      }

      // Send in batches
      for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
        const batch = eligible.slice(i, i + BATCH_SIZE);

        await Promise.all(batch.map(async ({ uid, email, isPaid }) => {
          if (dryRun) {
            log(`[dry-run] Would send to ${email} (${isPaid ? 'paid' : 'free'})`);
            sent++;
            return;
          }
          try {
            await sendEmail(email, isPaid);
            await db.collection('users').doc(uid).set(
              { emailSentCommunityLibrary: true, emailSentCommunityLibraryAt: Date.now() },
              { merge: true }
            );
            sent++;
            log(`Sent to ${email} (${isPaid ? 'paid' : 'free'})`);
          } catch (err) {
            failed++;
            errors.push({ email, error: err.message });
            log(`FAILED for ${email}: ${err.message}`);
          }
        }));

        if (i + BATCH_SIZE < eligible.length) await sleep(BATCH_DELAY);
      }

    } while (pageToken);

    const summary = { dryRun, total, sent, skipped, failed, errors };
    log(`Done. ${JSON.stringify({ total, sent, skipped, failed })}`);
    return { statusCode: 200, body: JSON.stringify(summary, null, 2) };

  } catch (err) {
    log(`Fatal: ${err.message}`);
    return { statusCode: 500, body: err.message };
  }
};
