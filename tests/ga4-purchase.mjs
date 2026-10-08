// Tests for the server-side sale report: netlify/functions/_ga4.js and the
// trialing → active branch of webhook.js.
//
// This is the only place a sale is ever recorded. Every plan is sold as a
// 7-day trial, so success.html only ever sees a trial start — its 'purchase'
// branch was unreachable from the day it was written, which is why GA4 showed
// $0.00 of lifetime revenue. The real charge lands seven days later with no
// browser open, so if this path is wrong there is no second chance and no
// visible symptom: the money arrives in Stripe and the report stays empty.
//
// Run: node tests/ga4-purchase.mjs

import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// ── Captured side effects ─────────────────────────────────────────────────────
let ga4Hits = [];      // Measurement Protocol calls
let sentEmails = [];   // send-email calls
let userDocs = {};
let failGa4 = false;   // make the GA4 endpoint throw
let ga4Status = 204;   // or answer with a status code

function resetWorld(userData = {}) {
  ga4Hits = [];
  sentEmails = [];
  failGa4 = false;
  ga4Status = 204;
  userDocs = {
    u1: {
      email: 'coach@example.com',
      plan: 'club',
      stripeCustomerId: 'cus_1',
      gaClientId: '1234567890.1234567890',
      ...userData,
    },
  };
}

// ── Stubs ─────────────────────────────────────────────────────────────────────
const Module = require('module');
const realLoad = Module._load;
Module._load = function (request) {
  if (request === 'stripe') {
    return () => ({
      webhooks: { constructEvent: (body) => JSON.parse(body) },
      subscriptions: { retrieve: async () => ({}) },
    });
  }
  if (request === 'firebase-admin') {
    const snapshot = (id) => (userDocs[id] ? { ...userDocs[id] } : undefined);
    const docRef = (id) => ({
      async get() { return { exists: !!userDocs[id], data: () => snapshot(id) }; },
      async update(patch) { Object.assign(userDocs[id], patch); },
      async set(patch) { Object.assign(userDocs[id] ||= {}, patch); },
    });
    return {
      apps: [{}],
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
                  docs: ids.map(id => ({ data: () => snapshot(id), ref: docRef(id) })),
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

// One fetch stub serving both destinations; they are told apart by URL.
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  if (u.includes('google-analytics.com')) {
    if (failGa4) throw new Error('simulated network failure');
    if (ga4Status >= 400) return { ok: false, status: ga4Status, async text() { return 'rejected'; } };
    ga4Hits.push({ url: u, body: JSON.parse(opts.body) });
    return { ok: true, status: 204, async text() { return ''; } };
  }
  sentEmails.push(JSON.parse(opts.body));
  return { ok: true, status: 200, async text() { return ''; } };
};

process.env.PUBLIC_URL = 'https://courtdraw.app';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
process.env.FIREBASE_PRIVATE_KEY = 'x';
process.env.GA4_API_SECRET = 'test-secret';

const { handler } = require(path.join(ROOT, 'netlify/functions/webhook.js'));
const { isValidClientId, sendGa4Event } = require(path.join(ROOT, 'netlify/functions/_ga4.js'));

// ── Helpers ───────────────────────────────────────────────────────────────────
function trialConverted({ unit_amount = 9900, currency = 'eur', id = 'sub_1', withPrice = true } = {}) {
  return {
    type: 'customer.subscription.updated',
    data: {
      object: {
        id,
        customer: 'cus_1',
        status: 'active',
        items: withPrice ? { data: [{ price: { unit_amount, currency } }] } : { data: [] },
      },
      previous_attributes: { status: 'trialing' },
    },
  };
}

const fire = (evt) => handler({ headers: { 'stripe-signature': 'sig' }, body: JSON.stringify(evt) });
const purchases = () => ga4Hits.filter(h => h.body.events[0].name === 'purchase');
const firstPurchase = () => purchases()[0].body.events[0].params;

// ── Tests: the sale is reported at all ────────────────────────────────────────

test('a trial converting to paid reports a purchase to GA4', async () => {
  // The whole point. Before this, nothing anywhere recorded a sale.
  resetWorld();
  await fire(trialConverted());
  assert(purchases().length === 1, `expected one purchase, got ${purchases().length}`);
  assert(ga4Hits[0].body.client_id === '1234567890.1234567890',
    `must be attributed to the visitor, got ${ga4Hits[0].body.client_id}`);
});

test('it reports the real amount and currency, not an assumed one', async () => {
  // Checkout bills in five currencies and the plan may have changed since the
  // trial began, so the figure is read off the subscription.
  for (const [unit_amount, currency, expected] of [
    [9900, 'eur', ['EUR', 99]],
    [600,  'usd', ['USD', 6]],
    [4900, 'gbp', ['GBP', 49]],
  ]) {
    resetWorld();
    await fire(trialConverted({ unit_amount, currency }));
    const p = firstPurchase();
    assert(p.currency === expected[0], `expected ${expected[0]}, got ${p.currency}`);
    assert(p.value === expected[1], `expected ${expected[1]}, got ${p.value}`);
    assert(p.items[0].price === expected[1], 'the line item must carry the same figure');
  }
});

test('the transaction id is the subscription, so GA4 can dedupe too', async () => {
  resetWorld();
  await fire(trialConverted({ id: 'sub_abc' }));
  assert(firstPurchase().transaction_id === 'sub_abc',
    `expected the subscription id, got ${firstPurchase().transaction_id}`);
});

test('the plan is named from the user record', async () => {
  resetWorld({ plan: 'pro' });
  await fire(trialConverted({ unit_amount: 600, currency: 'eur' }));
  assert(firstPurchase().items[0].item_name === 'Pro Plan',
    `got ${firstPurchase().items[0].item_name}`);
});

// ── Tests: it is reported exactly once ────────────────────────────────────────

test('a re-delivered event neither double-counts the sale nor re-emails', async () => {
  // Stripe explicitly re-delivers on retry. Counting one sale twice is worse
  // than not counting it: it silently inflates the only revenue figure there is.
  resetWorld();
  await fire(trialConverted());
  assert(purchases().length === 1 && sentEmails.length === 1, 'first delivery should do both');
  await fire(trialConverted());
  assert(purchases().length === 1, `re-delivery must not re-report, got ${purchases().length}`);
  assert(sentEmails.length === 1, `re-delivery must not re-email, got ${sentEmails.length}`);
});

// ── Tests: analytics must never cost a customer their access ──────────────────

test('a GA4 outage does not stop the conversion being recorded', async () => {
  // The customer has been charged by this point. A failed analytics call must
  // not take down the handler that grants them what they paid for.
  resetWorld();
  failGa4 = true;
  await fire(trialConverted());
  assert(userDocs.u1.trialConverted === true, 'the account must still be marked converted');
  assert(sentEmails.length === 1, 'the confirmation email must still go out');
});

test('a visitor with no GA4 cookie still gets their access and their email', async () => {
  // Ad blocker, declined consent, or a checkout that beat the cookie.
  resetWorld({ gaClientId: undefined });
  await fire(trialConverted());
  assert(purchases().length === 0, 'nothing to attribute, so nothing is sent');
  assert(userDocs.u1.trialConverted === true, 'access is unaffected');
  assert(sentEmails.length === 1, 'the email is unaffected');
});

test('an unconfigured API secret is survivable', async () => {
  resetWorld();
  const saved = process.env.GA4_API_SECRET;
  delete process.env.GA4_API_SECRET;
  try {
    await fire(trialConverted());
    assert(purchases().length === 0, 'no secret, no call');
    assert(userDocs.u1.trialConverted === true, 'everything else still works');
  } finally {
    process.env.GA4_API_SECRET = saved;
  }
});

test('a price Stripe could not give us reports zero rather than throwing', async () => {
  resetWorld();
  await fire(trialConverted({ withPrice: false }));
  assert(userDocs.u1.trialConverted === true, 'the conversion is still recorded');
  if (purchases().length) {
    assert(firstPurchase().value === 0, `expected 0, got ${firstPurchase().value}`);
  }
});

// ── Tests: the module's own contract ──────────────────────────────────────────
// webhook.js also wraps the call in a try/catch, so a throw from here would be
// swallowed there and the behaviour tests above would pass regardless. That
// makes this contract invisible to them — and a later cleanup that trusted the
// documented "never throws" and dropped the outer catch would have no guard
// left. Tested directly instead.

test('sendGa4Event resolves false on a network failure, never rejects', async () => {
  resetWorld();
  failGa4 = true;
  const out = await sendGa4Event('1234567890.1234567890', 'purchase', { value: 1 });
  assert(out === false, `expected false, got ${out}`);
});

test('sendGa4Event resolves false when GA4 rejects the request', async () => {
  resetWorld();
  ga4Status = 400;
  const out = await sendGa4Event('1234567890.1234567890', 'purchase', { value: 1 });
  assert(out === false, `a non-2xx must report failure, got ${out}`);
});

test('sendGa4Event reports success only when GA4 accepted it', async () => {
  resetWorld();
  const out = await sendGa4Event('1234567890.1234567890', 'purchase', { value: 1 });
  assert(out === true, `expected true on a clean send, got ${out}`);
  assert(ga4Hits.length === 1, 'and it should actually have gone out');
  assert(ga4Hits[0].url.includes('api_secret=test-secret'), 'the secret must be on the query string');
});

// ── Tests: client id validation ───────────────────────────────────────────────

test('only a well-formed client id is accepted', async () => {
  for (const good of ['1234567890.1234567890', '1.1', '999999999.1700000000']) {
    assert(isValidClientId(good), `${good} should be valid`);
  }
  for (const bad of [
    '', null, undefined, 42, 'GA1.1.123.456', 'abc.def', '123', '123.', '.123',
    '123.456.789', '1'.repeat(40) + '.' + '1'.repeat(40),   // over the length cap
    '123.456&api_secret=leak',                              // injection attempt
  ]) {
    assert(!isValidClientId(bad), `${JSON.stringify(bad)} should be rejected`);
  }
});

test('a tampered client id never reaches the wire', async () => {
  // It arrives from the browser, so it is attacker-controlled in principle.
  resetWorld({ gaClientId: '123.456&api_secret=leak' });
  await fire(trialConverted());
  assert(purchases().length === 0, 'a malformed id must be dropped, not sent');
});

// ── Runner ────────────────────────────────────────────────────────────────────
let passed = 0; const failures = [];
for (const t of tests) {
  try { await t.fn(); console.log(`  ✓ ${t.name}`); passed++; }
  catch (e) { console.log(`  ✗ ${t.name}\n      ${e.message}`); failures.push(t.name); }
}
console.log(`\n${passed}/${tests.length} passed`);
process.exit(failures.length ? 1 : 0);
