const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { stripeCustomerId } = JSON.parse(event.body);

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: 'https://courtdraw.app/account.html'
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ url: session.url })
  };
};
