// Server-rendered page for one published community play: /play/:id
//
// Why this exists
// ---------------
// The plays were reachable only from inside the app, which is noindex, and
// from /community, which loads all of them with one fetch and gives none of
// them a URL. So the biggest body of content on the site was a single page to
// a search engine, competing for "basketball tactics board" — a head term
// where the site sits around position six — rather than for the long-tail
// queries each play actually answers.
//
// The diagram is rendered into the response rather than drawn by script after
// load. A page whose content arrives only after a fetch is the weakest case
// for a crawler, and the diagram is the whole reason the page is worth having.
//
// A play with no real diagram on it is served but marked noindex: a wall of
// near-empty pages is how a section gets discounted wholesale.

const admin = require('firebase-admin');
const { playToSvg, playHasContent, esc } = require('./_play-render');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
    })
  });
}
const db = admin.firestore();

const SITE = process.env.PUBLIC_URL || 'https://courtdraw.app';

const TACTIC_LABEL = {
  offensive:  'Offensive play',
  defensive:  'Defensive setup',
  set_play:   'Set play',
  transition: 'Transition',
  other:      'Tactic',
};

// Play ids are Firestore document ids: the generated twenty-character kind
// for user-published plays, and readable ones like football_formation_442 for
// the seeded set. Anything else is a probe or a stale link, and is refused
// before it costs a read.
const VALID_ID = /^[A-Za-z0-9_-]{6,64}$/;

// Where the id actually arrives.
//
// The first version read only event.queryStringParameters.id, because that is
// what the redirect writes. In production every single play returned 404 while
// the sitemap — reading the same collection with the same credentials — listed
// all 210, which placed the fault squarely on the id never reaching the
// lookup. The tests did not catch it: they handed the function the same event
// shape the function assumed, so they verified an assumption against itself.
//
// Netlify preserves the ORIGINAL request path across a 200 rewrite, so
// /play/<id> is in event.path whatever happens to the query string. All three
// sources are read, cheapest first, so the page no longer depends on one
// detail of how the platform passes a parameter through a rewrite.
function playIdFromEvent(event) {
  const fromQuery = ((event.queryStringParameters || {}).id || '').trim();
  if (fromQuery) return fromQuery;

  // /play/<id>, with or without a trailing slash, and also the function's own
  // path if it is ever called as /.netlify/functions/play-page/<id>.
  const path = String(event.path || event.rawUrl || '');
  const m = path.match(/\/(?:play|play-page)\/([^/?#]+)\/?$/);
  if (m) { try { return decodeURIComponent(m[1]).trim(); } catch (e) { return m[1].trim(); } }

  // Last resort: the raw query string, which some runtimes populate instead.
  const raw = String(event.rawQuery || '');
  const q = raw.match(/(?:^|&)id=([^&]*)/);
  if (q) { try { return decodeURIComponent(q[1]).trim(); } catch (e) { return q[1].trim(); } }

  return '';
}

const titleCase = (s) => String(s || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();

function notFound() {
  return {
    statusCode: 404,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
    body: `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Play not found — CourtDraw</title></head>
<body style="font-family:system-ui;background:#0b1120;color:#e2e8f0;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px;">
<div><h1 style="font-size:1.4rem;">This play is no longer available</h1>
<p style="color:#94a3b8;">It may have been unpublished by its author.</p>
<p><a href="/community" style="color:#60a5fa;">Browse the community library</a></p></div>
</body></html>`,
  };
}

exports.handler = async (event) => {
  const id = playIdFromEvent(event);
  if (!VALID_ID.test(id)) {
    // Logged with what arrived, so if this ever misfires again the Netlify
    // function log says which field held the id rather than leaving it to be
    // guessed from the outside, where a refused id and a missing play look
    // identical by design.
    console.warn('[play-page] no usable id;',
      'path=', JSON.stringify(event.path || ''),
      'query=', JSON.stringify(event.queryStringParameters || {}));
    return notFound();
  }

  let snap;
  try {
    snap = await db.collection('communityPlays').doc(id).get();
  } catch (e) {
    console.error('[play-page] Firestore read failed:', e.message);
    return { statusCode: 500, headers: { 'Content-Type': 'text/plain' }, body: 'Server error' };
  }
  if (!snap.exists) return notFound();

  const d = snap.data() || {};
  const safeParse = (s, fb) => { try { return JSON.parse(s); } catch (e) { return fb; } };
  const play = {
    courtId: d.courtId || '',
    objects: safeParse(d.objectsJson, []),
    tokens:  safeParse(d.tokensJson, []),
  };

  const name       = (d.name || 'Untitled play').slice(0, 100);
  const sport      = titleCase(d.sport || d.courtId);
  const tactic     = TACTIC_LABEL[d.tacticType] || TACTIC_LABEL.other;
  const ageGroup   = d.ageGroup ? titleCase(d.ageGroup) : '';
  const author     = (d.authorName && !String(d.authorName).includes('@')) ? d.authorName : 'CourtDraw';
  const saves      = typeof d.saveCount === 'number' ? d.saveCount : 0;
  const indexable  = playHasContent(play);

  const title = `${name} — ${sport} ${tactic.toLowerCase()} diagram | CourtDraw`;
  const description = `${tactic} for ${sport}${ageGroup ? `, ${ageGroup}` : ''}. `
    + `Free interactive diagram — open it in CourtDraw, edit it for your own squad, and export or share it.`;
  const canonical = `${SITE}/play/${encodeURIComponent(id)}`;
  const svg = playToSvg(play, { title: `${name} — ${sport} ${tactic.toLowerCase()}` });

  // The app loads a play handed to it through sessionStorage — the same path
  // /community has used all along. Reusing it means no new endpoint and no
  // second fetch: this page already holds the play, so the CTA can queue it
  // directly. With scripting off the link still reaches the app, just with an
  // empty board; the page itself needs no script to render, which is the part
  // that matters for indexing.
  const queued = JSON.stringify({
    id,
    name,
    courtId:      d.courtId || '',
    sport:        d.sport || '',
    objects:      play.objects,
    tokens:       play.tokens,
    phases:       safeParse(d.phasesJson, []),
    currentPhase: typeof d.currentPhase === 'number' ? d.currentPhase : 0,
    authorName:   author,
    saveCount:    saves,
    _source:      'published',
  })
    // Inside a <script> block, these two sequences would end it early.
    .replace(/</g, '\\u003c')
    .replace(/\u2028|\u2029/g, (c) => '\\u' + c.charCodeAt(0).toString(16));

  // Serialised with < escaped: a play named "</script>…" would otherwise close
  // this block and run whatever followed. JSON.stringify does not do it, and
  // the name comes from a user.
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name,
    description,
    url: canonical,
    about: sport,
    genre: tactic,
    isAccessibleForFree: true,
    author: { '@type': 'Organization', name: author },
    publisher: { '@type': 'Organization', name: 'CourtDraw', url: SITE },
  };

  const meta = [
    ['Sport', sport],
    ['Type', tactic],
    ageGroup ? ['Age group', ageGroup] : null,
    ['Shared by', author],
    saves > 0 ? ['Saved by coaches', String(saves)] : null,
  ].filter(Boolean);

  const body = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
${indexable ? '' : '<meta name="robots" content="noindex">\n'}<meta property="og:type" content="article">
<meta property="og:title" content="${esc(name)} — ${esc(sport)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${SITE}/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/icons/icon.svg" type="image/svg+xml">
<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>
<style>
  :root { --bg:#0b1120; --bg2:#111a2e; --border:#1e293b; --fg:#e2e8f0; --muted:#94a3b8; --accent:#3b82f6; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--fg); font-family:system-ui,-apple-system,"Segoe UI",sans-serif; line-height:1.6; }
  .wrap { max-width:860px; margin:0 auto; padding:32px 16px 64px; }
  a { color:var(--accent); }
  .crumbs { font-size:0.82rem; color:var(--muted); margin-bottom:18px; }
  .crumbs a { color:var(--muted); text-decoration:none; }
  .crumbs a:hover { color:var(--accent); }
  h1 { font-size:1.75rem; line-height:1.25; margin:0 0 10px; }
  .sub { color:var(--muted); margin:0 0 24px; }
  .board { background:var(--bg2); border:1px solid var(--border); border-radius:14px; padding:10px; margin-bottom:24px; }
  .board svg { display:block; border-radius:8px; }
  .meta { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; margin-bottom:28px; }
  .meta div { background:var(--bg2); border:1px solid var(--border); border-radius:10px; padding:12px 14px; }
  .meta dt { font-size:0.72rem; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); margin:0 0 3px; }
  .meta dd { margin:0; font-weight:700; font-size:0.95rem; }
  .cta { display:inline-block; background:var(--accent); color:#fff; font-weight:700; text-decoration:none; padding:13px 26px; border-radius:10px; }
  .cta-note { font-size:0.82rem; color:var(--muted); margin-top:10px; }
  .more { margin-top:40px; padding-top:28px; border-top:1px solid var(--border); }
  .more h2 { font-size:1.05rem; margin:0 0 14px; }
  .chips { display:flex; flex-wrap:wrap; gap:9px; }
  .chips a { background:var(--bg2); border:1px solid var(--border); border-radius:100px; padding:7px 16px; font-size:0.84rem; font-weight:600; color:var(--muted); text-decoration:none; }
  .chips a:hover { border-color:var(--accent); color:var(--accent); }
  @media (max-width:520px) { h1 { font-size:1.4rem; } }
</style>
</head>
<body>
<div class="wrap">
  <nav class="crumbs"><a href="/">CourtDraw</a> › <a href="/community">Community plays</a> › ${esc(sport)}</nav>

  <h1>${esc(name)}</h1>
  <p class="sub">${esc(tactic)} · ${esc(sport)}${ageGroup ? ` · ${esc(ageGroup)}` : ''}</p>

  <div class="board">${svg}</div>

  <dl class="meta">
    ${meta.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('\n    ')}
  </dl>

  <script>
    // Queued here rather than on click. The app reads this key when it opens
    // with ?loadplay=1, and the write has to have happened by then.
    //
    // This used to be a click handler on the link below, which was a race: the
    // script sat at the end of the body, so a click landing before it parsed
    // navigated to the app with nothing queued and opened an empty board. It
    // also made the one button that matters depend on a listener attaching.
    // Running at parse time, above the link, there is no ordering to lose and
    // the link is a plain link again.
    //
    // Queuing for someone who never clicks costs nothing: one sessionStorage
    // key, read only by ?loadplay=1 and overwritten by the next play page.
    try { sessionStorage.setItem('courtdraw_queued_play', ${JSON.stringify(queued)}); } catch (e) {}
  </script>
  <a class="cta" href="/app?loadplay=1">Open this play in CourtDraw →</a>
  <p class="cta-note">Free to open and edit. Change the positions, add your own phases, export it for your squad.</p>

  <div class="more">
    <h2>More for ${esc(sport)} coaches</h2>
    <div class="chips">
      <a href="/community">All community plays</a>
      <a href="/guides/how-to-build-a-reusable-coaching-play-library/">Build a reusable play library</a>
      <a href="/guides/how-to-build-a-training-session-plan/">Build a training session plan</a>
      <a href="/sports/">All 38+ sports</a>
    </div>
  </div>
</div>
</body>
</html>`;

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Plays change rarely. Caching at the edge keeps a crawl from costing a
      // Firestore read per request, and keeps the page fast for a real visitor.
      'Cache-Control': 'public, max-age=600, stale-while-revalidate=86400',
    },
    body,
  };
};

// Exported for tests: the extraction is the part that broke in production.
exports.playIdFromEvent = playIdFromEvent;
