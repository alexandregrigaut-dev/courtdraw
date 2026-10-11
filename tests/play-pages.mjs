// Tests for the per-play pages: /play/:id and /sitemap-plays.xml
//
// These pages exist for one reason: the ~210 community plays were reachable
// only from inside a noindex app and from /community, which loads them all
// client-side and gives none of them a URL. So the largest body of content on
// the site was a single page to a search engine.
//
// That makes the things worth testing unusual. It is not enough that the page
// returns 200 — the diagram has to be IN the response rather than drawn later,
// an id that does not exist has to be a real 404 rather than a friendly empty
// page, and a play with nothing on it must not be offered for indexing. Each
// of those failures is invisible in a browser and fatal to the point.
//
// Run: node tests/play-pages.mjs

import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function assertIncludes(h, n, msg) { if (!String(h).includes(n)) throw new Error(`${msg}\n    missing: ${n}`); }

// ── Firestore stub ────────────────────────────────────────────────────────────
let playDocs = {};
let dbReads = 0;   // how many times Firestore was actually consulted

function makePlay(over = {}) {
  return {
    name: '1-3-1 Zone Defence',
    courtId: 'basketball_full',
    sport: 'basketball',
    tacticType: 'defensive',
    ageGroup: 'u16',
    authorName: 'CourtDraw Team',
    saveCount: 37,
    currentPhase: 0,
    objectsJson: JSON.stringify([{ type: 'arrow', points: [[100, 100], [400, 300]], color: '#fff' }]),
    tokensJson:  JSON.stringify([{ pct: [0.3, 0.5], team: 'blue', label: '1' }]),
    phasesJson:  JSON.stringify([]),
    publishedAt: { toDate: () => new Date('2026-09-01T10:00:00Z') },
    ...over,
  };
}

const Module = require('module');
const realLoad = Module._load;
Module._load = function (request) {
  if (request === 'firebase-admin') {
    return {
      apps: [{}],
      initializeApp() {},
      credential: { cert: () => ({}) },
      firestore: () => ({
        collection: () => ({
          doc: (id) => ({
            async get() {
              dbReads++;
              return { exists: !!playDocs[id], id, data: () => playDocs[id] };
            },
          }),
          limit: () => ({
            async get() {
              return { docs: Object.entries(playDocs).map(([id, d]) => ({ id, data: () => d })) };
            },
          }),
        }),
      }),
    };
  }
  return realLoad.apply(this, arguments);
};

process.env.PUBLIC_URL = 'https://courtdraw.app';
process.env.FIREBASE_PRIVATE_KEY = 'x';

const { handler: playPage }  = require(path.join(ROOT, 'netlify/functions/play-page.js'));
const { handler: playSitemap } = require(path.join(ROOT, 'netlify/functions/sitemap-plays.js'));

const get = (id) => playPage({ queryStringParameters: { id } });

// ── Tests: the page is worth indexing ─────────────────────────────────────────

test('the diagram is in the HTML, not fetched afterwards', async () => {
  // The entire point. A page whose content arrives after a fetch is the
  // weakest case for a crawler, and the diagram IS the content here.
  playDocs = { abc123xyz789: makePlay() };
  const res = await get('abc123xyz789');
  assert(res.statusCode === 200, `expected 200, got ${res.statusCode}`);
  assertIncludes(res.body, '<svg', 'the SVG must be in the response');
  assertIncludes(res.body, 'marker-end', 'the arrow should be drawn');
  assertIncludes(res.body, '<circle', 'the player token should be drawn');
  assert(!/fetch\(|XMLHttpRequest/.test(res.body),
    'the page must not depend on a request to render its content');
});

test('the title and description describe the play, not the site', async () => {
  // A page titled "CourtDraw" 210 times over is 210 duplicate titles. These
  // have to carry the play, the sport and the kind of tactic to match the
  // long-tail queries the whole exercise is aimed at.
  playDocs = { abc123xyz789: makePlay() };
  const body = (await get('abc123xyz789')).body;
  const title = (body.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  assertIncludes(title, '1-3-1 Zone Defence', 'the play name belongs in the title');
  assertIncludes(title.toLowerCase(), 'basketball', 'so does the sport');
  assertIncludes(title.toLowerCase(), 'defensive', 'and the kind of tactic');
  assertIncludes(body, '<link rel="canonical" href="https://courtdraw.app/play/abc123xyz789">',
    'it needs a canonical url');
});

test('an empty board is served but never offered for indexing', async () => {
  // A wall of near-identical thin pages is how a whole section gets
  // discounted. These stay reachable — someone may hold the link — but they
  // are kept out of the index and out of the sitemap.
  playDocs = { emptyplay123: makePlay({ objectsJson: '[]', tokensJson: '[]' }) };
  const res = await get('emptyplay123');
  assert(res.statusCode === 200, 'it should still be reachable');
  assertIncludes(res.body, 'name="robots" content="noindex"', 'but must not be indexed');

  playDocs = { realplay12345: makePlay() };
  assert(!(await get('realplay12345')).body.includes('content="noindex"'),
    'a real play must NOT be noindexed');
});

test('an id that does not exist is a hard 404', async () => {
  // A friendly 200 for a missing play is a soft 404, and a crawler will index
  // it and then distrust the rest.
  playDocs = {};
  const res = await get('doesnotexist1');
  assert(res.statusCode === 404, `expected 404, got ${res.statusCode}`);
  assertIncludes(res.body, 'noindex', 'and it must not invite indexing');
});

test('a malformed id is refused without touching the database', async () => {
  // Refusing these only because the lookup misses would still be a 404, so
  // the status code alone proves nothing. What matters is that a probe costs
  // no read: these pages are public and a crawler or a scanner will try.
  playDocs = {};
  dbReads = 0;
  for (const bad of ['', '..', 'a', '<script>', 'x'.repeat(200), '../../etc/passwd', 'id with spaces']) {
    assert((await playPage({ queryStringParameters: { id: bad } })).statusCode === 404,
      `${JSON.stringify(bad)} should be refused`);
  }
  assert(dbReads === 0, `a malformed id must never reach Firestore, got ${dbReads} reads`);

  // ...and a well-formed one still does, or the guard is simply blocking all.
  playDocs = { abc123xyz789: makePlay() };
  dbReads = 0;
  await get('abc123xyz789');
  assert(dbReads === 1, `a valid id should be looked up exactly once, got ${dbReads}`);
});

test('play content cannot break out of the markup', async () => {
  // Names and geometry come from a browser via Firestore, so they are not to
  // be trusted into HTML unchecked.
  playDocs = {
    xssplay12345: makePlay({
      name: '<script>alert(1)</script>',
      authorName: '"><img src=x onerror=alert(1)>',
      objectsJson: JSON.stringify([{ type: 'circle', cx: 10, cy: 10, r: 5, color: '"><script>bad()</script>' }]),
    }),
  };
  const body = (await get('xssplay12345')).body;
  // Checked as raw tags rather than by substring: an escaped payload still
  // contains the words, as visible text, and that is the correct outcome
  // rather than a leak — &lt;img src=x onerror=alert(1)&gt; is a safe string.
  assert(!body.includes('<script>alert(1)</script>'), 'the name must not become a tag');
  assert(!body.includes('<img '), 'the author must not become a tag');
  assert(!body.includes('<script>bad()</script>'), 'a colour must not become a tag');
  assert(body.includes('&lt;img src=x onerror=alert(1)&gt;'),
    'it should still be shown, escaped, rather than silently dropped');
});

test('the CTA hands the play to the app through the path the app expects', async () => {
  // /community has always queued a play in sessionStorage and sent the user
  // to /app?loadplay=1. This page reuses that rather than inventing a second
  // mechanism the app does not implement.
  playDocs = { abc123xyz789: makePlay() };
  const body = (await get('abc123xyz789')).body;
  assertIncludes(body, 'href="/app?loadplay=1"', 'the link must reach the app');
  assertIncludes(body, 'courtdraw_queued_play', 'and queue the play under the key the app reads');
  assert(!body.includes('?play='), 'it must not use a parameter the app does not handle');
});

test('nothing a user typed can close a script block early', async () => {
  // Two blocks on this page are scripts: the JSON-LD and the CTA's queue.
  // Neither JSON.stringify nor HTML escaping protects a </script> sequence
  // inside them, and both carry the play's name. Counted rather than pattern
  // matched, so a third block added later is covered too.
  playDocs = { breakout12345: makePlay({ name: '</script><script>alert(1)</script>' }) };
  const body = (await get('breakout12345')).body;
  const opens  = (body.match(/<script\b/g)  || []).length;
  const closes = (body.match(/<\/script>/g) || []).length;
  assert(opens === closes, `unbalanced script tags: ${opens} open, ${closes} close`);
  assert(opens === 2, `expected exactly the two intended blocks, found ${opens}`);
  assert(!body.includes('<script>alert(1)</script>'), 'and nothing executable got through');
});

// ── Tests: the sitemap ────────────────────────────────────────────────────────

test('the sitemap lists real plays and omits empty ones', async () => {
  playDocs = {
    goodplay11111: makePlay(),
    goodplay22222: makePlay({ name: 'Press Break' }),
    emptyplay3333: makePlay({ objectsJson: '[]', tokensJson: '[]' }),
  };
  const res = await playSitemap();
  assert(res.statusCode === 200, `expected 200, got ${res.statusCode}`);
  assertIncludes(res.body, 'https://courtdraw.app/play/goodplay11111', 'a real play belongs here');
  assertIncludes(res.body, 'https://courtdraw.app/play/goodplay22222', 'so does the second');
  assert(!res.body.includes('emptyplay3333'),
    'an empty board must not be offered — it is noindex, so listing it contradicts the page');
  assertIncludes(res.body, '<lastmod>2026-09-01</lastmod>', 'a publish date should travel');
});

test('the sitemap stays valid when Firestore is unavailable', async () => {
  // A 500 here reads to a crawler as a problem with the site, and it may drop
  // urls it already holds. An empty but well-formed sitemap says "nothing new".
  const saved = playDocs;
  playDocs = new Proxy({}, { ownKeys() { throw new Error('simulated outage'); } });
  const res = await playSitemap();
  assert(res.statusCode === 200, `expected 200 even on failure, got ${res.statusCode}`);
  assertIncludes(res.body, '<urlset', 'and still be a valid sitemap');
  playDocs = saved;
});

// ── Tests: the plumbing that makes any of it reachable ────────────────────────

test('the routes and the second sitemap are declared', async () => {
  const fs = await import('node:fs');
  const toml = fs.readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8');
  assertIncludes(toml, 'from = "/play/:id"', 'the play route must exist');
  assertIncludes(toml, 'to   = "/.netlify/functions/play-page?id=:id"', 'and point at the function');
  assertIncludes(toml, 'from = "/sitemap-plays.xml"', 'the sitemap route must exist');

  const robots = fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8');
  assertIncludes(robots, 'Sitemap: https://courtdraw.app/sitemap-plays.xml',
    'the plays sitemap has to be declared or nothing will fetch it');
  assert(!/Disallow: \/play/.test(robots), 'the play pages must not be blocked');
});

test('the community page links to the play pages with a real anchor', async () => {
  // Cards are divs with click handlers. A handler is not a link: nothing
  // crawls it, and middle-click does nothing. The title is now an <a>.
  const fs = await import('node:fs');
  const html = fs.readFileSync(path.join(ROOT, 'community.html'), 'utf8');
  assertIncludes(html, 'href="/play/${encodeURIComponent(play.id)}"',
    'each card needs a real href to its play page');
  assertIncludes(html, "closest('.play-card-link')",
    'and the card-wide handler must let that link through');
});

test('the shared court shapes still load in both worlds', async () => {
  // src/court-svgs.js is read by community.html off window and by the
  // renderer as a module. Breaking either half silently empties every court.
  const courts = require(path.join(ROOT, 'src/court-svgs.js'));
  assert(Object.keys(courts).length > 30, `expected the full court set, got ${Object.keys(courts).length}`);
  const fs = await import('node:fs');
  const src = fs.readFileSync(path.join(ROOT, 'src/court-svgs.js'), 'utf8');
  assertIncludes(src, "typeof window !== 'undefined'", 'the browser assignment must survive');
  assertIncludes(src, 'module.exports', 'and so must the module export');
});

// ── Runner ────────────────────────────────────────────────────────────────────
let passed = 0; const failures = [];
for (const t of tests) {
  try { await t.fn(); console.log(`  ✓ ${t.name}`); passed++; }
  catch (e) { console.log(`  ✗ ${t.name}\n      ${e.message}`); failures.push(t.name); }
}
console.log(`\n${passed}/${tests.length} passed`);
process.exit(failures.length ? 1 : 0);
