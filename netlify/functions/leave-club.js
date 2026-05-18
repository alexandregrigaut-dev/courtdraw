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
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return { statusCode: 401, body: 'Unauthorized' };

  let uid;
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    uid = decoded.uid;
  } catch { return { statusCode: 401, body: 'Invalid token' }; }

  const userSnap = await db.collection('users').doc(uid).get();
  const userData = userSnap.exists ? userSnap.data() : {};

  if (!userData.clubId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Not a member of any club' }) };
  }
  if (userData.plan === 'club') {
    return { statusCode: 400, body: JSON.stringify({ error: 'Club owners cannot leave their own club. Cancel your subscription to close the club.' }) };
  }

  const clubId = userData.clubId;
  const FieldValue = admin.firestore.FieldValue;

  // Strip club membership from user doc
  await db.collection('users').doc(uid).update({
    clubId:     FieldValue.delete(),
    clubMember: FieldValue.delete(),
    clubName:   FieldValue.delete(),
  });

  // Remove from club's members sub-collection
  await db.collection('clubs').doc(clubId).collection('members').doc(uid).delete();

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true })
  };
};
