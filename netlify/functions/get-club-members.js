// Returns all coaches who have joined a club, plus basic club info.
// Accessible by both the club owner and invited club members (coaches).
// Reads the clubs/{clubId}/members subcollection, then enriches each
// entry with the user's email and join date from their Firestore profile.
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

  // Verify Firebase ID token
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

  // Access control: club owners AND invited members may read the roster
  const userSnap = await db.collection('users').doc(uid).get();
  const userData = userSnap.exists ? userSnap.data() : {};
  const isOwner  = userData.plan === 'club';
  const isMember = userData.clubMember === true && !!userData.clubId;
  if (!isOwner && !isMember) {
    return { statusCode: 403, body: 'Club access required' };
  }

  const clubId = userData.clubId || ('club_' + uid);

  // Fetch club doc for name + logo
  const clubSnap = await db.collection('clubs').doc(clubId).get();
  const clubData = clubSnap.exists ? clubSnap.data() : {};
  const clubName = clubData.clubName || clubData.name || userData.clubName || '';
  const logoUrl  = clubData.logoUrl  || null;
  const ownerId  = clubData.ownerId  || null;

  // Fetch all member documents from the subcollection
  const membersSnap = await db.collection('clubs').doc(clubId)
    .collection('members').orderBy('joinedAt', 'asc').get();

  const members = [];

  // For coaches: include the owner so they can see "Club Admin" in the roster
  if (!isOwner && ownerId) {
    const ownerSnap = await db.collection('users').doc(ownerId).get();
    const ownerData = ownerSnap.exists ? ownerSnap.data() : {};
    members.push({
      uid:      ownerId,
      email:    ownerData.email || '',
      name:     ownerData.displayName || ownerData.name || '',
      joinedAt: clubData.createdAt || '',
      role:     'admin',
      status:   'active'
    });
  }

  for (const docSnap of membersSnap.docs) {
    const memberUid = docSnap.id;
    if (memberUid === uid && isOwner) continue; // owners don't see themselves in the list
    if (memberUid === ownerId) continue;         // already added above for coaches

    const memberData = docSnap.data();
    // Enrich with user profile data (email may be more up-to-date there)
    const profileSnap = await db.collection('users').doc(memberUid).get();
    const profileData = profileSnap.exists ? profileSnap.data() : {};

    members.push({
      uid:      memberUid,
      email:    profileData.email || memberData.email || '',
      name:     profileData.displayName || profileData.name || '',
      joinedAt: memberData.joinedAt || '',
      role:     'coach',
      status:   'active'
    });
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ members, clubId, clubName, logoUrl })
  };
};
