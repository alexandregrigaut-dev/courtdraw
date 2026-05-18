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
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const authHeader = event.headers.authorization || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return { statusCode: 401, body: 'Unauthorized' };

  let uid;
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    uid = decoded.uid;
  } catch { return { statusCode: 401, body: 'Invalid token' }; }

  const userSnap = await db.collection('users').doc(uid).get();
  const userData = userSnap.exists ? userSnap.data() : {};
  if (userData.plan !== 'club') return { statusCode: 403, body: 'Club owner access required' };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, body: 'Bad JSON' }; }

  const { imageData, mimeType } = body;
  if (!imageData || !mimeType) return { statusCode: 400, body: 'Missing imageData or mimeType' };
  // ~1 MB base64 limit (base64 inflates ~33%, so 1MB raw ≈ 1.33MB base64)
  if (imageData.length > 1400000) return { statusCode: 413, body: 'Image too large (max ~1 MB)' };

  const clubId = userData.clubId || ('club_' + uid);
  // Store as a data URL directly in Firestore — no external storage bucket needed
  const logoUrl = `data:${mimeType};base64,${imageData}`;

  try {
    await db.collection('clubs').doc(clubId).set({ logoUrl }, { merge: true });
    await db.collection('users').doc(uid).set({ clubLogoUrl: logoUrl }, { merge: true });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logoUrl })
    };
  } catch (e) {
    console.error('upload-club-logo error:', e.message);
    return { statusCode: 500, body: 'Upload failed: ' + e.message };
  }
};
