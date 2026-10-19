// Tests for netlify/functions/club-prospects.js.
//
// The endpoint answers one question: which organisations already have
// several coaches using CourtDraw while paying nothing? The things worth
// testing are the judgements it makes, because each one can be wrong in a
// way that costs a real email to a real person:
//
//   - a consumer mailbox must never be read as an organisation, including
//     the European providers that a US-centric list would miss;
//   - a domain that already pays for Club must never appear as a prospect;
//   - and no individual's email address may leave the function at all.
//
// The last one is the reason the report is domain-only, so it is asserted
// against the serialised body rather than the parsed object.
//
// Run: node tests/club-prospects.mjs

import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

const SECRET = 'test-secret';

// The mock world: accounts as Firebase Auth would hand them over, plus the
// Firestore doc each one has (or null for an account with no doc at all).
let accounts, docReadError, pageSize;

function resetWorld() {
  accounts = [];
  docReadError = null;   // uid -> message, for a single unreadable doc
  pageSize = 1000;
}
resetWorld();

function acct(email, doc, creationTime = 'Mon, 01 Apr 2026 10:00:00 GMT') {
  const uid = `uid${accounts.length + 1}`;
  accounts.push({ uid, email, metadata: { creationTime }, doc });
  return uid;
}

const Module = require('module');
const realLoad = Module._load;
Module._load = function (request) {
  if (request === 'firebase-admin') {
    return {
      apps: [{}],
      initializeApp() {},
      credential: { cert: () => ({}) },
      auth: () => ({
        listUsers: async (max, pageToken) => {
          // Paginate so the do/while loop in the handler is exercised.
          const start = pageToken ? Number(pageToken) : 0;
          const slice = accounts.slice(start, start + pageSize);
          const next = start + pageSize;
          return {
            users: slice.map(a => ({ uid: a.uid, email: a.email, metadata: a.metadata })),
            pageToken: next < accounts.length ? String(next) : undefined,
          };
        },
      }),
      firestore: () => ({
        collection: () => ({
          doc: (id) => ({
            async get() {
              if (docReadError && docReadError.uid === id) {
                throw new Error(docReadError.message);
              }
              const found = accounts.find(a => a.uid === id);
              const doc = found ? found.doc : null;
              return { exists: !!doc, data: () => ({ ...doc }) };
            },
          }),
        }),
      }),
    };
  }
  return realLoad.apply(this, arguments);
};

process.env.INTERNAL_SECRET = SECRET;
process.env.FIREBASE_PROJECT_ID = 'p';
process.env.FIREBASE_CLIENT_EMAIL = 'c';
process.env.FIREBASE_PRIVATE_KEY = 'k';

const { handler } = require(path.join(ROOT, 'netlify/functions/club-prospects.js'));

const call = (event = {}) =>
  handler({ headers: { 'x-internal-secret': SECRET }, ...event });

const body = (res) => JSON.parse(res.body);
const shared = (res) => body(res).sharedDomains;
const lone = (res) => body(res).loneOrgDomains;
const find = (list, domain) => list.find(e => e.domain === domain);

// ---------------------------------------------------------------- auth

test('no secret configured at all is rejected, not waved through', async () => {
  resetWorld();
  const saved = process.env.INTERNAL_SECRET;
  delete process.env.INTERNAL_SECRET;
  const res = await call();
  process.env.INTERNAL_SECRET = saved;
  assert(res.statusCode === 401, `expected 401, got ${res.statusCode}`);
});

test('a missing header is rejected', async () => {
  resetWorld();
  const res = await handler({ headers: {} });
  assert(res.statusCode === 401, `expected 401, got ${res.statusCode}`);
});

test('no headers object at all is rejected rather than throwing', async () => {
  resetWorld();
  const res = await handler({});
  assert(res.statusCode === 401, `expected 401, got ${res.statusCode}`);
});

test('a wrong secret is rejected', async () => {
  resetWorld();
  const res = await handler({ headers: { 'x-internal-secret': 'nope' } });
  assert(res.statusCode === 401, `expected 401, got ${res.statusCode}`);
});

test('the secret is NOT accepted from the query string', async () => {
  // Unlike user-activation-stats, this endpoint has no ?secret= fallback.
  // If one is ever added, this test is the thing that should stop it.
  resetWorld();
  const res = await handler({ headers: {}, queryStringParameters: { secret: SECRET } });
  assert(res.statusCode === 401,
    `query-string secret must not authenticate; got ${res.statusCode}`);
});

// ------------------------------------------------------- consumer domains

test('gmail accounts never appear as an organisation', async () => {
  resetWorld();
  acct('a@gmail.com', { plan: 'free' });
  acct('b@gmail.com', { plan: 'free' });
  const res = await call();
  assert(!find(shared(res), 'gmail.com'), 'gmail.com was reported as a shared org domain');
  assert(!find(lone(res), 'gmail.com'), 'gmail.com was reported as a lone org domain');
});

test('European consumer providers are excluded too, not just the US ones', async () => {
  // A US-only list would file half of CourtDraw's actual market as clubs.
  resetWorld();
  for (const d of ['freemail.hu', 'citromail.hu', 'seznam.cz', 'azet.sk',
                   'orange.fr', 'laposte.net', 'web.de', 'virgilio.it']) {
    acct(`one@${d}`, { plan: 'free' });
    acct(`two@${d}`, { plan: 'free' });
  }
  const res = await call();
  const reported = [...shared(res), ...lone(res)].map(e => e.domain);
  assert(reported.length === 0,
    `consumer providers leaked into the report: ${reported.join(', ')}`);
});

test('domain matching ignores case', async () => {
  resetWorld();
  acct('a@GMAIL.COM', { plan: 'free' });
  acct('b@GmAiL.cOm', { plan: 'free' });
  const res = await call();
  const reported = [...shared(res), ...lone(res)].map(e => e.domain);
  assert(reported.length === 0, `uppercase gmail leaked: ${reported.join(', ')}`);
});

// --------------------------------------------------------- the two signals

test('two accounts on one org domain are the strong signal', async () => {
  resetWorld();
  acct('coach1@tennisclub.hu', { plan: 'free' });
  acct('coach2@tennisclub.hu', { plan: 'free' });
  const res = await call();
  const e = find(shared(res), 'tennisclub.hu');
  assert(e, 'tennisclub.hu missing from sharedDomains');
  assert(e.accounts === 2, `expected 2 accounts, got ${e.accounts}`);
  assert(!find(lone(res), 'tennisclub.hu'), 'also appeared in loneOrgDomains');
});

test('a single account on an org domain is the weak signal, kept separate', async () => {
  resetWorld();
  acct('solo@someclub.ie', { plan: 'free' });
  const res = await call();
  assert(find(lone(res), 'someclub.ie'), 'someclub.ie missing from loneOrgDomains');
  assert(!find(shared(res), 'someclub.ie'),
    'a lone account must not be reported as a shared domain');
});

test('a domain that already pays for Club is not a prospect', async () => {
  resetWorld();
  acct('director@bigclub.com', { plan: 'club' });
  acct('coach@bigclub.com', { plan: 'free' });
  const res = await call();
  assert(!find(shared(res), 'bigclub.com'),
    'an existing Club customer was reported as a prospect');
  assert(!find(lone(res), 'bigclub.com'), 'leaked into loneOrgDomains instead');
});

test('a Pro account does not disqualify a domain, but is counted', async () => {
  // Pro is one coach paying for themselves — the Club pitch still applies.
  resetWorld();
  acct('coach1@padelclub.es', { plan: 'pro' });
  acct('coach2@padelclub.es', { plan: 'free' });
  const res = await call();
  const e = find(shared(res), 'padelclub.es');
  assert(e, 'a domain with a Pro account should still be a prospect');
  assert(e.paying === 1, `expected paying=1, got ${e.paying}`);
  assert(e.accounts === 2, `expected accounts=2, got ${e.accounts}`);
});

// ------------------------------------------------------------ PII guarantee

test('no email address appears anywhere in the response', async () => {
  resetWorld();
  acct('coach1@tennisclub.hu', { plan: 'free' });
  acct('coach2@tennisclub.hu', { plan: 'free' });
  acct('solo@someclub.ie', { plan: 'free' });
  acct('person@gmail.com', { plan: 'free' });
  const res = await call();
  assert(!res.body.includes('@'),
    'the response contains an "@" — an email address is leaking out');
  assert(!/coach1|coach2|solo|person/.test(res.body),
    'a mailbox local-part leaked into the response');
});

test('no uid appears in the response either', async () => {
  resetWorld();
  acct('coach1@tennisclub.hu', { plan: 'free' });
  acct('coach2@tennisclub.hu', { plan: 'free' });
  const res = await call();
  assert(!/uid\d/.test(res.body), 'a Firebase uid leaked into the response');
});

// ------------------------------------------------------------ sports column

test('sports are pooled across the accounts on a domain, without duplicates', async () => {
  resetWorld();
  acct('a@club.hu', { plan: 'free', recentActivity: [
    { name: 'p1', sport: 'tennis', savedAt: 100 },
    { name: 'p2', sport: 'tennis', savedAt: 200 },
  ]});
  acct('b@club.hu', { plan: 'free', recentActivity: [
    { name: 'p3', sport: 'padel', savedAt: 300 },
  ]});
  const res = await call();
  const e = find(shared(res), 'club.hu');
  assert(e.sports.length === 2, `expected 2 distinct sports, got ${JSON.stringify(e.sports)}`);
  assert(e.sports.includes('tennis') && e.sports.includes('padel'),
    `expected tennis and padel, got ${JSON.stringify(e.sports)}`);
});

test('a sport is ordered by its most recent save, not its first', async () => {
  resetWorld();
  // hurling arrives FIRST and tennis second, but hurling is the one still
  // in use. Ordering on the first save would put tennis top; ordering on
  // the most recent save puts hurling top. The gap between those two is
  // the whole point of the field, so the fixture has to separate them.
  acct('a@club.ie', { plan: 'free', recentActivity: [
    { name: 'p1', sport: 'hurling', savedAt: 100 },
    { name: 'p2', sport: 'tennis',  savedAt: 500 },
    { name: 'p3', sport: 'hurling', savedAt: 900 },
  ]});
  acct('b@club.ie', { plan: 'free' });
  const res = await call();
  const e = find(shared(res), 'club.ie');
  assert(e.sports[0] === 'hurling',
    `expected hurling first (used most recently), got ${JSON.stringify(e.sports)}`);
});

test('activity entries with no sport are ignored rather than counted as one', async () => {
  resetWorld();
  acct('a@club.fr', { plan: 'free', recentActivity: [
    { name: 'p1', savedAt: 100 },
    { name: 'p2', sport: '', savedAt: 200 },
    { name: 'p3', sport: null, savedAt: 300 },
    null,
    { name: 'p4', sport: 'futsal', savedAt: 400 },
  ]});
  acct('b@club.fr', { plan: 'free' });
  const res = await call();
  const e = find(shared(res), 'club.fr');
  assert(e.sports.length === 1 && e.sports[0] === 'futsal',
    `expected only futsal, got ${JSON.stringify(e.sports)}`);
});

// -------------------------------------------------------------- engagement

test('saves are totalled and active accounts counted separately', async () => {
  resetWorld();
  acct('a@club.cz', { plan: 'free', recentActivity: [
    { name: 'p1', sport: 'futsal', savedAt: 1 },
    { name: 'p2', sport: 'futsal', savedAt: 2 },
  ]});
  acct('b@club.cz', { plan: 'free' });               // no doc activity
  acct('c@club.cz', { plan: 'free', recentActivity: [] });  // present but empty
  const res = await call();
  const e = find(shared(res), 'club.cz');
  assert(e.totalSaves === 2, `expected totalSaves=2, got ${e.totalSaves}`);
  assert(e.activeAccounts === 1,
    `expected activeAccounts=1 (only one has saves), got ${e.activeAccounts}`);
  assert(e.accounts === 3, `expected accounts=3, got ${e.accounts}`);
});

test('an account with no Firestore doc still counts towards its domain', async () => {
  resetWorld();
  acct('a@club.sk', null);
  acct('b@club.sk', null);
  const res = await call();
  const e = find(shared(res), 'club.sk');
  assert(e, 'a domain whose accounts have no user doc vanished from the report');
  assert(e.accounts === 2, `expected 2 accounts, got ${e.accounts}`);
  assert(e.paying === 0, 'an account with no doc must default to free, not paying');
});

test('signup dates give the range the organisation arrived over', async () => {
  resetWorld();
  acct('a@club.it', { plan: 'free' }, 'Tue, 03 Feb 2026 10:00:00 GMT');
  acct('b@club.it', { plan: 'free' }, 'Fri, 15 May 2026 10:00:00 GMT');
  const res = await call();
  const e = find(shared(res), 'club.it');
  assert(e.firstSignup === '2026-02-03', `got firstSignup ${e.firstSignup}`);
  assert(e.lastSignup === '2026-05-15', `got lastSignup ${e.lastSignup}`);
});

// -------------------------------------------------------------- robustness

test('one unreadable Firestore doc does not abort the whole report', async () => {
  resetWorld();
  const uid = acct('a@club.pt', { plan: 'free' });
  acct('b@club.pt', { plan: 'free' });
  docReadError = { uid, message: 'simulated Firestore outage' };
  const res = await call();
  assert(res.statusCode === 200, `expected 200, got ${res.statusCode}`);
  const e = find(shared(res), 'club.pt');
  assert(e && e.accounts === 2,
    'the account whose doc failed should still be counted on its domain');
});

test('an account with an unusable email is skipped and reported', async () => {
  resetWorld();
  acct('no-at-sign', { plan: 'free' });
  acct('@leading', { plan: 'free' });
  acct('trailing@', { plan: 'free' });
  acct(null, { plan: 'free' });
  acct('good@club.pl', { plan: 'free' });
  const res = await call();
  const b = body(res);
  assert(b.scanned.unparseableEmail === 4,
    `expected 4 unparseable, got ${b.scanned.unparseableEmail}`);
  assert(b.scanned.accounts === 5, `expected 5 scanned, got ${b.scanned.accounts}`);
  assert(find(lone(res), 'club.pl'), 'the valid account was lost');
});

test('every page of accounts is scanned, not just the first', async () => {
  resetWorld();
  pageSize = 2;   // force three pages
  acct('a@club.at', { plan: 'free' });
  acct('b@club.at', { plan: 'free' });
  acct('c@club.at', { plan: 'free' });
  acct('d@club.at', { plan: 'free' });
  acct('e@club.at', { plan: 'free' });
  const res = await call();
  const e = find(shared(res), 'club.at');
  assert(e.accounts === 5,
    `pagination dropped accounts: expected 5, got ${e.accounts}`);
});

// ----------------------------------------------------------------- ordering

test('shared domains are ordered by account count, then by engagement', async () => {
  resetWorld();
  // two accounts, lots of saves
  acct('a@small.hu', { plan: 'free', recentActivity: [
    { name: 'x', sport: 's', savedAt: 1 }, { name: 'y', sport: 's', savedAt: 2 },
    { name: 'z', sport: 's', savedAt: 3 },
  ]});
  acct('b@small.hu', { plan: 'free' });
  // three accounts, no saves — more people beats more saves
  acct('a@big.hu', { plan: 'free' });
  acct('b@big.hu', { plan: 'free' });
  acct('c@big.hu', { plan: 'free' });
  // two accounts, no saves — same size as small.hu, less engaged
  acct('a@quiet.hu', { plan: 'free' });
  acct('b@quiet.hu', { plan: 'free' });
  const res = await call();
  const order = shared(res).map(e => e.domain);
  assert(order[0] === 'big.hu', `expected big.hu first, got ${order.join(' > ')}`);
  assert(order[1] === 'small.hu', `expected small.hu second, got ${order.join(' > ')}`);
  assert(order[2] === 'quiet.hu', `expected quiet.hu third, got ${order.join(' > ')}`);
});

test('lone org domains are ordered by engagement', async () => {
  resetWorld();
  acct('a@quiet.ie', { plan: 'free' });
  acct('a@busy.ie', { plan: 'free', recentActivity: [
    { name: 'x', sport: 'hurling', savedAt: 1 },
    { name: 'y', sport: 'hurling', savedAt: 2 },
  ]});
  const res = await call();
  const order = lone(res).map(e => e.domain);
  assert(order[0] === 'busy.ie', `expected busy.ie first, got ${order.join(' > ')}`);
});

// ------------------------------------------------------------------ summary

test('the summary totals match the lists it describes', async () => {
  resetWorld();
  acct('a@one.hu', { plan: 'free' });
  acct('b@one.hu', { plan: 'free' });
  acct('a@two.hu', { plan: 'free' });
  acct('b@two.hu', { plan: 'free' });
  acct('c@two.hu', { plan: 'free' });
  acct('solo@three.hu', { plan: 'free' });
  acct('someone@gmail.com', { plan: 'free' });
  const res = await call();
  const b = body(res);
  assert(b.summary.sharedOrgDomains === 2,
    `expected 2 shared domains, got ${b.summary.sharedOrgDomains}`);
  assert(b.summary.sharedOrgAccounts === 5,
    `expected 5 accounts across shared domains, got ${b.summary.sharedOrgAccounts}`);
  assert(b.summary.loneOrgDomains === 1,
    `expected 1 lone org domain, got ${b.summary.loneOrgDomains}`);
  assert(b.summary.distinctDomains === 4,
    `distinctDomains should count gmail too, got ${b.summary.distinctDomains}`);
});

// --------------------------------------------------------------------- run

let pass = 0, fail = 0;
for (const { name, fn } of tests) {
  try { await fn(); console.log(`  ✓ ${name}`); pass++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); fail++; }
}
console.log(`${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
