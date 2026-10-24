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
  'yandex.ru', 'mail.ru', 'qq.com', '163.com', 'naver.com',
  // Added after the first real run reported gmx.ch and home.nl as
  // organisations. GMX sells the same mailbox under a different country
  // code, and home.nl is a Dutch consumer ISP — the list was written from
  // the global providers and missed the national ones underneath them.
  'gmx.ch', 'gmx.fr', 'gmx.es', 'gmx.co.uk',
  'home.nl', 'ziggo.nl', 'kpnmail.nl', 'planet.nl', 'xs4all.nl',
  'telenet.be', 'skynet.be', 'proximus.be',
  'bluewin.ch', 'sunrise.ch', 'hispeed.ch',
  'chello.at', 'a1.net', 'aon.at',
  'telia.com', 'online.no', 'broadpark.no',
  'tin.it', 'fastwebnet.it', 'terra.es', 'telefonica.net',
  'sapo.pt', 'bol.com.br', 'uol.com.br'
]);

/**
 * Throwaway mailbox services. Two accounts on the same disposable domain
 * look exactly like two coaches at the same club and mean nothing at all;
 * the first real run's only "shared organisation" was yopmail.com. They are
 * counted so the number stays visible rather than silently discarded.
 */
const DISPOSABLE_DOMAINS = new Set([
  'yopmail.com', 'yopmail.fr', 'yopmail.net',
  'mailinator.com', 'guerrillamail.com', 'sharklasers.com',
  '10minutemail.com', 'tempmail.com', 'temp-mail.org', 'throwawaymail.com',
  'trashmail.com', 'getnada.com', 'dispostable.com', 'maildrop.cc',
  'fakeinbox.com', 'mintemail.com', 'spamgourmet.com', 'mailnesia.com'
]);

/**
 * Our own domains. A test account and a colleague's address are not leads,
 * and seeing them listed as prospects wastes the reader's attention on the
 * two entries they already know about.
 */
const OWN_DOMAINS = new Set([
  'courtdraw.app',
  'musketastenisz.hu'
]);

/**
 * Schools and universities, which the first run showed to be half of every
 * organisation-looking domain — and nobody went looking for them. They are
 * a different sale from a sports club: several teachers, one budget holder,
 * a purchasing process that treats EUR 99 a year as a rounding error, and a
 * school year that renews itself.
 *
 * Detection is by address shape only, so it UNDER-COUNTS and is meant to:
 * plenty of schools own an ordinary domain (a district board, an academy,
 * a prep school) and cannot be told apart from a company without a name
 * list, which would go stale faster than it helped. Anything it misses
 * simply stays in the organisation bucket, where it was before.
 */
function looksEducational(domain) {
  return /(^|\.)(edu|ac)\.[a-z.]{2,}$/.test(domain)   // edu.au, ac.uk, edu.hk
      || /\.edu$/.test(domain)                        // umich.edu
      || /(^|\.)sch\.[a-z.]{2,}$/.test(domain)        // sch.uk and friends
      || /k12/.test(domain)                           // cpsk12.org
      || /(^|\.)(uni|univ)[a-z-]*\.[a-z.]{2,}$/.test(domain);
}

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
  const educationDomains = [];
  const loneOrgDomains = [];
  const excluded = { consumer: 0, disposable: 0, own: 0, alreadyClub: 0 };

  for (const d of domains.values()) {
    if (CONSUMER_DOMAINS.has(d.domain))   { excluded.consumer++;   continue; }
    if (DISPOSABLE_DOMAINS.has(d.domain)) { excluded.disposable++; continue; }
    if (OWN_DOMAINS.has(d.domain))        { excluded.own++;        continue; }

    // A domain that already has a paying Club account is not a prospect —
    // it is a customer, and sending it a Club pitch would be a mistake.
    if (d.hasClub) { excluded.alreadyClub++; continue; }

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

    // Several accounts at one organisation stays the strongest signal there
    // is, school or not, so that test comes first.
    if (d.accounts >= 2)              sharedDomains.push(entry);
    else if (looksEducational(d.domain)) educationDomains.push(entry);
    else                              loneOrgDomains.push(entry);
  }

  // Most accounts first, then most engaged — the order to work the list in.
  sharedDomains.sort((a, b) => b.accounts - a.accounts || b.totalSaves - a.totalSaves);
  educationDomains.sort((a, b) => b.totalSaves - a.totalSaves);
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
        educationDomains:  educationDomains.length,
        loneOrgDomains:    loneOrgDomains.length
      },
      // Why a domain was left out, so an empty report can be read as
      // "nobody qualified" rather than "something went wrong".
      excluded,
      // Strongest signal: several people at one organisation, none on Club.
      sharedDomains,
      // Schools and universities. Detected by address shape, so this
      // under-counts — a district board or an academy on an ordinary
      // domain stays in loneOrgDomains below.
      educationDomains,
      // Suggestive only. Ask whether they coach with others; never assume.
      loneOrgDomains
    }, null, 2)
  };
};
