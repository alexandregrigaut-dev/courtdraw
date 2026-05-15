const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const templates = {
  welcome: (email) => ({
    from: 'CourtDraw <Courtdraw.info@gmail.com>',
    to: email,
    subject: 'Welcome to CourtDraw',
    html: `
      <h1>Welcome to CourtDraw!</h1>
      <p>Your account is ready. Start drawing court diagrams in seconds.</p>
      <p><a href="https://courtdraw.app/courtdraw-app.html">Open the app</a></p>
      <p style="color:#666;font-size:12px;">Questions? Email Courtdraw.info@gmail.com</p>
    `
  }),
  paymentConfirmed: (email) => ({
    from: 'CourtDraw <Courtdraw.info@gmail.com>',
    to: email,
    subject: 'You are now CourtDraw Pro',
    html: `
      <h1>Welcome to CourtDraw Pro!</h1>
      <p>Your subscription is active. All Pro features are now unlocked.</p>
      <p><a href="https://courtdraw.app/courtdraw-app.html">Open the app</a></p>
    `
  }),
  paymentFailed: (email) => ({
    from: 'CourtDraw <Courtdraw.info@gmail.com>',
    to: email,
    subject: 'Payment issue with your CourtDraw subscription',
    html: `
      <h1>We could not process your payment</h1>
      <p>Please update your billing details to keep your Pro access.</p>
      <p><a href="https://courtdraw.app/account.html">Update billing</a></p>
    `
  })
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { template, email } = JSON.parse(event.body);
  if (!templates[template]) return { statusCode: 400, body: 'Unknown template' };

  await resend.emails.send(templates[template](email));
  return { statusCode: 200, body: JSON.stringify({ sent: true }) };
};
