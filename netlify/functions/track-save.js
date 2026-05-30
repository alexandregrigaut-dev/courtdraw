/**
 * track-save.js — lightweight server-side save tracker
 *
 * Called by the app (client-side) whenever a logged-in user saves a tactic.
 * Increments playsThisWeek and totalPlays in the user's Firestore doc, and
 * stores the most-recently-saved play name + sport for the weekly digest.
 *
 * Auth: valid Firebase ID token required (same pattern as the welcome email endpoint).
 *
 * POST body: { playName: string, courtId: string }
 */

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

  // Require a valid Firebase ID token
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

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, body: 'Bad JSON' }; }
  const playName = (body.playName || '').slice(0, 80);
  const courtId  = (body.courtId  || '').slice(0, 40);

  // Get the current ISO week key (e.g. "2026-W22") — resets the weekly counter each week
  const now = Date.now();
  const d = new Date(now);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  const weekKey = `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;

  try {
    const userRef = db.collection('users').doc(uid);
    const snap = await userRef.get();
    const data = snap.exists ? snap.data() : {};

    const currentWeekKey    = data.savesWeekKey || '';
    const currentPlaysWeek  = currentWeekKey === weekKey ? (data.playsThisWeek || 0) : 0;

    await userRef.set({
      playsThisWeek:   currentPlaysWeek + 1,
      savesWeekKey:    weekKey,
      totalPlays:      (data.totalPlays || 0) + 1,
      lastSaveAt:      now,
      lastPlayName:    playName || data.lastPlayName || '',
      lastPlayCourt:   courtId  || data.lastPlayCourt || '',
    }, { merge: true });

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('track-save error:', err.message);
    return { statusCode: 500, body: err.message };
  }
};
