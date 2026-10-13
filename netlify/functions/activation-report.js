/**
 * activation-report.js — on-demand cohort analysis
 *
 * GET /.netlify/functions/activation-report
 * Auth: header  x-internal-secret: <INTERNAL_SECRET>
 *       or query ?secret=<INTERNAL_SECRET>, so it can be opened in a browser
 *       the same way user-activation-stats.js is.
 *
 * Returns JSON with conversion rates broken down by activation event,
 * plus time-to-activation stats for users who hit each moment.
 *
 * Firestore fields read:
 *   trialStartedAt        — ISO, written by webhook on checkout.session.completed (trial)
 *   trialConverted        — bool, written by webhook on subscription.updated trialing→active
 *   trialConvertedAt      — ISO
 *   activation_sharedPlay — ms timestamp (first share)
 *   activation_exportedPNG — ms timestamp (first PNG export)
 *   activation_builtPhase2 — ms timestamp (first 2-phase build)
 *   activatedAt           — ms timestamp (earliest of any activation event)
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

const ACTIVATION_KEYS = ['sharedPlay', 'exportedPNG', 'builtPhase2'];

function pct(n, d) {
  if (!d) return null;
  return Math.round((n / d) * 1000) / 10; // one decimal
}

// Both take values already expressed in hours. The earlier version divided by
// 36000 as if it were handed milliseconds, so avgHoursToActivation reported 0.0
// for every event no matter what the data said.
function avgHours(hours) {
  if (!hours.length) return null;
  const sum = hours.reduce((a, b) => a + b, 0);
  return Math.round((sum / hours.length) * 100) / 100;
}

// The mean is dragged up by the one coach who comes back on day six. The median
// is what "when do people activate" actually means, and it decides whether the
// trial email on day 2 lands before or after the moment that matters.
function medianHours(hours) {
  if (!hours.length) return null;
  const sorted = [...hours].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Math.round(value * 100) / 100;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };

  const secret = process.env.INTERNAL_SECRET;
  const provided = (event.headers || {})['x-internal-secret']
    || (event.queryStringParameters || {}).secret;
  if (!secret || provided !== secret) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  // Bucket structure per activation event
  const buckets = {};
  for (const key of ACTIVATION_KEYS) {
    buckets[key] = {
      trialed: 0,       // users who trialed AND hit this event
      converted: 0,     // of those, how many converted
      hoursToActivation: [],  // hours from trialStartedAt to activation
    };
  }

  const overall = { trialed: 0, converted: 0 };
  const anyActivation = { trialed: 0, converted: 0 };
  const noActivation  = { trialed: 0, converted: 0 };

  // Page through all user docs that have trialStartedAt
  let lastDoc = null;
  let hasMore = true;

  while (hasMore) {
    let query = db.collection('users')
      .where('trialStartedAt', '!=', null)
      .orderBy('trialStartedAt')
      .limit(500);
    if (lastDoc) query = query.startAfter(lastDoc);

    const snap = await query.get();
    if (snap.empty) break;
    hasMore = snap.size === 500;
    lastDoc = snap.docs[snap.docs.length - 1];

    for (const docSnap of snap.docs) {
      const d = docSnap.data();
      const trialStartMs = new Date(d.trialStartedAt).getTime();
      const converted    = d.trialConverted === true;

      overall.trialed++;
      if (converted) overall.converted++;

      let hitAny = false;

      for (const key of ACTIVATION_KEYS) {
        const field = `activation_${key}`;
        if (d[field]) {
          hitAny = true;
          buckets[key].trialed++;
          if (converted) buckets[key].converted++;
          // Time from trial start to this activation event
          const hoursToActivate = (d[field] - trialStartMs) / (1000 * 60 * 60);
          if (hoursToActivate >= 0) buckets[key].hoursToActivation.push(hoursToActivate);
        }
      }

      if (hitAny) {
        anyActivation.trialed++;
        if (converted) anyActivation.converted++;
      } else {
        noActivation.trialed++;
        if (converted) noActivation.converted++;
      }
    }
  }

  // Build report
  const report = {
    generatedAt: new Date().toISOString(),
    overall: {
      trialedUsers:    overall.trialed,
      convertedUsers:  overall.converted,
      conversionRate:  pct(overall.converted, overall.trialed),
    },
    activatedVsNot: {
      activated: {
        trialed:        anyActivation.trialed,
        converted:      anyActivation.converted,
        conversionRate: pct(anyActivation.converted, anyActivation.trialed),
      },
      neverActivated: {
        trialed:        noActivation.trialed,
        converted:      noActivation.converted,
        conversionRate: pct(noActivation.converted, noActivation.trialed),
      },
    },
    byActivationEvent: {},
  };

  for (const key of ACTIVATION_KEYS) {
    const b = buckets[key];
    const notTrialed    = overall.trialed - b.trialed;
    const notConverted  = overall.converted - b.converted;
    report.byActivationEvent[key] = {
      // Users who hit this activation event
      hit: {
        trialed:        b.trialed,
        converted:      b.converted,
        conversionRate: pct(b.converted, b.trialed),
        avgHoursToActivation:    avgHours(b.hoursToActivation),
        medianHoursToActivation: medianHours(b.hoursToActivation),
        pctActivatedWithin48h: b.hoursToActivation.length
          ? pct(b.hoursToActivation.filter(h => h <= 48).length, b.hoursToActivation.length)
          : null,
      },
      // Users who never hit this activation event
      missed: {
        trialed:        notTrialed,
        converted:      notConverted,
        conversionRate: pct(notConverted, notTrialed),
      },
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(report, null, 2),
  };
};
