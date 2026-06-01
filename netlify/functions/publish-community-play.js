/**
 * publish-community-play.js — Authenticated Netlify Function
 * Publishes a tactic to the public community library.
 * Requires: Firebase ID token + Pro or Club plan.
 *
 * Firestore collection: communityPlays
 * Body: { name, courtId, sport, tacticType, ageGroup,
 *         objects[], tokens[], phases[], currentPhase, authorName }
 *
 * INTEGRATION NOTES:
 * - Same auth pattern as save-club-tactic.js (Bearer token → verifyIdToken)
 * - Drawing data serialised as JSON strings (same workaround as club tactics)
 * - tacticType: 'offensive'|'defensive'|'set_play'|'transition'|'other'
 * - ageGroup: optional string e.g. 'U13-U14', 'Adult', ''
 * - isClubOnly always false here (club-only publishing is the existing auto-share flow)
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

const VALID_TACTIC_TYPES = new Set(['offensive', 'defensive', 'set_play', 'transition', 'other', '']);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Auth
  const authHeader = event.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return { statusCode: 401, body: 'Unauthorized' };

  let uid;
  try { uid = (await admin.auth().verifyIdToken(token)).uid; }
  catch { return { statusCode: 401, body: 'Invalid token' }; }

  // Plan check — must be Pro or Club
  const userSnap = await db.collection('users').doc(uid).get();
  const userData = userSnap.exists ? userSnap.data() : {};
  const plan = userData.plan || 'free';
  if (plan !== 'pro' && plan !== 'club') {
    return { statusCode: 403, body: 'Pro or Club plan required to publish to the community library.' };
  }

  // Parse body
  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: 'Bad JSON' }; }

  // Validate required fields
  const name = (body.name || '').trim();
  if (!name || name.length > 100) return { statusCode: 400, body: 'Invalid tactic name (1–100 chars)' };
  if (!Array.isArray(body.objects)) return { statusCode: 400, body: 'objects must be an array' };
  if (!Array.isArray(body.tokens))  return { statusCode: 400, body: 'tokens must be an array' };
  const tacticType = (body.tacticType || '').toLowerCase();
  if (!VALID_TACTIC_TYPES.has(tacticType)) return { statusCode: 400, body: 'Invalid tacticType' };

  try {
    const docRef = db.collection('communityPlays').doc();
    await docRef.set({
      name,
      courtId:      body.courtId      || '',
      sport:        body.sport        || '',
      category:     _tacticTypeToCat(tacticType),
      tacticType:   tacticType || 'other',
      ageGroup:     (body.ageGroup    || '').trim().slice(0, 30),
      authorUid:    uid,
      authorName:   (userData.username || 'Coach').slice(0, 80),
      publishedAt:  admin.firestore.FieldValue.serverTimestamp(),
      isClubOnly:   false,
      plan,            // plan tier at publish time
      objectsJson:  JSON.stringify(body.objects      || []),
      tokensJson:   JSON.stringify(body.tokens       || []),
      phasesJson:   JSON.stringify(body.phases       || []),
      currentPhase: body.currentPhase || 0,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, id: docRef.id }),
    };

  } catch (err) {
    console.error('publish-community-play error:', err);
    return { statusCode: 500, body: 'Internal error: ' + (err.message || String(err)) };
  }
};

function _tacticTypeToCat(tacticType) {
  const map = { offensive: 'Offense', defensive: 'Defense', set_play: 'Set Play', transition: 'Transition', other: 'Other' };
  return map[tacticType] || '';
}
