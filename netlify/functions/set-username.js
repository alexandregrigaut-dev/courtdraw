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
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const authHeader = event.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return { statusCode: 401, body: 'Unauthorized' };

  let uid;
  try { uid = (await admin.auth().verifyIdToken(token)).uid; }
  catch { return { statusCode: 401, body: 'Invalid token' }; }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: 'Bad JSON' }; }

  const username = (body.username || '').toLowerCase().trim();
  if (!USERNAME_RE.test(username)) {
    return { statusCode: 400, body: 'Username must be 3–30 characters: letters, numbers, and underscores only.' };
  }

  try {
    const userRef     = db.collection('users').doc(uid);
    const usernameRef = db.collection('usernames').doc(username);

    await db.runTransaction(async t => {
      const usernameSnap = await t.get(usernameRef);
      if (usernameSnap.exists && usernameSnap.data().uid !== uid) {
        const err = new Error('taken');
        err.code = 'USERNAME_TAKEN';
        throw err;
      }

      // Release old username reservation when the user is changing their name
      const userSnap = await t.get(userRef);
      const oldUsername = userSnap.exists ? userSnap.data().username : null;
      if (oldUsername && oldUsername !== username) {
        t.delete(db.collection('usernames').doc(oldUsername));
      }

      t.set(usernameRef, { uid, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      // Use set+merge so this works even if the user doc doesn't exist yet (Google OAuth users)
      t.set(userRef, { username }, { merge: true });
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, username })
    };
  } catch (err) {
    if (err.code === 'USERNAME_TAKEN') {
      return { statusCode: 409, body: 'Username already taken.' };
    }
    console.error('set-username error:', err);
    return { statusCode: 500, body: 'Internal error: ' + (err.message || String(err)) };
  }
};
