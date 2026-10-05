// Tests for the customer.subscription.trial_will_end webhook handler.
//
// This handler only ever runs on Netlify, against live Stripe and Firestore,
// three days before a real customer is charged. A mistake in it is invisible
// until someone is billed without warning — which is the exact failure it was
// written to prevent. So it is exercised here against stubs rather than
// trusted, with the currency handling tested hardest: checkout bills in five
// currencies, and naming an amount the customer will never be charged is worse
// than naming none.
//
// Run: node tests/trial-reminder.mjs

import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// ── Captured side effects ─────────────────────────────────────────────────────
let sentEmails = [];     // what would have gone to the customer
let userDocs = {};       // the users collection
let docUpdates = [];     // writes back to Firestore

function resetWorld(userData = {}) {
  sentEmails = [];
  docUpdates = [];
  userDocs = { u1: { email: 'coach@example.com', plan: 'club', stripeCustomerId: 'cus_1', ...userData } };
}

// ── Stubs, installed before the handler is required ───────────────────────────
// stripe, firebase-admin and fetch are all Netlify runtime concerns and are
// deliberately absent from package.json (no build step, so npm install must
// stay a no-op), hence intercepting the module load rather than installing them.
const Module = require('module');
const realLoad = Module._load;
Module._load = function (request) {
  if (request === 'stripe') {
    return () => ({
      webhooks: {
        // The handler verifies the signature first; hand back the event we planted.
        constructEvent: (body) => JSON.parse(body),
      },
      subscriptions: { retrieve: async () => ({}) },
    });
  }
  if (request === 'firebase-admin') {
    const docRef = (id) => ({
      async get() { return { exists: !!userDocs[id], data: () => userDocs[id] }; },
      async update(patch) { docUpdates.push({ id, patch }); Object.assign(userDocs[id], patch); },
      async set(patch) { docUpdates.push({ id, patch }); Object.assign(userDocs[id] ||= {}, patch); },
      ref: null,
    });
    return {
      apps: [{}],                       // already initialised — skip initializeApp
      initializeApp() {},
      credential: { cert: () => ({}) },
      firestore: Object.assign(() => ({
        collection: () => ({
          doc: docRef,
          where: () => ({
            limit: () => ({
              async get() {
                const ids = Object.keys(userDocs);
                return {
                  empty: ids.length === 0,
                  docs: ids.map(id => ({ data: () => userDocs[id], ref: docRef(id) })),
                };
              },
            }),
          }),
        }),
      }), { FieldValue: { increment: (n) => n } }),
    };
  }
  return realLoad.apply(this, arguments);
};

// The handler posts to the send-email function over HTTP; capture instead.
globalThis.fetch = async (url, opts) => {
  sentEmails.push(JSON.parse(opts.body));
  return { ok: true, status: 200, async text() { return ''; } };
};

process.env.PUBLIC_URL = 'https://courtdraw.app';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
process.env.FIREBASE_PRIVATE_KEY = 'x';

const { handler } = require(path.join(ROOT, 'netlify/functions/webhook.js'));

// ── Helpers ───────────────────────────────────────────────────────────────────
const THREE_DAYS = Math.floor(Date.now() / 1000) + 3 * 86400;

function trialWillEndEvent({ unit_amount = 9900, currency = 'eur', trial_end = THREE_DAYS,
                             cancel_at_period_end = false, withPrice = true } = {}) {
  return {
    type: 'customer.subscription.trial_will_end',
    data: {
      object: {
        customer: 'cus_1',
        trial_end,
        cancel_at_period_end,
        items: withPrice ? { data: [{ price: { unit_amount, currency } }] } : { data: [] },
      },
    },
  };
}

const fire = (evt) => handler({ headers: { 'stripe-signature': 'sig' }, body: JSON.stringify(evt) });

// ── Tests ─────────────────────────────────────────────────────────────────────

test('warns the customer three days out, naming the date and the amount', async () => {
  resetWorld();
  await fire(trialWillEndEvent());
  assert(sentEmails.length === 1, `expected exactly one email, got ${sentEmails.length}`);
  const m = sentEmails[0];
  assert(m.template === 'trialEndingSoon', `wrong template: ${m.template}`);
  assert(m.email === 'coach@example.com', `wrong recipient: ${m.email}`);
  assert(m.templateData.amountText.includes('99'), `amount missing: ${m.templateData.amountText}`);
  assert(/\d{1,2} \w+ \d{4}/.test(m.templateData.endDate),
    `end date should be a readable date, got: ${m.templateData.endDate}`);
  assert(m.templateData.planName === 'Club', `plan name wrong: ${m.templateData.planName}`);
});

test('names the amount in the currency the customer actually checked out with', async () => {
  // The whole reason the figure is read off the subscription instead of being a
  // constant. A euro figure shown to a US customer is worse than no figure.
  for (const [currency, symbol, notSymbols] of [
    ['eur', '€', ['$', '£']],
    ['usd', '$', ['€', '£']],
    ['gbp', '£', ['€', '$']],
  ]) {
    resetWorld();
    await fire(trialWillEndEvent({ currency, unit_amount: 9900 }));
    const txt = sentEmails[0].templateData.amountText;
    assert(txt.includes(symbol), `${currency}: expected ${symbol}, got ${txt}`);
    for (const wrong of notSymbols) {
      assert(!txt.includes(wrong), `${currency}: must not contain ${wrong}, got ${txt}`);
    }
  }
});

test('still warns when the price cannot be read, without inventing a figure', async () => {
  for (const evt of [
    trialWillEndEvent({ withPrice: false }),
    trialWillEndEvent({ unit_amount: null }),
    trialWillEndEvent({ currency: 'NOTACURRENCY' }),
  ]) {
    resetWorld();
    await fire(evt);
    assert(sentEmails.length === 1, 'the warning must still go out');
    const txt = sentEmails[0].templateData.amountText;
    assert(txt === '', `expected no figure, got "${txt}"`);
  }
});

test('a re-delivered event does not email the customer twice', async () => {
  // Stripe explicitly re-delivers events on retry.
  resetWorld();
  await fire(trialWillEndEvent());
  assert(sentEmails.length === 1, 'first delivery should send');
  await fire(trialWillEndEvent());
  assert(sentEmails.length === 1, `re-delivery must not resend, got ${sentEmails.length} emails`);
});

test('a later, genuinely different trial is still warned about', async () => {
  // The guard keys on this trial's end date, not a bare boolean, so it must not
  // silence a real second trial.
  resetWorld();
  await fire(trialWillEndEvent({ trial_end: THREE_DAYS }));
  await fire(trialWillEndEvent({ trial_end: THREE_DAYS + 90 * 86400 }));
  assert(sentEmails.length === 2, `a new trial should warn again, got ${sentEmails.length}`);
});

test('says nothing to someone who has already cancelled', async () => {
  // No charge is coming, so warning about one would be wrong and alarming.
  resetWorld();
  await fire(trialWillEndEvent({ cancel_at_period_end: true }));
  assert(sentEmails.length === 0, 'a cancelling customer must not be warned about a charge');
});

test('does not fall over when there is no matching user or email', async () => {
  resetWorld();
  userDocs = {};                                   // no user for this customer
  await fire(trialWillEndEvent());
  assert(sentEmails.length === 0, 'no user, no email');

  resetWorld({ email: undefined });                // user exists, no address
  await fire(trialWillEndEvent());
  assert(sentEmails.length === 0, 'no address, no email');
});

test('a Pro trial is named Pro, not Club', async () => {
  resetWorld({ plan: 'pro' });
  await fire(trialWillEndEvent());
  assert(sentEmails[0].templateData.planName === 'Pro', 'plan name should follow the user record');
});

test('templateData key order matches the template signature', async () => {
  // send-email spreads templateData positionally:
  //   templates[t](email, ...Object.values(templateData))
  // so a reordered object silently swaps the arguments.
  resetWorld();
  await fire(trialWillEndEvent());
  const keys = Object.keys(sentEmails[0].templateData);
  assert(JSON.stringify(keys) === JSON.stringify(['endDate', 'amountText', 'planName']),
    `key order must match trialEndingSoon(email, endDate, amountText, planName), got ${JSON.stringify(keys)}`);
});

// ── Runner ────────────────────────────────────────────────────────────────────
let passed = 0; const failures = [];
for (const t of tests) {
  try { await t.fn(); console.log(`  ✓ ${t.name}`); passed++; }
  catch (e) { console.log(`  ✗ ${t.name}\n      ${e.message}`); failures.push(t.name); }
}
console.log(`\n${passed}/${tests.length} passed`);
process.exit(failures.length ? 1 : 0);
