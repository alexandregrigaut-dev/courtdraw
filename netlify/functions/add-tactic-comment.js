// Adds a coach note / comment to a club tactic.
// Access: any member of the club that owns the tactic.
// Limits: text max 500 chars; 50 comments per tactic.
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

    let uid, displayName, email;
    try {
      const decoded = await admin.auth().verifyIdToken(token);
      uid         = decoded.uid;
      displayName = decoded.name  || null;
      email       = decoded.email || null;
    } catch { return { statusCode: 401, body: 'Invalid token' }; }

    // Resolve club membership
    const userSnap = await db.collection('users').doc(uid).get();
    const userData = userSnap.exists ? userSnap.data() : {};
    const hasAccess = userData.plan === 'club' || userData.clubMember === true;
    const clubId    = userData.memberOfClubId || userData.clubId ||
                      (userData.plan === 'club' ? 'club_' + uid : null);
    if (!hasAccess || !clubId) return { statusCode: 403, body: 'Club access required' };

    let tacticId, text;
    try { ({ tacticId, text } = JSON.parse(event.body || '{}')); }
    catch { return { statusCode: 400, body: 'Bad JSON' }; }

    if (!tacticId || typeof tacticId !== 'string') return { statusCode: 400, body: 'Missing tacticId' };
    if (!text || typeof text !== 'string' || !text.trim()) return { statusCode: 400, body: 'Empty comment' };

    // Sanitise & cap
    const sanitised = text.trim().slice(0, 500);

    // Verify tactic belongs to this club
    const tacticSnap = await db.collection('clubs').doc(clubId)
      .collection('tactics').doc(tacticId).get();
    if (!tacticSnap.exists) return { statusCode: 404, body: 'Tactic not found' };

    // Enforce 50-comment cap per tactic
    const commentsRef = db.collection('clubs').doc(clubId)
      .collection('tactics').doc(tacticId)
      .collection('comments');
    const count = (await commentsRef.limit(50).get()).size;
    if (count >= 50) return { statusCode: 429, body: 'Comment limit reached for this tactic' };

    const authorName = displayName || userData.displayName || email || 'Coach';

    const newRef = await commentsRef.add({
      text:       sanitised,
      authorUid:  uid,
      authorName,
      addedAt:    admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, id: newRef.id, authorName, text: sanitised })
    };
  } catch (err) {
    console.error('add-tactic-comment error:', err);
    return { statusCode: 500, body: 'Internal error: ' + (err.message || String(err)) };
  }
};
