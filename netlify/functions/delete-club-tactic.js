// Deletes a tactic from the club shared library.
// Access rules:
//   - Club owners can delete any tactic in their club.
//   - Club members (coaches) can delete only tactics they authored (authorUid === uid).
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
  if (event.httpMethod !== 'DELETE') return { statusCode: 405, body: 'Method Not Allowed' };

  const authHeader = event.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return { statusCode: 401, body: 'Unauthorized' };

  let uid;
  try { uid = (await admin.auth().verifyIdToken(token)).uid; }
  catch { return { statusCode: 401, body: 'Invalid token' }; }

  const userSnap = await db.collection('users').doc(uid).get();
  const userData = userSnap.exists ? userSnap.data() : {};

  // Resolve which club this user belongs to (mirrors save-club-tactic / get-club-tactics)
  const clubId = userData.memberOfClubId || userData.clubId;
  // isOwner: user owns THIS specific club (not just any club)
  const isOwner  = userData.plan === 'club' && userData.clubId === clubId && !userData.memberOfClubId;
  const isMember = userData.clubMember === true || isOwner;
  if (!isMember || !clubId) return { statusCode: 403, body: 'Club access required' };
  let tacticId;
  try { ({ tacticId } = JSON.parse(event.body || '{}')); }
  catch { return { statusCode: 400, body: 'Bad JSON' }; }
  if (!tacticId || typeof tacticId !== 'string') return { statusCode: 400, body: 'Missing tacticId' };

  // Load the tactic to check authorship
  const tacticSnap = await db.collection('clubs').doc(clubId)
    .collection('tactics').doc(tacticId).get();
  if (!tacticSnap.exists) return { statusCode: 404, body: 'Tactic not found' };

  const tacticData = tacticSnap.data();

  // Coaches can only delete their own tactics; owners can delete any
  if (!isOwner && tacticData.authorUid !== uid) {
    return { statusCode: 403, body: 'You can only delete your own tactics' };
  }

  await tacticSnap.ref.delete();
  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
