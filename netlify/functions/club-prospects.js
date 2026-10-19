/**
 * club-prospects.js — read-only. Which organisations are already using
 * CourtDraw with several coaches, and paying nothing for it?
 *
 * The Club tier has exactly one customer, so there is no pattern to learn
 * from. This endpoint goes the other way round: instead of guessing who
 * might buy Club, it finds the accounts already *behaving* like a club.
 *
 * Two signals, in descending order of how much they actually tell you:
 *
 *   1. SHARED DOMAIN — two or more accounts on the same non-consumer email
 *      domain. This is not an inference. Several people at one organisation
 *      registered separately, which is exactly the situation the Club tier
 *      exists for, and each is sitting on a one-court free plan instead.
 *      Strongest lead in the dataset.
 *
 *   2. LONE ORGANISATION DOMAIN — a single account whose domain is not a
 *      consumer mailbox provider. Suggestive, nothing more: it catches real
 *      clubs, and it also catches freelancers, teachers and anyone with a
 *      vanity domain. Treat as a maybe, and ask rather than assert.
 *
 * DOMAINS ONLY. The report deliberately never returns a user's email
 * address or uid. The actionable unit here is the organisation, not the
 * person: a domain with three accounts on it is approached through the
 * club's own published contact address, and "several of your coaches
 * already use this" is a stronger Club pitch than emailing one of them.
 * Keeping mailboxes out of the response means this report can be pulled,
 * pasted and forwarded without moving anyone's personal data around.
 *
 * Auth: header x-internal-secret ONLY.
 *
 * Deliberately no ?secret= fallback, unlike user-activation-stats. A secret
 * in a query string lands in browser history and in the function's access
 * logs, and this one is shared with the email senders.
 *
 *   printf 'secret: '; read -rs S; echo
 *   curl -sS -H "x-internal-secret: $S" \
 *     https://courtdraw.app/.netlify/functions/club-prospects
 *   unset S
 *
 * READ ONLY — never writes to Firestore or Auth.
 *
 * Firestore fields read (all written by the app, see courtdraw-app.html):
 *   plan             — 'free' | 'pro' | 'club'
 *   recentActivity[] — {name, sport, savedAt}, appended by __trackPlaySaved
 *
 * Caveat worth remembering when reading the sports column: free users'
 * saves have only been tracked since the Pro/Club gate came off
 * __trackPlaySaved. An older free account can be a heavy user and still
 * show zero saves, so absence of activity here is not evidence of absence.
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

/**
 * Mailbox providers an individual uses. A domain on this list says nothing
 * about where its owner coaches, so those accounts are never prospects.
 *
 * Weighted towards CourtDraw's actual markets: the Hungarian (freemail,
 * citromail, indamail), French (orange, wanadoo, laposte), Czech (seznam,
 * centrum) and Slovak (azet) providers matter as much as the global ones,
 * and leaving them out would file half of Europe as an organisation.
 */
const CONSUMER_DOMAINS = new Set([
  'gmail.com', 'googlemail.com',
  'outlook.com', 'outlook.fr', 'outlook.de', 'outlook.es', 'outlook.it',
  'outlook.hu', 'hotmail.com', 'hotmail.co.uk', 'hotmail.fr', 'hotmail.it',
  'hotmail.es', 'hotmail.de', 'live.com', 'live.co.uk', 'msn.com',
  'yahoo.com', 'yahoo.co.uk', 'yahoo.fr', 'yahoo.de', 'yahoo.it',
  'yahoo.es', 'yahoo.ie', 'ymail.com', 'rocketmail.com',
  'icloud.com', 'me.com', 'mac.com',
  'aol.com', 'mail.com', 'gmx.com', 'gmx.de', 'gmx.net', 'gmx.at',
  'web.de', 't-online.de', 'zoho.com',
  'proton.me', 'protonmail.com', 'pm.me', 'tutanota.com',
  'freemail.hu', 'citromail.hu', 'indamail.hu', 'vipmail.hu',
  't-online.hu', 'upcmail.hu',
  'orange.fr', 'wanadoo.fr', 'free.fr', 'laposte.net', 'sfr.fr',
  'bbox.fr', 'numericable.fr',
  'seznam.cz', 'centrum.cz', 'volny.cz', 'azet.sk', 'centrum.sk',
  'libero.it', 'virgilio.it', 'tiscali.it', 'alice.it',
  'eircom.net', 'btinternet.com', 'btconnect.com', 'sky.com',
  'yandex.ru', 'mail.ru', 'qq.com', '163.com', 'naver.com'
]);

function domainOf(email) {
  if (typeof email !== 'string') return null;
  const at = email.lastIndexOf('@');
  if (at < 1 || at === email.length - 1) return null;
  return email.slice(at + 1).toLowerCase();
}

/** Distinct sports an account has saved plays in, most recent first. */
function sportsOf(data) {
  const activity = Array.isArray(data && data.recentActivity) ? data.recentActivity : [];
  const seen = new Map();
  for (const entry of activity) {
    if (!entry || typeof entry.sport !== 'string' || !entry.sport) continue;
    const at = typeof entry.savedAt === 'number' ? entry.savedAt : 0;
    if (!seen.has(entry.sport) || at > seen.get(entry.sport)) seen.set(entry.sport, at);
  }
  return [...seen.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([sport]) => sport);
}

exports.handler = async (event) => {
  const secret = process.env.INTERNAL_SECRET;
  const provided = (event.headers || {})['x-internal-secret'];
  if (!secret || provided !== secret) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  // Accumulated per domain as accounts are scanned, so no list of
  // individual accounts is ever built.
  const domains = new Map();
  const scanned = { accounts: 0, withUserDoc: 0, unparseableEmail: 0 };

  try {
    let pageToken;
    do {
      const result = await admin.auth().listUsers(1000, pageToken);
      pageToken = result.pageToken;

      for (const user of result.users) {
        scanned.accounts++;

        const domain = domainOf(user.email);
        if (!domain) { scanned.unparseableEmail++; continue; }

        let data = null;
        try {
          const snap = await db.collection('users').doc(user.uid).get();
          if (snap.exists) { data = snap.data(); scanned.withUserDoc++; }
        } catch (e) {
          // A single unreadable doc must not cost the whole report. The
          // account still counts, on its Auth record alone.
          console.warn(`Firestore read failed for ${user.uid}: ${e.message}`);
        }

        const plan = data && (data.plan === 'pro' || data.plan === 'club')
          ? data.plan
          : 'free';
        const saves = Array.isArray(data && data.recentActivity)
          ? data.recentActivity.length
          : 0;
        const signedUpAt = user.metadata && user.metadata.creationTime
          ? new Date(user.metadata.creationTime).toISOString().slice(0, 10)
          : null;

        if (!domains.has(domain)) {
          domains.set(domain, {
            domain, accounts: 0, paying: 0, hasClub: false,
            totalSaves: 0, activeAccounts: 0,
            sports: new Set(), firstSignup: null, lastSignup: null
          });
        }
        const d = domains.get(domain);
        d.accounts++;
        if (plan !== 'free') d.paying++;
        if (plan === 'club') d.hasClub = true;
        d.totalSaves += saves;
        if (saves > 0) d.activeAccounts++;
        for (const sport of sportsOf(data)) d.sports.add(sport);
        if (signedUpAt) {
          if (!d.firstSignup || signedUpAt < d.firstSignup) d.firstSignup = signedUpAt;
          if (!d.lastSignup  || signedUpAt > d.lastSignup)  d.lastSignup  = signedUpAt;
        }
      }
    } while (pageToken);
  } catch (err) {
    console.error('club-prospects failed:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }

  const sharedDomains = [];
  const loneOrgDomains = [];

  for (const d of domains.values()) {
    if (CONSUMER_DOMAINS.has(d.domain)) continue;

    // A domain that already has a paying Club account is not a prospect —
    // it is a customer, and sending it a Club pitch would be a mistake.
    if (d.hasClub) continue;

    const entry = {
      domain:         d.domain,
      accounts:       d.accounts,
      paying:         d.paying,
      activeAccounts: d.activeAccounts,
      totalSaves:     d.totalSaves,
      sports:         [...d.sports],
      firstSignup:    d.firstSignup,
      lastSignup:     d.lastSignup
    };

    if (d.accounts >= 2) sharedDomains.push(entry);
    else                 loneOrgDomains.push(entry);
  }

  // Most accounts first, then most engaged — the order to work the list in.
  sharedDomains.sort((a, b) => b.accounts - a.accounts || b.totalSaves - a.totalSaves);
  loneOrgDomains.sort((a, b) => b.totalSaves - a.totalSaves);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      generatedAt: new Date().toISOString(),
      scanned,
      summary: {
        distinctDomains:   domains.size,
        sharedOrgDomains:  sharedDomains.length,
        sharedOrgAccounts: sharedDomains.reduce((n, e) => n + e.accounts, 0),
        loneOrgDomains:    loneOrgDomains.length
      },
      // Strongest signal: several people at one organisation, none on Club.
      sharedDomains,
      // Suggestive only. Ask whether they coach with others; never assume.
      loneOrgDomains
    }, null, 2)
  };
};
