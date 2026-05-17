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
  if (userData.plan !== 'club') return { statusCode: 403, body: 'Club plan required' };
  const clubId = userData.clubId || ('club_' + uid);
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, body: 'Bad JSON' }; }
  const { teamColorA, teamColorB } = body;
  // Validate hex colors
  const hexRe = /^#[0-9a-fA-F]{6}$/;
  if ((teamColorA && !hexRe.test(teamColorA)) || (teamColorB && !hexRe.test(teamColorB))) {
    return { statusCode: 400, body: 'Invalid color format (must be #RRGGBB)' };
  }
  const update = {};
  if (teamColorA) update.teamColorA = teamColorA;
  if (teamColorB) update.teamColorB = teamColorB;
  await db.collection('clubs').doc(clubId).update(update);
  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
