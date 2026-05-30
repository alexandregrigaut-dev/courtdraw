# CourtDraw — Project Context

> **Single source of truth for new Claude Code sessions.**
> Last stable commit: `7b46d32` — "Fix 9 inaccurate court thumbnail icons" (2026-05-29 21:00)

---

## 1. Project Overview

CourtDraw is a **sports coaching tactics board PWA** deployed at [courtdraw.app](https://courtdraw.app). It lets coaches draw plays, position players, animate phases, and share tactics for 38+ sports. Built as a solo side project, monetised via Stripe with Free / Pro / Club tiers.

**Core value proposition:** No download, no account needed to start. Works on any device including iPad and iPhone. Coaches can draw a play in 30 seconds and share a link.

**Business model:**
- **Free** — 1 locked-in sport court, 3 saved plays, PNG export with watermark
- **Pro** — All 38+ courts, unlimited saves, clean PNG/PDF export, phase animation, video overlay, share links, session builder. €6/mo or €49/yr, 7-day free trial.
- **Club** — Everything in Pro + shared library, club branding on exports, up to 10 coaches, admin dashboard. €99/yr, 7-day free trial.

---

## 2. Architecture & Tech Stack

### Why this stack

The entire app is **intentionally a single-file PWA with no build step**. This was a deliberate decision: no webpack, no bundler, no framework, no node_modules on the frontend. The only `package.json` is for Netlify Functions (backend). This keeps iteration extremely fast — edit one file, push, it's live in ~30 seconds.

### Frontend
- **`courtdraw-app.html`** — ~6,300 lines. The entire app: HTML structure, all CSS, all JavaScript. Vanilla JS. No framework.
- **`index.html`** — ~2,000 lines. Marketing landing page. Also vanilla HTML/CSS/JS with Firebase auth for nav state.
- **`login.html`** — Auth page. Uses ES modules + Firebase SDK via `importmap`.
- **`src/sports-config.js`** — ES module. Default player token positions for all 38 sports. Loaded via `<link rel="modulepreload">` so it's always ready.
- **`src/firebase.js`** — Firebase app init (client-side config).
- **`src/auth.js`** — registerUser, loginUser, logoutUser, resetPassword, getUserPlan.
- **`tactics-library.js`** — Pre-built tactic templates (network-first in SW, never cached stale).
- Drawing is done on an **HTML5 Canvas** overlaid on SVG court artwork.
- Player tokens are **absolutely-positioned DOM divs** (`.player-token`) over the canvas, not drawn on canvas. This lets them be dragged with pointer events independently from drawings.

### Backend
- **Netlify Functions** (Node.js, CommonJS) at `netlify/functions/`
- **Firebase Auth** — email/password + Google OAuth
- **Firestore** — user documents (`users/{uid}`), club data, club tactics
- **Stripe** — Checkout, Billing Portal, Webhooks
- **Resend** — Transactional email (welcome, payment confirmed, payment failed, drip sequence)

### Hosting
- **Netlify** — static files + functions. Auto-deploys on push to `main`.
- Functions accessible via `/api/*` redirect → `/.netlify/functions/:splat`
- `www.courtdraw.app` → `courtdraw.app` (301 redirect in netlify.toml)

### PWA
- **`manifest.json`** — `start_url: "/courtdraw-app.html"`, standalone display, theme `#1d4ed8`
- **`sw.js`** — Cache name `courtdraw-v7`. HTML pages are **network-first** (always fetch fresh, fall back to cache offline). Static assets (icons, manifest) are **cache-first**. `tactics-library.js` is always network-first so new templates are never blocked by stale cache.

---

## 3. File Structure

```
courtdraw/
├── courtdraw-app.html          # The entire app (canvas, tools, modals, all JS)
├── index.html                  # Marketing landing page
├── login.html                  # Sign-in / create account page
├── club-admin.html             # Club owner dashboard
├── join-club.html              # Join a club via invite code
├── success.html                # Post-Stripe-checkout success page
├── privacy.html                # Privacy policy
├── terms.html                  # Terms of service
├── manifest.json               # PWA manifest
├── sw.js                       # Service worker (cache-v7)
├── tactics-library.js          # Pre-built play templates (network-first)
├── robots.txt
├── sitemap.xml
├── netlify.toml                # Build config, redirects, scheduled functions, security headers
├── package.json                # Backend deps only: stripe, firebase-admin, resend
├── .env.example                # All required env vars documented
│
├── assets/
│   ├── icons/
│   │   ├── icon.svg            # Favicon (SVG)
│   │   ├── icon-192.png        # PWA icon
│   │   └── icon-512.png        # PWA icon
│   ├── og-image.png            # Open Graph image (1200×630) — must be PNG not SVG
│   └── og-image.svg            # Source SVG
│
├── src/
│   ├── firebase.js             # Firebase init (client-side, keys are public by design)
│   ├── auth.js                 # Auth helpers (ES module)
│   └── sports-config.js        # Default player positions for all 38 sports (ES module)
│
└── netlify/functions/
    ├── create-checkout-session.js   # Stripe checkout session creation
    ├── create-portal-session.js     # Stripe billing portal
    ├── webhook.js                   # Stripe webhook → updates Firestore plan
    ├── send-email.js                # Resend email sender (all templates)
    ├── drip-emails.js               # Scheduled: daily 09:00 UTC, Day 2/5/10 nudges
    ├── _admin-init.js               # Shared Firebase Admin init helper
    ├── add-tactic-comment.js        # Club: add comment to shared tactic
    ├── delete-club-tactic.js        # Club: owner deletes a shared tactic
    ├── get-club-data.js             # Club: fetch full club data
    ├── get-club-info.js             # Club: basic info (name, logo, code)
    ├── get-club-members.js          # Club: member list
    ├── get-club-tactics.js          # Club: shared tactic library
    ├── get-tactic-comments.js       # Club: comments on a tactic
    ├── increment-tactic-views.js    # Club: view counter
    ├── join-by-code.js              # Club: join via 6-char code
    ├── join-club.js                 # Club: join flow
    ├── kick-club-member.js          # Club: owner removes a member
    ├── leave-club.js                # Club: member leaves
    ├── regenerate-club-code.js      # Club: owner resets join code
    ├── save-club-tactic.js          # Club: publish tactic to shared library
    ├── send-reset-email.js          # Password reset email
    ├── update-club-colors.js        # Club: update team colours
    ├── update-club-logo.js          # Club: update logo URL
    ├── update-club-name.js          # Club: update club name
    ├── upload-club-logo.js          # Club: logo upload to Firebase Storage
    └── webhook.js                   # Stripe webhook handler
```

---

## 4. Drawing System

### Canvas + Token architecture

The board has two layers:
1. **SVG** (`#court-svg`) — the court background artwork. Static, inline SVG.
2. **Canvas** (`#drawing-canvas`) — all drawn shapes (arrows, lines, zones, text). Positioned absolutely over the SVG.
3. **Token layer** (`#token-layer`) — absolutely-positioned `div.player-token` elements. Pointer-events enabled on tokens, none on the layer itself.

### Drawing tools
`state.tool` is set by toolbar buttons. Tools: `arrow`, `dash`, `line`, `arc-left`, `arc-right`, `circle`, `zone`, `text`, `eraser`, `select`.

Canvas pointer events (`pointerdown`/`pointermove`/`pointerup`) drive all drawing. Each shape is stored as an object in `state.objects[]`. On every frame `redrawAll()` clears and redraws all objects from state.

### Coordinate system
All drawn objects store coordinates as **normalised [0–1] fractions** of canvas dimensions. This means drawings scale correctly when the window resizes. Raw pixel coords are only used for rendering.

### Select tool
Shapes can be selected (tap), moved (drag), recoloured, or deleted. Selection uses hit-testing per shape type. Corner handles enable resize for boxes/zones.

### Player tokens
Tokens are DOM elements absolutely positioned using percentage-based `left`/`top` CSS. Their positions are stored in `state.tokenPositions[]` as `{id, team, label, pct: [x, y]}` where `pct` is [0–1] normalised to the court container. In portrait mode the court is rotated 90° CW — token positioning compensates for this with swapped axes.

### Phase animation
`state.phases` is an array of `{objects, tokens}` snapshots. The phase bar shows `Phase N / M`. `+ Phase` clones the current state as a new phase. Play button (`▶`) interpolates between phases with `requestAnimationFrame`. Pro-only feature.

---

## 5. State Management

All app state lives in the single `state` object (defined around line 2378 in `courtdraw-app.html`):

```js
const state = {
  tool: 'arrow',
  color: '#ef4444',
  lineWidth: 3,
  objects: [],           // drawn shapes on current phase
  tokenPositions: [],    // player token positions
  phases: null,          // array of phase snapshots (Pro)
  currentPhase: 0,
  savedTactics: [],      // user's tactic library
  savedSessions: [],     // session builder plays
  courtId: 'football_full',
  freeCourt: null,       // id of the one court free users get to keep
  isPro: false,
  isClub: false,
  isClubOwner: false,
  clubId: null,
  clubName: '',
  theme: 'dark',
  zoom: 1, panX: 0, panY: 0,
  portraitRotated: false,
  // ...
}
```

**Firebase resolves asynchronously.** On cold load `isPro = false` comes from localStorage. Once Firebase auth resolves, `window.__updatePro(isPro, isClub, ...)` is called from the Firebase module script, which updates `state` and all UI.

---

## 6. localStorage Keys

All keys are used in `courtdraw-app.html` unless noted:

| Key | Value | Purpose |
|-----|-------|---------|
| `courtdraw_tactics_<uid>` | JSON array | User's saved plays (scoped per Firebase UID) |
| `courtdraw_sessions_<uid>` | JSON array | User's session builder data |
| `courtdraw_tactics_guest` | JSON array | Pre-login saves (migrated on first sign-in) |
| `courtdraw_pro` | `'1'` / `'0'` | Cached plan state (pre-Firebase load FOUC prevention) |
| `courtdraw_free_court` | court id | The one court a free user has locked in |
| `courtdraw_club_name` | string | Cached club name |
| `courtdraw_theme` | `'dark'` / `'light'` | Theme preference |
| `courtdraw_color` | hex | Last-used drawing colour |
| `courtdraw_linewidth` | number | Last-used line width |
| `courtdraw_color_a` | hex | Team A colour |
| `courtdraw_color_b` | hex | Team B colour |
| `courtdraw_pending_checkout` | plan key | Checkout intent saved pre-login |
| `cd_welcomed` | `'1'` | Welcome overlay shown flag |
| `cd_nudge_shown` | `'1'` | Draw-nudge tooltip shown flag |
| `cd_first_draw_done` | `'1'` | User has drawn at least once |
| `cd_visit_count` | number | Visit counter for return-visitor banner |
| `cd_return_prompt_shown` | `'1'` | Return visitor banner shown flag |
| `pwa_banner_dismissed` | `'1'` | PWA install banner dismissed |
| `pwa_installed` | `'1'` | User installed the PWA |
| `toolbar_pinned` | `'1'` | Toolbar pin preference (persisted) |

**sessionStorage keys** (cleared on tab close):
- `cd_save_prompt_shown` — save-to-library prompt shown this session
- `cd_export_nudge_shown` — export nudge shown this session
- `cd_share_upsell_shown` — share upsell shown this session

---

## 7. Free vs Pro vs Club Gating

### Free tier limits
- **Courts:** One locked-in court (`state.freeCourt`) chosen on first selection. `whiteboard` is always free (`free: true`). All other 37 courts require Pro/Club.
- **Saves:** `FREE_SAVES = 3`. Counter shown on Save button. On hitting limit, paywall opens.
- **Exports:** PNG exports have watermark. PDF export is Pro-only.
- **Phase animation:** Pro-only (button shows `+ Phase 🔒`).
- **Share link:** Pro-only. Shown via `showFeaturePreview('share', ...)`.
- **Video overlay:** Pro-only.
- **Session builder:** Pro-only.
- **Clean export (no watermark):** Pro-only.

### How gating is enforced
1. Toolbar buttons have `pro-lock` CSS class added when free (subtle lock indicator).
2. Clicking gated buttons calls `showFeaturePreview(featureKey, paywallReason)` which shows a feature description modal with a "See pricing →" button that opens the paywall.
3. The paywall modal (`#modal-paywall`) shows all three plans with Stripe checkout buttons.
4. `startCheckout(planKey)` is called. If not logged in, saves intent to `courtdraw_pending_checkout` and redirects to `/login.html`. After login, `success.html` reads the pending key and triggers checkout.

### Stripe price IDs (hardcoded in client, verified server-side)
```js
const STRIPE_PRICES = {
  proMonthly: 'price_1TXcRlPJqd0y6tXmlReqKxZ5',
  proYearly:  'price_1TXcTWPJqd0y6tXmY0aJr80k',
  club:       'price_1TXcWHPJqd0y6tXmf0AclVdB'
}
```
Price IDs are also stored as Netlify env vars (`STRIPE_PRICE_ID_PRO_MONTHLY`, etc.) for the webhook handler to map back to plan names.

---

## 8. Auth Flow

### Login page (`login.html`)
- Uses `<script type="importmap">` to map Firebase SDK bare specifiers to CDN URLs (gstatic.com).
- Imports `loginUser`/`registerUser` from `/src/auth.js`.
- `window.handleSignin` / `window.handleSignup` are assigned inside the module script so they're accessible from `onsubmit="handleSignin(event)"`.
- **Critical pattern:** Forms use `onsubmit="handleSignin(event)"` + `type="submit"` buttons. The module-assigned functions call `e.preventDefault()` synchronously. Do NOT change this to a different event pattern — it caused breakage in the past.
- `rememberMe()` checks the "Stay signed in" checkbox — uses `browserLocalPersistence` (survives browser restart) or `browserSessionPersistence`.
- On success, `resolveRedirect(user)` reads Firestore plan and navigates to `/club-admin.html` (club owners) or `/` (everyone else).
- `onAuthStateChanged` auto-redirects if already logged in when page loads.

### App page auth
- A `<script type="module">` in `courtdraw-app.html` imports Firebase and calls `onAuthStateChanged`.
- On auth state change: calls `window.__updatePro(isPro, isClub, clubId, ...)` which updates `state` and all UI.
- `window.__currentUser` is set to the Firebase User object (or null).
- Club users: `state.isClub = true`. `state.isPro` may be false for Club members (only owners have the Stripe subscription, members are invited).

---

## 9. Mobile / Portrait Mode

This is the most complex UX system in the app. Read carefully before touching it.

### How portrait mode works
On phones in portrait (H > W × 1.1), the court SVG + canvas is **rotated 90° CW** using CSS `transform`. This makes the landscape court fill the full phone height. The header, toolbar, and phase bar become glass overlays.

- `state.portraitRotated` — set by `updatePortraitLayout()`, called from `syncCanvas()`.
- Body gets class `portrait-mode` when rotated.

### Chrome reveal (portrait)
In portrait mode, all chrome (header/toolbar/phase-bar) is **hidden by default** (translated off-screen). Revealed by:
1. Tapping the **three-dot hint** (`#pt-bottom-hint`) in the bottom-right corner.
2. Touching the top 60px (`TOP_ZONE`) or bottom 70px (`BOTTOM_ZONE`) of the viewport.
3. On first entry into portrait mode: auto-shows for 2.5 seconds.

The hint is positioned at `bottom: 14px; right: 16px` with `pointer-events: none`. It becomes invisible (`opacity: 0`) when chrome is visible.

When chrome is visible, body has class `pt-chrome-visible`. Chrome auto-hides after 3 seconds (`HIDE_DELAY`). The pin button (`#toolbar-pin-btn`) disables auto-hide.

`window._showPtChrome` and `window._showLsChrome` are exposed from the IIFEs so external code (e.g., the pin button) can trigger them.

### Chrome reveal (landscape mobile)
Same pattern but using `ls-chrome-visible` class and `isLandscapeMobile()` check (width ≤ 900 and width > height). Edge zones: top 55px, bottom 65px.

### Token coordinate transforms in portrait
When portrait-rotated, the canvas coordinate system is swapped. When placing or moving tokens in portrait, the code compensates:
- Screen-X maps to container-Y
- Screen-Y maps to container-X (inverted)
This is handled in pointer event handlers and in `repositionTokens()`.

### Key gotcha: `state.portraitRotated` vs body class
The touch handlers check `state.portraitRotated` (JS state), not the CSS class. Both should always be in sync after `syncCanvas()` runs, but `syncCanvas()` only runs after a 80ms+ delay via `afterReady()`. On fast first taps this can cause the portrait handler to miss. The solution is to check both: `state.portraitRotated || document.body.classList.contains('portrait-mode')`.

---

## 10. Courts System

38 sport courts + 1 whiteboard, all defined inline in `courtdraw-app.html` in the `COURTS` array (starting ~line 1680).

Each court has:
```js
{
  id: 'handball',
  name: 'Handball',
  category: 'indoor',   // 'racket' | 'indoor' | 'field' | 'ice' | 'beach' | 'other'
  free: false,          // only whiteboard has free: true
  svg: () => `<svg>...</svg>`,     // court artwork (SVG string)
  thumbnail: () => `<svg>...</svg>` // court picker thumbnail (smaller SVG)
}
```

Court SVG coordinate system: `viewBox="0 0 1000 600"` (landscape). All court artwork is drawn within this viewBox.

Default player tokens per sport are in `src/sports-config.js` as `SPORT_TOKENS[courtId]`. Token positions are `pct: [x, y]` normalised 0–1 over the viewBox. The module exports `__getDefaultTokens` which is called by the app after auth and module load.

**Free court logic:** When a free user first selects a non-free, non-whiteboard court, that court ID is saved to `state.freeCourt` and `localStorage('courtdraw_free_court')`. They can never switch to another non-free court without upgrading. If they try, the paywall opens.

---

## 11. Save / Library System

### Tactic save
`saveTactic()` saves the current board state as a tactic object:
```js
{
  id: Date.now(),       // unique ID (NOTE: no random suffix — ms collision possible at high frequency)
  name: string,
  ts: Date.now(),
  objects: [...],       // deep copy of drawn shapes
  tokens: [...],        // deep copy of token positions
  notes: string,        // coach notes (Pro feature, gated on focus)
  tags: string,         // comma-separated tags (Pro feature, gated on click)
  courtId: string,
  thumbnail: string     // base64 PNG thumbnail of the board
}
```

Saved to `localStorage[tacticsKey()]` where `tacticsKey()` returns `courtdraw_tactics_guest` (logged-out) or `courtdraw_tactics_<uid>` (logged in). On first Firebase auth resolution, guest tactics are migrated to the user-scoped key.

### Free tier save limit
`FREE_SAVES = 3`. On hitting the limit, paywall opens. Counter shown on Save button.

### Club library
Club members can publish tactics to the shared Firestore library via `save-club-tactic.js`. The library is fetched via `get-club-tactics.js`. Comments are stored in Firestore sub-collections.

---

## 12. Export System

### PNG export (`exportPNG()`)
1. Creates an offscreen canvas matching the visible board dimensions.
2. Draws court SVG as an image via `drawImage` (converts SVG to blob URL first).
3. Redraws all `state.objects` shapes onto the offscreen canvas.
4. Draws all player tokens.
5. For free users: draws a watermark overlay.
6. `canvas.toBlob()` → triggers download.

### PDF export (`exportPDF()`)
1. Opens a new window.
2. Renders the court + drawing as a high-res PNG.
3. Injects the PNG into the new window's HTML with `@media print` CSS.
4. Calls `window.print()` inside a `win.onload` handler (not a setTimeout) for reliability.
Pro-only feature.

### Share link (`shareBoard()`)
Serialises `state.objects`, `state.tokenPositions`, `state.phases`, `state.courtId`, and `state.teamColorA/B` as JSON → LZ-compressed → base64 → appended to URL as `#cd=<data>`. On load, `loadFromHash()` parses and restores.

Share links can get very long for complex boards. There is no enforced size limit on the current version (size guard was removed in a revert).

---

## 13. Email Templates

All emails sent via Resend through `send-email.js`. Templates defined in that file:

| Template key | When sent |
|---|---|
| `welcome` | On account creation (from login.html) |
| `payment_confirmed` | Stripe webhook: checkout.session.completed |
| `payment_failed` | Stripe webhook: invoice.payment_failed |
| `trial_ending` | Stripe webhook: customer.subscription.trial_will_end |
| `subscription_cancelled` | Stripe webhook: customer.subscription.deleted |
| `drip_day2` | Day 2 after signup (free users only) |
| `drip_day5` | Day 5 after signup (free users only) |
| `drip_day10` | Day 10 after signup (free users only) |

Drip emails are sent by the scheduled function `drip-emails.js` which runs daily at 09:00 UTC. It lists all Firebase Auth users, filters those created exactly 2/5/10 days ago (±12h window), checks plan is still free, checks `dripEmailsSent` array in Firestore to prevent duplicates.

**Internal auth for server-to-server email calls:** Server functions pass `x-internal-secret` header (env var `INTERNAL_SECRET`). Client-side calls (login.html welcome email) send a Firebase ID token in `Authorization: Bearer` header, restricted to `welcome` template only.

---

## 14. Engagement Features

### First-visit welcome overlay
`showWelcomeOverlay()` fires on cold load if `!localStorage('cd_welcomed')` and user is not signed in and no freeCourt is set. Shows a 3-step "Pick court → Draw → Share" guide. On dismiss: sets `cd_welcomed`, opens court picker.

### Draw nudge tooltip
Fires after court selection if user has never drawn (`!cd_first_draw_done`, `!cd_nudge_shown`). Points at the Arrow tool button.

### Return visitor banner
Fixed strip at top. Shows on 3rd visit (`cd_visit_count === 3`), only once (`cd_return_prompt_shown`), only for free non-Club users. Contains "Try Pro free →" CTA.

### Save prompt modal
Fires 12 seconds after first draw on the free tier if user is not signed in. Encourages account creation to save plays.

### Feature preview modal
When free user clicks a Pro-gated feature (share, export, session, video), `showFeaturePreview(key, reason)` shows a description modal. "See pricing →" opens the paywall. ✕ closes without redirect.
- Has animated progress bar that auto-advances to paywall after 2.6 seconds.
- Phase teaser: animated 3-phase preview that auto-redirects to paywall after the last phase.

### PWA install banner
Shows after 2 page loads if not already installed and not dismissed. On iOS shows instructions modal (Add to Home Screen flow). On Android/Chrome uses `beforeinstallprompt` event.

---

## 15. Known Bugs & Gotchas

### Portrait toolbar (mobile Safari)
**Issue:** On iPhones using Safari browser (not installed PWA), the three-dot hint is at `bottom: 14px; right: 16px` with `pointer-events: none`. On some iPhones the home-indicator gesture zone at the bottom can intercept taps. The touch detection zones (`TOP_ZONE = 60px`, `BOTTOM_ZONE = 70px`) may not be reachable behind Safari's bottom navigation bar.

**Current state:** Known issue, not yet fixed. The dots are visible but tapping them doesn't work because `pointer-events: none`. The edge-zone detection (60px top / 70px bottom) may be partially blocked by Safari chrome on some devices.

**Approach to fix (when ready):** Change `#pt-bottom-hint` to a real `<button>` with `pointer-events: auto` and `onclick="window._showPtChrome()"`. Move its position to `bottom: max(72px, calc(env(safe-area-inset-bottom) + 48px))` so it's above the home indicator. Do NOT increase BOTTOM_ZONE above ~85px or it will overlap the visible toolbar and cause it to never auto-hide.

### tactic.id collisions
`id: Date.now()` — if two tactics are saved within the same millisecond (unlikely in practice), they'll have the same ID. No observable bugs yet but worth fixing with `Date.now() + '-' + Math.random().toString(36).slice(2,7)`.

### Share link size
Very complex boards (many objects + multiple phases) can generate URLs over 4,000 characters. Most URL shorteners and messaging apps truncate at different limits. No user-facing error is shown when this happens.

### iOS form submission
`login.html` uses standard HTML `<form onsubmit="handleSignin(event)">` with `type="submit"` buttons. `window.handleSignin` is assigned inside a `<script type="module">`. On some iOS configurations the module may not be fully loaded when the user taps "Sign in", causing native form submission (GET) to fire, which reloads the page and clears the fields.
**Do NOT attempt to fix this by changing to `type="button"` with `onclick="window.handleSignin&&window.handleSignin(event)"` — the `&&` guard silently does nothing when the module fails, making sign-in completely broken on all platforms.**

### Firebase module CSP
If you add a Content-Security-Policy header to `netlify.toml`, ensure `connect-src` includes all Firebase endpoints: `https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firebaseinstallations.googleapis.com https://firestore.googleapis.com`. Missing any of these will silently break auth or Firestore. The current `netlify.toml` has no CSP — do not add one without testing sign-in thoroughly.

### Canvas rendering in portrait
In portrait mode the canvas transform is applied by `applyZoom()`. `syncCanvas()` must run (with its 80ms `afterReady` delay) before the touch handlers that check `state.portraitRotated` will work. Fast taps immediately after page load may not trigger portrait chrome reveal.

### Session builder tactic references
Session plays reference saved tactics by `tactic.id`. If a tactic is deleted from the library while a session still references it, the session render will show a blank/empty play. No error handling for this case currently.

### `tactics-library.js` is always network-first
If this file fails to load (offline, 404), the tactic library section of the app shows no templates. This is intentional — it's always fetched fresh so updates reach users instantly.

---

## 16. Netlify Environment Variables

All must be set in Netlify → Site → Environment Variables:

```
STRIPE_SECRET_KEY            sk_live_... (or sk_test_... for test mode)
STRIPE_WEBHOOK_SECRET        whsec_...
STRIPE_PRICE_ID_PRO_MONTHLY  price_1TXcRlPJqd0y6tXmlReqKxZ5
STRIPE_PRICE_ID_PRO_YEARLY   price_1TXcTWPJqd0y6tXmY0aJr80k
STRIPE_PRICE_ID_CLUB         price_1TXcWHPJqd0y6tXmf0AclVdB
FIREBASE_PROJECT_ID          courtdraw
FIREBASE_CLIENT_EMAIL        firebase-adminsdk-...@courtdraw.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY         -----BEGIN PRIVATE KEY-----\n...
RESEND_API_KEY               re_...
PUBLIC_URL                   https://courtdraw.app
SUPPORT_EMAIL                hello@courtdraw.app
INTERNAL_SECRET              (any random string — used for server-to-server email calls)
NETLIFY_SKIP_SECRETS_SCANNING true  (set in netlify.toml build.environment)
```

**Note:** Firebase client-side API keys (`apiKey`, `appId`, `messagingSenderId`) are hardcoded in `src/firebase.js`. This is intentional and safe — Firebase security is enforced by Firebase Security Rules, not key secrecy.

**Stripe is currently on test keys.** Switch to live keys before any real payment is needed.

---

## 17. Deployment

- **Trigger:** Any push to `main` auto-deploys on Netlify.
- **Build command:** None (static site, `publish = "."`)
- **Deploy time:** ~30 seconds.
- **Service worker versioning:** When making significant changes to `courtdraw-app.html` or `index.html`, bump `CACHE_NAME` in `sw.js` (currently `courtdraw-v7`) so existing users get the new version. Format: `courtdraw-v{N}`.
- **No local dev server needed.** Open `courtdraw-app.html` directly in browser for most development. Firebase auth and Stripe won't work locally (need deployed Functions), but all drawing tools and UI work.

---

## 18. Code Conventions

### JavaScript
- **Vanilla JS only.** No framework, no TypeScript, no imports in `courtdraw-app.html` (except the Firebase module script at the bottom).
- All app code is in a single `<script>` block in `courtdraw-app.html`.
- Firebase module script is a separate `<script type="module">` at the bottom of the file.
- Functions are global (no modules in the main script block). This is intentional for the single-file architecture.
- `window.__updatePro(...)` and `window.__currentUser` are the bridge between the Firebase module script and the main app script.
- Use `esc(str)` helper for HTML escaping any user-supplied string in `innerHTML` contexts.

### CSS
- CSS custom properties for all colours and spacing: `--bg`, `--surface`, `--surface2`, `--border`, `--text`, `--text2`, `--accent`, `--header-h`, `--toolbar-h`, `--phase-bar-h`.
- Dark theme is default (`data-theme="dark"` on `<html>`). Light theme via `[data-theme="light"]` overrides.
- Safe-area insets used on all fixed elements near edges: `env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`.
- `touch-action: manipulation` on all buttons to eliminate 300ms delay.

### Netlify Functions
- All functions use CommonJS (`require`, `exports.handler`).
- Firebase Admin is initialised with `if (!admin.apps.length)` guard to prevent re-initialisation on hot-reloads.
- All functions that accept user data verify Firebase ID token via `admin.auth().verifyIdToken(token)` before trusting any user-supplied data.
- Return `{ statusCode: N, body: string }` format.

### Naming
- CSS IDs: `kebab-case` (`#court-container`, `#modal-paywall`)
- CSS classes: `kebab-case` (`.player-token`, `.modal-sheet`)
- JS functions: `camelCase` (`saveTactic`, `openCourtPicker`)
- JS constants: `UPPER_SNAKE_CASE` (`FREE_SAVES`, `STRIPE_PRICES`, `COURTS`)
- Netlify function files: `kebab-case.js` (`create-checkout-session.js`)

---

## 19. Things NOT To Do

1. **Do not add a CSP header to `netlify.toml` without thorough testing.** A misconfigured CSP silently breaks Firebase auth and makes sign-in impossible. The current `netlify.toml` intentionally has no CSP.

2. **Do not change the login form from `onsubmit` + `type="submit`.** Previous attempts to "fix" iOS issues by switching to `type="button"` with `onclick` broke sign-in on all platforms.

3. **Do not increase portrait BOTTOM_ZONE above ~85px.** It will overlap the visible toolbar and create an infinite reset loop where the toolbar never auto-hides.

4. **Do not make `#pt-bottom-hint` have `pointer-events: none` AND try to increase zones to compensate.** Fix the root issue instead: make the hint a tappable button.

5. **Do not bump `sw.js` CACHE_NAME for minor changes.** Only bump it when users need to receive updated HTML/JS files (significant feature changes). Unnecessary bumps cause all users to re-download all cached assets.

6. **Do not add npm packages to the frontend.** The `package.json` is for Netlify Functions only. The frontend uses CDN scripts (Firebase, Stripe.js) and no other dependencies.

7. **Do not use `git reset --hard` on `main`.** Always use `git revert` or checkout specific files. The remote is always in sync with local `main`.
