/**
 * unsubscribe.js — Public Netlify Function
 * Handles clicks on the "Unsubscribe" link in every email footer, and
 * one-click unsubscribe requests from mail clients (RFC 8058, triggered via
 * the List-Unsubscribe-Post header set in send-email.js).
 *
 * GET  /api/unsubscribe?email=...&token=...  → marks unsubscribed, shows a confirmation page
 * POST /api/unsubscribe?email=...&token=...  → marks unsubscribed, returns 200 (mail-client one-click)
 *
 * The token is an HMAC-SHA256 of the email, signed with INTERNAL_SECRET
 * (see buildUnsubscribeUrl in send-email.js) — this prevents anyone from
 * unsubscribing an email address they don't control.
 *
 * Unsubscribing only affects marketing emails (drip, weekly digest,
 * re-engagement, broadcasts) — see the `unsubscribed` check in those
 * scheduled functions. Transactional emails (password reset, billing) are
 * unaffected.
 */

const admin = require('firebase-admin');
const crypto = require('crypto');

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
const SECRET = process.env.INTERNAL_SECRET;

function expectedToken(email) {
  return crypto.createHmac('sha256', SECRET || '').update(email).digest('hex').slice(0, 32);
}

function isValidToken(email, token) {
  if (!SECRET || !email || !token) return false;
  const expected = Buffer.from(expectedToken(email));
  const given = Buffer.from(String(token));
  if (expected.length !== given.length) return false;
  return crypto.timingSafeEqual(expected, given);
}

async function markUnsubscribed(email) {
  // Registered user — Firestore doc is keyed by uid, not email.
  try {
    const user = await admin.auth().getUserByEmail(email);
    await db.collection('users').doc(user.uid).set(
      { unsubscribed: true, unsubscribedAt: Date.now() },
      { merge: true }
    );
  } catch (err) {
    if (err.code !== 'auth/user-not-found') console.error('unsubscribe (users):', err.message);
  }

  // Anonymous email capture — Firestore doc is keyed by the email itself.
  try {
    const ref = db.collection('anonEmails').doc(email);
    const snap = await ref.get();
    if (snap.exists) {
      await ref.set({ unsubscribed: true, unsubscribedAt: Date.now() }, { merge: true });
    }
  } catch (err) {
    console.error('unsubscribe (anonEmails):', err.message);
  }
}

function page({ statusCode, title, message }) {
  return {
    statusCode,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — CourtDraw</title></head>
<body style="margin:0;padding:0;background:#0a1628;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a1628;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
        <tr><td style="background:#0d1f3c;border:1px solid #1e3a5f;border-radius:16px;padding:40px 36px;text-align:center;">
          <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#64748b;">${title}</p>
          <h1 style="margin:0 0 16px;font-size:24px;font-weight:800;color:#f1f5f9;letter-spacing:-0.02em;">${message}</h1>
          <a href="https://courtdraw.app" style="display:inline-block;margin-top:8px;font-size:14px;color:#3b82f6;text-decoration:none;">Back to courtdraw.app</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  };
}

exports.handler = async (event) => {
  const method = event.httpMethod;
  if (method !== 'GET' && method !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const params = event.queryStringParameters || {};
  const email = (params.email || '').trim().toLowerCase();
  const token = params.token || '';

  if (!isValidToken(email, token)) {
    if (method === 'POST') return { statusCode: 400, body: 'Invalid or expired link' };
    return page({
      statusCode: 400,
      title: 'Invalid link',
      message: "This unsubscribe link is invalid or expired. Email hello@courtdraw.app and we'll take care of it.",
    });
  }

  await markUnsubscribed(email);

  // One-click unsubscribe from a mail client (Gmail/Outlook/Yahoo native button) —
  // respond immediately, no confirmation page needed.
  if (method === 'POST') {
    return { statusCode: 200, body: 'OK' };
  }

  return page({
    statusCode: 200,
    title: 'Unsubscribed',
    message: `You won't receive marketing emails from CourtDraw anymore. Account and billing emails you trigger yourself (like password resets) are unaffected.`,
  });
};
