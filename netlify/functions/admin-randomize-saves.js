/**
 * admin-randomize-saves.js — One-time admin utility
 * Assigns realistic, varied saveCount values to all seeded @CourtDraw Team plays.
 * Protected by INTERNAL_SECRET env var. Call once after deploy, then this function
 * can be left in place (it's idempotent and does nothing without the secret).
 *
 * Usage:
 *   POST /api/admin-randomize-saves
 *   Body: { "secret": "<INTERNAL_SECRET env var value>" }
 *
 * After running, delete or disable this function.
 */

const { db } = require('./_admin-init');

// Deterministic pseudo-random from a string seed (mulberry32-style)
function seededRandom(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
  }
  const t = (hash >>> 0) / 4294967296;
  return t;
}

// Maps a play ID to a realistic-looking save count in range [min, max]
function realisticSaveCount(playId) {
  const r = seededRandom(playId);
  // Distribution: most plays 3-18, a few popular ones up to 47
  if (r > 0.92) return Math.floor(r * 100) % 30 + 18; // 18-47 (top 8%)
  if (r > 0.70) return Math.floor(r * 100) % 10 + 8;  // 8-17 (next 22%)
  return Math.floor(r * 100) % 6 + 2;                 // 2-7 (most plays)
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const secret = process.env.INTERNAL_SECRET;
    if (!secret || body.secret !== secret) {
      return { statusCode: 403, body: 'Forbidden' };
    }

    const snap = await db.collection('communityPlays')
      .where('authorName', '==', 'CourtDraw Team')
      .limit(500)
      .get();

    if (snap.empty) {
      return { statusCode: 200, body: JSON.stringify({ updated: 0, message: 'No CourtDraw Team plays found' }) };
    }

    const batch = db.batch();
    let count = 0;
    snap.docs.forEach(doc => {
      const newCount = realisticSaveCount(doc.id);
      batch.update(doc.ref, { saveCount: newCount });
      count++;
    });

    await batch.commit();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updated: count, message: `Updated saveCount on ${count} plays` }),
    };
  } catch (err) {
    console.error('admin-randomize-saves error:', err);
    return { statusCode: 500, body: 'Error: ' + (err.message || String(err)) };
  }
};
