// Tests for netlify/functions/backfill-trial-dates.js.
//
// The webhook's trial branch never ran, so 37 accounts completed a checkout
// with no trialStartedAt and the activation report has no cohort. Stripe still
// holds the real dates. This endpoint reads them back.
//
// It writes to production user docs, so the things worth testing are the
// safeguards: GET changes nothing, a second run is a no-op, one bad customer
// does not abort the run, and a finished trial never gets marked live.
//
// Run: node tests/trial-backfill.mjs

import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

const T = (iso) => Math.floor(Date.parse(iso) / 1000);

let userDocs, diagnostics, subsByCustomer, writes, stripeError, writeError, listCalls;

function resetWorld() {
  userDocs = {};
  diagnostics = {};
  subsByCustomer = {};
  writes = [];
  stripeError = null;
  writeError = null;
  listCalls = [];
}
resetWorld();

const Module = require('module');
const realLoad = Module._load;
Module._load = function (request) {
  if (request === 'stripe') {
    return () => ({
      subscriptions: {
        list: async ({ customer }) => {
          listCalls.push(customer);
          if (stripeError) throw new Error(stripeError);
          return { data: subsByCustomer[customer] || [] };
        },
      },
    });
  }
  if (request === 'firebase-admin') {
    return {
      apps: [{}],
      initializeApp() {},
      credential: { cert: () => ({}) },
      auth: () => ({
        listUsers: async () => ({
          users: Object.keys(userDocs).map(uid => ({ uid })),
          pageToken: undefined,
        }),
      }),
      firestore: () => ({
        collection: (coll) => ({
          doc: (id) => ({
            async get() {
              return { exists: !!userDocs[id], data: () => ({ ...userDocs[id] }) };
            },
            async set(patch) {
              if (coll === 'diagnostics') { diagnostics[id] = patch; return; }
              if (writeError) throw new Error(writeError);
              writes.push({ uid: id, patch });
              Object.assign(userDocs[id], patch);
            },
          }),
        }),
      }),
    };
  }
  return realLoad.apply(this, arguments);
};

process.env.FIREBASE_PRIVATE_KEY = 'x';
process.env.STRIPE_SECRET_KEY = 'sk_test';
process.env.INTERNAL_SECRET = 's3cret';

const { handler } = require(path.join(ROOT, 'netlify/functions/backfill-trial-dates.js'));

const call = (opts = {}) => handler({
  httpMethod: 'GET', headers: { 'x-internal-secret': 's3cret' }, ...opts,
});
const dryRun = async (o) => JSON.parse((await call(o)).body);
const applyRun = async () => JSON.parse((await call({ httpMethod: 'POST' })).body);

// A customer whose trial Stripe still remembers.
function seedOneTrialUser() {
  userDocs = { u1: { plan: 'pro', stripeCustomerId: 'cus_1' } };
  subsByCustomer.cus_1 = [{
    id: 'sub_1', status: 'active',
    trial_start: T('2026-09-01T10:00:00Z'),
    trial_end:   T('2026-09-08T10:00:00Z'),
  }];
}

// ── Auth ─────────────────────────────────────────────────────────────────────
test('the header is required', async () => {
  resetWorld();
  const res = await call({ headers: {} });
  assert(res.statusCode === 401, `got ${res.statusCode}`);
});

test('a query parameter does NOT open a write endpoint', async () => {
  // The read-only reports accept ?secret= for convenience. This one writes, and
  // a URL that writes is a URL that gets clicked by accident.
  resetWorld();
  const res = await handler({
    httpMethod: 'POST', headers: {}, queryStringParameters: { secret: 's3cret' },
  });
  assert(res.statusCode === 401, `got ${res.statusCode}`);
});

test('a wrong secret is rejected', async () => {
  resetWorld();
  const res = await call({ headers: { 'x-internal-secret': 'nope' } });
  assert(res.statusCode === 401, `got ${res.statusCode}`);
});

test('with INTERNAL_SECRET unset nothing runs', async () => {
  resetWorld();
  delete process.env.INTERNAL_SECRET;
  try {
    const res = await call();
    assert(res.statusCode === 401, `got ${res.statusCode}`);
  } finally { process.env.INTERNAL_SECRET = 's3cret'; }
});

test('only GET and POST are accepted', async () => {
  resetWorld();
  for (const m of ['PUT', 'DELETE', 'PATCH']) {
    const res = await call({ httpMethod: m });
    assert(res.statusCode === 405, `${m} got ${res.statusCode}`);
  }
});

// ── Dry run is the default, and it is genuinely dry ──────────────────────────
test('GET writes nothing but reports exactly what it would write', async () => {
  resetWorld(); seedOneTrialUser();
  const r = await dryRun();
  assert(/DRY RUN/.test(r.mode), `mode: ${r.mode}`);
  assert(writes.length === 0, `GET wrote ${writes.length} docs`);
  assert(r.counts.planned === 1, `planned: ${r.counts.planned}`);
  assert(r.counts.written === 0, `written: ${r.counts.written}`);
  assert(r.changes[0].trialStartedAt === '2026-09-01T10:00:00.000Z',
    `trialStartedAt: ${r.changes[0].trialStartedAt}`);
  assert(r.changes[0].trialEndsAt === '2026-09-08T10:00:00.000Z',
    `trialEndsAt: ${r.changes[0].trialEndsAt}`);
  assert(userDocs.u1.trialStartedAt === undefined, 'the user doc was mutated by a dry run');
});

test('POST applies the same writes the dry run described', async () => {
  resetWorld(); seedOneTrialUser();
  const planned = (await dryRun()).changes;
  const r = await applyRun();
  assert(r.mode === 'APPLIED', `mode: ${r.mode}`);
  assert(r.counts.written === 1, `written: ${r.counts.written}`);
  assert(userDocs.u1.trialStartedAt === planned[0].trialStartedAt,
    'applied a different value than the dry run promised');
});

// ── Idempotence ──────────────────────────────────────────────────────────────
test('an account that already has trialStartedAt is left alone', async () => {
  resetWorld(); seedOneTrialUser();
  userDocs.u1.trialStartedAt = '2026-01-01T00:00:00.000Z';
  const r = await applyRun();
  assert(r.counts.alreadyHadTrialStart === 1, `skipped: ${r.counts.alreadyHadTrialStart}`);
  assert(r.counts.written === 0, `written: ${r.counts.written}`);
  assert(userDocs.u1.trialStartedAt === '2026-01-01T00:00:00.000Z', 'overwrote an existing value');
  assert(listCalls.length === 0, 'called Stripe for an account it was going to skip');
});

test('running twice writes once', async () => {
  resetWorld(); seedOneTrialUser();
  await applyRun();
  const second = await applyRun();
  assert(second.counts.written === 0, `second run wrote ${second.counts.written}`);
  assert(writes.length === 1, `total writes: ${writes.length}`);
});

// ── Who gets touched ─────────────────────────────────────────────────────────
test('accounts with no Stripe customer are skipped without calling Stripe', async () => {
  resetWorld();
  userDocs = { free1: { plan: 'free' }, free2: {} };
  const r = await applyRun();
  assert(r.counts.accountsScanned === 2, `scanned: ${r.counts.accountsScanned}`);
  assert(r.counts.withStripeCustomer === 0, `withCustomer: ${r.counts.withStripeCustomer}`);
  assert(listCalls.length === 0, 'called Stripe for a user with no customer id');
  assert(writes.length === 0, 'wrote to a free account');
});

test('a customer Stripe has no trial for is counted, not written', async () => {
  resetWorld();
  userDocs = { u1: { stripeCustomerId: 'cus_1' } };
  subsByCustomer.cus_1 = [{ id: 'sub_1', status: 'active', trial_start: null, trial_end: null }];
  const r = await applyRun();
  assert(r.counts.noTrialInStripe === 1, `noTrial: ${r.counts.noTrialInStripe}`);
  assert(writes.length === 0, 'wrote a trial that Stripe does not have');
});

test('a customer with no subscriptions at all is counted, not written', async () => {
  resetWorld();
  userDocs = { u1: { stripeCustomerId: 'cus_1' } };
  subsByCustomer.cus_1 = [];
  const r = await applyRun();
  assert(r.counts.noTrialInStripe === 1, `noTrial: ${r.counts.noTrialInStripe}`);
  assert(writes.length === 0, 'wrote with no subscription to read');
});

test('the earliest trial wins when a customer has several subscriptions', async () => {
  // The activation report measures week one, so the trial that matters is the
  // first one they ever started, not whichever Stripe lists first.
  resetWorld();
  userDocs = { u1: { stripeCustomerId: 'cus_1' } };
  subsByCustomer.cus_1 = [
    { id: 'sub_late',  status: 'active',   trial_start: T('2026-09-01T00:00:00Z'), trial_end: T('2026-09-08T00:00:00Z') },
    { id: 'sub_first', status: 'canceled', trial_start: T('2026-06-01T00:00:00Z'), trial_end: T('2026-06-08T00:00:00Z') },
    { id: 'sub_mid',   status: 'canceled', trial_start: T('2026-07-01T00:00:00Z'), trial_end: T('2026-07-08T00:00:00Z') },
  ];
  const r = await applyRun();
  assert(r.changes[0].subscriptionId === 'sub_first', `picked ${r.changes[0].subscriptionId}`);
  assert(userDocs.u1.trialStartedAt === '2026-06-01T00:00:00.000Z',
    `trialStartedAt: ${userDocs.u1.trialStartedAt}`);
});

test('a subscription with no trial is ignored when picking the earliest', async () => {
  resetWorld();
  userDocs = { u1: { stripeCustomerId: 'cus_1' } };
  subsByCustomer.cus_1 = [
    { id: 'sub_notrial', status: 'active', trial_start: null, trial_end: null },
    { id: 'sub_trial',   status: 'canceled', trial_start: T('2026-07-01T00:00:00Z'), trial_end: T('2026-07-08T00:00:00Z') },
  ];
  const r = await applyRun();
  assert(r.changes[0].subscriptionId === 'sub_trial', `picked ${r.changes[0].subscriptionId}`);
});

// ── isTrialing must not resurrect a finished trial ───────────────────────────
test('a finished trial is never marked as currently trialing', async () => {
  // isTrialing drives the in-app banner. Setting it on a trial that ended in
  // September would show a permanent, false warning.
  resetWorld(); seedOneTrialUser();
  await applyRun();
  assert(userDocs.u1.isTrialing === undefined,
    `isTrialing: ${userDocs.u1.isTrialing} on a trial Stripe calls 'active'`);
});

test('a live trial does get marked as trialing', async () => {
  resetWorld();
  userDocs = { u1: { stripeCustomerId: 'cus_1' } };
  subsByCustomer.cus_1 = [{
    id: 'sub_1', status: 'trialing',
    trial_start: T('2026-10-14T00:00:00Z'), trial_end: T('2026-10-21T00:00:00Z'),
  }];
  await applyRun();
  assert(userDocs.u1.isTrialing === true, `isTrialing: ${userDocs.u1.isTrialing}`);
});

test('a missing trial_end leaves trialEndsAt out rather than inventing one', async () => {
  resetWorld();
  userDocs = { u1: { stripeCustomerId: 'cus_1' } };
  subsByCustomer.cus_1 = [{ id: 'sub_1', status: 'active', trial_start: T('2026-09-01T00:00:00Z'), trial_end: null }];
  await applyRun();
  assert(userDocs.u1.trialStartedAt, 'trialStartedAt missing');
  assert(!('trialEndsAt' in userDocs.u1), `trialEndsAt: ${userDocs.u1.trialEndsAt}`);
});

test('it never touches trialConverted or plan', async () => {
  resetWorld(); seedOneTrialUser();
  userDocs.u1.trialConverted = true;
  userDocs.u1.plan = 'club';
  await applyRun();
  assert(userDocs.u1.trialConverted === true, 'trialConverted changed');
  assert(userDocs.u1.plan === 'club', 'plan changed');
  const patch = writes[0].patch;
  assert(!('trialConverted' in patch) && !('plan' in patch),
    `the write included fields it should not: ${Object.keys(patch).join(',')}`);
});

// ── One bad account must not abort the run ───────────────────────────────────
test('a Stripe failure is recorded and the run continues', async () => {
  resetWorld();
  userDocs = { u1: { stripeCustomerId: 'cus_1' } };
  stripeError = 'rate limited';
  const res = await call({ httpMethod: 'POST' });
  assert(res.statusCode === 200, `got ${res.statusCode}`);
  const r = JSON.parse(res.body);
  assert(r.counts.stripeLookupFailed === 1, `failed: ${r.counts.stripeLookupFailed}`);
  assert(r.failures.length === 1 && /rate limited/.test(r.failures[0].error),
    `failures: ${JSON.stringify(r.failures)}`);
});

test('a Firestore write failure is recorded, not thrown', async () => {
  resetWorld(); seedOneTrialUser();
  writeError = 'permission denied';
  const res = await call({ httpMethod: 'POST' });
  assert(res.statusCode === 200, `got ${res.statusCode}`);
  const r = JSON.parse(res.body);
  assert(r.counts.written === 0, `written: ${r.counts.written}`);
  assert(r.failures.some(f => f.stage === 'firestore write'),
    `failures: ${JSON.stringify(r.failures)}`);
});

// ── Record keeping ───────────────────────────────────────────────────────────
test('the run is recorded outside the 24-hour log window', async () => {
  resetWorld(); seedOneTrialUser();
  await applyRun();
  const b = diagnostics.trialBackfill;
  assert(b, 'no trialBackfill diagnostics written');
  assert(b.mode === 'APPLIED', `mode: ${b.mode}`);
  assert(b.counts.written === 1, `counts.written: ${b.counts.written}`);
  assert(!Number.isNaN(Date.parse(b.at)), `at: ${b.at}`);
});

test('the secret never appears in the response', async () => {
  resetWorld(); seedOneTrialUser();
  const res = await call();
  assert(!res.body.includes('s3cret'), 'secret leaked into the response');
});

let pass = 0, fail = 0;
for (const t of tests) {
  try { await t.fn(); console.log(`  ✓ ${t.name}`); pass++; }
  catch (e) { console.log(`  ✗ ${t.name}\n      ${e.message}`); fail++; }
}
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
