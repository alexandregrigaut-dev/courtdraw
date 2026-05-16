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

// Map Stripe price IDs to CourtDraw plan names
const PLAN_BY_PRICE = {
  [process.env.STRIPE_PRICE_ID_PRO_MONTHLY]: 'pro',
  [process.env.STRIPE_PRICE_ID_PRO_YEARLY]:  'pro',
  [process.env.STRIPE_PRICE_ID_CLUB]:        'club'
};

async function sendEmail(template, email) {
  await fetch(`${process.env.PUBLIC_URL}/.netlify/functions/send-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ template, email })
  });
}

exports.handler = async (event) => {
  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const plan = PLAN_BY_PRICE[session.metadata.priceId] || 'pro';
    await db.collection('users').doc(session.metadata.userId).update({
      plan,
      stripeCustomerId: session.customer,
      subscribedAt: new Date().toISOString()
    });
    await sendEmail('paymentConfirmed', session.customer_email);
  }

  if (stripeEvent.type === 'customer.subscription.deleted') {
    const customerId = stripeEvent.data.object.customer;
    const snap = await db.collection('users')
      .where('stripeCustomerId', '==', customerId)
      .limit(1)
      .get();
    if (!snap.empty) {
      await snap.docs[0].ref.update({ plan: 'free', cancelledAt: new Date().toISOString() });
    }
  }

  if (stripeEvent.type === 'invoice.payment_failed') {
    const email = stripeEvent.data.object.customer_email;
    if (email) await sendEmail('paymentFailed', email);
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
