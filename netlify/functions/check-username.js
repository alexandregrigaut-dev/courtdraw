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

const USERNAME_RE = /^[a-z0-9_]{3,30}$/;

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };
  const username = ((event.queryStringParameters || {}).username || '').toLowerCase().trim();
  if (!USERNAME_RE.test(username)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ available: false, error: 'invalid_format' })
    };
  }
  try {
    const snap = await db.collection('usernames').doc(username).get();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ available: !snap.exists })
    };
  } catch (err) {
    console.error('check-username error:', err);
    return { statusCode: 500, body: 'Internal error' };
  }
};
