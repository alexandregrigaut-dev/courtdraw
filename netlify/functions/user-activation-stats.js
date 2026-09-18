/**
 * user-activation-stats.js — read-only activation snapshot across ALL registered users.
 *
 * Unlike activation-report.js (which only covers users who started a trial and
 * requires a POST-style header), this covers every registered account and can be
 * triggered by simply visiting a URL:
 *
 *   https://courtdraw.app/.netlify/functions/user-activation-stats?secret=YOUR_INTERNAL_SECRET
 *
 * READ ONLY — this function never writes to Firestore or Auth.
 *
 * Answers: of everyone who registered, how many ever actually saved a play?
 *
 * Firestore fields read (all written by the app, see courtdraw-app.html):
 *   recentActivity[]  — appended by __trackPlaySaved on every play save
 *   sessionsCount     — written by __trackSessionSaved
 *   activatedAt       — earliest activation event
 *   plan              — 'free' | 'pro' | 'club'
 *
 * Caveat: recentActivity is only written for signed-in users. Plays saved
 * anonymously to localStorage before registering are not counted.
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

const FREE_SAVES = 3; // mirrors courtdraw-app.html

function pct(n, d) {
  if (!d) return null;
  return Math.round((n / d) * 1000) / 10;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };

  const secret = process.env.INTERNAL_SECRET;
  if (!secret || event.queryStringParameters?.secret !== secret) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  let totalAccounts = 0;
  let withFirestoreDoc = 0;
  let everSavedPlay = 0;
  let everUsedSessions = 0;
  let everActivated = 0;

  const saveBuckets = { '0': 0, '1': 0, '2': 0, '3 (free cap)': 0, '4+': 0 };
  const planCounts = { free: 0, pro: 0, club: 0 };
  const signupsByMonth = {};

  try {
    let pageToken;
    do {
      const result = await admin.auth().listUsers(1000, pageToken);
      pageToken = result.pageToken;

      for (const user of result.users) {
        totalAccounts++;

        const created = new Date(user.metadata.creationTime);
        const monthKey = `${created.getUTCFullYear()}-${String(created.getUTCMonth() + 1).padStart(2, '0')}`;
        signupsByMonth[monthKey] = (signupsByMonth[monthKey] || 0) + 1;

        let data = null;
        try {
          const snap = await db.collection('users').doc(user.uid).get();
          if (snap.exists) { data = snap.data(); withFirestoreDoc++; }
        } catch (e) {
          console.warn(`Firestore read failed for ${user.uid}: ${e.message}`);
          continue;
        }
        if (!data) { saveBuckets['0']++; planCounts.free++; continue; }

        const plan = data.plan === 'pro' || data.plan === 'club' ? data.plan : 'free';
        planCounts[plan]++;

        const saves = Array.isArray(data.recentActivity) ? data.recentActivity.length : 0;
        if (saves > 0) everSavedPlay++;
        if (saves === 0)               saveBuckets['0']++;
        else if (saves === 1)          saveBuckets['1']++;
        else if (saves === 2)          saveBuckets['2']++;
        else if (saves === FREE_SAVES) saveBuckets['3 (free cap)']++;
        else                           saveBuckets['4+']++;

        if (data.sessionsCount > 0) everUsedSessions++;
        if (data.activatedAt) everActivated++;
      }
    } while (pageToken);

    const report = {
      generatedAt: new Date().toISOString(),
      readOnly: true,

      headline: {
        totalRegisteredAccounts: totalAccounts,
        everSavedAPlay: everSavedPlay,
        everSavedAPlayPct: pct(everSavedPlay, totalAccounts),
        neverSavedAnything: totalAccounts - everSavedPlay,
        neverSavedPct: pct(totalAccounts - everSavedPlay, totalAccounts),
      },

      depthOfUse: {
        savesPerUser: saveBuckets,
        everUsedSessionBuilder: everUsedSessions,
        everUsedSessionBuilderPct: pct(everUsedSessions, totalAccounts),
        everHitAnActivationEvent: everActivated,
        everHitAnActivationEventPct: pct(everActivated, totalAccounts),
      },

      plans: {
        ...planCounts,
        payingTotal: planCounts.pro + planCounts.club,
        payingPct: pct(planCounts.pro + planCounts.club, totalAccounts),
      },

      signupsByMonth,

      notes: {
        withFirestoreDoc,
        withoutFirestoreDoc: totalAccounts - withFirestoreDoc,
        caveat: 'recentActivity is only written for signed-in users; anonymous localStorage saves are not counted.',
      },
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report, null, 2),
    };
  } catch (err) {
    console.error('user-activation-stats error:', err.message);
    return { statusCode: 500, body: err.message };
  }
};
