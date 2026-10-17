// Tests for netlify/functions/share-page.js.
//
// "Copy share link" produced courtdraw.app/courtdraw-app.html#s=<base64>. A
// fragment never reaches the server, so a link pasted into a team chat had no
// title, no description and no preview. In five months not one of 35 trialing
// coaches ever shared a play — the feature worked, its output was not worth
// forwarding.
//
// The page renders that same payload server-side. Two things matter most here:
// the encoding must round-trip exactly (a corrupted board is worse than no
// preview), and the page must be noindex (a shared board belongs to whoever
// holds the link and must never become a search result).
//
// Run: node tests/share-page.mjs

import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

process.env.PUBLIC_URL = 'https://courtdraw.app';
const { handler } = require(path.join(ROOT, 'netlify/functions/share-page.js'));

// Exactly what the browser does: btoa(encodeURIComponent(JSON.stringify(x))).
const encode = (obj) =>
  Buffer.from(encodeURIComponent(JSON.stringify(obj)), 'latin1').toString('base64');

// The shapes the app really produces: tokens carry pct:[x,y] (not x/y), and a
// drawn arrow carries points:[[x,y],[x,y]]. An earlier version of this fixture
// invented {x,y} tokens — which render as nothing, while the page still
// contains <svg> from the court itself. The test passed and proved nothing.
const board = (over = {}) => ({
  courtId: 'futsal',
  objects: [{ type: 'arrow', color: '#fff', lineWidth: 3, points: [[120, 90], [640, 420]] }],
  tokens: [{ team: 'blue', label: '7', pct: [0.3, 0.4] }],
  phases: [{}, {}],
  currentPhase: 0,
  ...over,
});

const get = (p) => handler({ httpMethod: 'GET', queryStringParameters: { p } });
const html = async (p) => (await get(p)).body;

// ── The round trip ───────────────────────────────────────────────────────────
test('a board encoded by the browser decodes and renders its contents', async () => {
  // <svg> alone proves nothing — the empty court produces that. These assert
  // the token and the arrow actually made it into the markup.
  const res = await get(encode(board()));
  assert(res.statusCode === 200, `got ${res.statusCode}`);
  assert(/<svg/.test(res.body), 'no diagram in the HTML');
  assert(/<circle[^>]*r="22"/.test(res.body), 'the token did not render');
  assert(res.body.includes('>7</text>'), 'the token label did not render');
  assert(/<path d="M120,90 L640,420"/.test(res.body), 'the arrow did not render');
  assert(/marker-end="url\(#/.test(res.body), 'the arrowhead did not render');
});

test('non-ASCII in a board survives the round trip', async () => {
  // Coaches name things in Hungarian and French. btoa cannot take those bytes
  // directly, which is why the app percent-encodes first; the server has to
  // reverse exactly that, not guess at UTF-8.
  const res = await get(encode(board({ tokens: [
    { team: 'blue', label: 'Kézilabda', pct: [0.2, 0.3] },
    { team: 'red',  label: 'Défenseur', pct: [0.7, 0.6] },
  ] })));
  assert(res.statusCode === 200, `got ${res.statusCode}`);
  assert(res.body.includes('Kézilabda'), 'Hungarian label lost');
  assert(res.body.includes('Défenseur'), 'French label lost');
});

// ── Privacy: this is the one that must never regress ────────────────────────
test('a shared board is noindex', async () => {
  const body = await html(encode(board()));
  assert(/<meta name="robots" content="noindex/.test(body),
    'a private board would be indexable');
});

test('the invalid-link page is noindex too', async () => {
  const res = await get('not-base64-at-all!!');
  assert(/<meta name="robots" content="noindex/.test(res.body), 'error page indexable');
});

// ── What makes the link worth forwarding ────────────────────────────────────
test('it carries the Open Graph tags a chat app reads', async () => {
  const body = await html(encode(board()));
  for (const tag of ['og:title', 'og:description', 'og:image', 'og:type', 'twitter:card']) {
    assert(body.includes(tag), `missing ${tag}`);
  }
});

test('og:image points at the asset that exists', async () => {
  const body = await html(encode(board()));
  assert(body.includes('https://courtdraw.app/assets/og-image.png'),
    'og:image is not the real asset path');
});

test('the title names the sport rather than saying "play"', async () => {
  const body = await html(encode(board({ courtId: 'futsal' })));
  assert(/<title>Futsal play/.test(body), 'title does not name the sport');
});

test('a singles/doubles court reads naturally', async () => {
  const body = await html(encode(board({ courtId: 'tennis_singles' })));
  assert(body.includes('Tennis (singles)'), 'court label not humanised');
});

test('a multi-phase play says so, a single-phase one does not', async () => {
  const many = await html(encode(board({ phases: [{}, {}, {}] })));
  const one  = await html(encode(board({ phases: [{}] })));
  assert(/3 phases/.test(many), 'phase count missing');
  assert(!/1 phases/.test(one), 'said "1 phases"');
});

// ── The two onward paths ─────────────────────────────────────────────────────
test('the CTA opens the same board in the app', async () => {
  const p = encode(board());
  const body = await html(p);
  assert(body.includes(`/app#s=${encodeURIComponent(p)}`),
    'the CTA does not hand the payload back to the app');
});

test('the embed snippet uses the format embed.html actually reads', async () => {
  const p = encode(board());
  const body = await html(p);
  assert(body.includes('embed.html#s='), 'no embed snippet');
  assert(body.includes('&lt;iframe'), 'the snippet is not escaped for display');
});

// ── Bad input must not crash or render nonsense ─────────────────────────────
test('a missing payload gives the helpful page, not a 500', async () => {
  const res = await handler({ httpMethod: 'GET', queryStringParameters: {} });
  assert(res.statusCode === 404, `got ${res.statusCode}`);
  assert(/didn’t open/.test(res.body), 'no explanation offered');
});

test('a truncated link — the most likely real failure — is explained', async () => {
  const p = encode(board());
  const res = await get(p.slice(0, Math.floor(p.length / 2)));
  assert(res.statusCode === 404, `got ${res.statusCode}`);
  assert(/cut short|could not be read|didn’t open/.test(res.body),
    'unhelpful failure page');
});

test('valid base64 that is not a board is rejected', async () => {
  const res = await get(Buffer.from('hello', 'latin1').toString('base64'));
  assert(res.statusCode === 404, `got ${res.statusCode}`);
});

test('an empty board is not worth a page', async () => {
  const res = await get(encode({ courtId: 'futsal', objects: [], tokens: [] }));
  assert(res.statusCode === 404, `got ${res.statusCode}`);
});

test('an oversized payload is refused without decoding it', async () => {
  const res = await get('A'.repeat(20000));
  assert(res.statusCode === 404, `got ${res.statusCode}`);
  assert(/too long/.test(res.body), 'did not say why');
});

test('the path form /s/<payload> resolves too', async () => {
  const p = encode(board());
  const res = await handler({
    httpMethod: 'GET', path: `/s/${encodeURIComponent(p)}`, queryStringParameters: {},
  });
  assert(res.statusCode === 200, `got ${res.statusCode}`);
  assert(/<svg/.test(res.body), 'no diagram');
});

test('only GET is served', async () => {
  const res = await handler({ httpMethod: 'POST', queryStringParameters: {} });
  assert(res.statusCode === 405, `got ${res.statusCode}`);
});

// ── Injection: the payload is attacker-controlled ───────────────────────────
test('a hostile courtId cannot break out of the title', async () => {
  // courtId reaches <title>, og:title and the <h1>. It comes from whoever made
  // the link, which is not necessarily whoever opens it.
  const res = await get(encode(board({ courtId: '"><script>alert(1)</script>' })));
  assert(res.statusCode === 200, `got ${res.statusCode}`);
  // Case-insensitive, and on the tag rather than the payload: courtLabel
  // title-cases its input, so an unescaped injection arrives as <Script>,
  // which executes just the same. Matching the lowercase string missed it.
  // This page renders no scripts of its own, so any <script at all is a bug.
  assert(!/<script/i.test(res.body), 'a script tag reached the page from user input');
  assert(res.body.includes('&lt;') || res.body.includes('&quot;'),
    'user input was not escaped at all');
});

test('a hostile token label cannot inject markup', async () => {
  const res = await get(encode(board({ tokens: [
    { team: 'blue', label: '</text><script>alert(1)</script>', pct: [0.2, 0.3] },
    { team: 'red',  label: 'ok', pct: [0.7, 0.6] },
  ] })));
  assert(!/<script/i.test(res.body), 'a script tag reached the page from a token label');
});

let pass = 0, fail = 0;
for (const t of tests) {
  try { await t.fn(); console.log(`  ✓ ${t.name}`); pass++; }
  catch (e) { console.log(`  ✗ ${t.name}\n      ${e.message}`); fail++; }
}
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
