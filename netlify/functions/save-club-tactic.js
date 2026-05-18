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
  const userData = userSnap.exists ? userSnap.data() : {};

  // Grant access to club owners AND any user marked as a club member
  const hasClubAccess = userData.plan === 'club' || userData.clubMember === true;
  if (!hasClubAccess || !userData.clubId)
    return { statusCode: 403, body: 'Club access required' };

  const clubId = userData.clubId;
  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, body: 'Bad JSON' }; }

  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0 || body.name.length > 100)
    return { statusCode: 400, body: 'Invalid tactic name' };
  if (!Array.isArray(body.objects) || !Array.isArray(body.tokens))
    return { statusCode: 400, body: 'Invalid tactic data' };

  // Use Firestore auto-generated ID to avoid timestamp collisions when
  // two coaches share tactics at the same time, and to prevent a re-share
  // from silently overwriting the previous entry.
  const docRef = db.collection('clubs').doc(clubId).collection('tactics').doc();
  await docRef.set({
    name:         body.name.trim(),
    courtId:      body.courtId || '',
    objects:      body.objects || [],
    tokens:       body.tokens  || [],
    phases:       body.phases  || [],
    currentPhase: body.currentPhase || 0,
    authorUid:    uid,
    authorName:   body.authorName || '',
    authorEmail:  userData.email  || '',
    sharedAt:     admin.firestore.FieldValue.serverTimestamp()
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, clubId, tacticId: docRef.id })
  };
};
