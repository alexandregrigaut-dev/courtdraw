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
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const token = (event.headers.authorization || '').replace('Bearer ', '');
  if (!token) return { statusCode: 401, body: 'Unauthorized' };

  let uid;
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return { statusCode: 401, body: 'Invalid token' };
  }

  let clubId;
  try {
    ({ clubId } = JSON.parse(event.body || '{}'));
  } catch {
    return { statusCode: 400, body: 'Bad request' };
  }

  if (!clubId || typeof clubId !== 'string' || !clubId.startsWith('club_')) {
    return { statusCode: 400, body: 'Invalid club ID' };
  }

  // Verify the club exists
  const clubSnap = await db.collection('clubs').doc(clubId).get();
  if (!clubSnap.exists) {
    return { statusCode: 404, body: 'Club not found' };
  }

  // Don't overwrite existing Club plan owners
  const userSnap = await db.collection('users').doc(uid).get();
  const userData = userSnap.exists ? userSnap.data() : {};
  if (userData.plan === 'club' && userData.clubId && userData.clubId !== clubId) {
    // User already owns a different club — don't overwrite, but allow joining as member
    await db.collection('users').doc(uid).update({ memberOfClubId: clubId });
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, role: 'member', clubId })
    };
  }

  // Link user to club (member role — keeps whatever plan they have, adds clubId)
  const resolvedClubName = clubSnap.data().clubName || clubSnap.data().name || '';
  const update = { clubId };
  if (resolvedClubName) update.clubName = resolvedClubName; // denormalize so app can show club name
  if (!userData.plan || userData.plan === 'free') {
    // Grant club-member access (read/write to shared library) without full club plan billing
    update.clubMember = true;
  }

  await db.collection('users').doc(uid).update(update);

  // Add member to club's members sub-collection
  await db.collection('clubs').doc(clubId)
    .collection('members').doc(uid)
    .set({ joinedAt: new Date().toISOString(), email: userData.email || '' }, { merge: true });

  const clubData = clubSnap.data();
  return {
    statusCode: 200,
    body: JSON.stringify({
      ok: true,
      role: 'member',
      clubId,
      clubName: clubData.clubName || clubData.name || ''
    })
  };
};
