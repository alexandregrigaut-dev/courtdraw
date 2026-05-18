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
  const userSnap = await db.collection('users').doc(uid).get();
  if (!userSnap.exists || userSnap.data().plan !== 'club')
    return { statusCode: 403, body: 'Club plan required' };
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, body: 'Bad JSON' }; }
  const { clubName } = body;
  if (!clubName || clubName.length > 60) return { statusCode: 400, body: 'Invalid name' };
  const clubId = userSnap.data().clubId || ('club_' + uid);
  await db.collection('users').doc(uid).update({ clubName });
  await db.collection('clubs').doc(clubId).set({ clubName }, { merge: true });
  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
