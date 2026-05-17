// Allows a coach to join a club using a short alphanumeric club code
// instead of the full invite URL.  The code is stored on the club document
// as `clubCode` (6 uppercase chars, generated at subscription time).
// Access: any authenticated user (coaches on free or pro plan).
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

  // Verify Firebase ID token
  const authHeader = event.headers.authorization || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return { statusCode: 401, body: 'Unauthorized' };

  let uid;
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    return { statusCode: 401, body: 'Invalid token' };
  }

  let code;
  try {
    ({ code } = JSON.parse(event.body || '{}'));
  } catch {
    return { statusCode: 400, body: 'Bad JSON' };
  }

  if (!code || typeof code !== 'string' || code.trim().length < 4) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Enter a valid club code.' }) };
  }

  const normalized = code.trim().toUpperCase();

  // Look up the club by its code (indexed single-field equality query)
  const clubsSnap = await db.collection('clubs')
    .where('clubCode', '==', normalized).limit(1).get();

  if (clubsSnap.empty) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Club code not found. Check with your Club Admin.' })
    };
  }

  const clubDoc  = clubsSnap.docs[0];
  const clubId   = clubDoc.id;
  const clubData = clubDoc.data();

  // Prevent the owner from joining their own club
  if (clubData.ownerId === uid) {
    return { statusCode: 400, body: JSON.stringify({ error: "You own this club — no need to join." }) };
  }

  // Read the user's current profile
  const userSnap = await db.collection('users').doc(uid).get();
  const userData = userSnap.exists ? userSnap.data() : {};

  // Already a member of this club — idempotent OK
  if (userData.clubId === clubId) {
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, alreadyMember: true, clubId,
        clubName: clubData.clubName || clubData.name || '' })
    };
  }

  // Club-plan owners can be members of another club, but we don't overwrite their primary clubId
  const isClubOwner = userData.plan === 'club' && userData.clubId && userData.clubId !== clubId;
  const resolvedClubName = clubData.clubName || clubData.name || '';

  const update = isClubOwner
    ? { memberOfClubId: clubId }
    : { clubId, ...(resolvedClubName && { clubName: resolvedClubName }) };

  // Grant club-member library access to free/pro users
  if (!isClubOwner && (!userData.plan || userData.plan === 'free' || userData.plan === 'pro')) {
    update.clubMember = true;
  }

  await db.collection('users').doc(uid).update(update);

  // Record member in the club's subcollection
  await db.collection('clubs').doc(clubId)
    .collection('members').doc(uid)
    .set({ joinedAt: new Date().toISOString(), email: userData.email || '' }, { merge: true });

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, clubId, clubName: resolvedClubName })
  };
};
