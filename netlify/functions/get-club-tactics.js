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
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };
  const authHeader = event.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return { statusCode: 401, body: 'Unauthorized' };
  let uid;
  try { uid = (await admin.auth().verifyIdToken(token)).uid; }
  catch { return { statusCode: 401, body: 'Invalid token' }; }
  const userSnap = await db.collection('users').doc(uid).get();
  const userData = userSnap.exists ? userSnap.data() : {};
  const hasClubAccess = userData.plan === 'club' || userData.clubMember === true;
  // memberOfClubId is set when a club owner joins a second club as a member
  const clubId = userData.memberOfClubId || userData.clubId;
  if (!hasClubAccess || !clubId)
    return { statusCode: 403, body: 'Club access required' };
  const snap = await db.collection('clubs').doc(clubId).collection('tactics')
    .orderBy('sharedAt', 'desc').limit(100).get();
  const tactics = snap.docs.map(d => {
    const data = d.data();
    // Convert Firestore Timestamp → ISO string so the client can use new Date(sharedAt)
    if (data.sharedAt && typeof data.sharedAt.toDate === 'function') {
      data.sharedAt = data.sharedAt.toDate().toISOString();
    }
    return { ...data, _clubShared: true, _firestoreId: d.id };
  });
  return { statusCode: 200, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tactics, clubId }) };
};
