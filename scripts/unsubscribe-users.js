/**
 * unsubscribe-users.js
 * One-off admin script: marks one or more users as unsubscribed from
 * marketing emails (drip, weekly digest, re-engagement, broadcasts).
 * Transactional emails (welcome, payment, password reset) are unaffected.
 *
 * Usage:
 *   node scripts/unsubscribe-users.js coach1@example.com coach2@example.com
 *
 * Or with a .env file at the repo root:
 *   node -r dotenv/config scripts/unsubscribe-users.js coach1@example.com
 *
 * Requires FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 * (same service account used by the Netlify functions).
 */

'use strict';

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

async function main() {
  const emails = process.argv.slice(2).map(e => e.trim().toLowerCase()).filter(Boolean);
  if (emails.length === 0) {
    console.error('Usage: node scripts/unsubscribe-users.js <email> [email...]');
    process.exit(1);
  }

  for (const email of emails) {
    try {
      const user = await admin.auth().getUserByEmail(email);
      await db.collection('users').doc(user.uid).set(
        { unsubscribed: true, unsubscribedAt: Date.now() },
        { merge: true }
      );
      console.log(`✅ Unsubscribed ${email} (${user.uid})`);
    } catch (err) {
      console.error(`❌ ${email}: ${err.message}`);
    }
  }

  process.exit(0);
}

main();
