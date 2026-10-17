/**
 * share-page.js — server-rendered landing page for a shared board.
 *
 * "Copy share link" used to produce
 *
 *   courtdraw.app/courtdraw-app.html#s=<base64>
 *
 * A fragment never reaches the server, so a link pasted into a team chat had
 * no title, no description and no preview — a bare URL. In five months not one
 * of 35 trialing coaches ever shared a play. The feature works; its output was
 * not worth forwarding.
 *
 * This renders the same payload server-side: the diagram in the HTML, real
 * Open Graph tags, a button that opens the board in the app, and the iframe
 * snippet for embed.html — which has always read this identical format and
 * which nothing on the site has ever mentioned.
 *
 * The payload travels in the query string rather than the fragment, because a
 * preview is impossible for data the server never sees. That is the trade:
 * board contents appear in request logs. Nothing is stored, and the page is
 * noindex — a shared board is private to whoever holds the link, and must not
 * turn up in search results.
 */

const { playToSvg, playHasContent, esc } = require('./_play-render');

const SITE = process.env.PUBLIC_URL || 'https://courtdraw.app';

// A share link is capped at 4000 characters by the app. Anything far beyond
// that is not a board, so decode nothing and spend nothing on it.
const MAX_PAYLOAD = 8000;

function payloadFromEvent(event) {
  const q = (event.queryStringParameters || {}).p;
  if (q) return String(q);
  // /s/<payload> is accepted too, so a hand-edited link still resolves.
  const path = String(event.path || event.rawUrl || '');
  const m = path.match(/\/(?:s|share-page)\/([^/?#]+)\/?$/);
  if (m) { try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; } }
  return '';
}

// btoa(encodeURIComponent(json)) is what the app produces. latin1 is the exact
// inverse of btoa: it was a byte string, not UTF-8 text.
function decodePayload(encoded) {
  const percent = Buffer.from(encoded, 'base64').toString('latin1');
  const json = decodeURIComponent(percent);
  const play = JSON.parse(json);
  if (!play || typeof play !== 'object') throw new Error('not an object');
  return play;
}

// tennis_singles -> Tennis (singles); futsal -> Futsal
function courtLabel(courtId) {
  const raw = String(courtId || '').trim();
  if (!raw) return 'Tactics';
  const m = raw.match(/^(.*)_(singles|doubles)$/);
  const base = (m ? m[1] : raw).replace(/_/g, ' ').trim();
  const titled = base.replace(/\b[a-z]/g, c => c.toUpperCase());
  return m ? `${titled} (${m[2]})` : titled;
}

const page = ({ title, description, bodyHtml, status }) => ({
  statusCode: status,
  headers: { 'Content-Type': 'text/html; charset=utf-8' },
  body: `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<!-- A shared board belongs to whoever holds the link. It is never a search result. -->
<meta name="robots" content="noindex, nofollow">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${SITE}/assets/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/icons/icon.svg" type="image/svg+xml">
<style>
  :root { --bg:#0b1120; --bg2:#111a2e; --border:#1e293b; --fg:#e2e8f0; --muted:#94a3b8; --accent:#3b82f6; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--fg); font-family:system-ui,-apple-system,"Segoe UI",sans-serif; line-height:1.6; }
  .wrap { max-width:860px; margin:0 auto; padding:32px 16px 64px; }
  a { color:var(--accent); }
  h1 { font-size:1.6rem; line-height:1.25; margin:0 0 6px; }
  .sub { color:var(--muted); margin:0 0 22px; font-size:0.95rem; }
  .board { background:var(--bg2); border:1px solid var(--border); border-radius:12px; padding:10px; margin-bottom:22px; }
  .board svg { display:block; border-radius:8px; }
  .cta { display:inline-block; background:var(--accent); color:#fff; font-weight:700; text-decoration:none;
         padding:13px 26px; border-radius:10px; }
  .cta:hover { background:#1d4ed8; }
  .ghost { display:inline-block; color:var(--muted); text-decoration:none; padding:13px 20px; }
  .ghost:hover { color:var(--fg); }
  details { margin-top:30px; border-top:1px solid var(--border); padding-top:18px; }
  summary { cursor:pointer; color:var(--muted); font-size:0.9rem; }
  code { display:block; white-space:pre-wrap; word-break:break-all; background:var(--bg2);
         border:1px solid var(--border); border-radius:8px; padding:12px; margin-top:10px;
         font-size:0.78rem; color:var(--fg); }
  .foot { margin-top:40px; color:var(--muted); font-size:0.82rem; }
</style>
</head>
<body><div class="wrap">${bodyHtml}</div></body>
</html>`,
});

exports.handler = async (event) => {
  if (event.httpMethod && event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const encoded = payloadFromEvent(event);

  const invalid = (reason) => page({
    status: 404,
    title: 'This share link didn’t open — CourtDraw',
    description: 'The link may have been cut short when it was pasted.',
    bodyHtml: `<h1>This link didn’t open</h1>
<p class="sub">Share links are long, and chat apps sometimes cut them in half. Ask for it again, or start your own board — it’s free.</p>
<a class="cta" href="/app">Open CourtDraw</a>
<p class="foot">${esc(reason)}</p>`,
  });

  if (!encoded) return invalid('No board data in the link.');
  if (encoded.length > MAX_PAYLOAD) return invalid('That link is too long to be a board.');

  let play;
  try {
    play = decodePayload(encoded);
  } catch (e) {
    return invalid('The board data could not be read.');
  }
  if (!playHasContent(play)) return invalid('That board is empty.');

  const sport = courtLabel(play.courtId);
  const phases = Array.isArray(play.phases) ? play.phases.length : 0;
  const title = `${sport} play — CourtDraw`;
  const description = phases > 1
    ? `A ${sport.toLowerCase()} play in ${phases} phases, drawn on CourtDraw. Open it, edit it, or build your own — free.`
    : `A ${sport.toLowerCase()} play drawn on CourtDraw. Open it, edit it, or build your own — free.`;

  const svg = playToSvg(play, { title: `${sport} play` });
  // The app and embed.html both read this exact fragment format.
  const appUrl   = `/app#s=${encodeURIComponent(encoded)}`;
  const embedUrl = `${SITE}/embed.html#s=${encodeURIComponent(encoded)}`;

  return page({
    status: 200,
    title,
    description,
    bodyHtml: `<h1>${esc(sport)} play</h1>
<p class="sub">${phases > 1 ? `${phases} phases · ` : ''}Shared from CourtDraw</p>
<div class="board">${svg}</div>
<a class="cta" href="${esc(appUrl)}">Open this play in CourtDraw →</a>
<a class="ghost" href="/app">Start a blank board</a>
<details>
  <summary>Embed this play on your club site</summary>
  <code>&lt;iframe src="${esc(embedUrl)}" width="100%" height="480" style="border:0;border-radius:12px" title="${esc(sport)} play"&gt;&lt;/iframe&gt;</code>
</details>
<p class="foot">Free tactics board for 38+ sports · <a href="/">courtdraw.app</a></p>`,
  });
};
