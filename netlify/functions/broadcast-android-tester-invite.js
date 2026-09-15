/**
 * broadcast-android-tester-invite.js — One-time broadcast Netlify Function
 * Sends the Android beta-tester recruitment email to all registered users.
 *
 * Trigger by visiting a URL (GET) — no curl/terminal needed:
 *   https://courtdraw.app/.netlify/functions/broadcast-android-tester-invite?secret=YOUR_INTERNAL_SECRET
 *
 * That call is always a DRY RUN (counts eligible users, sends nothing) —
 * safe to visit even by accident (an email client's link preview, a browser
 * prefetch, etc. can't trigger a real send). To actually send, add
 * &confirm=yes to the same URL:
 *   https://courtdraw.app/.netlify/functions/broadcast-android-tester-invite?secret=YOUR_INTERNAL_SECRET&confirm=yes
 *
 * (POST with an x-internal-secret header, matching broadcast-community-library.js's
 * convention, also works and skips the dry-run default — see the handler below.)
 *
 * YOUR_INTERNAL_SECRET is the INTERNAL_SECRET value from Netlify's
 * Site settings → Environment variables — the same secret every other
 * internal broadcast/digest function in this codebase already uses.
 *
 * Send-once guard: sets emailSentAndroidTesterInvite: true on each user doc
 * after a successful send — re-running the function will skip those users,
 * so it's safe to trigger more than once (e.g. to catch new signups later).
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

async function sendEmail(email) {
  const headers = {
    'Content-Type': 'application/json',
    'x-internal-secret': process.env.INTERNAL_SECRET,
  };
  const res = await fetch(`${APP_URL}/.netlify/functions/send-email`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ template: 'androidTesterInvite', email }),
  });
  if (!res.ok) throw new Error(`send-email ${res.status}: ${await res.text()}`);
}

exports.handler = async (event) => {
  const secret = process.env.INTERNAL_SECRET;
  const method = event.httpMethod;

  // Admin-only — a GET with the right ?secret= or a POST with the right
  // x-internal-secret header. GET exists specifically so this can be
  // triggered by opening a URL, with no terminal/curl required.
  let authorized = false;
  let dryRun = true;

  if (method === 'GET') {
    authorized = !!secret && event.queryStringParameters?.secret === secret;
    dryRun = event.queryStringParameters?.confirm !== 'yes';
  } else if (method === 'POST') {
    authorized = !!secret && event.headers['x-internal-secret'] === secret;
    try { dryRun = !!(JSON.parse(event.body || '{}').dryRun); } catch {}
  } else {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  if (!authorized) return { statusCode: 401, body: 'Unauthorized' };

  const log = (msg) => console.log(`[broadcast-android-tester-invite] ${msg}`);
  log(dryRun ? 'DRY RUN — no emails will be sent' : 'LIVE RUN — sending emails');

  let sent = 0, skipped = 0, failed = 0, total = 0;
  const errors = [];

  try {
    let pageToken;
    do {
      const result = await admin.auth().listUsers(1000, pageToken);
      pageToken = result.pageToken;

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
        if (userData.emailSentAndroidTesterInvite) { skipped++; continue; }
        if (userData.unsubscribed) { skipped++; continue; }

        total++;
        eligible.push({ uid: user.uid, email: user.email });
      }

      for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
        const batch = eligible.slice(i, i + BATCH_SIZE);

        await Promise.all(batch.map(async ({ uid, email }) => {
          if (dryRun) {
            log(`[dry-run] Would send to ${email}`);
            sent++;
            return;
          }
          try {
            await sendEmail(email);
            await db.collection('users').doc(uid).set(
              { emailSentAndroidTesterInvite: true, emailSentAndroidTesterInviteAt: Date.now() },
              { merge: true }
            );
            sent++;
            log(`Sent to ${email}`);
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
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(summary, null, 2),
    };

  } catch (err) {
    log(`Fatal: ${err.message}`);
    return { statusCode: 500, body: err.message };
  }
};
