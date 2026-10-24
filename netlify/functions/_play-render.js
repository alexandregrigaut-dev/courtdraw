// Renders a published community play as a standalone SVG, server-side.
// Import with: const { playToSvg, playHasContent } = require('./_play-render');
//
// Why this exists
// ---------------
// The 200-odd plays in the community library were reachable only from inside
// courtdraw-app.html, a single-page app that is noindex, and from /community,
// which fetches them client-side and gives none of them a URL of its own. So
// the largest body of content on the site was one page as far as a search
// engine was concerned, and could never answer the queries the plays actually
// match — "1-3-1 zone defence diagram" rather than "basketball tactics board".
//
// Rendering the diagram here, into the HTML, is what makes a play page worth
// indexing: the SVG is the content, and it has to be in the response rather
// than drawn by script after load.
//
// This is a port of renderTacticThumb/objToLibSvg from courtdraw-app.html. The
// court shapes are not copied — src/court-svgs.js is shared by both.

const COURT_SVGS = require('../../src/court-svgs.js');

// Defaults from the app's own state.teamColorA / teamColorB. A published play
// does not carry the colours its author was using, so both render in the
// standard blue and red rather than guessing.
const TEAM_A = '#60a5fa';
const TEAM_B = '#dc2626';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// A number that is safe to put in an SVG attribute. Play geometry comes out of
// Firestore, where it was written from a browser, so it is not to be trusted
// into markup unchecked.
const num = (v, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

// Marker ids must be unique within one document or the arrowheads collide.
// The app used Math.random; a counter is used here so the same play always
// renders byte-identical, which keeps the page cacheable and diffable.
function makeIdGen(prefix) {
  let n = 0;
  return () => `${prefix}${++n}`;
}

function objToSvg(o, nextId) {
  if (!o || typeof o !== 'object') return '';
  const color = esc(o.color || '#fff');
  const width = num(o.lineWidth, 3);

  if (o.type === 'arrow' || o.type === 'dashed-arrow' || o.type === 'line') {
    let pts = Array.isArray(o.points) ? o.points : null;
    if (!pts || pts.length < 2) {
      if (o.x1 !== undefined) pts = [[o.x1, o.y1], [o.x2, o.y2]];
      else return '';
    }
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${num(p[0])},${num(p[1])}`).join(' ');
    const dash = o.type === 'dashed-arrow' ? ' stroke-dasharray="20,12"' : '';
    if (o.type === 'line') {
      return `<path d="${d}" stroke="${color}" stroke-width="${width}" fill="none"${dash} stroke-linecap="round"/>`;
    }
    const id = nextId();
    return `<defs><marker id="${id}" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">`
         + `<path d="M0,0 L0,6 L8,3 z" fill="${color}"/></marker></defs>`
         + `<path d="${d}" stroke="${color}" stroke-width="${width}" fill="none"${dash}`
         + ` marker-end="url(#${id})" stroke-linecap="round"/>`;
  }

  if (o.type === 'circle') {
    return `<circle cx="${num(o.cx)}" cy="${num(o.cy)}" r="${num(o.r)}" stroke="${color}"`
         + ` stroke-width="${num(o.lineWidth, 2)}" fill="none"/>`;
  }

  if (o.type === 'rect') {
    // Both shapes exist in stored data: {x,y,w,h} from the library and
    // {x1,y1,x2,y2} from a freshly drawn rectangle.
    const hasXY = o.x !== undefined;
    const x = hasXY ? num(o.x) : Math.min(num(o.x1), num(o.x2));
    const y = hasXY ? num(o.y) : Math.min(num(o.y1), num(o.y2));
    const w = hasXY ? num(o.w) : Math.abs(num(o.x2) - num(o.x1));
    const h = hasXY ? num(o.h) : Math.abs(num(o.y2) - num(o.y1));
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" stroke="${color}"`
         + ` stroke-width="${num(o.lineWidth, 2)}" fill="none"/>`;
  }

  if (o.type === 'arc') {
    let x1, y1, x2, y2, cpx, cpy;
    if (Array.isArray(o.points) && o.points.length >= 3) {
      [x1, y1] = o.points[0];
      [x2, y2] = o.points[o.points.length - 1];
      [cpx, cpy] = o.points[Math.floor(o.points.length / 2)];
    } else {
      x1 = o.x1; y1 = o.y1; x2 = o.x2; y2 = o.y2; cpx = o.cpx; cpy = o.cpy;
    }
    const id = nextId();
    return `<defs><marker id="${id}" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">`
         + `<path d="M0,0 L0,6 L8,3 z" fill="${color}"/></marker></defs>`
         + `<path d="M${num(x1)},${num(y1)} Q${num(cpx)},${num(cpy)} ${num(x2)},${num(y2)}"`
         + ` stroke="${color}" stroke-width="${width}" fill="none" stroke-linecap="round"`
         + ` marker-end="url(#${id})"/>`;
  }

  if (o.type === 'text') {
    return `<text x="${num(o.x)}" y="${num(o.y)}" fill="${color}" font-size="${num(o.fontSize, 20)}"`
         + ` font-family="system-ui" font-weight="700">${esc(o.text)}</text>`;
  }

  return '';   // unknown shape: skip it rather than emit broken markup
}

function tokenToSvg(tk) {
  if (!tk || !Array.isArray(tk.pct) || tk.pct.length < 2) return '';
  const cx = num(tk.pct[0]) * 1000;
  const cy = num(tk.pct[1]) * 600;

  // The ball is a token like any other in the payload, but it is not a player
  // and must not look like one. Without this branch it fell through to the
  // team colours below and rendered as an unlabelled team-A circle — on a
  // tactics diagram that reads as an extra player standing on the pitch,
  // which is worse than ugly. Smaller and neutrally coloured, matching the
  // embed. Drawn before the label line, which a ball never has.
  if (tk.team === 'ball') {
    return `<circle cx="${cx}" cy="${cy}" r="14" fill="#f5f5f0" stroke="#78716c" stroke-width="3"/>`;
  }

  const fill = tk.team === 'red' ? TEAM_B : TEAM_A;
  return `<circle cx="${cx}" cy="${cy}" r="22" fill="${fill}" stroke="#fff" stroke-width="4"/>`
       + `<text x="${cx}" y="${cy + 8}" text-anchor="middle" fill="#fff" font-size="18"`
       + ` font-weight="700" font-family="system-ui">${esc(tk.label)}</text>`;
}

// True when there is an actual diagram here rather than an empty court. Used
// to decide whether a play is worth putting in front of a search engine: a
// page showing a bare pitch is the thin content that gets a whole section
// discounted, so those render but are not indexed or listed in the sitemap.
function playHasContent(play) {
  const objects = Array.isArray(play && play.objects) ? play.objects : [];
  const tokens  = Array.isArray(play && play.tokens)  ? play.tokens  : [];
  return objects.length + tokens.length >= 2;
}

function playToSvg(play, { title = '' } = {}) {
  const courtSvg = COURT_SVGS[play && play.courtId] || COURT_SVGS.whiteboard || '';
  const nextId = makeIdGen('m');
  const objects = (Array.isArray(play.objects) ? play.objects : [])
    .map(o => objToSvg(o, nextId)).join('');
  const tokens = (Array.isArray(play.tokens) ? play.tokens : [])
    .map(tokenToSvg).join('');
  // role="img" plus a title is what a screen reader and an image crawler read;
  // without it this is a decorative blob to both.
  return `<svg viewBox="0 0 1000 600" xmlns="http://www.w3.org/2000/svg" role="img"`
       + ` aria-label="${esc(title)}" width="100%" height="auto">`
       + `<title>${esc(title)}</title>${courtSvg}${objects}${tokens}</svg>`;
}

module.exports = { playToSvg, playHasContent, esc, COURT_SVGS };
