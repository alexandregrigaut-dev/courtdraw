/**
 * smoke.mjs — end-to-end smoke tests for CourtDraw.
 *
 * Covers the paths a broken deploy would hurt most: the app loading, the
 * first-run journey a new coach actually walks, and the four GA4 events the
 * activation funnel is measured with. Those events are the reason this file
 * exists — when `play_saved` read zero in GA4 we had no way to tell a real
 * user behaviour from a broken listener without hand-driving a browser.
 *
 * Deliberately dependency-free: the repo ships no node_modules and Netlify
 * publishes it as a static site, so these run against whatever Playwright the
 * environment provides rather than adding one to package.json.
 *
 *   node tests/smoke.mjs            # all suites
 *   node tests/smoke.mjs app        # only suites whose name contains "app"
 *
 * Exits non-zero on the first failing assertion in a test, but runs every
 * remaining test so one break doesn't hide the others.
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const url = (p) => 'file://' + path.join(ROOT, p);

// ── Playwright lookup ────────────────────────────────────────────────────
// Installed globally in CI and in the dev container, not as a project dep.
function loadChromium() {
  const require = createRequire(import.meta.url);
  const candidates = [
    'playwright',
    'playwright-core',
    '/opt/node22/lib/node_modules/playwright/index.js',
  ];
  for (const id of candidates) {
    try { return require(id).chromium; } catch { /* try next */ }
  }
  throw new Error(
    'Playwright not found. Install it first:  npm i -g playwright && npx playwright install chromium'
  );
}

// PLAYWRIGHT_BROWSERS_PATH usually makes launch() work unaided; fall back to
// an explicit binary if the environment pins one.
async function launch(chromium) {
  try {
    return await chromium.launch();
  } catch (err) {
    const exe = process.env.CHROME_PATH || process.env.CHROMIUM_PATH;
    if (!exe) throw err;
    return await chromium.launch({ executablePath: exe });
  }
}

// ── Tiny assertion harness ───────────────────────────────────────────────
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
function assertEq(actual, expected, msg) {
  if (actual !== expected) throw new Error(`${msg}\n    expected: ${expected}\n    actual:   ${actual}`);
}
function assertIncludes(haystack, needle, msg) {
  if (!haystack.includes(needle)) throw new Error(`${msg}\n    missing: ${needle}`);
}

// ── Shared helpers ───────────────────────────────────────────────────────

/** GA4 event names pushed to dataLayer so far, in order. */
const firedEvents = (page) => page.evaluate(() =>
  (window.dataLayer || []).map(a => (a && a[0] === 'event') ? a[1] : null).filter(Boolean));

/** Params of the most recent push of a given event name. */
const eventParams = (page, name) => page.evaluate((n) => {
  const hits = (window.dataLayer || []).filter(a => a && a[0] === 'event' && a[1] === n);
  return hits.length ? hits[hits.length - 1][2] : null;
}, name);

/** Open the app and walk past the first-run welcome overlay. */
async function openAppPastWelcome(page) {
  await page.goto(url('courtdraw-app.html'), { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#modal-welcome.open', { timeout: 15000 });
  await page.locator('#modal-welcome .modal-close').click();
  await page.waitForTimeout(700);
  // "Let's go" opens the court picker; the ✕ shouldn't, but close it if present.
  const picker = page.locator('#modal-court-picker.open .modal-close').first();
  if (await picker.count() && await picker.isVisible().catch(() => false)) {
    await picker.click();
    await page.waitForTimeout(400);
  }
}

/** Draw one stroke on the board. */
async function drawStroke(page) {
  const box = await page.locator('#drawing-canvas').boundingBox();
  assert(box, 'drawing canvas has no layout box');
  await page.mouse.move(box.x + 180, box.y + 180);
  await page.mouse.down();
  await page.mouse.move(box.x + 330, box.y + 280, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(400);
}

// ── Tests: the app ───────────────────────────────────────────────────────

test('app: loads with a canvas and no page errors', async (page, errors) => {
  await page.goto(url('courtdraw-app.html'), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  assert(await page.locator('#drawing-canvas').count() === 1, 'expected exactly one #drawing-canvas');
  assertEq(errors.length, 0, `uncaught page errors: ${errors.join(' | ')}`);
});

test('app: first-run welcome overlay appears and dismisses', async (page) => {
  await page.goto(url('courtdraw-app.html'), { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#modal-welcome.open', { timeout: 15000 });
  assert(await page.locator('#modal-welcome').isVisible(), 'welcome overlay should be visible on first visit');
  await page.locator('#modal-welcome .modal-close').click();
  await page.waitForTimeout(600);
  assert(!(await page.locator('#modal-welcome.open').count()), 'welcome overlay should close on ✕');
  assertIncludes(await firedEvents(page), 'welcome_overlay_dismissed', 'dismissing should report itself');
});

test('app: drawing fires first_action (activation funnel entry point)', async (page) => {
  await openAppPastWelcome(page);
  await drawStroke(page);
  const fired = await firedEvents(page);
  assertIncludes(fired, 'first_action', 'drawing a stroke must fire first_action');
  assertIncludes(fired, 'first_draw', 'drawing a stroke must fire first_draw');
  const params = await eventParams(page, 'first_action');
  assertEq(params?.source, 'draw', 'first_action should record how the board was first touched');
});

test('app: first_action fires only once per session', async (page) => {
  await openAppPastWelcome(page);
  await drawStroke(page);
  await drawStroke(page);
  const count = (await firedEvents(page)).filter(n => n === 'first_action').length;
  assertEq(count, 1, 'first_action is a once-per-session event; a repeat would inflate the funnel');
});

test('app: Save button opens the dialog and fires save_dialog_opened', async (page) => {
  await openAppPastWelcome(page);
  await drawStroke(page);
  const save = page.locator('button[title="Save tactic"]');
  assert(await save.isVisible(), 'the Save button must be visible — the funnel depends on it');
  await save.click();
  await page.waitForTimeout(600);
  assert(await page.locator('#modal-save-quick').isVisible(), 'save dialog should open');
  assertIncludes(await firedEvents(page), 'save_dialog_opened', 'opening the save dialog must report itself');
  const params = await eventParams(page, 'save_dialog_opened');
  assertEq(params?.variant, 'quick', 'the toolbar Save opens the quick variant');
});

test('app: completing a save fires play_saved', async (page) => {
  await openAppPastWelcome(page);
  await drawStroke(page);
  await page.locator('button[title="Save tactic"]').click();
  await page.waitForTimeout(600);
  await page.locator('#modal-save-quick button[onclick*=quickSaveTactic]').click();
  await page.waitForTimeout(900);
  assertIncludes(await firedEvents(page), 'play_saved', 'confirming a save must fire play_saved');
  const params = await eventParams(page, 'play_saved');
  assertEq(params?.save_number, 1, 'the first save should be numbered 1');
});

test('app: community library opens with plays rendered', async (page) => {
  // The 206-play library is the shortest path from a blank court to a first
  // save, so a silent failure here would be expensive and invisible.
  await openAppPastWelcome(page);
  await page.locator('#btn-pro-library').click();
  await page.waitForTimeout(900);
  assert(await page.locator('#community-library-modal.open').count() === 1,
    'the Community button should open #community-library-modal');
  // Bundled plays render from tactics-library.js; Firestore-published ones are
  // lazy-loaded and may be absent offline, so only assert on the bundled set.
  const cards = await page.locator('#community-library-modal [data-play-id], #community-library-modal .comm-card').count();
  assert(cards > 0, 'the library should render at least the bundled plays, not an empty grid');
});

// ── Tests: marketing pages ───────────────────────────────────────────────

test('pages: landing page renders without errors or horizontal overflow', async (page, errors) => {
  await page.goto(url('index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  assertEq(errors.length, 0, `uncaught page errors: ${errors.join(' | ')}`);
  assert(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)),
    'landing page should not scroll horizontally at 1280px');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  assert(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)),
    'landing page should not scroll horizontally at 390px');
});

test('pages: compare page table survives at phone width', async (page) => {
  await page.goto(url('compare/index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(800);
  assert(await page.locator('table.cmp tbody tr').count() >= 5, 'comparison table should have its rows');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  assert(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)),
    'the wide table must scroll inside .table-wrap, not push the page sideways');
  assert(await page.evaluate(() => {
    const w = document.querySelector('.table-wrap');
    return !!w && w.scrollWidth > w.clientWidth;
  }), '.table-wrap should be the thing that scrolls');
});

// ── Runner ───────────────────────────────────────────────────────────────

const filter = process.argv[2];
const selected = filter ? tests.filter(t => t.name.includes(filter)) : tests;

const chromium = loadChromium();
const browser = await launch(chromium);
let passed = 0;
const failures = [];

for (const t of selected) {
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    await t.fn(page, errors);
    console.log(`  ✓ ${t.name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${t.name}\n      ${err.message.replace(/\n/g, '\n      ')}`);
    failures.push(t.name);
  } finally {
    await context.close();
  }
}
await browser.close();

console.log(`\n${passed}/${selected.length} passed${failures.length ? `, ${failures.length} failed` : ''}`);
if (failures.length) process.exit(1);
