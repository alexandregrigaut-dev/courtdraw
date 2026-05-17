// Generates (or regenerates) the 6-character alphanumeric join code for a club.
// Called by the Club Admin from the admin dashboard.
// Only the club owner (plan === 'club') can call this.
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

// Characters chosen to avoid visual ambiguity (no 0/O, 1/I/L)
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode() {
  return Array.from({ length: 6 }, () =>
    CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  ).join('');
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
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
    return { statusCode: 403, body: 'Club plan required' };
  }

  const clubId  = userData.clubId || ('club_' + uid);
  const newCode = generateCode();

  await db.collection('clubs').doc(clubId).update({ clubCode: newCode });

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, clubCode: newCode })
  };
};
