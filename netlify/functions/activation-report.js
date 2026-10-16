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
 * Reads every account via admin.auth().listUsers() and fetches each user doc
 * by id — the same pattern weekly-digest.js and user-activation-stats.js use.
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

  // Walk every registered account and read its doc, the way weekly-digest,
  // drip-emails and user-activation-stats all do.
  //
  // This replaces a collection query filtered on `trialStartedAt != null`.
  // That was the only `!=` query in the codebase, so nothing else proved the
  // pattern worked, and in production it returned zero rows while
  // user-activation-stats read 119 user docs from the same collection with
  // listUsers. A filter that silently matches nothing reports an empty funnel
  // as a real result, which is worse than an error.
  //
  // `scanned` and `fieldPresence` below say which of the two possible causes
  // is true — the field is missing on every doc, or the old filter was wrong —
  // without needing another round trip to find out.
  const scanned = { accounts: 0, withUserDoc: 0 };
  const fieldPresence = {
    subscribedAt: 0,      // written on every completed checkout
    stripeCustomerId: 0,  // ditto
    trialStartedAt: 0,    // written only when the checkout was a trial
    isTrialing: 0,
    trialConverted: 0,
  };

  let pageToken;
  do {
    const result = await admin.auth().listUsers(1000, pageToken);
    pageToken = result.pageToken;

    for (const user of result.users) {
      scanned.accounts++;

      let d = null;
      try {
        const snap = await db.collection('users').doc(user.uid).get();
        if (snap.exists) { d = snap.data(); scanned.withUserDoc++; }
      } catch (e) {
        console.warn(`activation-report: Firestore read failed for ${user.uid}: ${e.message}`);
        continue;
      }
      if (!d) continue;

      for (const f of Object.keys(fieldPresence)) {
        if (d[f] !== undefined && d[f] !== null) fieldPresence[f]++;
      }

      // Only users who actually started a trial belong in the funnel.
      if (d.trialStartedAt === undefined || d.trialStartedAt === null) continue;

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
  } while (pageToken);

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

    // Reading zero trials is a claim that needs evidence. These say whether the
    // collection was actually read and which fields were found, so an empty
    // funnel can be told apart from a broken read without a code change.
    diagnostics: {
      accountsScanned:      scanned.accounts,
      accountsWithUserDoc:  scanned.withUserDoc,
      fieldPresence,
    },
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
