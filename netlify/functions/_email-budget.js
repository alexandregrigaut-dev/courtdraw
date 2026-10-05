// Shared daily send budget for the scheduled (bulk) email jobs.
// Import with: const { remainingBulkBudget, recordBulkSend, DIGEST_PER_RUN } = require('./_email-budget');
//
// Why this exists
// ---------------
// Every email the app sends — bulk and transactional alike — goes through one
// Resend account, and the free plan caps the whole account at 100 emails per
// day. Password resets (send-reset-email) and the Stripe lifecycle mails
// (webhook.js: trial started, payment confirmed, club welcome, cancellation)
// draw on that same 100. Before this, the Monday digest fired ~80 in one go and
// left almost nothing for them — and because every send is wrapped in a
// try/catch that only logs, a coach locked out of their account or a customer
// who had just paid would simply never get their mail, silently.
//
// So the bulk jobs are held to BULK_DAILY_BUDGET and the remainder of the
// account's 100 stays free for mail a human is actively waiting on.
//
// Transactional sends deliberately do NOT consult or increment this counter:
// they must always go out, and putting a Firestore round-trip on that path adds
// a failure mode to the one path that must not fail. The gap between
// BULK_DAILY_BUDGET and the account's real cap is their headroom.
//
// Firestore: emailBudget/<YYYY-MM-DD> { count }
// Keying the document by date means the count rolls over on its own — no reset
// job, no stale-date comparison.

const admin = require('firebase-admin');

// Of Resend's 100/day, bulk may use this many. The remainder is the
// transactional reserve. Raise both together if the Resend plan changes.
const BULK_DAILY_BUDGET = 70;

// The digest is the only job big enough to drain the budget by itself, and it
// runs at 08:00 — before drip-emails (09:00) and reengagement-emails (10:00).
// Those two are time-sensitive in a way the digest is not: drip only matches a
// user within ±12h of day 2/5/10 after signup, so a drip starved of quota is
// not delayed, it is missed permanently. Capping the digest below the budget
// keeps room for them. The digest, by contrast, just finishes tomorrow.
const DIGEST_PER_RUN = 55;

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD, UTC
}

function budgetRef(db) {
  return db.collection('emailBudget').doc(todayKey());
}

// How many bulk sends are still allowed today. Never negative.
// On a Firestore read failure this returns 0 — if we cannot tell how much has
// been spent, the safe assumption is "none left", because overshooting burns
// the transactional reserve.
async function remainingBulkBudget(db) {
  try {
    const snap = await budgetRef(db).get();
    const used = (snap.exists && snap.data().count) || 0;
    return Math.max(0, BULK_DAILY_BUDGET - used);
  } catch (e) {
    console.error('[email-budget] read failed, treating budget as exhausted:', e.message);
    return 0;
  }
}

// Record n successful bulk sends. Call after each send rather than batching at
// the end: a scheduled function that times out mid-run would otherwise lose the
// whole count and let the next job overspend.
// Never throws — a failed count must not fail the send that already happened.
async function recordBulkSend(db, n = 1) {
  if (n <= 0) return;
  try {
    await budgetRef(db).set(
      { count: admin.firestore.FieldValue.increment(n) },
      { merge: true }
    );
  } catch (e) {
    console.error('[email-budget] increment failed:', e.message);
  }
}

module.exports = { BULK_DAILY_BUDGET, DIGEST_PER_RUN, remainingBulkBudget, recordBulkSend, todayKey };
