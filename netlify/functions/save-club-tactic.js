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
  const token = (event.headers.authorization || '').replace('Bearer ', '');
  if (!token) return { statusCode: 401, body: 'Unauthorized' };
  let uid;
  try { uid = (await admin.auth().verifyIdToken(token)).uid; }
  catch { return { statusCode: 401, body: 'Invalid token' }; }
  const userSnap = await db.collection('users').doc(uid).get();
  const userData = userSnap.exists ? userSnap.data() : {};
  const hasClubAccess = userData.plan === 'club' || userData.clubMember === true;
  if (!hasClubAccess || !userData.clubId)
    return { statusCode: 403, body: 'Club access required' };
  const clubId = userData.clubId;
  const body = JSON.parse(event.body);
  const tacticId = (body.id || Date.now()).toString();
  await db.collection('clubs').doc(clubId).collection('tactics').doc(tacticId).set({
    id: body.id, name: body.name, courtId: body.courtId,
    objects: body.objects || [], tokens: body.tokens || [],
    phases: body.phases || [], currentPhase: body.currentPhase || 0,
    ts: body.ts, authorUid: uid, authorName: body.authorName || '',
    sharedAt: new Date().toISOString()
  });
  return { statusCode: 200, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, clubId }) };
};
