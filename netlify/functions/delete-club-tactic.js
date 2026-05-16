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
  if (event.httpMethod !== 'DELETE') return { statusCode: 405, body: 'Method Not Allowed' };
  const token = (event.headers.authorization || '').replace('Bearer ', '');
  if (!token) return { statusCode: 401, body: 'Unauthorized' };
  let uid;
  try { uid = (await admin.auth().verifyIdToken(token)).uid; }
  catch { return { statusCode: 401, body: 'Invalid token' }; }
  const userSnap = await db.collection('users').doc(uid).get();
  const userData = userSnap.exists ? userSnap.data() : {};
  // Only club owners (plan === 'club') can delete shared tactics
  if (userData.plan !== 'club' || !userData.clubId)
    return { statusCode: 403, body: 'Club plan required' };
  const clubId = userData.clubId;
  const { tacticId } = JSON.parse(event.body);
  await db.collection('clubs').doc(clubId).collection('tactics').doc(tacticId).delete();
  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
