/**
 * send-test-email.js — One-off deliverability diagnostic.
 *
 * Sends a single copy of the androidTesterInvite template — the exact
 * template that showed 0 opens / 0 clicks across 67 delivered sends — to a
 * single hardcoded recipient, so the actual inbox placement (Inbox / Spam /
 * Promotions) can be checked directly.
 *
 * Trigger by visiting a URL (GET) — no curl/terminal needed:
 *   https://courtdraw.app/.netlify/functions/send-test-email?secret=YOUR_INTERNAL_SECRET
 *
 * The recipient is hardcoded (not a query param) so this endpoint can't be
 * used as an open mail-relay to spam arbitrary addresses.
 *
 * This is a one-off diagnostic tool, not part of the regular email system —
 * delete this file once the deliverability question is answered.
 */

const RECIPIENT = 'alexandre.grigaut@gmail.com';

exports.handler = async (event) => {
  const secret = process.env.INTERNAL_SECRET;
  const authorized = !!secret && event.queryStringParameters?.secret === secret;
  if (!authorized) return { statusCode: 401, body: 'Unauthorized' };

  const appUrl = process.env.PUBLIC_URL || 'https://courtdraw.app';

  try {
    const res = await fetch(`${appUrl}/.netlify/functions/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': secret,
      },
      body: JSON.stringify({ template: 'androidTesterInvite', email: RECIPIENT }),
    });

    const body = await res.text();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sentTo: RECIPIENT,
        sendEmailStatus: res.status,
        sendEmailResponse: body,
      }, null, 2),
    };
  } catch (err) {
    return { statusCode: 500, body: `Fatal: ${err.message}` };
  }
};
