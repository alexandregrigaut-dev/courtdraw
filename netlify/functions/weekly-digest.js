/**
 * weekly-digest.js — Netlify Scheduled Function
 * Runs every Monday at 08:00 UTC.
 *
 * For each user with an email address:
 *   Pro/Club  → personalised digest (plays saved last week, spotlight, stale-sport nudge)
 *   Free      → static "your saves are waiting" re-engagement
 *
 * Firestore fields read/written on users/<uid>:
 *   recentActivity[]     — { name, sport, savedAt } — written by the app on each save
 *   lastSaved_<Sport>    — ms timestamp, flat fields written by the app
 *   weeklyDigestSentWeek — ISO week string "YYYY-Www", prevents double-sends
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

// ISO week string e.g. "2026-W22" — used to deduplicate sends within the same week
function isoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / DAY_MS) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

async function sendDigest(email, template, opts) {
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.INTERNAL_SECRET) headers['x-internal-secret'] = process.env.INTERNAL_SECRET;
  const body = { template, email };
  if (opts) body.templateData = { _opts: opts };
  const res = await fetch(`${process.env.PUBLIC_URL}/.netlify/functions/send-email`, {
    method: 'POST', headers, body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`send-email ${res.status}: ${text}`);
  }
}

exports.handler = async () => {
  const now      = Date.now();
  const thisWeek = isoWeek();
  const weekAgo  = now - WEEK_MS;
  const threeWeeksAgo = now - 21 * DAY_MS;

  let processed = 0, sent = 0, skipped = 0;

  try {
    let pageToken;
    do {
      const result = await admin.auth().listUsers(1000, pageToken);
      pageToken = result.pageToken;

      for (const user of result.users) {
        if (!user.email) { skipped++; continue; }
        processed++;

        let userData = {};
        try {
          const snap = await db.collection('users').doc(user.uid).get();
          userData = snap.exists ? snap.data() : {};
        } catch (e) {
          console.warn(`Firestore read failed for ${user.uid}:`, e.message);
          skipped++; continue;
        }

        // Skip if already sent this week
        if (userData.weeklyDigestSentWeek === thisWeek) { skipped++; continue; }

        const plan   = userData.plan || 'free';
        const isPro  = plan === 'pro' || plan === 'club';
        const recent = Array.isArray(userData.recentActivity) ? userData.recentActivity : [];

        let template, opts;

        if (isPro) {
          // Plays saved in the last 7 days
          const lastWeekPlays = recent
            .filter(p => p.savedAt && p.savedAt >= weekAgo)
            .sort((a, b) => b.savedAt - a.savedAt);

          // Find a sport the user hasn't drawn in 3+ weeks
          let suggestionSport = null;
          const lastSavedEntries = Object.entries(userData)
            .filter(([k]) => k.startsWith('lastSaved_'))
            .map(([k, v]) => ({ sport: k.slice('lastSaved_'.length), ts: v }))
            .filter(x => x.ts < threeWeeksAgo)
            .sort((a, b) => a.ts - b.ts);
          if (lastSavedEntries.length) suggestionSport = lastSavedEntries[0].sport;

          if (lastWeekPlays.length > 0) {
            const spotlight = lastWeekPlays[0];
            template = 'weeklyDigestActive';
            opts = {
              count:         lastWeekPlays.length,
              spotlightName: spotlight.name,
              spotlightSport: spotlight.sport,
              suggestionSport
            };
          } else {
            // Find the most recent play overall for the recap line
            const allSorted = [...recent].sort((a, b) => b.savedAt - a.savedAt);
            const last = allSorted[0] || null;
            let daysSince = null;
            if (last) daysSince = Math.round((now - last.savedAt) / DAY_MS);
            template = 'weeklyDigestLapsed';
            opts = {
              lastPlayName:  last ? last.name : null,
              lastPlaySport: last ? last.sport : '',
              daysSince,
              suggestionSport
            };
          }
        } else {
          // Free user — static nudge, no opts needed
          template = 'weeklyDigestFree';
          opts = null;
        }

        try {
          await sendDigest(user.email, template, opts);
          await db.collection('users').doc(user.uid).set(
            { weeklyDigestSentWeek: thisWeek },
            { merge: true }
          );
          sent++;
          console.log(`Sent ${template} to ${user.email}`);
        } catch (e) {
          console.error(`Failed to send digest to ${user.email}:`, e.message);
        }
      }
    } while (pageToken);

    console.log(`Weekly digest complete. Processed: ${processed}, Sent: ${sent}, Skipped: ${skipped}`);
    return { statusCode: 200, body: JSON.stringify({ processed, sent, skipped }) };
  } catch (err) {
    console.error('Weekly digest error:', err.message);
    return { statusCode: 500, body: err.message };
  }
};
