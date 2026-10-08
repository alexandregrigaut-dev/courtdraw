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

// The Measurement Protocol answers 2xx for a malformed event and then discards
// it. There is no validation in the response, so a broken payload looks exactly
// like no sales having happened — silence either way, and nothing to tell them
// apart. The debug endpoint is the only thing that will say what is wrong with
// a payload, so GA4_DEBUG sends a second, parallel copy there purely to have
// Google's verdict written into the function logs.
const GA4_DEBUG_ENDPOINT = 'https://www.google-analytics.com/debug/mp/collect';

// Off unless explicitly switched on. Setting GA4_DEBUG=0 or =false in Netlify
// turns it off, which is what someone typing either of those means — a bare
// truthiness check would read both as on, since they are non-empty strings.
function debugEnabled() {
  const v = String(process.env.GA4_DEBUG || '').trim().toLowerCase();
  return v !== '' && v !== '0' && v !== 'false' && v !== 'off' && v !== 'no';
}

// Ask the debug endpoint what it makes of this payload and write the answer to
// the logs. Diagnostic only: it records nothing, returns nothing, and is not
// allowed to affect the send that has already happened or the caller's result.
async function logPayloadValidation(url, body) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    const text = await res.text();
    let messages = [];
    try { messages = JSON.parse(text).validationMessages || []; } catch (e) { /* not JSON */ }
    if (!messages.length) {
      console.log('[ga4][debug] payload validated clean — GA4 will keep this event');
    } else {
      for (const m of messages) {
        console.error(
          `[ga4][debug] INVALID ${m.fieldPath || '(payload)'}: ${m.description || text}` +
          (m.validationCode ? ` [${m.validationCode}]` : '')
        );
      }
    }
  } catch (e) {
    console.error('[ga4][debug] validation call failed:', e.message);
  }
}

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

  // Built once so the validation call below checks the exact bytes that were
  // sent, not a second copy that might differ.
  const payload = JSON.stringify({
    client_id: clientId,
    // Without this GA4 timestamps the event on arrival, which is correct here:
    // the charge is happening now, not when the trial started.
    events: [{ name, params }],
  });

  try {
    const res = await fetch(
      `${GA4_ENDPOINT}?measurement_id=${encodeURIComponent(GA4_MEASUREMENT_ID)}&api_secret=${encodeURIComponent(secret)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      }
    );
    // The Measurement Protocol returns 2xx with an empty body on success and
    // does NOT report validation errors — a malformed event is accepted and
    // then discarded. So a true here means "GA4 took it", not "GA4 kept it".
    if (!res.ok) {
      console.error('[ga4] rejected', name, res.status);
      return false;
    }

    // Only after the real send has gone through, and only when asked. The
    // payload sent above is deliberately left untouched — no debug_mode flag
    // on the recorded event, so what GA4 stores is exactly what it would store
    // with this switched off.
    if (debugEnabled()) {
      await logPayloadValidation(
        `${GA4_DEBUG_ENDPOINT}?measurement_id=${encodeURIComponent(GA4_MEASUREMENT_ID)}&api_secret=${encodeURIComponent(secret)}`,
        payload
      );
    }
    return true;
  } catch (e) {
    console.error('[ga4] send failed:', e.message);
    return false;
  }
}

module.exports = { sendGa4Event, isValidClientId, debugEnabled, GA4_MEASUREMENT_ID };
