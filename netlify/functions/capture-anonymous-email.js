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

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, body: 'Bad JSON' }; }

  const email = (body.email || '').toLowerCase().trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { statusCode: 400, body: 'Invalid email' };
  }

  try {
    const docRef = db.collection('anonEmails').doc(email);
    const existing = await docRef.get();

    if (existing.exists) {
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    await docRef.set({
      email,
      capturedAt: admin.firestore.FieldValue.serverTimestamp(),
      source: 'tutorial_complete',
      dripEmailsSent: []
    });

    const headers = { 'Content-Type': 'application/json' };
    if (process.env.INTERNAL_SECRET) headers['x-internal-secret'] = process.env.INTERNAL_SECRET;

    await fetch(`${process.env.PUBLIC_URL}/.netlify/functions/send-email`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ template: 'anonWelcome', email })
    });

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('capture-anonymous-email error:', err.message);
    return { statusCode: 500, body: err.message };
  }
};
