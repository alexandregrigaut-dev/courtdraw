// Dynamic sitemap for the community plays: /sitemap-plays.xml
//
// The static sitemap.xml cannot list these — the plays live in Firestore and
// change without a deploy, so a hand-maintained list would be wrong the day
// after it was written. robots.txt names this as a second sitemap, which the
// protocol allows, rather than restructuring the existing one into an index.
//
// Only plays with a real diagram are listed. A play page with an empty court
// on it is served and marked noindex, and listing it here would be asking a
// crawler to spend budget on the pages least worth having.

const admin = require('firebase-admin');
const { playHasContent } = require('./_play-render');

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

// The protocol's own ceiling is 50,000. This is far below it and exists to
// keep one runaway query from producing a file nobody intended.
const MAX_URLS = 5000;

const xmlEscape = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

exports.handler = async () => {
  let snap;
  try {
    snap = await db.collection('communityPlays').limit(MAX_URLS).get();
  } catch (e) {
    console.error('[sitemap-plays] Firestore read failed:', e.message);
    // An empty-but-valid sitemap beats a 500: a crawler treats the error as a
    // problem with the site, and may drop URLs it already has.
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
      body: '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>',
    };
  }

  const safeParse = (s, fb) => { try { return JSON.parse(s); } catch (e) { return fb; } };

  const urls = [];
  for (const doc of snap.docs) {
    const d = doc.data() || {};
    const play = {
      objects: safeParse(d.objectsJson, []),
      tokens:  safeParse(d.tokensJson, []),
    };
    if (!playHasContent(play)) continue;

    const published = d.publishedAt && typeof d.publishedAt.toDate === 'function'
      ? d.publishedAt.toDate().toISOString().slice(0, 10)
      : null;
    urls.push(
      `  <url>\n    <loc>${xmlEscape(`${SITE}/play/${doc.id}`)}</loc>\n`
      + (published ? `    <lastmod>${published}</lastmod>\n` : '')
      + `    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>`
    );
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
    body: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`,
  };
};
