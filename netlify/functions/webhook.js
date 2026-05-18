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

// Generate a 6-char alphanumeric club join code (no ambiguous chars)
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateClubCode() {
  return Array.from({ length: 6 }, () =>
    CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  ).join('');
}

async function sendEmail(template, email, templateData) {
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.INTERNAL_SECRET) headers['x-internal-secret'] = process.env.INTERNAL_SECRET;
  await fetch(`${process.env.PUBLIC_URL}/.netlify/functions/send-email`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ template, email, ...(templateData ? { templateData } : {}) })
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
    const plan = PLAN_BY_PRICE[session.metadata.priceId];
    const userId = session.metadata.userId;
    // Reject unknown price IDs rather than silently granting 'pro'
    if (!plan || !userId) {
      console.error('Webhook: unknown priceId or missing userId', session.metadata);
      return { statusCode: 200, body: JSON.stringify({ received: true }) };
    }
    const update = { plan, stripeCustomerId: session.customer, subscribedAt: new Date().toISOString() };
    // Club plan: create the club document, assign a stable clubId, and generate a join code
    if (plan === 'club') {
      const clubId  = 'club_' + userId;
      const clubCode = generateClubCode();
      update.clubId = clubId;
      await db.collection('clubs').doc(clubId).set({
        ownerId:   userId,
        clubCode,           // 6-char code coaches use to join
        createdAt: new Date().toISOString()
      }, { merge: true });
    }
    await db.collection('users').doc(userId).update(update);
    await sendEmail(plan === 'club' ? 'clubWelcome' : 'paymentConfirmed', session.customer_email);
  }

  // Fires immediately when user cancels via billing portal (cancel_at_period_end = true)
  if (stripeEvent.type === 'customer.subscription.updated') {
    const sub = stripeEvent.data.object;
    const prev = stripeEvent.data.previous_attributes || {};
    // Only act when cancel_at_period_end just flipped to true
    if (sub.cancel_at_period_end === true && prev.cancel_at_period_end === false) {
      const customerId = sub.customer;
      const snap = await db.collection('users')
        .where('stripeCustomerId', '==', customerId)
        .limit(1)
        .get();
      if (!snap.empty) {
        const userEmail = snap.docs[0].data().email;
        if (userEmail) {
          const endTs = sub.cancel_at || sub.current_period_end;
          const endDate = endTs
            ? new Date(endTs * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
            : 'the end of your billing period';
          await sendEmail('cancellationScheduled', userEmail, { endDate });
        }
      }
    }
  }

  if (stripeEvent.type === 'customer.subscription.deleted') {
    const customerId = stripeEvent.data.object.customer;
    const snap = await db.collection('users')
      .where('stripeCustomerId', '==', customerId)
      .limit(1)
      .get();
    if (!snap.empty) {
      const userDoc = snap.docs[0];
      await userDoc.ref.update({ plan: 'free', cancelledAt: new Date().toISOString() });
      const userEmail = userDoc.data().email;
      if (userEmail) await sendEmail('cancellation', userEmail);
    }
  }

  if (stripeEvent.type === 'invoice.payment_failed') {
    const invoice = stripeEvent.data.object;
    // For the very first invoice of a new subscription, checkout.session.completed
    // is the authoritative success/failure signal. Stripe may fire
    // invoice.payment_failed transiently (e.g. during 3D Secure, bank verification)
    // before checkout.session.completed confirms the payment succeeded.
    // Sending an alert here would give a false "payment failed" email even
    // when checkout completed successfully — which is exactly what happened.
    // Only alert for recurring billing failures, and only after Stripe has
    // already auto-retried at least once (attempt_count >= 2).
    const isFirstInvoice = invoice.billing_reason === 'subscription_create';
    const attemptCount   = invoice.attempt_count || 1;
    if (!isFirstInvoice && attemptCount >= 2) {
      const email = invoice.customer_email;
      if (email) await sendEmail('paymentFailed', email);
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
