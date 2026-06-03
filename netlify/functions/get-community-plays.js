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
 * - Legacy plays published before username feature (2026-06-01) may have an
 *   email stored in authorName. Those are resolved against users/{authorUid}.username
 *   via a single batch lookup; unknown authors fall back to 'Coach'.
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

// Deterministic pseudo-random [0,1) from a string — used to normalise seeded save counts
// so they look organic instead of all showing "12".
function seededRandom(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  return (h >>> 0) / 4294967296;
}
function normaliseSaveCount(id, raw) {
  // Only normalise plays that still carry the seeded default of exactly 12.
  // Once real users increment a play beyond 12 the real count is used as-is.
  if (raw !== 12) return raw;
  const r = seededRandom(id);
  if (r > 0.92) return Math.floor(r * 100) % 30 + 18; // 18-47 (top 8%)
  if (r > 0.70) return Math.floor(r * 100) % 10 + 8;  // 8-17 (next 22%)
  return Math.floor(r * 100) % 6 + 2;                 // 2-7 (most plays)
}

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

    // First pass: build the raw play list and collect UIDs that need username resolution
    // (plays published before the username feature have an email in authorName)
    const rawPlays = snap.docs.map(d => {
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
        _rawAuthorName: data.authorName || '',
        saveCount:    normaliseSaveCount(d.id, data.saveCount || 0),
        publishedAt,
        currentPhase: data.currentPhase || 0,
        objects:      safeJsonParse(data.objectsJson, []),
        tokens:       safeJsonParse(data.tokensJson,  []),
        phases:       safeJsonParse(data.phasesJson,  []),
      };
    });

    // Collect unique UIDs whose stored authorName looks like an email
    const uidsNeedingLookup = [
      ...new Set(
        rawPlays
          .filter(p => p._rawAuthorName.includes('@') && p.authorUid)
          .map(p => p.authorUid)
      )
    ];

    // Batch-fetch user docs for those UIDs to resolve their current username
    const usernameByUid = {};
    if (uidsNeedingLookup.length > 0) {
      const userSnaps = await Promise.all(
        uidsNeedingLookup.map(uid => db.collection('users').doc(uid).get())
      );
      userSnaps.forEach((snap, i) => {
        if (snap.exists && snap.data().username) {
          usernameByUid[uidsNeedingLookup[i]] = snap.data().username;
        }
      });
    }

    // Second pass: resolve authorName
    const plays = rawPlays.map(p => {
      let authorName;
      if (p._rawAuthorName.includes('@')) {
        // Legacy email — replace with username if resolved, else 'Coach'
        authorName = usernameByUid[p.authorUid] || 'Coach';
      } else {
        authorName = p._rawAuthorName || 'Coach';
      }
      const { _rawAuthorName, ...rest } = p;
      return { ...rest, authorName };
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
