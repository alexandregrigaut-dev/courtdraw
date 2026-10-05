// Unit tests for netlify/functions/_email-budget.js
//
// The bulk email jobs are scheduled functions — they only ever run on Netlify,
// against real Firestore, once a day. That makes a mistake in the budget logic
// expensive to discover: an off-by-one that lets bulk overspend shows up as a
// customer who paid and never got their receipt, days later, silently. So the
// module is tested here against a stubbed Firestore rather than trusted.
//
// Run: node tests/email-budget.mjs

import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// ── Firestore stub ────────────────────────────────────────────────────────────
// Models just enough of the API the module uses: collection().doc().get()/set(),
// and FieldValue.increment sentinels resolved on write.
const INCREMENT = Symbol('increment');

function makeDb({ failRead = false, failWrite = false } = {}) {
  const docs = new Map();
  const db = {
    _docs: docs,
    collection: (col) => ({
      doc: (id) => {
        const key = `${col}/${id}`;
        return {
          key,
          async get() {
            if (failRead) throw new Error('simulated Firestore read failure');
            const data = docs.get(key);
            return { exists: data !== undefined, data: () => data };
          },
          async set(patch) {
            if (failWrite) throw new Error('simulated Firestore write failure');
            const cur = docs.get(key) || {};
            const next = { ...cur };
            for (const [k, v] of Object.entries(patch)) {
              next[k] = (v && v[INCREMENT] !== undefined)
                ? (cur[k] || 0) + v[INCREMENT]
                : v;
            }
            docs.set(key, next);
          }
        };
      }
    })
  };
  return db;
}

// Stub firebase-admin before the module under test requires it. It is a Netlify
// runtime dependency and is deliberately absent from package.json (the site has
// no build step, so npm install must stay a no-op) — hence intercepting the
// load rather than populating require.cache, which would need to resolve it.
const Module = require('module');
const realLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'firebase-admin') {
    return { firestore: { FieldValue: { increment: (n) => ({ [INCREMENT]: n }) } } };
  }
  return realLoad.apply(this, arguments);
};

const budget = require(path.join(ROOT, 'netlify/functions/_email-budget.js'));
const { BULK_DAILY_BUDGET, DIGEST_PER_RUN, remainingBulkBudget, recordBulkSend, todayKey } = budget;

// ── Tests ─────────────────────────────────────────────────────────────────────

test('budget leaves headroom for transactional mail under the Resend cap', () => {
  const RESEND_FREE_DAILY_CAP = 100;
  assert(BULK_DAILY_BUDGET < RESEND_FREE_DAILY_CAP,
    `bulk budget ${BULK_DAILY_BUDGET} must leave room under the ${RESEND_FREE_DAILY_CAP}/day cap`);
  assert(RESEND_FREE_DAILY_CAP - BULK_DAILY_BUDGET >= 25,
    'transactional reserve should be a meaningful share, not a token one');
});

test('digest cap sits below the shared budget so drips are not starved', () => {
  // drip-emails only matches a user within +/-12h of day 2/5/10, so a drip
  // skipped for want of budget is missed permanently. The digest, which merely
  // finishes tomorrow, must not be able to consume the whole budget.
  assert(DIGEST_PER_RUN < BULK_DAILY_BUDGET,
    `digest cap ${DIGEST_PER_RUN} must be below the bulk budget ${BULK_DAILY_BUDGET}`);
  assert(BULK_DAILY_BUDGET - DIGEST_PER_RUN >= 10,
    'at least 10/day should survive the digest for the time-critical jobs');
});

test('a fresh day starts with the full budget', async () => {
  const db = makeDb();
  assert(await remainingBulkBudget(db) === BULK_DAILY_BUDGET, 'empty day should offer the full budget');
});

test('sends are counted and the budget shrinks', async () => {
  const db = makeDb();
  await recordBulkSend(db);
  await recordBulkSend(db, 4);
  assert(await remainingBulkBudget(db) === BULK_DAILY_BUDGET - 5,
    'five recorded sends should reduce the remaining budget by five');
});

test('budget never reports negative once spent past the cap', async () => {
  const db = makeDb();
  await recordBulkSend(db, BULK_DAILY_BUDGET + 25);
  assert(await remainingBulkBudget(db) === 0, 'overspend must clamp to 0, not go negative');
});

test('the counter is keyed per day, so it rolls over on its own', async () => {
  const db = makeDb();
  await recordBulkSend(db, 40);
  assert(await remainingBulkBudget(db) === BULK_DAILY_BUDGET - 40);

  // Yesterday's document must not be what today reads.
  const todayDoc = `emailBudget/${todayKey()}`;
  assert(db._docs.has(todayDoc), 'count should be stored under today\'s date key');
  const carried = db._docs.get(todayDoc);
  db._docs.delete(todayDoc);
  db._docs.set('emailBudget/1999-01-01', carried);
  assert(await remainingBulkBudget(db) === BULK_DAILY_BUDGET,
    'a count stored under another date must not reduce today\'s budget');
});

test('a Firestore read failure is treated as no budget, not full budget', async () => {
  // Failing open here would let bulk overspend and eat the transactional
  // reserve — the exact outcome this module exists to prevent.
  const db = makeDb({ failRead: true });
  assert(await remainingBulkBudget(db) === 0, 'unreadable budget must fail closed');
});

test('a failed count never throws into the caller', async () => {
  // The send has already gone out by the time we record it. Throwing here would
  // turn a bookkeeping failure into a crashed run.
  const db = makeDb({ failWrite: true });
  await recordBulkSend(db, 1); // must resolve, not reject
});

test('recording zero or negative is a no-op', async () => {
  const db = makeDb();
  await recordBulkSend(db, 0);
  await recordBulkSend(db, -5);
  assert(await remainingBulkBudget(db) === BULK_DAILY_BUDGET, 'no-op calls must not move the counter');
});

test('a full digest backlog drains over consecutive days and then stops', async () => {
  // The behaviour the schedule change relies on: with ~80 subscribers, Monday
  // takes DIGEST_PER_RUN and Tuesday clears the rest, with the remaining days
  // no-ops because weeklyDigestSentWeek is already set.
  let pending = 80, day = 0;
  const perDay = [];
  while (pending > 0 && day < 7) {
    const db = makeDb(); // each day starts with a fresh budget document
    const allowance = Math.min(DIGEST_PER_RUN, await remainingBulkBudget(db));
    const sentToday = Math.min(allowance, pending);
    for (let i = 0; i < sentToday; i++) await recordBulkSend(db);
    perDay.push(sentToday);
    pending -= sentToday;
    // what the time-critical jobs find left over after the digest has run
    assert(await remainingBulkBudget(db) >= BULK_DAILY_BUDGET - DIGEST_PER_RUN,
      'the digest must never leave the time-critical jobs with nothing');
    day++;
  }
  assert(pending === 0, 'the whole backlog should clear');
  assert(perDay.length === 2, `80 subscribers should clear in 2 days, took ${perDay.length}: ${perDay}`);
});

// ── Runner ────────────────────────────────────────────────────────────────────
let passed = 0; const failures = [];
for (const t of tests) {
  try { await t.fn(); console.log(`  ✓ ${t.name}`); passed++; }
  catch (e) { console.log(`  ✗ ${t.name}\n      ${e.message}`); failures.push(t.name); }
}
console.log(`\n${passed}/${tests.length} passed`);
process.exit(failures.length ? 1 : 0);
