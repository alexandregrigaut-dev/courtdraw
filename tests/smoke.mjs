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

// ── Tests: the save nudge ────────────────────────────────────────────────
// 6.7% of users who touch the board ever open the save dialog. The nudge is
// the experiment against that number, so its gating has to stay honest: it
// must not fire on a stray line, and it must route into the instrumented
// save path rather than a parallel one.

/** NUDGE_IDLE_MS is a top-level const, reachable in page scope but not on window. */
const nudgeIdleMs = (page) => page.evaluate(() => NUDGE_IDLE_MS);

test('nudge: does not fire below the object threshold', async (page) => {
  await openAppPastWelcome(page);
  await drawStroke(page);
  await drawStroke(page);                       // two objects — under the minimum
  await page.waitForTimeout(await nudgeIdleMs(page) + 2500);
  const fired = await firedEvents(page);
  assert(!fired.includes('save_nudge_shown'),
    'two strokes is not a play; the nudge must stay quiet');
});

test('nudge: fires once drawing stops, and routes into the save dialog', async (page) => {
  await openAppPastWelcome(page);
  await drawStroke(page);
  await drawStroke(page);
  await drawStroke(page);                       // at the minimum
  await page.waitForTimeout(await nudgeIdleMs(page) + 2500);

  const fired = await firedEvents(page);
  assertIncludes(fired, 'save_nudge_shown', 'three objects plus idle should nudge');
  const shown = await eventParams(page, 'save_nudge_shown');
  assertEq(shown?.objects_count, 3, 'the nudge should report how much was drawn');
  assert(await page.locator('#toast.show').count() === 1, 'the nudge should be visible as a toast');

  await page.locator('#toast-cta-btn').click();
  await page.waitForTimeout(600);
  const after = await firedEvents(page);
  assertIncludes(after, 'save_nudge_accepted', 'tapping the CTA should report acceptance');
  assertIncludes(after, 'save_dialog_opened', 'the CTA must open the real save dialog');
  assert(await page.locator('#modal-save-quick').isVisible(), 'save dialog should be open');
  const opened = await eventParams(page, 'save_dialog_opened');
  assertEq(opened?.source, 'nudge', 'nudge-driven opens must be attributable');
});

test('nudge: dismissing it reports the reason, and it does not return', async (page) => {
  await openAppPastWelcome(page);
  for (let i = 0; i < 3; i++) await drawStroke(page);
  await page.waitForTimeout(await nudgeIdleMs(page) + 2500);
  await page.locator('#toast-dismiss-btn').click();
  await page.waitForTimeout(400);
  const after = await firedEvents(page);
  assertIncludes(after, 'save_nudge_dismissed', 'dismissing should report itself');
  assertEq((await eventParams(page, 'save_nudge_dismissed'))?.method, 'button',
    'an active reject should be distinguishable from a timeout');

  // The ✕ handler used to hide the toast without clearing the auto-hide timer,
  // so the same dismissal reported twice — 'button' now, 'timeout' later. Wait
  // past the toast's own lifetime and confirm only one outcome was recorded.
  await page.waitForTimeout(await page.evaluate(() => NUDGE_VISIBLE_MS) + 2500);
  const settled = await firedEvents(page);
  assertEq(settled.filter(n => n === 'save_nudge_dismissed').length, 1,
    'one toast must yield exactly one outcome, or the funnel is unreadable');
  // Drawing again must not summon it a second time. Invoking the trigger
  // directly rather than idling again keeps the suite fast and asserts the
  // once-per-session guard itself, not the timer.
  await drawStroke(page);
  await page.evaluate(() => maybeShowSaveNudge());
  await page.waitForTimeout(400);
  const final = await firedEvents(page);
  assertEq(final.filter(n => n === 'save_nudge_shown').length, 1,
    'the nudge is once per session; a repeat would be nagging');
});

test('app: toolbar Save still reports itself as the toolbar', async (page) => {
  await openAppPastWelcome(page);
  await drawStroke(page);
  await page.locator('button[title="Save tactic"]').click();
  await page.waitForTimeout(600);
  assertEq((await eventParams(page, 'save_dialog_opened'))?.source, 'toolbar',
    'unattributed opens should not be credited to the nudge');
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

// ── Tests: paywall reporting ─────────────────────────────────────────────
// openCourtPaywall() opened the modal directly and reported nothing, so the
// most likely wall in the product was invisible in analytics. These pin the
// reporting in place and keep `source` meaningful.

test('paywall: the locked-court wall reports itself', async (page) => {
  await openAppPastWelcome(page);
  await page.evaluate(() => openCourtPaywall('Tennis'));
  await page.waitForTimeout(400);
  assertIncludes(await firedEvents(page), 'paywall_shown',
    'the locked-court wall must report — it was silent before');
  const p = await eventParams(page, 'paywall_shown');
  assertEq(p?.source, 'locked_court', 'it must be attributable to the court lock');
  assert(await page.locator('#modal-paywall').isVisible(), 'and still actually open the modal');
});

test('paywall: triggers are distinguishable by source', async (page) => {
  await openAppPastWelcome(page);
  await page.evaluate(() => openPaywall('You have used all 3 free saves.', 'save_cap'));
  await page.waitForTimeout(300);
  const p = await eventParams(page, 'paywall_shown');
  assertEq(p?.source, 'save_cap', 'an explicit source should be reported verbatim');
  assert(String(p?.reason || '').includes('free saves'),
    'the user-facing sentence should still travel as `reason`');
});

test('paywall: an unlabelled trigger is reported as unspecified, not dropped', async (page) => {
  await openAppPastWelcome(page);
  await page.evaluate(() => openPaywall());
  await page.waitForTimeout(300);
  assertEq((await eventParams(page, 'paywall_shown'))?.source, 'unspecified',
    'a missing source should be visible as a gap, not absent');
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

test('pages: clubs page renders with its pricing maths intact', async (page) => {
  await page.goto(url('clubs/index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(800);

  assert((await page.locator('h1').innerText()).length > 10, 'clubs page should have an h1');
  assert(await page.locator('.club-maths .cm-row').count() === 2,
    'the break-even block should show both rows (two Pro vs one Club)');

  // the whole argument of the page is that these two numbers sit side by side
  const vals = await page.locator('.club-maths .cm-val').allInnerTexts();
  assert(vals.some(v => v.includes('98')) && vals.some(v => v.includes('99')),
    `break-even block should contrast 98 against 99, got ${JSON.stringify(vals)}`);

  // FAQ markup must stay in step with the FAQPage schema or the rich result breaks
  const onPage = await page.locator('.faq-item').count();
  const inSchema = await page.evaluate(() => {
    for (const el of document.querySelectorAll('script[type="application/ld+json"]')) {
      for (const node of (JSON.parse(el.textContent)['@graph'] || [])) {
        if (node['@type'] === 'FAQPage') return node.mainEntity.length;
      }
    }
    return -1;
  });
  assert(onPage === 5 && inSchema === 5,
    `FAQ count must match schema: ${onPage} on page, ${inSchema} in JSON-LD`);

  assert(await page.locator('.nav-links a[href="/clubs/"]').count() === 1,
    'clubs page should be reachable from the global nav');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  assert(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)),
    'clubs page should not scroll horizontally at 390px');
});

test('pages: 5-a-side page deep-links the right court and keeps FAQ schema in step', async (page) => {
  await page.goto(url('5-a-side-tactics-board/index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(800);

  // the whole point of the page is to open the 5-a-side pitch, not futsal
  const params = await page.evaluate(() => [...new Set(
    [...document.querySelectorAll('a[href*="courtdraw-app"]')].map(a => new URL(a.href).search))]);
  assert(params.length === 1 && params[0] === '?court=futsal_mini',
    `every CTA should open the 5-a-side court, got ${JSON.stringify(params)}`);

  // FAQ rich result is dropped if the schema and the visible text disagree
  const faq = await page.evaluate(() => {
    const onPage = [...document.querySelectorAll('.faq-item h3')].map(h => h.textContent.trim());
    let schema = null;
    for (const el of document.querySelectorAll('script[type="application/ld+json"]')) {
      for (const node of (JSON.parse(el.textContent)['@graph'] || [])) {
        if (node['@type'] === 'FAQPage') schema = node.mainEntity.map(q => q.name.trim());
      }
    }
    return { onPage, schema };
  });
  assert(faq.schema && faq.onPage.length === 5 && JSON.stringify(faq.schema) === JSON.stringify(faq.onPage),
    `FAQ schema must match the visible questions:\n  page:   ${JSON.stringify(faq.onPage)}\n  schema: ${JSON.stringify(faq.schema)}`);

  // class names must match the shared sport-page stylesheet, or the page renders unstyled
  assert(await page.evaluate(() => {
    const el = document.querySelector('.how-num');
    return el ? getComputedStyle(el).borderRadius : 'MISSING';
  }) === '50%', '.how-num must exist and pick up the shared sport-page stylesheet');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  assert(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)),
    '5-a-side page should not scroll horizontally at 390px');
});

test('trial notice: stays quiet while the charge is still far off', async (page) => {
  await page.goto(url('courtdraw-app.html'), { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const shown = await page.evaluate(() => {
    const far = new Date(Date.now() + 6 * 86400000).toISOString();
    maybeShowTrialBanner({ isTrialing: true, trialEndsAt: far, plan: 'club', trialAmount: 9900, trialCurrency: 'EUR' });
    return document.getElementById('trial-banner').classList.contains('show');
  });
  assert(shown === false, 'banner should not appear 6 days out — only inside the last 3');
});

test('trial notice: states the charge in the customer\'s own currency', async (page) => {
  await page.goto(url('courtdraw-app.html'), { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  // The app bills in five currencies. Showing a US customer a euro figure would
  // be worse than showing none, so each case asserts the symbol it must carry
  // and that it carries no other currency's.
  const cases = [
    { currency: 'EUR', amount: 9900, mustHave: '€',   mustNotHave: ['$', '£'] },
    { currency: 'USD', amount: 10900, mustHave: '$',  mustNotHave: ['€', '£'] },
    { currency: 'GBP', amount: 8500, mustHave: '£',   mustNotHave: ['€', '$'] },
  ];
  for (const c of cases) {
    const text = await page.evaluate((c) => {
      try { localStorage.removeItem('courtdraw_trial_notice_hidden'); } catch {}
      document.getElementById('trial-banner').classList.remove('show');
      const soon = new Date(Date.now() + 2 * 86400000).toISOString();
      maybeShowTrialBanner({ isTrialing: true, trialEndsAt: soon, plan: 'club',
                             trialAmount: c.amount, trialCurrency: c.currency });
      const el = document.getElementById('trial-banner');
      return el.classList.contains('show') ? el.innerText : null;
    }, c);
    assert(text, `banner should appear 2 days out for ${c.currency}`);
    assert(text.includes(c.mustHave), `${c.currency} notice should show ${c.mustHave}, got: ${text}`);
    for (const wrong of c.mustNotHave) {
      assert(!text.includes(wrong), `${c.currency} notice must not show ${wrong}, got: ${text}`);
    }
    assert(/\b99|109|85\b/.test(text.replace(/[^0-9]/g, ' ')), `notice should carry the amount, got: ${text}`);
  }
});

test('trial notice: shows no figure rather than a wrong one', async (page) => {
  await page.goto(url('courtdraw-app.html'), { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => ({
    missing: formatTrialAmount(undefined, 'EUR'),
    noCurrency: formatTrialAmount(9900, null),
    bogus: formatTrialAmount(9900, 'NOTACURRENCY'),
    good: formatTrialAmount(9900, 'EUR'),
  }));
  assert(r.missing === null && r.noCurrency === null && r.bogus === null,
    `incomplete or invalid price data must yield null, got ${JSON.stringify(r)}`);
  assert(typeof r.good === 'string' && r.good.includes('99'), `valid data should format, got ${r.good}`);

  // and the banner still renders, just without an amount
  const text = await page.evaluate(() => {
    try { localStorage.removeItem('courtdraw_trial_notice_hidden'); } catch {}
    const soon = new Date(Date.now() + 2 * 86400000).toISOString();
    maybeShowTrialBanner({ isTrialing: true, trialEndsAt: soon, plan: 'pro' });
    const el = document.getElementById('trial-banner');
    return el.classList.contains('show') ? el.innerText : null;
  });
  assert(text && /trial ends/i.test(text), 'banner should still warn when the amount is unknown');
  assert(!/[€$£]/.test(text), `must not invent a currency figure, got: ${text}`);
});

test('trial notice: never shows for someone who is not trialing', async (page) => {
  await page.goto(url('courtdraw-app.html'), { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const anyShown = await page.evaluate(() => {
    const soon = new Date(Date.now() + 2 * 86400000).toISOString();
    const el = document.getElementById('trial-banner');
    for (const data of [
      {},                                                        // no plan data at all
      { isTrialing: false, trialEndsAt: soon, plan: 'pro' },      // paid, not trialing
      { isTrialing: true, plan: 'pro' },                          // trialing but no end date
      { isTrialing: true, trialEndsAt: 'not-a-date', plan: 'pro' },
      { isTrialing: true, trialEndsAt: new Date(Date.now() - 86400000).toISOString(), plan: 'pro' }, // already over
    ]) {
      el.classList.remove('show');
      maybeShowTrialBanner(data);
      if (el.classList.contains('show')) return JSON.stringify(data);
    }
    return null;
  });
  assert(anyShown === null, `banner shown for a non-trialing case: ${anyShown}`);
});

test('trial notice: dismissing it keeps it away for the rest of the day', async (page) => {
  await page.goto(url('courtdraw-app.html'), { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => {
    try { localStorage.removeItem('courtdraw_trial_notice_hidden'); } catch {}
    const soon = new Date(Date.now() + 2 * 86400000).toISOString();
    const data = { isTrialing: true, trialEndsAt: soon, plan: 'club', trialAmount: 9900, trialCurrency: 'EUR' };
    const el = document.getElementById('trial-banner');

    maybeShowTrialBanner(data);
    const afterFirst = el.classList.contains('show');

    dismissTrialBanner();
    const afterDismiss = el.classList.contains('show');

    maybeShowTrialBanner(data);          // same day — must stay away
    const afterRetry = el.classList.contains('show');

    // a later day is a fresh decision
    try { localStorage.setItem('courtdraw_trial_notice_hidden', '1999-01-01'); } catch {}
    maybeShowTrialBanner(data);
    const afterNewDay = el.classList.contains('show');

    return { afterFirst, afterDismiss, afterRetry, afterNewDay };
  });
  assert(r.afterFirst === true,  'banner should show first time');
  assert(r.afterDismiss === false, 'dismiss should hide it');
  assert(r.afterRetry === false, 'it must not come back the same day');
  assert(r.afterNewDay === true, 'a new day should surface it again — the charge is closer, not further');
});

test('trial notice: is actually readable in all three layouts', async (page) => {
  // The logic tests above all passed while this banner was rendering clipped
  // underneath a fixed, full-bleed #board-area on mobile — they only asserted
  // the `show` class. Mobile portrait and landscape are immersive layouts where
  // the board is fixed and the header is translated off-screen, so a banner in
  // normal flow ends up behind the court. This asserts it is really on top and
  // really legible.
  for (const [label, width, height] of [['portrait', 390, 844], ['landscape', 844, 390], ['desktop', 1280, 800]]) {
    await page.setViewportSize({ width, height });
    await page.goto(url('courtdraw-app.html'), { waitUntil: 'load' });
    await page.waitForTimeout(1200);

    const r = await page.evaluate(() => {
      document.querySelectorAll('.modal-backdrop.open, #modal-welcome.open')
        .forEach(m => m.classList.remove('open'));
      try { localStorage.removeItem('courtdraw_trial_notice_hidden'); } catch {}
      const soon = new Date(Date.now() + 2 * 86400000).toISOString();
      maybeShowTrialBanner({ isTrialing: true, trialEndsAt: soon, plan: 'club',
                             trialAmount: 9900, trialCurrency: 'EUR' });
      const el = document.getElementById('trial-banner');
      const box = el.getBoundingClientRect();
      // whatever is painted at the banner's own position must be the banner
      const probe = document.elementFromPoint(Math.round(box.left + 20),
                                              Math.round(box.top + box.height / 2));
      const btn = el.querySelector('.tb-btn').getBoundingClientRect();
      return {
        visible: box.height > 0 && box.width > 0,
        onScreen: box.top >= 0 && box.bottom <= innerHeight,
        clipped: el.scrollHeight > el.clientHeight + 1,
        covered: !(probe && el.contains(probe)),
        buttonReachable: btn.width > 0 && btn.right <= innerWidth + 1,
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });

    assert(r.visible,  `${label}: banner should have a visible box`);
    assert(r.onScreen, `${label}: banner should sit fully inside the viewport`);
    assert(!r.clipped, `${label}: banner text is clipped — it would be unreadable`);
    assert(!r.covered, `${label}: banner is painted underneath another element`);
    assert(r.buttonReachable, `${label}: the Manage button must be reachable`);
    assert(r.overflowX === 0, `${label}: banner must not push the page sideways`);
  }
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
