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

function safeJsonParse(str, fallback) {
  try { return str ? JSON.parse(str) : fallback; } catch { return fallback; }
}


exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };
    const authHeader = event.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return { statusCode: 401, body: 'Unauthorized' };

    let uid;
    try { uid = (await admin.auth().verifyIdToken(token)).uid; }
    catch { return { statusCode: 401, body: 'Invalid token' }; }

    const userSnap = await db.collection('users').doc(uid).get();
    const userData = userSnap.exists ? userSnap.data() : {};
    const hasClubAccess = userData.plan === 'club' || userData.clubMember === true;
    // memberOfClubId is set when a club owner joins a second club as a member.
    // Fall back to 'club_' + uid for owners whose webhook may not have written clubId.
    const clubId = userData.memberOfClubId || userData.clubId ||
                   (userData.plan === 'club' ? 'club_' + uid : null);
    if (!hasClubAccess || !clubId) {
      console.error('get-club-tactics: access denied', { uid, plan: userData.plan, clubId, hasClubAccess });
      return { statusCode: 403, body: 'Club access required' };
    }

    const snap = await db.collection('clubs').doc(clubId).collection('tactics')
      .orderBy('sharedAt', 'desc').limit(100).get();

    // First pass: collect raw data and find UIDs needing username resolution
    const rawTactics = snap.docs.map(d => {
      const data = d.data();
      const sharedAt = data.sharedAt && typeof data.sharedAt.toDate === 'function'
        ? data.sharedAt.toDate().toISOString()
        : null;
      return {
        name:            data.name         || '',
        courtId:         data.courtId      || '',
        currentPhase:    data.currentPhase || 0,
        authorUid:       data.authorUid    || '',
        _rawAuthorName:  data.authorName   || '',
        viewCount:       data.viewCount    || 0,
        sharedAt,
        objects:         safeJsonParse(data.objectsJson, []),
        tokens:          safeJsonParse(data.tokensJson,  []),
        phases:          safeJsonParse(data.phasesJson,  []),
        _clubShared:     true,
        _firestoreId:    d.id
      };
    });

    // Batch-resolve usernames for legacy tactics that stored an email as authorName
    const uidsNeedingLookup = [
      ...new Set(
        rawTactics
          .filter(t => t._rawAuthorName.includes('@') && t.authorUid)
          .map(t => t.authorUid)
      )
    ];
    const usernameByUid = {};
    if (uidsNeedingLookup.length > 0) {
      const userSnaps = await Promise.all(
        uidsNeedingLookup.map(u => db.collection('users').doc(u).get())
      );
      userSnaps.forEach((snap, i) => {
        if (snap.exists && snap.data().username) {
          usernameByUid[uidsNeedingLookup[i]] = snap.data().username;
        }
      });
    }

    const tactics = rawTactics.map(t => {
      let authorName;
      if (t._rawAuthorName.includes('@')) {
        authorName = usernameByUid[t.authorUid] || 'Coach';
      } else {
        authorName = t._rawAuthorName || 'Coach';
      }
      const { _rawAuthorName, ...rest } = t;
      return { ...rest, authorName };
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tactics, clubId })
    };

  } catch (err) {
    console.error('get-club-tactics unhandled error:', err);
    return { statusCode: 500, body: 'Internal error: ' + (err.message || String(err)) };
  }
};
