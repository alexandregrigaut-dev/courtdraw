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

  // Must be a club owner
  const adminSnap = await db.collection('users').doc(uid).get();
  const adminData = adminSnap.exists ? adminSnap.data() : {};
  if (adminData.plan !== 'club') return { statusCode: 403, body: 'Club owner access required' };
  const clubId = adminData.clubId;
  if (!clubId) return { statusCode: 400, body: 'Admin has no clubId' };

  let memberUid;
  try { ({ memberUid } = JSON.parse(event.body || '{}')); }
  catch { return { statusCode: 400, body: 'Bad JSON' }; }
  if (!memberUid) return { statusCode: 400, body: 'Missing memberUid' };

  // Verify the member actually belongs to this club
  const memberRef = db.collection('clubs').doc(clubId).collection('members').doc(memberUid);
  const memberSnap = await memberRef.get();
  if (!memberSnap.exists) return { statusCode: 404, body: 'Member not found in this club' };

  const FieldValue = admin.firestore.FieldValue;

  // Strip club membership from the user document
  await db.collection('users').doc(memberUid).update({
    clubId:     FieldValue.delete(),
    clubMember: FieldValue.delete(),
    clubName:   FieldValue.delete(),
  });

  // Remove from club's members sub-collection
  await memberRef.delete();

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true })
  };
};
