/**
 * backfill-trial-dates.js — one-off repair for trial fields the webhook never wrote.
 *
 * checkout.session.completed gated its trial branch on
 * `session.payment_status === 'no_payment_required'`, which was never true in
 * production. 37 accounts completed a checkout and not one got trialStartedAt,
 * so the activation report has no cohort to work with. Stripe still holds the
 * real dates, so this reads them back.
 *
 * Auth: header x-internal-secret: <INTERNAL_SECRET>. Header only, deliberately:
 * this one writes, and a URL that writes is a URL that gets clicked by accident.
 *
 *   GET   — dry run. Reports exactly what it would write, changes nothing.
 *   POST  — applies those writes.
 *
 * Idempotent: an account that already has trialStartedAt is left alone, so a
 * second run is a no-op and this can be left deployed.
 *
 * Writes, per account, only what Stripe can prove:
 *   trialStartedAt  — ISO, from subscription.trial_start
 *   trialEndsAt     — ISO, from subscription.trial_end
 *   isTrialing      — true, ONLY when Stripe currently reports status 'trialing'
 *
 * It does not touch trialConverted, which the webhook's trialing → active
 * handler already writes correctly, nor plan, nor anything billing-related.
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { db, adminAuth } = require('./_admin-init');

const iso = (unixSeconds) =>
  typeof unixSeconds === 'number' && unixSeconds > 0
    ? new Date(unixSeconds * 1000).toISOString()
    : null;

// A customer can hold several subscriptions over time. The trial that matters
// is the first one they ever started, since that is what the activation report
// measures week one against.
function earliestTrial(subscriptions) {
  const withTrial = subscriptions.filter(s => typeof s.trial_start === 'number' && s.trial_start > 0);
  if (!withTrial.length) return null;
  return withTrial.sort((a, b) => a.trial_start - b.trial_start)[0];
}

exports.handler = async (event) => {
  const method = event.httpMethod;
  if (method !== 'GET' && method !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const secret = process.env.INTERNAL_SECRET;
  const provided = (event.headers || {})['x-internal-secret'];
  if (!secret || provided !== secret) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  const apply = method === 'POST';

  const counts = {
    accountsScanned: 0,
    withStripeCustomer: 0,
    alreadyHadTrialStart: 0,
    noTrialInStripe: 0,
    stripeLookupFailed: 0,
    planned: 0,
    written: 0,
  };
  const changes = [];   // what was or would be written
  const failures = [];

  try {
    let pageToken;
    do {
      const result = await adminAuth.listUsers(1000, pageToken);
      pageToken = result.pageToken;

      for (const user of result.users) {
        counts.accountsScanned++;

        let d = null;
        try {
          const snap = await db.collection('users').doc(user.uid).get();
          if (snap.exists) d = snap.data();
        } catch (e) {
          failures.push({ uid: user.uid, stage: 'firestore read', error: e.message });
          continue;
        }
        if (!d || !d.stripeCustomerId) continue;
        counts.withStripeCustomer++;

        // Never overwrite a real value. A second run must be a no-op.
        if (d.trialStartedAt) { counts.alreadyHadTrialStart++; continue; }

        let subs;
        try {
          const list = await stripe.subscriptions.list({
            customer: d.stripeCustomerId,
            status: 'all',
            limit: 100,
          });
          subs = (list && list.data) || [];
        } catch (e) {
          counts.stripeLookupFailed++;
          failures.push({ uid: user.uid, stage: 'stripe list', error: e.message });
          continue;
        }

        const sub = earliestTrial(subs);
        if (!sub) { counts.noTrialInStripe++; continue; }

        const update = { trialStartedAt: iso(sub.trial_start) };
        const endsAt = iso(sub.trial_end);
        if (endsAt) update.trialEndsAt = endsAt;
        // Only a trial Stripe still calls live earns the in-app banner. Setting
        // this on a finished trial would show a stale warning forever.
        if (sub.status === 'trialing') update.isTrialing = true;

        counts.planned++;
        changes.push({
          uid: user.uid,
          subscriptionId: sub.id,
          subStatus: sub.status,
          ...update,
        });

        if (apply) {
          try {
            await db.collection('users').doc(user.uid).set(update, { merge: true });
            counts.written++;
          } catch (e) {
            failures.push({ uid: user.uid, stage: 'firestore write', error: e.message });
          }
        }
      }
    } while (pageToken);
  } catch (e) {
    console.error('backfill-trial-dates failed:', e.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: e.message, counts, partial: true }, null, 2),
    };
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: apply ? 'APPLIED' : 'DRY RUN — POST to the same URL to apply',
    counts,
    changes,
    failures,
  };

  // Keep a record outside Netlify's 24-hour log window.
  try {
    await db.collection('diagnostics').doc('trialBackfill').set({
      at: report.generatedAt,
      mode: report.mode,
      counts,
      failures,
    });
  } catch (e) {
    console.error('Could not record backfill diagnostics:', e.message);
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(report, null, 2),
  };
};
