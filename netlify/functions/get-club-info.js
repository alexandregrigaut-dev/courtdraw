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
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };
  const clubId = (event.queryStringParameters || {}).clubId;
  if (!clubId || !clubId.startsWith('club_')) return { statusCode: 400, body: 'Invalid club ID' };
  try {
    const snap = await db.collection('clubs').doc(clubId).get();
    if (!snap.exists) return { statusCode: 404, body: 'Club not found' };
    const d = snap.data();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clubId, clubName: d.clubName || d.name || 'Club Library' })
    };
  } catch (e) {
    return { statusCode: 500, body: 'Server error' };
  }
};
