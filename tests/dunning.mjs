// Tests for the dunning path: invoice.payment_failed and the two ways a
// subscription can end.
//
// This is the code that decides what a paying customer hears when their card
// stops working, and it only ever runs on Netlify against live Stripe. The
// money at stake is not hypothetical: of the failed renewals so far, one in
// seven recovered, and the great majority of what was lost was the annual Club
// charge. A mistake here is invisible until someone has already churned, so the
// handler is exercised against stubs rather than trusted.
//
// Run: node tests/dunning.mjs

import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// ── Captured side effects ─────────────────────────────────────────────────────
let sentEmails = [];
let userDocs = {};

function resetWorld(userData = {}) {
  sentEmails = [];
  userDocs = { u1: { email: 'coach@example.com', plan: 'club', stripeCustomerId: 'cus_1', ...userData } };
}

// ── Stubs, installed before the handler is required ───────────────────────────
// stripe and firebase-admin are Netlify runtime concerns, deliberately absent
// from package.json (no build step, so npm install must stay a no-op), hence
// intercepting the module load rather than installing them.
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
    // data() hands back a copy, as a real Firestore snapshot does: it is a
    // point-in-time read and a later update() must not reach back and change
    // it. A live reference here would quietly mask reading a field after the
    // write that overwrote it.
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

globalThis.fetch = async (url, opts) => {
  sentEmails.push(JSON.parse(opts.body));
  return { ok: true, status: 200, async text() { return ''; } };
};

process.env.PUBLIC_URL = 'https://courtdraw.app';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
process.env.FIREBASE_PRIVATE_KEY = 'x';

const { handler } = require(path.join(ROOT, 'netlify/functions/webhook.js'));

// ── Helpers ───────────────────────────────────────────────────────────────────
const DAY = 86400;
const SOON = Math.floor(Date.now() / 1000) + 2 * DAY;

function failedInvoice({ attempt_count = 2, next_payment_attempt = SOON, amount_due = 9900,
                         currency = 'eur', billing_reason = 'subscription_cycle',
                         id = 'in_1', customer_email = 'invoice@example.com' } = {}) {
  return {
    type: 'invoice.payment_failed',
    data: { object: { id, customer: 'cus_1', customer_email, attempt_count,
                      next_payment_attempt, amount_due, currency, billing_reason } },
  };
}

function subDeleted({ reason = 'cancellation_requested', withDetails = true } = {}) {
  return {
    type: 'customer.subscription.deleted',
    data: { object: { customer: 'cus_1',
                      ...(withDetails ? { cancellation_details: { reason } } : {}) } },
  };
}

const fire = (evt) => handler({ headers: { 'stripe-signature': 'sig' }, body: JSON.stringify(evt) });
const templatesSent = () => sentEmails.map(m => m.template);

// ── Tests: escalation ─────────────────────────────────────────────────────────

test('the retries escalate instead of repeating one mail', async () => {
  // The defect this exists to prevent: attempts 2, 3 and 4 all fired the same
  // template, so the last warning before cancellation read like the first.
  resetWorld();
  await fire(failedInvoice({ attempt_count: 2, next_payment_attempt: SOON }));
  await fire(failedInvoice({ attempt_count: 3, next_payment_attempt: SOON + 2 * DAY }));
  await fire(failedInvoice({ attempt_count: 4, next_payment_attempt: null }));

  assert(sentEmails.length === 3, `expected 3 mails, got ${sentEmails.length}`);
  assert(templatesSent()[2] === 'paymentFailedFinal',
    `the last attempt must send the final notice, got ${templatesSent()[2]}`);
  const dates = sentEmails.slice(0, 2).map(m => m.templateData.retryDate);
  assert(dates[0] && dates[1] && dates[0] !== dates[1],
    `the two notices must name different retry dates, got ${JSON.stringify(dates)}`);
});

test('the final notice follows Stripe, not a hardcoded attempt number', async () => {
  // The retry schedule is configurable in the dashboard. An empty
  // next_payment_attempt is Stripe saying it has stopped trying, whenever
  // that happens — keying on a count would send "last attempt" at the wrong
  // time if the schedule were ever shortened.
  resetWorld();
  await fire(failedInvoice({ attempt_count: 2, next_payment_attempt: null }));
  assert(templatesSent()[0] === 'paymentFailedFinal',
    `no further retry scheduled means final notice, got ${templatesSent()[0]}`);
});

// ── Tests: what the mail says ─────────────────────────────────────────────────

test('names the plan from the user record, not a hardcoded Pro', async () => {
  // Most of the revenue lost to failed payments has been the annual Club
  // renewal, and this mail used to tell those customers their "Pro" access
  // was at risk.
  resetWorld({ plan: 'club' });
  await fire(failedInvoice());
  assert(sentEmails[0].templateData.planName === 'Club',
    `Club customer must be told Club, got ${sentEmails[0].templateData.planName}`);

  resetWorld({ plan: 'pro' });
  await fire(failedInvoice());
  assert(sentEmails[0].templateData.planName === 'Pro', 'Pro customer must be told Pro');
});

test('names the amount in the currency actually billed', async () => {
  for (const [currency, symbol, notSymbols] of [
    ['eur', '€', ['$', '£']],
    ['usd', '$', ['€', '£']],
    ['gbp', '£', ['€', '$']],
  ]) {
    resetWorld();
    await fire(failedInvoice({ currency, amount_due: 9900 }));
    const txt = sentEmails[0].templateData.amountText;
    assert(txt.includes(symbol), `${currency}: expected ${symbol}, got ${txt}`);
    assert(txt.includes('99'), `${currency}: expected the figure, got ${txt}`);
    for (const wrong of notSymbols) {
      assert(!txt.includes(wrong), `${currency}: must not contain ${wrong}, got ${txt}`);
    }
  }
});

test('still warns when the amount cannot be read, without inventing one', async () => {
  for (const evt of [
    failedInvoice({ amount_due: null }),
    failedInvoice({ currency: null }),
    failedInvoice({ currency: 'NOTACURRENCY' }),
  ]) {
    resetWorld();
    await fire(evt);
    assert(sentEmails.length === 1, 'the warning must still go out');
    assert(sentEmails[0].templateData.amountText === '',
      `expected no figure, got "${sentEmails[0].templateData.amountText}"`);
  }
});

test('templateData key order matches both template signatures', async () => {
  // send-email spreads templateData positionally:
  //   templates[t](email, ...Object.values(templateData))
  // so a reordered object silently swaps the arguments.
  resetWorld();
  await fire(failedInvoice({ next_payment_attempt: SOON }));
  assert(JSON.stringify(Object.keys(sentEmails[0].templateData))
    === JSON.stringify(['planName', 'amountText', 'retryDate']),
    `paymentFailed(email, planName, amountText, retryDate), got ${JSON.stringify(Object.keys(sentEmails[0].templateData))}`);

  resetWorld();
  await fire(failedInvoice({ next_payment_attempt: null }));
  assert(JSON.stringify(Object.keys(sentEmails[0].templateData))
    === JSON.stringify(['planName', 'amountText']),
    `paymentFailedFinal(email, planName, amountText), got ${JSON.stringify(Object.keys(sentEmails[0].templateData))}`);
});

// ── Tests: who gets it, and how often ─────────────────────────────────────────

test('a re-delivered event does not mail the customer twice', async () => {
  resetWorld();
  await fire(failedInvoice({ attempt_count: 3 }));
  await fire(failedInvoice({ attempt_count: 3 }));
  assert(sentEmails.length === 1, `re-delivery must not resend, got ${sentEmails.length}`);
});

test('a second invoice later is dunned on its own merits', async () => {
  // The dedupe key must not silence a genuinely new failure months later.
  resetWorld();
  await fire(failedInvoice({ id: 'in_1', attempt_count: 2 }));
  await fire(failedInvoice({ id: 'in_2', attempt_count: 2 }));
  assert(sentEmails.length === 2, `a new invoice must warn again, got ${sentEmails.length}`);
});

test('prefers the account address, falling back to the invoice', async () => {
  resetWorld({ email: 'account@example.com' });
  await fire(failedInvoice({ customer_email: 'invoice@example.com' }));
  assert(sentEmails[0].email === 'account@example.com',
    `should mail the account, got ${sentEmails[0].email}`);

  resetWorld();
  userDocs = {};                                   // no account for this customer
  await fire(failedInvoice({ customer_email: 'invoice@example.com' }));
  assert(sentEmails.length === 1 && sentEmails[0].email === 'invoice@example.com',
    'with no account, the invoice address is better than silence');
});

test('the first invoice of a new subscription is never dunned', async () => {
  // checkout.session.completed is the authoritative signal there, and Stripe
  // fires payment_failed transiently during 3D Secure.
  resetWorld();
  await fire(failedInvoice({ billing_reason: 'subscription_create', attempt_count: 2 }));
  await fire(failedInvoice({ billing_reason: 'subscription_create', next_payment_attempt: null }));
  assert(sentEmails.length === 0, `new-subscription failures must stay quiet, got ${templatesSent()}`);
});

test('the very first attempt is not dunned', async () => {
  resetWorld();
  await fire(failedInvoice({ attempt_count: 1 }));
  assert(sentEmails.length === 0, 'Stripe retries once before we say anything');
});

// ── Tests: the two ways a subscription ends ───────────────────────────────────

test('a card that kept failing does not get a goodbye mail', async () => {
  // Involuntary churn is recoverable: that coach still wants the product.
  resetWorld({ plan: 'club' });
  await fire(subDeleted({ reason: 'payment_failed' }));
  assert(templatesSent()[0] === 'reactivateAfterFailure',
    `payment failure must get the reactivation mail, got ${templatesSent()[0]}`);
  assert(userDocs.u1.plan === 'free', 'access is still revoked either way');
});

test('a disputed payment is treated the same way', async () => {
  resetWorld();
  await fire(subDeleted({ reason: 'payment_disputed' }));
  assert(templatesSent()[0] === 'reactivateAfterFailure', 'a dispute is not a goodbye either');
});

test('someone who actually cancelled still gets the goodbye mail', async () => {
  resetWorld();
  await fire(subDeleted({ reason: 'cancellation_requested' }));
  assert(templatesSent()[0] === 'cancellation',
    `a real cancellation must keep its mail, got ${templatesSent()[0]}`);
});

test('an unknown reason keeps the existing mail rather than guessing', async () => {
  for (const evt of [subDeleted({ withDetails: false }), subDeleted({ reason: null })]) {
    resetWorld();
    await fire(evt);
    assert(templatesSent()[0] === 'cancellation',
      `an unstated reason must not regress, got ${templatesSent()[0]}`);
  }
});

test('the reactivation mail names the plan they had, not the one they are on now', async () => {
  // The same handler downgrades the record to 'free'. Reading the plan after
  // that write would offer a Club customer their "Pro" plan back.
  resetWorld({ plan: 'club' });
  await fire(subDeleted({ reason: 'payment_failed' }));
  assert(sentEmails[0].templateData.planName === 'Club',
    `should offer Club back, got ${sentEmails[0].templateData.planName}`);
});

// ── Tests: the templates actually render ──────────────────────────────────────
// Everything above stubs the HTTP call to send-email, so the templates
// themselves never run. They are reached by spreading templateData
// positionally, which is exactly the seam that fails silently: a wrong key
// order or arity does not throw, it renders the word "undefined" into a mail
// about someone's money. So render them here with the arguments the handler
// above was observed to produce.

// Driven through send-email's real handler rather than by exporting its
// internals, so the dispatch and the positional spread under test are the
// same code that runs in production.
let lastPayload = null;
const sendEmailHandler = (() => {
  const prevLoad = Module._load;
  Module._load = function (request) {
    if (request === 'resend') {
      return { Resend: class {
        constructor() { this.emails = { send: async (payload) => { lastPayload = payload; return {}; } }; }
      } };
    }
    return prevLoad.apply(this, arguments);
  };
  process.env.INTERNAL_SECRET = 'test-secret';
  try { return require(path.join(ROOT, 'netlify/functions/send-email.js')).handler; }
  finally { Module._load = prevLoad; }
})();

async function render(template, email, templateData) {
  lastPayload = null;
  const res = await sendEmailHandler({
    httpMethod: 'POST',
    headers: { 'x-internal-secret': 'test-secret' },
    body: JSON.stringify({ template, email, templateData }),
  });
  assert(res.statusCode === 200, `send-email rejected ${template}: ${res.statusCode} ${res.body}`);
  assert(lastPayload, `${template} produced no payload`);
  return lastPayload;
}

test('the dunning templates render the values they are handed', async () => {
  resetWorld({ plan: 'club' });
  await fire(failedInvoice({ attempt_count: 2, next_payment_attempt: SOON, amount_due: 9900, currency: 'eur' }));
  const notice = await render('paymentFailed', 'coach@example.com', sentEmails[0].templateData);

  assert(notice.html.includes('Club'), 'the notice must name the plan');
  assert(notice.html.includes('€99'), 'the notice must name the amount');
  assert(notice.html.includes(sentEmails[0].templateData.retryDate), 'the notice must name the retry date');
  assert(notice.subject.includes('Club'), `subject should name the plan, got: ${notice.subject}`);
  assert(notice.html.includes('?billing=1'), 'the CTA must deep-link to billing');
});

test('no template renders the word undefined into a mail about money', async () => {
  // The failure mode of positional spreading. A missing or reordered key does
  // not throw — it ships "your undefined renewal did not go through".
  resetWorld({ plan: 'club' });
  await fire(failedInvoice({ next_payment_attempt: SOON }));
  await fire(failedInvoice({ attempt_count: 4, next_payment_attempt: null }));
  await fire(subDeleted({ reason: 'payment_failed' }));
  assert(sentEmails.length === 3, `expected all three mails, got ${templatesSent()}`);

  for (const m of sentEmails) {
    const out = await render(m.template, m.email, m.templateData);
    for (const field of ['subject', 'html', 'text']) {
      const hit = String(out[field]).match(/.{0,60}undefined.{0,60}/);
      assert(!hit, hit && `${m.template}.${field} contains "undefined": ${hit[0]}`);
    }
  }
});

test('the final notice does not promise another retry', async () => {
  // It is the last attempt. Saying "we will try again" there is the whole
  // reason a separate template exists.
  resetWorld();
  await fire(failedInvoice({ attempt_count: 4, next_payment_attempt: null }));
  const final = await render('paymentFailedFinal', 'coach@example.com', sentEmails[0].templateData);
  assert(!/try again/i.test(final.html), 'the final notice must not promise another attempt');
  assert(/final|last/i.test(final.html), 'the final notice must say it is the last one');
});

test('the reactivation mail sends them somewhere that works', async () => {
  // Stripe has deleted the subscription by this point, so the billing portal
  // has nothing left to update — the link has to go to pricing.
  resetWorld({ plan: 'club' });
  await fire(subDeleted({ reason: 'payment_failed' }));
  const mail = await render('reactivateAfterFailure', 'coach@example.com', sentEmails[0].templateData);
  assert(mail.html.includes('#pricing'), 'must link to pricing, where resubscribing is possible');
  assert(!mail.html.includes('?billing=1'), 'the billing portal is a dead end for a deleted subscription');
  assert(mail.html.includes('Club'), 'must offer back the plan they lost');
});

// ── Runner ────────────────────────────────────────────────────────────────────
let passed = 0; const failures = [];
for (const t of tests) {
  try { await t.fn(); console.log(`  ✓ ${t.name}`); passed++; }
  catch (e) { console.log(`  ✗ ${t.name}\n      ${e.message}`); failures.push(t.name); }
}
console.log(`\n${passed}/${tests.length} passed`);
process.exit(failures.length ? 1 : 0);
