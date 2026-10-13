// Tests for netlify/functions/activation-report.js — the one instrument aimed
// at the biggest remaining revenue leak: 44% of all signups cancel on day 7,
// during the trial. The report correlates the three week-one activation moments
// (shared a play, exported a PNG, built a second phase) against whether the
// trial converted, and reports how long activation took.
//
// Two defects motivated these tests:
//   * avgHoursToActivation divided hours by 36000 as if they were milliseconds,
//     so it reported 0.0 for every event regardless of the data. A broken
//     number is worse than a missing one: it reads as "coaches activate
//     instantly", which is the opposite of the conclusion the data supports.
//   * the report could only be reached with a custom request header, so the
//     person who needs the answer could not open it.
//
// Run: node tests/activation-report.mjs

import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// ── The world ────────────────────────────────────────────────────────────────
let userDocs = {};     // id -> doc data
let queries  = [];     // every query the handler built, for the paging tests

const T0 = Date.parse('2026-09-01T00:00:00Z');
const hoursAfterStart = (h) => T0 + h * 3600 * 1000;

// A trialing user. `activations` maps an activation key to hours after trial
// start; omit a key to mean the coach never hit that moment.
function trialUser({ converted = false, activations = {}, startedAt = T0 } = {}) {
  const d = {
    trialStartedAt: new Date(startedAt).toISOString(),
    trialConverted: converted,
  };
  for (const [key, h] of Object.entries(activations)) {
    d[`activation_${key}`] = startedAt + h * 3600 * 1000;
  }
  return d;
}

function setUsers(docs) {
  userDocs = {};
  docs.forEach((d, i) => { userDocs[`u${i}`] = d; });
  queries = [];
}

// ── Stubs ────────────────────────────────────────────────────────────────────
// Faithful to the slice of Firestore the handler uses: an inequality filter on
// trialStartedAt, ordered by that field, paged with limit + startAfter. The
// handler relies on snap.size to decide whether another page exists, so the
// stub honours the real limit rather than returning everything at once.
const Module = require('module');
const realLoad = Module._load;
Module._load = function (request) {
  if (request === 'firebase-admin') {
    const buildQuery = (spec) => ({
      where(field, op, value) { return buildQuery({ ...spec, where: { field, op, value } }); },
      orderBy(field)          { return buildQuery({ ...spec, orderBy: field }); },
      limit(n)                { return buildQuery({ ...spec, limit: n }); },
      startAfter(cursor)      { return buildQuery({ ...spec, startAfter: cursor }); },
      async get() {
        queries.push(spec);
        // The `!= null` filter drops docs missing the field, as Firestore does.
        let rows = Object.entries(userDocs)
          .filter(([, d]) => d[spec.where.field] !== undefined && d[spec.where.field] !== null)
          .map(([id, d]) => ({ id, data: () => ({ ...d }) }));
        rows.sort((a, b) => String(a.data()[spec.orderBy]).localeCompare(String(b.data()[spec.orderBy]))
          || a.id.localeCompare(b.id));
        if (spec.startAfter) {
          const at = rows.findIndex(r => r.id === spec.startAfter.id);
          rows = at === -1 ? [] : rows.slice(at + 1);
        }
        const page = rows.slice(0, spec.limit);
        return { empty: page.length === 0, size: page.length, docs: page };
      },
    });
    return {
      apps: [{}],
      initializeApp() {},
      credential: { cert: () => ({}) },
      firestore: () => ({ collection: () => buildQuery({}) }),
    };
  }
  return realLoad.apply(this, arguments);
};

process.env.FIREBASE_PRIVATE_KEY = 'x';
process.env.INTERNAL_SECRET = 's3cret';

const { handler } = require(path.join(ROOT, 'netlify/functions/activation-report.js'));

const run = (opts = {}) => handler({
  httpMethod: 'GET',
  headers: { 'x-internal-secret': 's3cret' },
  queryStringParameters: {},
  ...opts,
});
const report = async (opts) => JSON.parse((await run(opts)).body);

// ── Auth ─────────────────────────────────────────────────────────────────────
test('405 on a non-GET request', async () => {
  const res = await run({ httpMethod: 'POST' });
  assert(res.statusCode === 405, `got ${res.statusCode}`);
});

test('the header form still works', async () => {
  setUsers([trialUser()]);
  const res = await run();
  assert(res.statusCode === 200, `got ${res.statusCode}`);
});

test('the query form works, so the report can be opened in a browser', async () => {
  setUsers([trialUser()]);
  const res = await run({ headers: {}, queryStringParameters: { secret: 's3cret' } });
  assert(res.statusCode === 200, `got ${res.statusCode}`);
});

test('no credential at all is rejected', async () => {
  const res = await run({ headers: {}, queryStringParameters: {} });
  assert(res.statusCode === 401, `got ${res.statusCode}`);
});

test('a wrong secret is rejected in either position', async () => {
  const a = await run({ headers: { 'x-internal-secret': 'nope' } });
  const b = await run({ headers: {}, queryStringParameters: { secret: 'nope' } });
  assert(a.statusCode === 401 && b.statusCode === 401, `got ${a.statusCode}/${b.statusCode}`);
});

test('a missing headers object does not crash the handler', async () => {
  setUsers([trialUser()]);
  const res = await handler({ httpMethod: 'GET', queryStringParameters: { secret: 's3cret' } });
  assert(res.statusCode === 200, `got ${res.statusCode}`);
});

test('a missing queryStringParameters object does not crash the handler', async () => {
  setUsers([trialUser()]);
  const res = await handler({ httpMethod: 'GET', headers: { 'x-internal-secret': 's3cret' } });
  assert(res.statusCode === 200, `got ${res.statusCode}`);
});

test('with INTERNAL_SECRET unset nothing opens the report', async () => {
  delete process.env.INTERNAL_SECRET;
  try {
    const a = await run();
    const b = await run({ headers: {}, queryStringParameters: { secret: '' } });
    const c = await handler({ httpMethod: 'GET', headers: {}, queryStringParameters: {} });
    assert(a.statusCode === 401 && b.statusCode === 401 && c.statusCode === 401,
      `got ${a.statusCode}/${b.statusCode}/${c.statusCode}`);
  } finally {
    process.env.INTERNAL_SECRET = 's3cret';
  }
});

test('the secret is never echoed into the response', async () => {
  setUsers([trialUser()]);
  const res = await run({ headers: {}, queryStringParameters: { secret: 's3cret' } });
  assert(!res.body.includes('s3cret'), 'secret leaked into the report body');
});

// ── Time to activation: the regression that motivated this file ──────────────
test('average hours to activation is reported in hours', async () => {
  // 12, 24 and 36 hours after trial start -> a 24 hour mean. The broken helper
  // returned 0 here, which read as "every coach activates immediately".
  setUsers([
    trialUser({ activations: { sharedPlay: 12 } }),
    trialUser({ activations: { sharedPlay: 24 } }),
    trialUser({ activations: { sharedPlay: 36 } }),
  ]);
  const r = await report();
  const avg = r.byActivationEvent.sharedPlay.hit.avgHoursToActivation;
  assert(avg === 24, `expected 24 hours, got ${avg}`);
});

test('a sub-hour activation is not rounded away to zero', async () => {
  setUsers([trialUser({ activations: { exportedPNG: 0.5 } })]);
  const r = await report();
  const avg = r.byActivationEvent.exportedPNG.hit.avgHoursToActivation;
  assert(avg === 0.5, `expected 0.5, got ${avg}`);
});

test('the average is rounded to two decimals, not truncated', async () => {
  setUsers([
    trialUser({ activations: { sharedPlay: 1 } }),
    trialUser({ activations: { sharedPlay: 2 } }),
    trialUser({ activations: { sharedPlay: 2 } }),
  ]);
  const r = await report();
  const avg = r.byActivationEvent.sharedPlay.hit.avgHoursToActivation;
  assert(avg === 1.67, `expected 1.67, got ${avg}`);
});

// The activations below are deliberately out of order. With pre-sorted input
// these tests pass even if medianHours never sorts at all.
test('median of an odd number of activations is the middle value', async () => {
  setUsers([
    trialUser({ activations: { sharedPlay: 100 } }),
    trialUser({ activations: { sharedPlay: 1 } }),
    trialUser({ activations: { sharedPlay: 4 } }),
  ]);
  const r = await report();
  const m = r.byActivationEvent.sharedPlay.hit.medianHoursToActivation;
  assert(m === 4, `expected 4, got ${m}`);
});

test('median of an even number of activations averages the middle pair', async () => {
  setUsers([
    trialUser({ activations: { sharedPlay: 200 } }),
    trialUser({ activations: { sharedPlay: 5 } }),
    trialUser({ activations: { sharedPlay: 1 } }),
    trialUser({ activations: { sharedPlay: 3 } }),
  ]);
  const r = await report();
  const m = r.byActivationEvent.sharedPlay.hit.medianHoursToActivation;
  assert(m === 4, `expected 4, got ${m}`);
});

test('the median resists the outlier that drags the mean', async () => {
  // This is the whole reason the median is reported: one coach returning on day
  // 20 should not move the answer to "when does activation happen".
  setUsers([
    trialUser({ activations: { builtPhase2: 480 } }),
    trialUser({ activations: { builtPhase2: 1 } }),
    trialUser({ activations: { builtPhase2: 3 } }),
    trialUser({ activations: { builtPhase2: 2 } }),
  ]);
  const r = await report();
  const { avgHoursToActivation: avg, medianHoursToActivation: med } =
    r.byActivationEvent.builtPhase2.hit;
  assert(med === 2.5, `expected median 2.5, got ${med}`);
  assert(avg > 100, `expected the mean to be dragged up, got ${avg}`);
});

test('timing fields are null when nobody hit the event', async () => {
  setUsers([trialUser({ activations: { sharedPlay: 3 } })]);
  const r = await report();
  const hit = r.byActivationEvent.exportedPNG.hit;
  assert(hit.avgHoursToActivation === null, `expected null, got ${hit.avgHoursToActivation}`);
  assert(hit.medianHoursToActivation === null, `expected null, got ${hit.medianHoursToActivation}`);
  assert(hit.pctActivatedWithin48h === null, `expected null, got ${hit.pctActivatedWithin48h}`);
});

test('the 48 hour share counts the boundary as inside the window', async () => {
  setUsers([
    trialUser({ activations: { sharedPlay: 48 } }),
    trialUser({ activations: { sharedPlay: 49 } }),
  ]);
  const r = await report();
  const p = r.byActivationEvent.sharedPlay.hit.pctActivatedWithin48h;
  assert(p === 50, `expected 50, got ${p}`);
});

test('an activation recorded before the trial began is left out of the timings', async () => {
  // A coach who used the free board for a week, then started a trial. The
  // activation is real, so it still counts towards conversion, but the negative
  // interval would corrupt the average.
  setUsers([
    { trialStartedAt: new Date(T0).toISOString(), trialConverted: true,
      activation_sharedPlay: hoursAfterStart(-72) },
    trialUser({ activations: { sharedPlay: 10 } }),
  ]);
  const r = await report();
  const hit = r.byActivationEvent.sharedPlay.hit;
  assert(hit.trialed === 2, `expected both counted, got ${hit.trialed}`);
  assert(hit.avgHoursToActivation === 10, `expected 10, got ${hit.avgHoursToActivation}`);
});

test('an unparseable trial start does not poison the averages with NaN', async () => {
  setUsers([
    { trialStartedAt: 'not a date', trialConverted: false, activation_sharedPlay: T0 },
    trialUser({ activations: { sharedPlay: 6 } }),
  ]);
  const r = await report();
  const avg = r.byActivationEvent.sharedPlay.hit.avgHoursToActivation;
  assert(avg === 6, `expected 6, got ${avg}`);
});

// ── The question the report exists to answer ─────────────────────────────────
test('activated and never-activated trials are compared head to head', async () => {
  setUsers([
    trialUser({ converted: true,  activations: { sharedPlay: 2 } }),
    trialUser({ converted: true,  activations: { exportedPNG: 5 } }),
    trialUser({ converted: false, activations: { builtPhase2: 9 } }),
    trialUser({ converted: false }),
    trialUser({ converted: false }),
    trialUser({ converted: false }),
  ]);
  const r = await report();
  assert(r.overall.trialedUsers === 6, `got ${r.overall.trialedUsers}`);
  assert(r.overall.convertedUsers === 2, `got ${r.overall.convertedUsers}`);
  assert(r.activatedVsNot.activated.trialed === 3, `got ${r.activatedVsNot.activated.trialed}`);
  assert(r.activatedVsNot.activated.conversionRate === 66.7,
    `got ${r.activatedVsNot.activated.conversionRate}`);
  assert(r.activatedVsNot.neverActivated.trialed === 3,
    `got ${r.activatedVsNot.neverActivated.trialed}`);
  assert(r.activatedVsNot.neverActivated.conversionRate === 0,
    `got ${r.activatedVsNot.neverActivated.conversionRate}`);
});

test('a coach hitting two moments is one person, not two', async () => {
  setUsers([trialUser({ converted: true, activations: { sharedPlay: 1, exportedPNG: 2 } })]);
  const r = await report();
  assert(r.activatedVsNot.activated.trialed === 1, `got ${r.activatedVsNot.activated.trialed}`);
  assert(r.byActivationEvent.sharedPlay.hit.trialed === 1);
  assert(r.byActivationEvent.exportedPNG.hit.trialed === 1);
});

test('each event reports the conversion lift over the coaches who missed it', async () => {
  setUsers([
    trialUser({ converted: true,  activations: { sharedPlay: 1 } }),
    trialUser({ converted: true,  activations: { sharedPlay: 1 } }),
    trialUser({ converted: false, activations: { sharedPlay: 1 } }),
    trialUser({ converted: false }),
    trialUser({ converted: false }),
    trialUser({ converted: false }),
    trialUser({ converted: false }),
  ]);
  const r = await report();
  const e = r.byActivationEvent.sharedPlay;
  assert(e.hit.conversionRate === 66.7, `hit: ${e.hit.conversionRate}`);
  assert(e.missed.trialed === 4, `missed trialed: ${e.missed.trialed}`);
  assert(e.missed.converted === 0, `missed converted: ${e.missed.converted}`);
  assert(e.missed.conversionRate === 0, `missed rate: ${e.missed.conversionRate}`);
});

test('all three activation moments are present even with no data', async () => {
  setUsers([]);
  const r = await report();
  const keys = Object.keys(r.byActivationEvent).sort();
  assert(JSON.stringify(keys) === JSON.stringify(['builtPhase2', 'exportedPNG', 'sharedPlay']),
    `got ${keys.join(',')}`);
});

test('an empty collection reports zeroes and nulls rather than dividing by zero', async () => {
  setUsers([]);
  const res = await run();
  assert(res.statusCode === 200, `got ${res.statusCode}`);
  const r = JSON.parse(res.body);
  assert(r.overall.trialedUsers === 0, `got ${r.overall.trialedUsers}`);
  assert(r.overall.conversionRate === null, `got ${r.overall.conversionRate}`);
  assert(r.activatedVsNot.activated.conversionRate === null);
  assert(r.byActivationEvent.sharedPlay.hit.conversionRate === null);
});

test('users who never started a trial are excluded entirely', async () => {
  userDocs = {
    free1: { activation_sharedPlay: T0 },               // free user, no trial
    free2: { trialStartedAt: null },                    // field explicitly null
    t1:    trialUser({ converted: true, activations: { sharedPlay: 4 } }),
  };
  queries = [];
  const r = await report();
  assert(r.overall.trialedUsers === 1, `got ${r.overall.trialedUsers}`);
  assert(r.overall.conversionRate === 100, `got ${r.overall.conversionRate}`);
});

test('only trialConverted === true counts as a conversion', async () => {
  setUsers([
    { trialStartedAt: new Date(T0).toISOString(), trialConverted: 'yes' },
    { trialStartedAt: new Date(T0).toISOString(), trialConverted: 1 },
    { trialStartedAt: new Date(T0).toISOString() },
    trialUser({ converted: true }),
  ]);
  const r = await report();
  assert(r.overall.convertedUsers === 1, `expected 1, got ${r.overall.convertedUsers}`);
});

// ── Paging ───────────────────────────────────────────────────────────────────
test('a cohort larger than one page is counted in full', async () => {
  const docs = [];
  for (let i = 0; i < 501; i++) {
    // Distinct, ordered start times so the cursor has something to walk.
    docs.push(trialUser({
      converted: i % 2 === 0,
      activations: { sharedPlay: 3 },
      startedAt: T0 + i * 3600 * 1000,
    }));
  }
  setUsers(docs);
  const r = await report();
  assert(r.overall.trialedUsers === 501, `expected 501, got ${r.overall.trialedUsers}`);
  assert(r.overall.convertedUsers === 251, `expected 251, got ${r.overall.convertedUsers}`);
  assert(r.byActivationEvent.sharedPlay.hit.trialed === 501,
    `expected 501, got ${r.byActivationEvent.sharedPlay.hit.trialed}`);
  assert(queries.length === 2, `expected 2 pages, got ${queries.length}`);
  assert(queries[1].startAfter, 'the second page was fetched without a cursor');
});

test('nobody is counted twice across a page boundary', async () => {
  const docs = [];
  for (let i = 0; i < 500; i++) {
    docs.push(trialUser({ converted: true, startedAt: T0 + i * 3600 * 1000 }));
  }
  setUsers(docs);
  const r = await report();
  // A full first page means "there may be more", so a second query runs and
  // must come back empty rather than replaying the same 500 docs.
  assert(r.overall.trialedUsers === 500, `expected 500, got ${r.overall.trialedUsers}`);
  assert(queries.length === 2, `expected a probe for a second page, got ${queries.length}`);
});

test('the query is still the indexed one Firestore requires', async () => {
  setUsers([trialUser()]);
  await report();
  const q = queries[0];
  assert(q.where.field === 'trialStartedAt' && q.where.op === '!=',
    'the inequality filter on trialStartedAt is gone');
  assert(q.orderBy === 'trialStartedAt',
    'an inequality filter must order by the same field or Firestore rejects it');
  assert(q.limit === 500, `expected a 500 doc page, got ${q.limit}`);
});

test('the report is served as JSON with a generation timestamp', async () => {
  setUsers([trialUser()]);
  const res = await run();
  assert(res.headers['Content-Type'] === 'application/json', 'wrong content type');
  const r = JSON.parse(res.body);
  assert(!Number.isNaN(Date.parse(r.generatedAt)), `bad generatedAt: ${r.generatedAt}`);
});

// ── Runner ───────────────────────────────────────────────────────────────────
let pass = 0, fail = 0;
for (const t of tests) {
  try { await t.fn(); console.log(`  ✓ ${t.name}`); pass++; }
  catch (e) { console.log(`  ✗ ${t.name}\n      ${e.message}`); fail++; }
}
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
