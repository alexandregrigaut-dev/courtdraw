const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
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

  // Look up the Stripe customer ID from Firestore (don't trust client-supplied ID)
  const userSnap = await db.collection('users').doc(uid).get();
  const userData = userSnap.exists ? userSnap.data() : {};
  const stripeCustomerId = userData.stripeCustomerId;

  if (!stripeCustomerId) {
    return { statusCode: 400, body: 'No active subscription found' };
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${process.env.PUBLIC_URL || 'https://courtdraw.app'}/courtdraw-app.html`
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ url: session.url })
  };
};
