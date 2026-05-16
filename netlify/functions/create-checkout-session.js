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

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Verify Firebase ID token from Authorization header
  const authHeader = event.headers.authorization || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return { statusCode: 401, body: 'Unauthorized' };

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(idToken);
  } catch {
    return { statusCode: 401, body: 'Invalid token' };
  }

  const { priceId } = JSON.parse(event.body);
  if (!priceId) return { statusCode: 400, body: 'Missing priceId' };

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'subscription',
    customer_email: decoded.email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.PUBLIC_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${process.env.PUBLIC_URL}/#pricing`,
    metadata: { userId: decoded.uid, priceId }
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ url: session.url })
  };
};
