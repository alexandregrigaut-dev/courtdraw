/**
 * get-author-plays.js — Public Netlify Function
 * Returns one coach's published community plays, for their public profile
 * page (/c/:username). No authentication required — same trust boundary
 * as get-community-plays.js, which already does an unauthenticated public
 * read of the same collection.
 *
 * Firestore collections: usernames (username -> uid), communityPlays
 * Query param: username
 * Returns: { username, plays: CommunityPlay[], total: number }
 *
 * INTEGRATION NOTES:
 * - Deliberately queries communityPlays with ONLY a .where('authorUid', '==', uid)
 *   equality filter — no .orderBy() alongside it. That combination needs a
 *   composite Firestore index that doesn't exist for this collection, and
 *   can't be created without console/CLI access. Sorted by publishedAt in
 *   JS instead, after fetching — a single coach's published-play count is
 *   always small, so this is cheap and avoids a runtime FAILED_PRECONDITION
 *   error on first deploy.
 * - Same field shape as get-community-plays.js so the front-end can reuse
 *   the same play-card rendering.
 */

const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    })
  });
}
const db = admin.firestore();

const USERNAME_RE = /^[a-z0-9_]{3,30}$/;

function safeJsonParse(str, fallback) {
  try { return str ? JSON.parse(str) : fallback; } catch { return fallback; }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const username = ((event.queryStringParameters && event.queryStringParameters.username) || '').toLowerCase().trim();
    if (!USERNAME_RE.test(username)) {
      return { statusCode: 400, body: 'Invalid username' };
    }

    const usernameSnap = await db.collection('usernames').doc(username).get();
    if (!usernameSnap.exists || !usernameSnap.data().uid) {
      return { statusCode: 404, body: 'Coach not found' };
    }
    const uid = usernameSnap.data().uid;

    const snap = await db.collection('communityPlays')
      .where('authorUid', '==', uid)
      .limit(200)
      .get();

    const plays = snap.docs.map(d => {
      const data = d.data();
      const publishedAt = data.publishedAt && typeof data.publishedAt.toDate === 'function'
        ? data.publishedAt.toDate().toISOString()
        : null;
      return {
        id:           d.id,
        name:         data.name         || '',
        courtId:      data.courtId      || '',
        sport:        data.sport        || '',
        category:     data.category     || '',
        tacticType:   data.tacticType   || '',
        ageGroup:     data.ageGroup     || '',
        saveCount:    data.saveCount    || 0,
        publishedAt,
        currentPhase: data.currentPhase || 0,
        objects:      safeJsonParse(data.objectsJson, []),
        tokens:       safeJsonParse(data.tokensJson,  []),
        phases:       safeJsonParse(data.phasesJson,  []),
      };
    });

    // Sorted here (not in the Firestore query) — see INTEGRATION NOTES above.
    plays.sort((a, b) => {
      if (!a.publishedAt) return 1;
      if (!b.publishedAt) return -1;
      return new Date(b.publishedAt) - new Date(a.publishedAt);
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
      },
      body: JSON.stringify({ username, plays, total: plays.length }),
    };

  } catch (err) {
    console.error('get-author-plays error:', err);
    return { statusCode: 500, body: 'Internal error: ' + (err.message || String(err)) };
  }
};
