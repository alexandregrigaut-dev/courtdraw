// Fire-and-forget: increments saveCount on a communityPlays document.
// No auth required — community plays are publicly loadable by all tiers.
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

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  let playId;
  try { ({ playId } = JSON.parse(event.body || '{}')); }
  catch { return { statusCode: 400, body: 'Bad JSON' }; }
  if (!playId || typeof playId !== 'string') return { statusCode: 400, body: 'Missing playId' };

  try {
    await db.collection('communityPlays').doc(playId)
      .update({ saveCount: admin.firestore.FieldValue.increment(1) });
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    // 404 = play deleted between load and count — harmless
    console.error('increment-community-play-saves error:', err);
    return { statusCode: 500, body: 'Internal error: ' + (err.message || String(err)) };
  }
};
