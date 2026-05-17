// Saves (or removes) the club logo URL on the club document.
// The logo is stored as a URL string — the Club Admin uploads their image
// to any hosting service and pastes the URL here.
// Only the club owner can update the logo.
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

// Very basic URL validation — must start with http/https
function isValidUrl(s) {
  try { return /^https?:\/\/.+/.test(s); } catch { return false; }
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

  const clubId = userData.clubId || ('club_' + uid);

  let logoUrl;
  try {
    ({ logoUrl } = JSON.parse(event.body || '{}'));
  } catch {
    return { statusCode: 400, body: 'Bad JSON' };
  }

  // logoUrl = null means "remove logo"
  if (logoUrl !== null && logoUrl !== undefined && !isValidUrl(logoUrl)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid URL. Must start with https://' }) };
  }

  const url = logoUrl || null;
  // Write to both the club document and the user's profile (denormalized for fast access)
  await Promise.all([
    db.collection('clubs').doc(clubId).update({ logoUrl: url }),
    db.collection('users').doc(uid).update({ clubLogoUrl: url })
  ]);

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true })
  };
};
