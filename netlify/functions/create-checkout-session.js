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

// Map price IDs to plan names (mirrors webhook.js)
const PLAN_BY_PRICE = {
  [process.env.STRIPE_PRICE_ID_PRO_MONTHLY]: 'pro',
  [process.env.STRIPE_PRICE_ID_PRO_YEARLY]:  'pro',
  [process.env.STRIPE_PRICE_ID_CLUB]:        'club'
};

// EUR value for each price — used by success.html to fire an accurate Meta Pixel Purchase event
const VALUE_BY_PRICE = {
  [process.env.STRIPE_PRICE_ID_PRO_MONTHLY]: 6,
  [process.env.STRIPE_PRICE_ID_PRO_YEARLY]:  49,
  [process.env.STRIPE_PRICE_ID_CLUB]:        99
};

// Trial periods: Club = 7 days, Pro = 7 days
// Card required upfront for both. Stripe auto-charges on trial end.
// If user cancels before trial ends, no charge — customer.subscription.deleted fires and access is revoked.
const CLUB_TRIAL_DAYS = 7;
const PRO_TRIAL_DAYS  = 7;

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

  let priceId;
  try { ({ priceId } = JSON.parse(event.body || '{}')); } catch { return { statusCode: 400, body: 'Bad JSON' }; }
  if (!priceId) return { statusCode: 400, body: 'Missing priceId' };

  const plan   = PLAN_BY_PRICE[priceId];
  const isClub = plan === 'club';
  const isPro  = plan === 'pro';
  const value  = VALUE_BY_PRICE[priceId] ?? 0;

  // All plans get a free trial. Card required upfront; no charge until trial ends.
  // If the user cancels before trial end: no charge, access revoked automatically via webhook.
  const trialDays = isClub ? CLUB_TRIAL_DAYS : isPro ? PRO_TRIAL_DAYS : 0;

  // Append &trial=true and &value=0 for trials so success.html shows the right message
  // and Meta Pixel fires StartTrial (no revenue) instead of Purchase.
  const planParam  = plan || 'pro';
  const isTrial    = trialDays > 0;
  const pixelValue = isTrial ? 0 : value;
  const successUrl = `${process.env.PUBLIC_URL}/success.html?session_id={CHECKOUT_SESSION_ID}&plan=${planParam}&value=${pixelValue}${isTrial ? '&trial=true' : ''}`;

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: decoded.email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url:  `${process.env.PUBLIC_URL}/#pricing`,
      metadata: { userId: decoded.uid, priceId },
      // All plans: free trial. Card required upfront; no charge until trial ends.
      ...(trialDays > 0 ? { subscription_data: { trial_period_days: trialDays } } : {})
    });
  } catch (err) {
    console.error('Stripe error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ url: session.url })
  };
};
