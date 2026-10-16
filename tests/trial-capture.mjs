// Tests for the trial branch of checkout.session.completed in webhook.js.
//
// This branch was gated on `session.payment_status === 'no_payment_required'`,
// an inference about the Checkout Session. Across 37 completed checkouts it was
// never once true: every user doc had trialStartedAt absent, while 19 of those
// same subscriptions later fired trialing → active. The trials were real; the
// inference about them was not.
//
// Nothing failed loudly, because every field it writes is only read somewhere
// quiet:
//   isTrialing + trialEndsAt  gate the in-app trial banner, so 37 coaches
//                             reached the end of a trial with no warning
//   trialAmount + currency    the amount that banner would have named
//   trialStartedAt            the activation report's entire cohort
//   isTrial                   picks the welcome email, so coaches starting a
//                             free trial were told their payment was confirmed
//
// The fix asks the subscription instead of inferring from the session. These
// tests drive the handler with payment_status values Stripe really sends,
// rather than the one the old code expected.
//
// Run: node tests/trial-capture.mjs

import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// ── World ────────────────────────────────────────────────────────────────────
let userDocs, diagnostics, sentEmails, subscription, retrieveError, retrieveCalls;

function resetWorld() {
  userDocs   = { u1: { email: 'coach@example.com', plan: 'free' } };
  diagnostics = {};
  sentEmails = [];
  retrieveError = null;
  retrieveCalls = [];
  // A real 7-day trial subscription as Stripe returns it.
  subscription = {
    id: 'sub_1',
    status: 'trialing',
    trial_end: Math.floor(Date.parse('2026-10-23T10:00:00Z') / 1000),
    items: { data: [{ price: { unit_amount: 600, currency: 'eur' } }] },
  };
}
resetWorld();

const Module = require('module');
const realLoad = Module._load;
Module._load = function (request) {
  if (request === 'stripe') {
    return () => ({
      webhooks: { constructEvent: (body) => JSON.parse(body) },
      subscriptions: {
        retrieve: async (id) => {
          retrieveCalls.push(id);
          if (retrieveError) throw new Error(retrieveError);
          return subscription;
        },
      },
    });
  }
  if (request === 'firebase-admin') {
    const docRef = (coll, id) => ({
      async get() {
        const store = coll === 'users' ? userDocs : diagnostics;
        return { exists: !!store[id], data: () => ({ ...store[id] }) };
      },
      async update(patch) { Object.assign(userDocs[id] ||= {}, patch); },
      async set(patch) {
        if (coll === 'diagnostics') diagnostics[id] = patch;
        else Object.assign(userDocs[id] ||= {}, patch);
      },
    });
    return {
      apps: [{}],
      initializeApp() {},
      credential: { cert: () => ({}) },
      firestore: Object.assign(() => ({
        collection: (coll) => ({
          doc: (id) => docRef(coll, id),
          where: () => ({ limit: () => ({ async get() { return { empty: true, docs: [] }; } }) }),
          add: async () => ({}),
        }),
      }), { FieldValue: { increment: (n) => n } }),
    };
  }
  return realLoad.apply(this, arguments);
};

globalThis.fetch = async (url, opts) => {
  const u = String(url);
  if (u.includes('send-email')) sentEmails.push(JSON.parse(opts.body));
  return { ok: true, status: 200, async text() { return ''; } };
};

process.env.PUBLIC_URL = 'https://courtdraw.app';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
process.env.FIREBASE_PRIVATE_KEY = 'x';
process.env.STRIPE_PRICE_ID_PRO_MONTHLY = 'price_pro_m';
process.env.STRIPE_PRICE_ID_PRO_YEARLY  = 'price_pro_y';
process.env.STRIPE_PRICE_ID_CLUB        = 'price_club';

const { handler } = require(path.join(ROOT, 'netlify/functions/webhook.js'));

// `payment_status` defaults to 'paid' — NOT the value the old gate wanted.
const checkout = (over = {}) => handler({
  httpMethod: 'POST',
  headers: { 'stripe-signature': 'sig' },
  body: JSON.stringify({
    type: 'checkout.session.completed',
    data: { object: {
      customer: 'cus_1',
      customer_email: 'coach@example.com',
      subscription: 'sub_1',
      payment_status: 'paid',
      metadata: { priceId: 'price_pro_m', userId: 'u1' },
      ...over,
    } },
  }),
});

// ── The regression ───────────────────────────────────────────────────────────
test('a trial is captured even when payment_status is not no_payment_required', async () => {
  resetWorld();
  await checkout({ payment_status: 'paid' });
  const d = userDocs.u1;
  assert(d.isTrialing === true, 'isTrialing not set');
  assert(d.trialEndsAt === '2026-10-23T10:00:00.000Z', `trialEndsAt: ${d.trialEndsAt}`);
  assert(typeof d.trialStartedAt === 'string' && d.trialStartedAt.length > 0,
    `trialStartedAt: ${d.trialStartedAt}`);
});

test('the old payment_status value still works', async () => {
  resetWorld();
  await checkout({ payment_status: 'no_payment_required' });
  assert(userDocs.u1.trialStartedAt, 'trialStartedAt missing');
});

test('a missing payment_status does not prevent capture', async () => {
  resetWorld();
  await checkout({ payment_status: undefined });
  assert(userDocs.u1.trialStartedAt, 'trialStartedAt missing');
});

test('trialStartedAt is a parseable timestamp the report can subtract from', async () => {
  resetWorld();
  await checkout();
  const ms = Date.parse(userDocs.u1.trialStartedAt);
  assert(!Number.isNaN(ms), `unparseable: ${userDocs.u1.trialStartedAt}`);
});

test('the amount and currency the banner names are captured', async () => {
  resetWorld();
  await checkout();
  assert(userDocs.u1.trialAmount === 600, `trialAmount: ${userDocs.u1.trialAmount}`);
  assert(userDocs.u1.trialCurrency === 'EUR', `trialCurrency: ${userDocs.u1.trialCurrency}`);
});

// ── Non-trial checkouts must stay clean ──────────────────────────────────────
test('a subscription with no trial_end writes no trial fields', async () => {
  resetWorld();
  subscription = { id: 'sub_1', status: 'active', trial_end: null, items: { data: [] } };
  await checkout();
  const d = userDocs.u1;
  assert(d.isTrialing === undefined, 'isTrialing should be absent');
  assert(d.trialEndsAt === undefined, 'trialEndsAt should be absent');
  assert(d.trialStartedAt === undefined, 'trialStartedAt should be absent');
});

test('the base fields are written either way', async () => {
  resetWorld();
  subscription = { id: 'sub_1', status: 'active', trial_end: null, items: { data: [] } };
  await checkout();
  assert(userDocs.u1.plan === 'pro', `plan: ${userDocs.u1.plan}`);
  assert(userDocs.u1.stripeCustomerId === 'cus_1', `customer: ${userDocs.u1.stripeCustomerId}`);
  assert(userDocs.u1.subscribedAt, 'subscribedAt missing');
});

// ── The welcome email rides on the same decision ─────────────────────────────
test('a trialing Pro checkout sends the trial email, not the payment receipt', async () => {
  resetWorld();
  await checkout({ payment_status: 'paid' });
  assert(sentEmails.length === 1, `expected 1 email, got ${sentEmails.length}`);
  assert(sentEmails[0].template === 'proTrialStarted',
    `got ${sentEmails[0].template} — a coach on a free trial was told payment was confirmed`);
});

test('a trialing Club checkout sends clubTrialStarted', async () => {
  resetWorld();
  await checkout({ metadata: { priceId: 'price_club', userId: 'u1' } });
  assert(sentEmails[0].template === 'clubTrialStarted', `got ${sentEmails[0].template}`);
});

test('a non-trial Pro checkout still sends the payment receipt', async () => {
  resetWorld();
  subscription = { id: 'sub_1', status: 'active', trial_end: null, items: { data: [] } };
  await checkout();
  assert(sentEmails[0].template === 'paymentConfirmed', `got ${sentEmails[0].template}`);
});

// ── Diagnostics: this failure was silent for 37 checkouts ────────────────────
test('a successful capture is recorded', async () => {
  resetWorld();
  await checkout();
  const t = diagnostics.trialCapture;
  assert(t, 'no trialCapture diagnostics written');
  assert(t.wrote === true, `wrote: ${t.wrote}`);
  assert(t.reason === 'trial fields written', `reason: ${t.reason}`);
  assert(t.subStatus === 'trialing', `subStatus: ${t.subStatus}`);
  assert(!Number.isNaN(Date.parse(t.at)), `at: ${t.at}`);
});

test('a subscription without a trial is recorded as such, with the payment_status', async () => {
  resetWorld();
  subscription = { id: 'sub_1', status: 'active', trial_end: null, items: { data: [] } };
  await checkout({ payment_status: 'paid' });
  const t = diagnostics.trialCapture;
  assert(t.wrote === false, `wrote: ${t.wrote}`);
  assert(t.reason === 'subscription carries no trial_end', `reason: ${t.reason}`);
  assert(t.paymentStatus === 'paid', `paymentStatus: ${t.paymentStatus}`);
});

test('a failed subscriptions.retrieve is recorded rather than swallowed', async () => {
  resetWorld();
  retrieveError = 'No such subscription';
  await checkout();
  const t = diagnostics.trialCapture;
  assert(t.wrote === false, `wrote: ${t.wrote}`);
  assert(/retrieve failed: No such subscription/.test(t.reason), `reason: ${t.reason}`);
});

test('a checkout with no subscription is recorded', async () => {
  resetWorld();
  await checkout({ subscription: undefined });
  const t = diagnostics.trialCapture;
  assert(t.wrote === false, `wrote: ${t.wrote}`);
  assert(t.reason === 'no session.subscription', `reason: ${t.reason}`);
  assert(retrieveCalls.length === 0, 'Stripe was called with no subscription id');
});

// ── Failures stay non-fatal: access must not depend on trial bookkeeping ─────
test('a failed retrieve still grants the plan and acknowledges the webhook', async () => {
  resetWorld();
  retrieveError = 'Stripe is down';
  const res = await checkout();
  assert(res.statusCode === 200, `got ${res.statusCode}`);
  assert(userDocs.u1.plan === 'pro', `plan: ${userDocs.u1.plan}`);
});

test('a price with no usable unit_amount leaves the amount out rather than guessing', async () => {
  // unit_amount is present but null — a metered or tiered price. Writing it
  // through would put `null` on the doc, and the banner would name no figure
  // while believing it had one.
  resetWorld();
  subscription.items = { data: [{ price: { unit_amount: null, currency: 'eur' } }] };
  await checkout();
  assert(userDocs.u1.trialStartedAt, 'the trial should still be captured');
  assert(!('trialAmount' in userDocs.u1),
    `trialAmount should be absent, got ${JSON.stringify(userDocs.u1.trialAmount)}`);
  assert(!('trialCurrency' in userDocs.u1),
    `trialCurrency should be absent, got ${JSON.stringify(userDocs.u1.trialCurrency)}`);
});

let pass = 0, fail = 0;
for (const t of tests) {
  try { await t.fn(); console.log(`  ✓ ${t.name}`); pass++; }
  catch (e) { console.log(`  ✗ ${t.name}\n      ${e.message}`); fail++; }
}
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
