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

  // ── checkout.session.completed ──────────────────────────────────────────────
  // Fires when user completes the Stripe checkout form — including for trials
  // (where payment_status = 'no_payment_required'). We grant plan access here
  // regardless of whether a charge was collected, so trial users get immediate
  // Club access. The subscription stays in 'trialing' state in Stripe.
  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const plan = PLAN_BY_PRICE[session.metadata.priceId];
    const userId = session.metadata.userId;
    // Reject unknown price IDs rather than silently granting access
    if (!plan || !userId) {
      console.error('Webhook: unknown priceId or missing userId', session.metadata);
      return { statusCode: 200, body: JSON.stringify({ received: true }) };
    }

    // Detect whether this is a trial checkout (any plan — no immediate charge means trial)
    const isTrial = session.payment_status === 'no_payment_required';

    const update = {
      plan,
      stripeCustomerId: session.customer,
      subscribedAt: new Date().toISOString()
    };

    // Store trial metadata for any trialing plan
    if (isTrial && session.subscription) {
      try {
        const sub = await stripe.subscriptions.retrieve(session.subscription);
        if (sub.trial_end) {
          update.isTrialing      = true;
          update.trialEndsAt     = new Date(sub.trial_end * 1000).toISOString();
          update.trialStartedAt  = new Date().toISOString();
          // Record the actual amount and currency so the in-app trial notice can
          // state what will be charged rather than guessing. Checkout bills in
          // five currencies, so assuming euros would show a US customer a figure
          // they will never be charged — worse than showing no figure at all.
          const price = sub.items && sub.items.data && sub.items.data[0] && sub.items.data[0].price;
          if (price && typeof price.unit_amount === 'number') {
            update.trialAmount   = price.unit_amount;                 // minor units
            update.trialCurrency = (price.currency || '').toUpperCase();
          }
        }
      } catch (e) {
        // Non-fatal: trial info is nice-to-have, not required for access
        console.error('Could not retrieve subscription for trial info:', e.message);
      }
    }

    // Club plan: create the club document, assign a stable clubId, generate a join code.
    // Guarded by clubSnap.exists so a duplicate webhook delivery (Stripe explicitly
    // allows re-delivery of the same event on retry) can't silently regenerate the
    // code and invalidate one already shared with the club's coaching staff.
    if (plan === 'club') {
      const clubId  = 'club_' + userId;
      update.clubId = clubId;
      const clubRef  = db.collection('clubs').doc(clubId);
      const clubSnap = await clubRef.get();
      if (!clubSnap.exists) {
        await clubRef.set({
          ownerId:   userId,
          clubCode:  generateClubCode(),   // 6-char code coaches use to join
          createdAt: new Date().toISOString()
        });
      }
    }

    await db.collection('users').doc(userId).update(update);

    // Send appropriate email based on plan and trial status
    if (plan === 'club') {
      await sendEmail(isTrial ? 'clubTrialStarted' : 'clubWelcome', session.customer_email);
    } else if (plan === 'pro') {
      await sendEmail(isTrial ? 'proTrialStarted' : 'paymentConfirmed', session.customer_email);
    }
  }

  // ── customer.subscription.trial_will_end ───────────────────────────────────
  // Fires 3 days before trial_end. This exists because Stripe's own trial
  // reminder is fixed at 7 days before the trial ends and our trial IS 7 days,
  // so that reminder lands on signup day and warns nobody. Every failed payment
  // on record was a first charge after a trial, and 92% of the money lost was
  // the annual Club charge arriving unannounced — this is the warning that
  // actually arrives in time to do something about it.
  if (stripeEvent.type === 'customer.subscription.trial_will_end') {
    const sub = stripeEvent.data.object;

    // Already cancelled — no charge is coming, so warning about one would be
    // both wrong and alarming.
    if (sub.cancel_at_period_end === true) {
      return { statusCode: 200, body: JSON.stringify({ received: true, skipped: 'cancelling' }) };
    }

    const snap = await db.collection('users')
      .where('stripeCustomerId', '==', sub.customer)
      .limit(1)
      .get();

    if (!snap.empty && sub.trial_end) {
      const userData = snap.docs[0].data();
      const userEmail = userData.email;

      // Stripe explicitly re-delivers events on retry. Keying the guard on this
      // trial's end date rather than a bare boolean means a re-delivery is
      // skipped while a genuinely new trial later still gets its warning.
      const alreadySent = userData.trialWillEndSentFor === sub.trial_end;

      if (userEmail && !alreadySent) {
        const plan     = userData.plan || 'pro';
        const planName = plan === 'club' ? 'Club' : 'Pro';
        const endDate  = new Date(sub.trial_end * 1000)
          .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

        // Read the real price off the subscription. Checkout bills in five
        // currencies, so an assumed figure could name an amount this customer
        // will never be charged; an empty string makes the template omit it.
        let amountText = '';
        const price = sub.items && sub.items.data && sub.items.data[0] && sub.items.data[0].price;
        if (price && typeof price.unit_amount === 'number' && price.currency) {
          try {
            const whole = price.unit_amount % 100 === 0;
            amountText = new Intl.NumberFormat('en-GB', {
              style: 'currency',
              currency: price.currency.toUpperCase(),
              minimumFractionDigits: whole ? 0 : 2,
              maximumFractionDigits: whole ? 0 : 2
            }).format(price.unit_amount / 100);
          } catch (e) {
            amountText = '';   // unrecognised currency — warn without a figure
          }
        }

        // Key order matters: send-email spreads templateData positionally.
        await sendEmail('trialEndingSoon', userEmail, { endDate, amountText, planName });
        await snap.docs[0].ref.update({ trialWillEndSentFor: sub.trial_end });
      }
    }
  }

  // ── customer.subscription.updated ──────────────────────────────────────────
  if (stripeEvent.type === 'customer.subscription.updated') {
    const sub  = stripeEvent.data.object;
    const prev = stripeEvent.data.previous_attributes || {};

    // 1. Trial converted to paid subscription (trialing → active) — any plan
    if (sub.status === 'active' && prev.status === 'trialing') {
      const customerId = sub.customer;
      const snap = await db.collection('users')
        .where('stripeCustomerId', '==', customerId)
        .limit(1)
        .get();
      if (!snap.empty) {
        const userData  = snap.docs[0].data();
        const userPlan  = userData.plan || 'pro';
        const userEmail = userData.email;
        await snap.docs[0].ref.update({
          isTrialing:        false,
          trialConverted:    true,
          trialConvertedAt:  new Date().toISOString(),
        });
        if (userEmail) {
          // Send plan-appropriate "trial converted" email
          const template = userPlan === 'club' ? 'clubTrialConverted' : 'proTrialConverted';
          await sendEmail(template, userEmail);
        }
      }
    }

    // 2. User cancelled via billing portal (cancel_at_period_end just flipped to true)
    //    Works for both paying subscribers and trial users (trial will end at trial_end).
    if (sub.cancel_at_period_end === true && prev.cancel_at_period_end === false) {
      const customerId = sub.customer;
      const snap = await db.collection('users')
        .where('stripeCustomerId', '==', customerId)
        .limit(1)
        .get();
      if (!snap.empty) {
        const userData  = snap.docs[0].data();
        const userEmail = userData.email;
        if (userEmail) {
          const endTs   = sub.cancel_at || sub.current_period_end || sub.trial_end;
          const endDate = endTs
            ? new Date(endTs * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
            : 'the end of your billing period';
          const plan = userData.plan || 'pro';
          await sendEmail('cancellationScheduled', userEmail, { endDate, plan });
        }
      }
    }
  }

  // ── customer.subscription.deleted ──────────────────────────────────────────
  // Fires when a subscription ends — whether by cancellation, payment failure
  // exhaustion, or trial ending without a successful charge. Always revoke access.
  if (stripeEvent.type === 'customer.subscription.deleted') {
    const customerId = stripeEvent.data.object.customer;
    const snap = await db.collection('users')
      .where('stripeCustomerId', '==', customerId)
      .limit(1)
      .get();
    if (!snap.empty) {
      const userDoc = snap.docs[0];
      await userDoc.ref.update({
        plan:        'free',
        isTrialing:  false,
        cancelledAt: new Date().toISOString()
      });
      const userEmail = userDoc.data().email;
      if (userEmail) await sendEmail('cancellation', userEmail);
    }
  }

  // ── invoice.payment_failed ──────────────────────────────────────────────────
  // For the very first invoice of a new subscription, checkout.session.completed
  // is the authoritative success/failure signal. Stripe may fire
  // invoice.payment_failed transiently (e.g. during 3D Secure, bank verification)
  // before checkout.session.completed confirms the payment succeeded.
  // Sending an alert here would give a false "payment failed" email even
  // when checkout completed successfully — which is exactly what happened.
  // Only alert for recurring billing failures, and only after Stripe has
  // already auto-retried at least once (attempt_count >= 2).
  // This also covers the trial → paid conversion failure: the first post-trial
  // invoice has billing_reason 'subscription_cycle' (not 'subscription_create'),
  // so it passes the isFirstInvoice check and follows the retry/alert path.
  if (stripeEvent.type === 'invoice.payment_failed') {
    const invoice = stripeEvent.data.object;
    const isFirstInvoice = invoice.billing_reason === 'subscription_create';
    const attemptCount   = invoice.attempt_count || 1;
    if (!isFirstInvoice && attemptCount >= 2) {
      const email = invoice.customer_email;
      if (email) await sendEmail('paymentFailed', email);
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
