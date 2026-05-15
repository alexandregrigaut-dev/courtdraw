const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { userId, email } = JSON.parse(event.body);

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'subscription',
    customer_email: email,
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: 'https://courtdraw.app/success.html?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: 'https://courtdraw.app/pricing.html',
    metadata: { userId }
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ url: session.url })
  };
};
