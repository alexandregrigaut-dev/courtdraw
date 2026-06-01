/**
 * get-community-plays.js — Public Netlify Function
 * Returns all published community plays from Firestore.
 * No authentication required — community plays are publicly readable.
 *
 * Firestore collection: communityPlays
 * Returns: { plays: CommunityPlay[], total: number }
 *
 * INTEGRATION NOTES:
 * - Parallel to get-club-tactics.js but public (no auth gate)
 * - Drawing data stored as JSON strings to avoid Firestore nested-array rejection
 * - Ordered by publishedAt desc (newest first)
 * - Capped at 500 docs; community library UI paginates client-side at 10/page
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

function safeJsonParse(str, fallback) {
  try { return str ? JSON.parse(str) : fallback; } catch { return fallback; }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const snap = await db.collection('communityPlays')
      .orderBy('publishedAt', 'desc')
      .limit(500)
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
        authorUid:    data.authorUid    || '',
        authorName:   data.authorName   || 'Coach',
        saveCount:    data.saveCount    || 0,
        publishedAt,
        currentPhase: data.currentPhase || 0,
        objects:      safeJsonParse(data.objectsJson, []),
        tokens:       safeJsonParse(data.tokensJson,  []),
        phases:       safeJsonParse(data.phasesJson,  []),
      };
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60', // 1-minute cache — fresh enough for a live library
      },
      body: JSON.stringify({ plays, total: plays.length }),
    };

  } catch (err) {
    console.error('get-community-plays error:', err);
    return { statusCode: 500, body: 'Internal error: ' + (err.message || String(err)) };
  }
};
