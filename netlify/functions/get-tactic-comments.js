// Returns all coach notes / comments for a club tactic.
// Access: any member of the club that owns the tactic.
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
    if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };

    const authHeader = event.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return { statusCode: 401, body: 'Unauthorized' };

    let uid;
    try { uid = (await admin.auth().verifyIdToken(token)).uid; }
    catch { return { statusCode: 401, body: 'Invalid token' }; }

    // Resolve club membership
    const userSnap = await db.collection('users').doc(uid).get();
    const userData = userSnap.exists ? userSnap.data() : {};
    const hasAccess = userData.plan === 'club' || userData.clubMember === true;
    const clubId    = userData.memberOfClubId || userData.clubId ||
                      (userData.plan === 'club' ? 'club_' + uid : null);
    if (!hasAccess || !clubId) return { statusCode: 403, body: 'Club access required' };

    const tacticId = (event.queryStringParameters || {}).tacticId;
    if (!tacticId || typeof tacticId !== 'string') return { statusCode: 400, body: 'Missing tacticId' };

    // Verify the tactic belongs to this club
    const tacticSnap = await db.collection('clubs').doc(clubId)
      .collection('tactics').doc(tacticId).get();
    if (!tacticSnap.exists) return { statusCode: 404, body: 'Tactic not found' };

    const commentsSnap = await db.collection('clubs').doc(clubId)
      .collection('tactics').doc(tacticId)
      .collection('comments')
      .orderBy('addedAt', 'asc')
      .limit(50)
      .get();

    const comments = commentsSnap.docs.map(d => {
      const data = d.data();
      return {
        id:         d.id,
        text:       data.text       || '',
        authorName: data.authorName || 'Coach',
        authorUid:  data.authorUid  || '',
        addedAt:    data.addedAt && typeof data.addedAt.toDate === 'function'
          ? data.addedAt.toDate().toISOString()
          : data.addedAt || null
      };
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comments })
    };
  } catch (err) {
    console.error('get-tactic-comments error:', err);
    return { statusCode: 500, body: 'Internal error: ' + (err.message || String(err)) };
  }
};
