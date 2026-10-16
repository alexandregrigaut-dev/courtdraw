// Auth tests for netlify/functions/user-activation-stats.js.
//
// This endpoint originally accepted the shared INTERNAL_SECRET only as a query
// parameter, which meant the one way to run it put the secret in a URL — into
// browser history and the function's access logs. That secret is shared with
// the email senders and the Stripe webhook, so it is worth more than this
// report. It now also accepts the header its sibling activation-report.js
// takes, so the secret can travel in a header instead.
//
// Run: node tests/stats-auth.mjs

import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// One account with a Firestore doc is enough: these tests are about who gets
// through the door, not what the report says once inside.
const authUsers = [{ uid: 'u1', metadata: { creationTime: '2026-06-22T10:00:00Z' } }];
const userDocs = { u1: { plan: 'pro', recentActivity: [{ name: 'p', savedAt: 1 }] } };

const Module = require('module');
const realLoad = Module._load;
Module._load = function (request) {
  if (request === 'firebase-admin') {
    return {
      apps: [{}],
      initializeApp() {},
      credential: { cert: () => ({}) },
      auth: () => ({ listUsers: async () => ({ users: authUsers, pageToken: undefined }) }),
      firestore: () => ({
        collection: () => ({
          doc: (id) => ({ async get() {
            return { exists: !!userDocs[id], data: () => ({ ...userDocs[id] }) };
          } }),
        }),
      }),
    };
  }
  return realLoad.apply(this, arguments);
};

process.env.FIREBASE_PRIVATE_KEY = 'x';
process.env.INTERNAL_SECRET = 's3cret';

const { handler } = require(path.join(ROOT, 'netlify/functions/user-activation-stats.js'));

const call = (opts = {}) => handler({
  httpMethod: 'GET', headers: {}, queryStringParameters: {}, ...opts,
});

test('the header form is accepted', async () => {
  const res = await call({ headers: { 'x-internal-secret': 's3cret' } });
  assert(res.statusCode === 200, `got ${res.statusCode}`);
});

test('the query form still works, so nothing that relied on it breaks', async () => {
  const res = await call({ queryStringParameters: { secret: 's3cret' } });
  assert(res.statusCode === 200, `got ${res.statusCode}`);
});

test('no credential is rejected', async () => {
  const res = await call();
  assert(res.statusCode === 401, `got ${res.statusCode}`);
});

test('a wrong secret is rejected in either position', async () => {
  const a = await call({ headers: { 'x-internal-secret': 'nope' } });
  const b = await call({ queryStringParameters: { secret: 'nope' } });
  assert(a.statusCode === 401 && b.statusCode === 401, `got ${a.statusCode}/${b.statusCode}`);
});

test('a wrong header does not fall through to a correct query param', async () => {
  // The header is checked first. If it is present but wrong, `||` must not
  // skip past it to the query string — that would let a bad header be rescued.
  const res = await call({
    headers: { 'x-internal-secret': 'nope' },
    queryStringParameters: { secret: 's3cret' },
  });
  assert(res.statusCode === 401, `got ${res.statusCode}`);
});

test('an empty header falls through to the query param', async () => {
  // An absent header arrives as '' from some proxies; that must behave as
  // absent rather than as a failed attempt.
  const res = await call({
    headers: { 'x-internal-secret': '' },
    queryStringParameters: { secret: 's3cret' },
  });
  assert(res.statusCode === 200, `got ${res.statusCode}`);
});

test('a missing headers object does not crash the handler', async () => {
  const res = await handler({
    httpMethod: 'GET', queryStringParameters: { secret: 's3cret' },
  });
  assert(res.statusCode === 200, `got ${res.statusCode}`);
});

test('a missing queryStringParameters object does not crash the handler', async () => {
  const res = await handler({
    httpMethod: 'GET', headers: { 'x-internal-secret': 's3cret' },
  });
  assert(res.statusCode === 200, `got ${res.statusCode}`);
});

test('with INTERNAL_SECRET unset nothing opens the report', async () => {
  delete process.env.INTERNAL_SECRET;
  try {
    const a = await call({ headers: { 'x-internal-secret': 's3cret' } });
    const b = await call({ queryStringParameters: { secret: '' } });
    const c = await call();
    assert(a.statusCode === 401 && b.statusCode === 401 && c.statusCode === 401,
      `got ${a.statusCode}/${b.statusCode}/${c.statusCode}`);
  } finally {
    process.env.INTERNAL_SECRET = 's3cret';
  }
});

test('no header and no query object returns 401 rather than crashing', async () => {
  // The short-circuit hides this: with a valid header, the query side is never
  // evaluated, so an unguarded event.queryStringParameters.secret never throws.
  // It throws only when the header is absent too — which is exactly the
  // unauthenticated request this endpoint must survive.
  const res = await handler({ httpMethod: 'GET', headers: {} });
  assert(res && res.statusCode === 401, `got ${res && res.statusCode}`);
});

test('neither object present returns 401 rather than crashing', async () => {
  const res = await handler({ httpMethod: 'GET' });
  assert(res && res.statusCode === 401, `got ${res && res.statusCode}`);
});

test('405 on a non-GET request', async () => {
  const res = await call({ httpMethod: 'POST', headers: { 'x-internal-secret': 's3cret' } });
  assert(res.statusCode === 405, `got ${res.statusCode}`);
});

test('the secret is never echoed into the response', async () => {
  const res = await call({ queryStringParameters: { secret: 's3cret' } });
  assert(!res.body.includes('s3cret'), 'secret leaked into the report body');
});

test('an authorised call still returns the report it is meant to', async () => {
  const res = await call({ headers: { 'x-internal-secret': 's3cret' } });
  const r = JSON.parse(res.body);
  assert(r.readOnly === true, 'readOnly flag missing');
  assert(r.headline.totalRegisteredAccounts === 1,
    `expected 1 account, got ${r.headline.totalRegisteredAccounts}`);
  assert(r.plans.pro === 1, `expected the pro plan counted, got ${r.plans.pro}`);
});

let pass = 0, fail = 0;
for (const t of tests) {
  try { await t.fn(); console.log(`  ✓ ${t.name}`); pass++; }
  catch (e) { console.log(`  ✗ ${t.name}\n      ${e.message}`); fail++; }
}
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
