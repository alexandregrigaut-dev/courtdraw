/**
 * weekly-digest.js — Netlify Scheduled Function (R-3)
 * Runs every Monday at 08:00 UTC.
 * Sends a "Your plays this week" recap email to Pro/Club users,
 * and a lighter nudge to free users.
 *
 * Logic:
 *  1. List all Firebase Auth users (paginated)
 *  2. For Pro/Club users: count tactics saved in last 7 days from Firestore,
 *     find the most recent play name/sport, send weeklyDigestPro
 *  3. For free users who have saved at least one play: send weeklyDigestFree
 *  4. De-duplicate: don't send if already sent this week (tracked via Firestore field)
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

const DAY_MS  = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

async function sendDigest(email, template, templateData) {
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.INTERNAL_SECRET) headers['x-internal-secret'] = process.env.INTERNAL_SECRET;
  const res = await fetch(`${process.env.PUBLIC_URL}/.netlify/functions/send-email`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ template, email, templateData })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`send-email failed (${res.status}): ${body}`);
  }
}

exports.handler = async () => {
  const now = Date.now();
  // ISO week key, e.g. "2026-W22" — prevents re-sending in the same calendar week
  const weekKey = (() => {
    const d = new Date(now);
    const jan1 = new Date(d.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((d - jan1) / DAY_MS + jan1.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  })();

  let processed = 0, sent = 0, skipped = 0;

  try {
    let pageToken;
    do {
      const result = await admin.auth().listUsers(1000, pageToken);
      pageToken = result.pageToken;

      for (const user of result.users) {
        if (!user.email) continue;
        processed++;

        let userDoc;
        try {
          userDoc = await db.collection('users').doc(user.uid).get();
        } catch (e) {
          console.warn(`Could not read Firestore for ${user.uid}:`, e.message);
          skipped++; continue;
        }

        const data = userDoc.exists ? userDoc.data() : {};
        const plan = data.plan || 'free';
        const weeklyDigestSent = Array.isArray(data.weeklyDigestSent) ? data.weeklyDigestSent : [];

        // Don't re-send in the same calendar week
        if (weeklyDigestSent.includes(weekKey)) { skipped++; continue; }

        const isPro  = plan === 'pro' || plan === 'club';
        const isFree = plan === 'free';

        // Free users: only nudge if they have saved at least one play
        const savedCount = data.tacticCount || 0;
        if (isFree && savedCount === 0) { skipped++; continue; }

        try {
          if (isPro) {
            // Count tactics saved in the last 7 days
            const sevenDaysAgo = new Date(now - WEEK_MS);
            let playsLastWeek = 0;
            let spotlightName = '';
            let spotlightSport = '';

            try {
              const snapshot = await db
                .collection('users').doc(user.uid)
                .collection('tactics')
                .where('ts', '>=', sevenDaysAgo.getTime())
                .orderBy('ts', 'desc')
                .limit(50)
                .get();
              playsLastWeek = snapshot.size;
              if (!snapshot.empty) {
                const latest = snapshot.docs[0].data();
                spotlightName  = latest.name  || '';
                spotlightSport = latest.courtId ? latest.courtId.replace(/_/g, ' ') : '';
              }
            } catch (e) {
              // tactics sub-collection may not exist — that's fine
            }

            await sendDigest(user.email, 'weeklyDigestPro', {
              playsLastWeek,
              spotlightName,
              spotlightSport
            });
          } else {
            // Free user with at least one save
            await sendDigest(user.email, 'weeklyDigestFree', { savesUsed: savedCount });
          }

          // Mark as sent for this week
          await db.collection('users').doc(user.uid).set(
            { weeklyDigestSent: [...weeklyDigestSent, weekKey] },
            { merge: true }
          );
          sent++;
          console.log(`Sent weekly digest (${plan}) to ${user.email}`);
        } catch (e) {
          console.error(`Failed to send weekly digest to ${user.email}:`, e.message);
        }
      }
    } while (pageToken);

    console.log(`Weekly digest complete. Processed: ${processed}, Sent: ${sent}, Skipped: ${skipped}`);
    return { statusCode: 200, body: JSON.stringify({ processed, sent, skipped }) };
  } catch (err) {
    console.error('Weekly digest function error:', err.message);
    return { statusCode: 500, body: err.message };
  }
};
