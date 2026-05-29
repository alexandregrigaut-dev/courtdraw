/**
 * drip-emails.js — Netlify Scheduled Function
 * Runs daily at 09:00 UTC.
 * Sends Day 2, Day 5, Day 10 drip emails to free users.
 *
 * Logic:
 *  1. List all Firebase Auth users (paginated)
 *  2. For each user created exactly 2, 5, or 10 days ago (±12h window):
 *     a. Check Firestore: plan must be 'free' (or missing)
 *     b. Check dripEmailsSent array: don't re-send the same day
 *     c. Send the email via the internal send-email function
 *     d. Update dripEmailsSent in Firestore
 */

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

const DRIP_DAYS = [2, 5, 10];
const DAY_MS    = 24 * 60 * 60 * 1000;
const WINDOW_MS = 12 * 60 * 60 * 1000; // ±12h tolerance so a run slightly early/late still fires

async function sendDrip(email, template) {
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.INTERNAL_SECRET) headers['x-internal-secret'] = process.env.INTERNAL_SECRET;
  const res = await fetch(`${process.env.PUBLIC_URL}/.netlify/functions/send-email`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ template, email })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`send-email failed (${res.status}): ${body}`);
  }
}

exports.handler = async () => {
  const now = Date.now();
  let processed = 0, sent = 0, skipped = 0;

  try {
    // Paginate through all Firebase Auth users
    let pageToken;
    do {
      const result = await admin.auth().listUsers(1000, pageToken);
      pageToken = result.pageToken;

      for (const user of result.users) {
        if (!user.email) continue; // no email — can't send
        processed++;

        const createdMs = new Date(user.metadata.creationTime).getTime();
        const ageDays   = (now - createdMs) / DAY_MS;

        // Find which drip day this user is on (within ±12h window)
        const matchDay = DRIP_DAYS.find(d => Math.abs(ageDays - d) * DAY_MS < WINDOW_MS);
        if (!matchDay) { skipped++; continue; }

        // Check Firestore for plan and already-sent drips
        let userDoc;
        try {
          userDoc = await db.collection('users').doc(user.uid).get();
        } catch (e) {
          console.warn(`Could not read Firestore for ${user.uid}:`, e.message);
          skipped++; continue;
        }

        const data             = userDoc.exists ? userDoc.data() : {};
        const plan             = data.plan || 'free';
        const dripEmailsSent   = Array.isArray(data.dripEmailsSent) ? data.dripEmailsSent : [];

        // Only send to free users who haven't received this drip yet
        if (plan !== 'free') { skipped++; continue; }
        if (dripEmailsSent.includes(matchDay)) { skipped++; continue; }

        const template = `dripDay${matchDay}`;
        try {
          await sendDrip(user.email, template);
          await db.collection('users').doc(user.uid).set(
            { dripEmailsSent: [...dripEmailsSent, matchDay] },
            { merge: true }
          );
          sent++;
          console.log(`Sent ${template} to ${user.email}`);
        } catch (e) {
          console.error(`Failed to send ${template} to ${user.email}:`, e.message);
        }
      }
    } while (pageToken);

    console.log(`Drip run complete. Processed: ${processed}, Sent: ${sent}, Skipped: ${skipped}`);
    return { statusCode: 200, body: JSON.stringify({ processed, sent, skipped }) };
  } catch (err) {
    console.error('Drip function error:', err.message);
    return { statusCode: 500, body: err.message };
  }
};
