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
    catch (e) { return { statusCode: 401, body: 'Invalid token' }; }

    const userSnap = await db.collection('users').doc(uid).get();
    const userData = userSnap.exists ? userSnap.data() : {};

    // Grant access to club owners AND any user marked as a club member
    const hasClubAccess = userData.plan === 'club' || userData.clubMember === true;
    // memberOfClubId is set when a club owner joins a second club as a member.
    // For club owners whose webhook may not have written clubId, fall back to
    // the stable derived ID used everywhere else (get-club-data.js pattern).
    const clubId = userData.memberOfClubId || userData.clubId ||
                   (userData.plan === 'club' ? 'club_' + uid : null);
    if (!hasClubAccess || !clubId) {
      console.error('save-club-tactic: access denied', { uid, plan: userData.plan, clubId, hasClubAccess });
      return { statusCode: 403, body: 'Club access required' };
    }

    let body;
    try { body = JSON.parse(event.body); }
    catch { return { statusCode: 400, body: 'Bad JSON' }; }

    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0 || body.name.length > 100)
      return { statusCode: 400, body: 'Invalid tactic name' };
    if (!Array.isArray(body.objects) || !Array.isArray(body.tokens))
      return { statusCode: 400, body: 'Invalid tactic data' };

    // Firestore does not allow nested arrays (arrays-of-arrays) which drawing
    // objects use for point tuples [[x,y],[x,y],...].  Serialize complex drawing
    // data as JSON strings; only scalar metadata is stored as indexed fields.
    const docRef = db.collection('clubs').doc(clubId).collection('tactics').doc();
    await docRef.set({
      name:         body.name.trim(),
      courtId:      body.courtId || '',
      // JSON-serialised drawing data — avoids Firestore nested-array rejection
      objectsJson:  JSON.stringify(body.objects      || []),
      tokensJson:   JSON.stringify(body.tokens       || []),
      phasesJson:   JSON.stringify(body.phases       || []),
      currentPhase: body.currentPhase || 0,
      authorUid:    uid,
      authorName:   body.authorName   || '',
      authorEmail:  userData.email    || '',
      sharedAt:     admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, clubId, tacticId: docRef.id })
    };

  } catch (err) {
    // Catch any uncaught error (Firestore timeout, network failure, etc.)
    // and return a readable 500 instead of a raw Netlify 502.
    console.error('save-club-tactic unhandled error:', err);
    return {
      statusCode: 500,
      body: 'Internal error: ' + (err.message || String(err))
    };
  }
};
