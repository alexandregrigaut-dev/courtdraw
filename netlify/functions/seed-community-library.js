/**
 * seed-community-library.js — One-time admin function.
 * Seeds all CourtDraw Team tactics from tactics-library.js into communityPlays.
 * Idempotent — uses each tactic's id as the Firestore doc ID.
 *
 * Call once: GET https://courtdraw.app/api/seed-community-library?token=SEED2026
 * Delete this file after the seed is confirmed.
 */

const tactics = require('./_tactics-data');

const { db } = require('./_admin-init');
const admin   = require('firebase-admin');

const SEED_TOKEN = 'SEED2026';

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

const SEED_DATE = new Date('2026-01-01T00:00:00Z');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const token = new URLSearchParams(event.rawQuery || '').get('token');
  if (token !== SEED_TOKEN) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  if (!Array.isArray(tactics) || tactics.length === 0) {
    return { statusCode: 500, body: 'Could not load TACTICS_LIBRARY' };
  }

  let written = 0, skipped = 0;
  const BATCH_SIZE = 400;

  try {
    for (let i = 0; i < tactics.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = tactics.slice(i, i + BATCH_SIZE);

      for (const t of chunk) {
        if (!t.id || !t.courtId || !t.sport) { skipped++; continue; }
        const docRef = db.collection('communityPlays').doc(t.id);
        batch.set(docRef, {
          name:         t.name        || '',
          courtId:      t.courtId     || '',
          sport:        t.sport       || '',
          category:     t.category    || '',
          tacticType:   CAT_TO_TYPE[t.category] ?? 'other',
          ageGroup:     '',
          authorUid:    'courtdraw-team',
          authorName:   'CourtDraw Team',
          publishedAt:  admin.firestore.Timestamp.fromDate(SEED_DATE),
          isClubOnly:   false,
          plan:         t.tier === 'free' ? 'free' : 'pro',
          saveCount:    t.tier === 'free' ? 12 : 8,
          objectsJson:  JSON.stringify(t.objects  || []),
          tokensJson:   JSON.stringify(t.tokens   || []),
          phasesJson:   JSON.stringify(t.phases   || []),
          currentPhase: 0,
          seeded:       true,
        }, { merge: false });
        written++;
      }

      await batch.commit();
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, written, skipped }),
    };

  } catch (err) {
    console.error('Seed error:', err);
    return { statusCode: 500, body: 'Seed failed: ' + err.message };
  }
};
