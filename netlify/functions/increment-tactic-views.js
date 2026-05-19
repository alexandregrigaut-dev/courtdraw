// Atomically increments the viewCount on a club tactic document.
// Called fire-and-forget from the client each time a club tactic is loaded.
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
  try {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    const authHeader = event.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return { statusCode: 401, body: 'Unauthorized' };

    let uid;
    try { uid = (await admin.auth().verifyIdToken(token)).uid; }
    catch { return { statusCode: 401, body: 'Invalid token' }; }

    const userSnap = await db.collection('users').doc(uid).get();
    const userData = userSnap.exists ? userSnap.data() : {};

    const hasClubAccess = userData.plan === 'club' || userData.clubMember === true;
    const clubId = userData.memberOfClubId || userData.clubId ||
                   (userData.plan === 'club' ? 'club_' + uid : null);
    if (!hasClubAccess || !clubId) return { statusCode: 403, body: 'Club access required' };

    let tacticId;
    try { ({ tacticId } = JSON.parse(event.body || '{}')); }
    catch { return { statusCode: 400, body: 'Bad JSON' }; }
    if (!tacticId || typeof tacticId !== 'string') return { statusCode: 400, body: 'Missing tacticId' };

    const docRef = db.collection('clubs').doc(clubId).collection('tactics').doc(tacticId);
    // FieldValue.increment handles missing field by initialising it to 1
    await docRef.update({ viewCount: admin.firestore.FieldValue.increment(1) });

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    // A 404 here means the tactic was deleted between load and count — harmless
    console.error('increment-tactic-views error:', err);
    return { statusCode: 500, body: 'Internal error: ' + (err.message || String(err)) };
  }
};
