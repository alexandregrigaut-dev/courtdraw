// Returns the club settings for the authenticated club owner.
// Used by club-admin.html to load code, colors, logo, and name
// without hitting client-side Firestore security rules.
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
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

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

  const userSnap = await db.collection('users').doc(uid).get();
  const userData = userSnap.exists ? userSnap.data() : {};
  if (userData.plan !== 'club') {
    return { statusCode: 403, body: 'Club owner access required' };
  }

  const clubId   = userData.clubId || ('club_' + uid);
  const clubSnap = await db.collection('clubs').doc(clubId).get();
  const clubData = clubSnap.exists ? clubSnap.data() : {};

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clubId,
      clubName:   clubData.clubName || clubData.name || userData.clubName || '',
      clubCode:   clubData.clubCode || null,
      logoUrl:    clubData.logoUrl  || userData.clubLogoUrl || null,
      teamColorA: clubData.teamColorA || null,
      teamColorB: clubData.teamColorB || null,
      createdAt:  clubData.createdAt || null,
    })
  };
};
