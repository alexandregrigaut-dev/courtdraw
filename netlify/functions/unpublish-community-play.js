// Removes a community play from the public library.
// Requires: Firebase ID token + must be the original author.
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

  const authHeader = event.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return { statusCode: 401, body: 'Unauthorized' };

  let uid;
  try { uid = (await admin.auth().verifyIdToken(token)).uid; }
  catch { return { statusCode: 401, body: 'Invalid token' }; }

  let playId;
  try { ({ playId } = JSON.parse(event.body || '{}')); }
  catch { return { statusCode: 400, body: 'Bad JSON' }; }
  if (!playId || typeof playId !== 'string') return { statusCode: 400, body: 'Missing playId' };

  try {
    const docRef = db.collection('communityPlays').doc(playId);
    const snap = await docRef.get();
    if (!snap.exists) return { statusCode: 404, body: 'Play not found' };
    if (snap.data().authorUid !== uid) return { statusCode: 403, body: 'Not the author' };

    await docRef.delete();
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('unpublish-community-play error:', err);
    return { statusCode: 500, body: 'Internal error: ' + (err.message || String(err)) };
  }
};
