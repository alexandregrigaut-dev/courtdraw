const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

// "from" must be a verified domain in Resend (courtdraw.app → verify in Resend dashboard)
const FROM = 'CourtDraw <hello@courtdraw.app>';
const APP_URL = process.env.PUBLIC_URL || 'https://courtdraw.app';

const templates = {
  welcome: (email) => ({
    from: FROM,
    to: email,
    subject: 'Welcome to CourtDraw',
    html: `
      <h1>Welcome to CourtDraw!</h1>
      <p>Your account is ready. Start drawing court diagrams in seconds.</p>
      <p><a href="${APP_URL}/courtdraw-app.html">Open the app →</a></p>
      <p style="color:#666;font-size:12px;">Questions? Reply to this email or contact hello@courtdraw.app</p>
    `
  }),
  paymentConfirmed: (email) => ({
    from: FROM,
    to: email,
    subject: 'You\'re now CourtDraw Pro 🎉',
    html: `
      <h1>Welcome to CourtDraw Pro!</h1>
      <p>Your subscription is active. All 37+ courts, unlimited saves, and clean PNG exports are now unlocked.</p>
      <p><a href="${APP_URL}/courtdraw-app.html">Open the app →</a></p>
    `
  }),
  paymentFailed: (email) => ({
    from: FROM,
    to: email,
    subject: 'Action needed — CourtDraw payment issue',
    html: `
      <h1>We couldn't process your payment</h1>
      <p>Please update your billing details to keep your Pro access.</p>
      <p><a href="${APP_URL}/courtdraw-app.html">Open CourtDraw →</a></p>
      <p style="color:#666;font-size:12px;">Need help? Contact hello@courtdraw.app</p>
    `
  })
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { template, email } = JSON.parse(event.body);
  if (!templates[template]) return { statusCode: 400, body: 'Unknown template' };
  if (!email) return { statusCode: 400, body: 'Missing email' };

  try {
    await resend.emails.send(templates[template](email));
    return { statusCode: 200, body: JSON.stringify({ sent: true }) };
  } catch (err) {
    return { statusCode: 500, body: `Email error: ${err.message}` };
  }
};
