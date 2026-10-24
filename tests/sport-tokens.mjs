// Tests for the default player positions in src/sports-config.js.
//
// These exist because of a bug nobody could see. In hurling and Gaelic
// football the goalkeeper and the centre full-back were given identical
// coordinates, so the keeper was drawn underneath the back and vanished:
// every GAA coach opening those boards counted fourteen players, not
// fifteen, on the two sports CourtDraw was being pitched to GAA county
// boards with. The file's own comment said the keeper belonged at x=115,
// which is what it was not doing.
//
// A token completely hidden under another is the failure worth guarding,
// because nothing on screen hints at it: the board looks deliberate, just
// wrong. Tokens that merely crowd are a different matter — both are
// visible and either can be dragged — so they are reported rather than
// failed, and the sports that do it today are listed as known.
//
// Run: node tests/sport-tokens.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// The board is 1000x600 and a token is drawn at radius 26, so two centres
// closer than 52px overlap to some degree.
const BOARD_W = 1000, BOARD_H = 600, TOKEN_R = 26;

const src = fs.readFileSync(path.join(ROOT, 'src/sports-config.js'), 'utf8');

/** The default-position map only. FORMATIONS is a separate set of presets. */
function sportTokenBlocks() {
  const start = src.indexOf('export const SPORT_TOKENS');
  const end = src.indexOf('export const FORMATIONS');
  assert(start !== -1 && end > start, 'sports-config.js no longer has the maps this test reads');
  const body = src.slice(start, end);
  const out = new Map();
  for (const [, sport, blk] of body.matchAll(/\n {2}(\w+):\s*\[(.*?)\n {2}\],/gs)) {
    const tokens = [...blk.matchAll(
      /team:\s*'(\w+)',\s*label:\s*'(\w*)',\s*pct:\s*\[([\d.]+),\s*([\d.]+)\]/g,
    )].map(([, team, label, x, y]) => ({
      team, label, x: Number(x), y: Number(y),
    }));
    if (tokens.length) out.set(sport, tokens);
  }
  return out;
}

const gap = (a, b) => Math.hypot((a.x - b.x) * BOARD_W, (a.y - b.y) * BOARD_H);

function pairs(tokens) {
  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    for (let j = i + 1; j < tokens.length; j++) out.push([tokens[i], tokens[j]]);
  }
  return out;
}

test('the parser actually finds the sports, so the rest means something', () => {
  const blocks = sportTokenBlocks();
  assert(blocks.size >= 30, `only parsed ${blocks.size} sports; the file's shape has changed`);
  for (const sport of ['hurling', 'gaelic_football', 'basketball_full', 'tennis_singles']) {
    assert(blocks.has(sport), `${sport} was not parsed out of SPORT_TOKENS`);
  }
  // 15 a side. The ball is not in this map — getDefaultTokens pushes it on
  // afterwards — so a board renders 31 tokens while the config holds 30.
  assert(blocks.get('hurling').length === 30,
    `hurling should field 15 a side, got ${blocks.get('hurling').length}`);
});

test('no default token is hidden underneath another', () => {
  // The bug itself: identical coordinates, so one token is invisible.
  const offenders = [];
  for (const [sport, tokens] of sportTokenBlocks()) {
    for (const [a, b] of pairs(tokens)) {
      if (a.x === b.x && a.y === b.y) {
        offenders.push(`${sport}: ${a.team} ${a.label} is exactly under ${b.team} ${b.label} at (${a.x}, ${a.y})`);
      }
    }
  }
  assert(offenders.length === 0,
    `a default token cannot be seen:\n  ${offenders.join('\n  ')}`);
});

test('every GAA keeper stands clear of its own full-back line', () => {
  // Named directly, because this is the formation the bug was in and the
  // one the GAA outreach points at. A generic check would let hurling
  // regress quietly as long as some other sport stayed clean.
  for (const sport of ['hurling', 'gaelic_football']) {
    const tokens = sportTokenBlocks().get(sport);
    const keepers = tokens.filter(t => t.label === 'GK');
    assert(keepers.length === 2, `${sport} should have one keeper per side, got ${keepers.length}`);
    for (const gk of keepers) {
      const backs = tokens.filter(t => t.team === gk.team && t.label === 'FB');
      assert(backs.length === 3, `${sport}: expected 3 full-backs for ${gk.team}, got ${backs.length}`);
      for (const fb of backs) {
        const d = gap(gk, fb);
        assert(d >= TOKEN_R * 2,
          `${sport}: the ${gk.team} keeper is ${d.toFixed(0)}px from a full-back, closer than the ${TOKEN_R * 2}px two tokens need`);
      }
    }
  }
});

test('the GAA keeper is still on its own goal line, not pushed upfield', () => {
  // The other way to separate them would have been to walk the keeper out
  // to meet the backs, which fixes the overlap and ruins the formation.
  // The pitch runs x=105..895, and the file's comment asks for x=115/885.
  for (const sport of ['hurling', 'gaelic_football']) {
    const tokens = sportTokenBlocks().get(sport);
    for (const gk of tokens.filter(t => t.label === 'GK')) {
      const px = gk.x * BOARD_W;
      const onOwnLine = gk.team === 'blue' ? px >= 105 && px <= 160
                                           : px <= 895 && px >= 840;
      assert(onOwnLine,
        `${sport}: the ${gk.team} keeper sits at x=${px.toFixed(0)}, away from its goal line`);
    }
  }
});

test('the two GAA sides stay mirror images of each other', () => {
  // They are the same 15-a-side shape, so a change applied to one side and
  // not the other is a mistake rather than a decision.
  for (const sport of ['hurling', 'gaelic_football']) {
    const tokens = sportTokenBlocks().get(sport);
    const key = t => `${t.label}@${t.y}`;
    const blue = tokens.filter(t => t.team === 'blue');
    const red = tokens.filter(t => t.team === 'red');
    for (const b of blue) {
      const mirrored = red.filter(r => r.label === b.label)
        .some(r => Math.abs((1 - r.x) - b.x) < 1e-9);
      assert(mirrored,
        `${sport}: blue ${key(b)} at x=${b.x} has no red counterpart at x=${(1 - b.x).toFixed(3)}`);
    }
  }
});

test('crowded-but-visible defaults are reported, not failed', () => {
  // Tokens closer than 52px overlap visually, but both can still be seen
  // and dragged, so this is a note rather than a break. It is here so the
  // list is visible and so a new sport's layout gets looked at.
  const known = new Set([
    'american_football', 'water_polo', 'korfball', 'football_half',
    'australian_rules', 'rugby_union', 'beach_soccer',
  ]);
  const crowded = [];
  for (const [sport, tokens] of sportTokenBlocks()) {
    const worst = pairs(tokens)
      .map(([a, b]) => ({ d: gap(a, b), a, b }))
      .sort((p, q) => p.d - q.d)[0];
    if (worst && worst.d < TOKEN_R * 2) {
      crowded.push({ sport, ...worst });
      if (!known.has(sport)) {
        console.log(`      note: ${sport} ${worst.a.label}/${worst.b.label} ${worst.d.toFixed(0)}px apart (new)`);
      }
    }
  }
  for (const sport of ['hurling', 'gaelic_football']) {
    assert(!crowded.some(c => c.sport === sport),
      `${sport} has crowded tokens again; it was fixed and should stay clear`);
  }
});

let pass = 0, fail = 0;
for (const { name, fn } of tests) {
  try { await fn(); console.log(`  ✓ ${name}`); pass++; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); fail++; }
}
console.log(`${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
