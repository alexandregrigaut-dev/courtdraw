// Server-side GA4 events (Measurement Protocol).
// Import with: const { sendGa4Event } = require('./_ga4');
//
// Why this exists
// ---------------
// Every plan is sold as a 7-day trial with the card taken up front, so the
// browser moment that success.html calls a conversion is the start of a trial,
// not a sale. The sale happens seven days later when Stripe charges the card —
// server-side, with nobody's browser open. There is no page on which a gtag
// call could fire, so GA4 saw no revenue at all and reported $0.00 lifetime.
//
// success.html did carry a 'purchase' branch, but it sat behind `if (isTrial)
// … else …`, and isTrial is true for every plan the server will sell. It was
// unreachable from the day it was written.
//
// The Measurement Protocol is the supported way to report an event that
// happens off-browser. It needs the GA4 client id of the original visit to
// attribute the sale to the session that produced it, which is why the id is
// collected at checkout and stored on the user record.
//
// Nothing here is allowed to fail a webhook: a dropped analytics event costs a
// row in a report, while a thrown error costs a customer their access.

const GA4_MEASUREMENT_ID = process.env.GA4_MEASUREMENT_ID || 'G-9NZSFKFV1N';
const GA4_ENDPOINT = 'https://www.google-analytics.com/mp/collect';

// A GA4 client id is two dot-separated integers (e.g. "1234567890.1234567890").
// Anything else came from a tampered or malformed cookie and is not worth
// sending — GA4 would silently drop the event anyway.
function isValidClientId(id) {
  return typeof id === 'string' && /^\d+\.\d+$/.test(id) && id.length <= 64;
}

// Fire-and-forget. Returns true only if GA4 accepted the request, so callers
// can log the outcome, but never throws and never rejects.
async function sendGa4Event(clientId, name, params) {
  const secret = process.env.GA4_API_SECRET;
  if (!secret) {
    // Not configured — expected until the secret is set in Netlify. Logged
    // once per event rather than silently, so a missing secret is findable.
    console.warn('[ga4] GA4_API_SECRET not set; skipping', name);
    return false;
  }
  if (!isValidClientId(clientId)) {
    // No usable client id: the visitor blocked GA4, declined consent, or
    // checked out before the cookie was written. The sale still happened; it
    // just cannot be tied to a session.
    console.warn('[ga4] no usable client id; skipping', name);
    return false;
  }

  try {
    const res = await fetch(
      `${GA4_ENDPOINT}?measurement_id=${encodeURIComponent(GA4_MEASUREMENT_ID)}&api_secret=${encodeURIComponent(secret)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          // Without this GA4 timestamps the event on arrival, which is correct
          // here: the charge is happening now, not when the trial started.
          events: [{ name, params }],
        }),
      }
    );
    // The Measurement Protocol returns 2xx with an empty body on success and
    // does NOT report validation errors — a malformed event is accepted and
    // then discarded. So a true here means "GA4 took it", not "GA4 kept it".
    if (!res.ok) {
      console.error('[ga4] rejected', name, res.status);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[ga4] send failed:', e.message);
    return false;
  }
}

module.exports = { sendGa4Event, isValidClientId, GA4_MEASUREMENT_ID };
