/**
 * seed-community-plays.js
 * One-time script: seeds the 200+ CourtDraw Team tactics from tactics-library.js
 * into the Firestore communityPlays collection.
 *
 * Idempotent — uses each tactic's existing `id` as the Firestore doc ID.
 * Re-running will update existing docs (safe).
 *
 * Usage:
 *   FIREBASE_PROJECT_ID=xxx \
 *   FIREBASE_CLIENT_EMAIL=yyy \
 *   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..." \
 *   node scripts/seed-community-plays.js
 *
 * Or with a .env file at the repo root:
 *   node -r dotenv/config scripts/seed-community-plays.js
 */

'use strict';

// Mock browser global so tactics-library.js can be required in Node
global.window = {};
require('../tactics-library.js');
const tactics = global.window.TACTICS_LIBRARY;

if (!Array.isArray(tactics) || tactics.length === 0) {
  console.error('❌ Could not load TACTICS_LIBRARY from tactics-library.js');
  process.exit(1);
}

const admin = require('firebase-admin');

if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
  console.error('❌ Missing Firebase env vars. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

// Map tactics-library category → tacticType used by publish-community-play.js
const CAT_TO_TYPE = {
  'Offense':    'offensive',
  'Defense':    'defensive',
  'Set Play':   'set_play',
  'Transition': 'transition',
  'Drill':      'other',
  'Formation':  'other',
  'Serve':      'offensive',
  '':           'other',
};

// Seed saveCount: free-tier plays get slightly more to surface them first on the public page
function seedSaveCount(tier) {
  return tier === 'free' ? 12 : 8;
}

// Fixed past publishedAt so user-published plays (newer) naturally appear first
const SEED_DATE = new Date('2026-01-01T00:00:00Z');

async function seed() {
  console.log(`📦 Loaded ${tactics.length} tactics from tactics-library.js`);

  const BATCH_SIZE = 400; // Firestore batch limit is 500
  let written = 0;
  let skipped = 0;

  for (let i = 0; i < tactics.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = tactics.slice(i, i + BATCH_SIZE);

    for (const t of chunk) {
      if (!t.id || !t.courtId || !t.sport) {
        console.warn(`  ⚠ Skipping malformed tactic: ${JSON.stringify(t).substring(0, 80)}`);
        skipped++;
        continue;
      }

      const tacticType = CAT_TO_TYPE[t.category] ?? 'other';
      const docRef = db.collection('communityPlays').doc(t.id);

      batch.set(docRef, {
        name:         t.name         || '',
        courtId:      t.courtId      || '',
        sport:        t.sport        || '',
        category:     t.category     || '',
        tacticType,
        ageGroup:     '',
        authorUid:    'courtdraw-team',
        authorName:   'CourtDraw Team',
        publishedAt:  admin.firestore.Timestamp.fromDate(SEED_DATE),
        isClubOnly:   false,
        plan:         t.tier === 'free' ? 'free' : 'pro',
        saveCount:    seedSaveCount(t.tier),
        objectsJson:  JSON.stringify(t.objects  || []),
        tokensJson:   JSON.stringify(t.tokens   || []),
        phasesJson:   JSON.stringify(t.phases   || []),
        currentPhase: 0,
        seeded:       true, // flag so we can identify template docs
      }, { merge: false }); // overwrite cleanly on re-run

      written++;
    }

    await batch.commit();
    console.log(`  ✓ Committed batch ${Math.ceil((i + BATCH_SIZE) / BATCH_SIZE)} (${Math.min(i + BATCH_SIZE, tactics.length)}/${tactics.length})`);
  }

  console.log(`\n✅ Done. Written: ${written}, Skipped: ${skipped}`);
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seeding failed:', err.message);
  process.exit(1);
});
