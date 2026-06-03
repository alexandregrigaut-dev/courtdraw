#!/usr/bin/env node
// scripts/generate-seo-pages.js
// Generates all per-sport SEO landing pages for CourtDraw.
// Run: node scripts/generate-seo-pages.js
// Output: <slug>-tactics-board/index.html (×33 pages) + sports/index.html + sitemap.xml update.

'use strict';
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..');
const TODAY = '2026-05-31';

// ─── SHARED LOGO SVG ──────────────────────────────────────────────────────────

const LOGO_SVG = `<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="28" height="28" rx="6" fill="#3b82f6"/>
  <rect x="2" y="8.5" width="24" height="11" rx="1" fill="#1d4ed8"/>
  <rect x="2" y="8.5" width="24" height="11" rx="1" stroke="white" stroke-width="0.9"/>
  <line x1="14" y1="8.5" x2="14" y2="19.5" stroke="white" stroke-width="0.9"/>
  <line x1="7.5" y1="9.8" x2="7.5" y2="18.2" stroke="white" stroke-width="0.75"/>
  <line x1="20.5" y1="9.8" x2="20.5" y2="18.2" stroke="white" stroke-width="0.75"/>
  <line x1="2" y1="9.8" x2="26" y2="9.8" stroke="white" stroke-width="0.75"/>
  <line x1="2" y1="18.2" x2="26" y2="18.2" stroke="white" stroke-width="0.75"/>
  <line x1="7.5" y1="14" x2="20.5" y2="14" stroke="white" stroke-width="0.75"/>
  <line x1="2" y1="14" x2="2.7" y2="14" stroke="white" stroke-width="0.75"/>
  <line x1="26" y1="14" x2="25.3" y2="14" stroke="white" stroke-width="0.75"/>
</svg>`;

// ─── SPORT FAMILIES (for internal linking) ────────────────────────────────────

const FAMILIES = {
  racquet: {
    label: 'Racquet & Net Sports',
    slugs: ['tennis', 'padel', 'pickleball', 'badminton', 'squash', 'table-tennis', 'racquetball', 'beach-tennis', 'padbol'],
  },
  football: {
    label: 'Football Codes',
    slugs: ['football', 'futsal', 'beach-soccer', 'rugby-union', 'rugby-league', 'gaelic-football', 'american-football', 'australian-rules'],
  },
  hockey: {
    label: 'Stick & Hockey Sports',
    slugs: ['field-hockey', 'ice-hockey', 'roller-hockey', 'indoor-hockey', 'floorball', 'hurling', 'lacrosse'],
  },
  hand: {
    label: 'Hand & Goal Team Sports',
    slugs: ['handball', 'beach-handball', 'basketball', 'netball', 'korfball', 'water-polo'],
  },
  volley: {
    label: 'Volley & Net Team Sports',
    slugs: ['volleyball', 'beach-volleyball', 'fistball'],
  },
};

// ─── SPORT DATA ───────────────────────────────────────────────────────────────

const SPORTS = [

  // ─── RACQUET / NET ───────────────────────────────────────────────────────────

  {
    slug: 'tennis',
    name: 'Tennis',
    primaryKeyword: 'tennis tactics board',
    title: 'Tennis Tactics Board — Draw & Share Plays | CourtDraw',
    metaDesc: 'Free online tennis tactics board for singles and doubles. Draw serve patterns, rally drills, and net-play sequences. Works on iPad offline. No install needed.',
    h1: 'Tennis Tactics Board',
    emoji: '🎾',
    courtIds: [['tennis_singles', 'Singles Court'], ['tennis_doubles', 'Doubles Court']],
    primaryCourtId: 'tennis_singles',
    family: 'racquet',
    plays: [
      { id: 'tennis_serve_volley', name: 'Serve & Volley', desc: 'Server charges net after a wide serve to cut off angles and finish at the net.' },
      { id: 'tennis_baseline_rally', name: 'Baseline Cross-Court Rally', desc: 'Consistent cross-court groundstrokes to open the court for a down-the-line winner.' },
      { id: 'tennis_return_of_serve', name: 'Chip & Charge Return', desc: 'Chip a low return at the server\'s feet and rush the net to exploit the weak volley.' },
    ],
    intro: `<p>Tennis coaching is pattern-based — but whiteboards erase between sessions and video clips don't draw the lines for you. CourtDraw gives you a dedicated tennis tactics board with accurate singles and doubles courts, so you can diagram serve patterns, rally structures, and net-play sequences in seconds, then share them directly to players' phones before a match or training session.</p>`,
    body: `<h2>Why Coaches Need a Tennis Tactics Board</h2>
<p>Modern tennis is won by recognising patterns and executing the right response under pressure. A player who understands <strong>serve-plus-one combinations</strong> — hitting a wide serve in the deuce court and following it up with an inside-out forehand to the open court — will consistently wrong-foot opponents who are trained only to react. Diagramming that pattern on an accurate court helps the player visualise both the geometry and the footwork required.</p>
<p>CourtDraw's tennis board covers everything a coach needs:</p>
<ul>
<li><strong>Serve patterns</strong> — map T, body, and wide options from both sides; show how the placement dictates the next ball.</li>
<li><strong>Return positioning</strong> — illustrate the chip-and-charge, the drive return, and block returns for big servers.</li>
<li><strong>Net approach sequences</strong> — draw the approach shot, the split-step position, and the volley target in one animated phase.</li>
<li><strong>Baseline rally structures</strong> — demonstrate the cross-court to down-the-line switch, and when to move inside the baseline to attack.</li>
</ul>

<h2>Singles Tactics</h2>
<p>In singles, court geometry is everything. The <strong>geometric centre of the baseline</strong> sits roughly a foot to the right of the court's physical centre, because most cross-court balls pull the opponent wider. Teaching players to recover to this position rather than the exact middle saves crucial recovery time. Diagram this recovery angle on CourtDraw and your players will internalise it far faster than from verbal instruction alone.</p>
<p>Key singles patterns to diagram:</p>
<ul>
<li><strong>The inside-out forehand</strong> — running around a backhand to hit a forehand cross-court, then closing to the net or staying back depending on the reply.</li>
<li><strong>Serve wide + crosscourt forehand</strong> — the deuce-side combination that opens the court.</li>
<li><strong>Short-ball approach</strong> — when to attack a short ball, which direction to drive it, and how to split-step before the opponent's pass.</li>
<li><strong>Defensive lob</strong> — height and depth requirements to give yourself time to recover when pulled wide.</li>
</ul>

<h2>Doubles Tactics</h2>
<p>Doubles introduces three-dimensional positioning that many players never fully grasp. The <strong>net player's role</strong> — when to poach, when to hold position, and when to fake a poach and reset — can be complex to explain verbally. On CourtDraw's doubles court you can show all four players simultaneously, draw the net player's poach path, and illustrate the server's recovery angle after the serve.</p>
<p>Essential doubles patterns to cover:</p>
<ul>
<li><strong>I-Formation</strong> — both players start on the same side of the centre mark, with the net player crouching; the server signals which direction the net player will poach.</li>
<li><strong>Australian Formation</strong> — server and net player on the same side to neutralise a strong cross-court return.</li>
<li><strong>Poach triggers</strong> — which return patterns make a poach high-percentage, and how the serving partner covers the open court.</li>
<li><strong>Lob over the net player</strong> — positioning and recovery when the opponents attack with a lob.</li>
</ul>

<h2>Animating Phases</h2>
<p>CourtDraw's phase system lets you build a play step by step — serve landing, ball path, player movement, volley target — and then present each step sequentially on the board. This is especially effective for teaching net approaches, where the timing of the split-step relative to the opponent's contact point is the hardest concept to convey in static diagrams.</p>
<p>Plays from the tactics library can be loaded directly into the board, modified, and saved under your own club library. Every saved tactic is available offline, so you can coach courtside without a wifi connection.</p>`,
    faqSport: 'tennis',
  },

  {
    slug: 'padel',
    name: 'Padel',
    primaryKeyword: 'padel tactics board',
    title: 'Padel Tactics Board — Draw & Share Plays | CourtDraw',
    metaDesc: 'Free online padel tactics board for coaches. Draw bandeja patterns, wall play, lob-and-recover, and net domination plays for 2v2. Works on iPad offline.',
    h1: 'Padel Tactics Board',
    emoji: '🏸',
    courtIds: [['padel', 'Padel Court']],
    primaryCourtId: 'padel',
    family: 'racquet',
    plays: [
      { id: 'padel_lob', name: 'Lob & Recover', desc: 'Defensive lob over the net players to reclaim position when caught at the back glass.' },
      { id: 'padel_bandeja', name: 'Bandeja Smash', desc: 'High overhead hit with spin and control to keep net dominance without over-committing.' },
      { id: 'padel_net_domination', name: 'Net Domination', desc: 'Both players press the net to volley aggressively and close out the point.' },
    ],
    intro: `<p>Padel's enclosed court transforms every rally into a chess match of angles, glass rebounds, and positioning. Most coaching mistakes happen because players don't understand the geometry — where the bandeja should land, which glass angle to exploit, when to lob and when to attack. CourtDraw's padel board lets you diagram all of it, show real 2v2 positioning, and share plays before players step on court.</p>`,
    body: `<h2>The Three Pillars of Padel Tactics</h2>
<p>Padel coaching revolves around three tactical principles: <strong>net domination</strong>, <strong>diagonal geometry</strong>, and <strong>controlled use of the glass walls</strong>. Every tactical concept you teach traces back to one or more of these pillars, and a visual board makes it dramatically easier for players to understand how they connect.</p>

<h2>Net Dominance</h2>
<p>Winning padel pairs spend the majority of each point at or near the net. The goal is to move forward after every opportunity and force the opponents to lob or play defensively from the back glass. Diagramming net domination shows players exactly where to stand — both partners roughly 1.5–2 metres from the net, slightly offset so each covers their side diagonal — and how to shift laterally to cover a cross-court dink or a lob that lands short.</p>
<p>When you diagram the <strong>4-2 net squeeze</strong> on CourtDraw, you can show how both players press forward as the opponent plays a defensive ball, closing the available angle to just the lob or the chiquita. Show this as a two-phase animation: first the opponents' ball, then the net pair's advance.</p>

<h2>The Bandeja and the Víbora</h2>
<p>Two of padel's signature shots — the <strong>bandeja</strong> and the <strong>víbora</strong> — are fundamentally tactical rather than just technical. The bandeja is a controlled overhead hit with sidespin that lands deep in the opponent's court and bounces into the side glass; it maintains net position while neutralising a lob. The víbora is a more aggressive version hit with more wrist snap and a sharper angle toward the side glass.</p>
<p>Coaches often struggle to explain when to choose one over the other. On CourtDraw you can draw the intended ball path, the anticipated glass rebound angle, and the net position the hitting player recovers to after each shot — making the decision tree concrete.</p>

<h2>Lob-and-Recover Positioning</h2>
<p>When caught at the back glass, a team's escape route is almost always the <strong>deep central lob</strong>. The key is not just the shot itself but what both players do immediately after: they must sprint forward together as a unit and attempt to regain net position before the opponents can put away the smash. Diagramming this movement — both players' paths, the ideal landing zone for the lob, and their target net position — closes a gap that verbal coaching alone rarely fills.</p>
<p>The <strong>lob-to-net recovery triangle</strong> is a concept every padel coach should be able to draw: the lob lands in the central or cross-court deep zone, Player A tracks back to cover the potential smash rebound from the glass, Player B moves to the T-zone ready to intercept a short reply.</p>

<h2>Wall Play and the Diagonal Cross</h2>
<p>The <strong>diagonal cross</strong> — a ball played from the left side toward the opponents' right side glass — is one of padel's most effective attacking patterns. When drawn correctly, it forces the opponent closest to the glass to play a defensive ball while the partner at net is left with no angle to intercept. Showing this on CourtDraw, including the expected glass rebound path and how the hitting team should follow it up, gives players a concrete model to execute in match conditions.</p>
<p>Wall rebounding is also central to defense: a ball that comes off the back glass at pace can be redirected cross-court at a sharp angle if the player reads the rebound early. Annotate the rebound angle and the ideal contact point on the board, and players will start seeing the geometry in training.</p>

<h2>Serve Tactics</h2>
<p>In padel, the serve starts every point but is far less dominant than in tennis. The key tactical question is: where does the serving pair position themselves after the serve to maximise net pressure? Diagram the server's follow-forward path, the net player's role in covering the central alley, and the split-step timing relative to the return contact. A well-diagrammed serve pattern prevents partners from leaving central gaps that the returning pair can exploit with the chiquita.</p>`,
    faqSport: 'padel',
  },

  {
    slug: 'pickleball',
    name: 'Pickleball',
    primaryKeyword: 'pickleball tactics board',
    title: 'Pickleball Tactics Board — Draw & Share Plays | CourtDraw',
    metaDesc: 'Free online pickleball tactics board for coaches. Draw kitchen strategy, third-shot drops, stacking patterns, and dink rallies. Works on iPad, offline.',
    h1: 'Pickleball Tactics Board',
    emoji: '🏓',
    courtIds: [['pickleball', 'Pickleball Court']],
    primaryCourtId: 'pickleball',
    family: 'racquet',
    plays: [
      { id: 'pickleball_third_shot_drop', name: 'Third Shot Drop', desc: 'Soft arcing shot into the kitchen to neutralise the net advantage and advance forward.' },
      { id: 'pickleball_dink_rally', name: 'Dink Rally Control', desc: 'Patient cross-court dinking to create an opening or force an unforced error.' },
      { id: 'pickleball_stacking', name: 'Stacking Formation', desc: 'Both players start on the same side to give the stronger player more forehands.' },
    ],
    intro: `<p>Pickleball coaching used to mean shouting tips across the court. Now you can diagram the entire third-shot sequence, explain stacking geometry, and show exactly why the kitchen line wins rallies — all before practice starts. CourtDraw's pickleball board gives you an accurate court with the non-volley zone highlighted so your players see, not just hear, every tactical principle you teach.</p>`,
    body: `<h2>The Kitchen Is the Game</h2>
<p>In pickleball, almost every tactical decision connects to the <strong>non-volley zone (NVZ) — the kitchen</strong>. Teams that control the kitchen line win; teams that camp at the baseline lose. The entire tactical vocabulary of pickleball — third-shot drops, dink rallies, erne attacks, lob resets — exists to either get players to the kitchen or neutralise opponents who are already there.</p>
<p>Showing this geometrically on a CourtDraw board is immediately more effective than verbal explanation. Draw both teams' positions, show the shot arc of a third-shot drop landing softly in the kitchen, then show both serving-team players advancing forward together. In one diagram you've explained the most fundamental tactical concept in the game.</p>

<h2>Third-Shot Strategy</h2>
<p>The <strong>third shot</strong> — hit by the serving team after the return of serve — is pickleball's most important and difficult shot. It must land softly in the kitchen to prevent the net team from attacking it, giving the serving team time to move forward. Coaches diagram three main options:</p>
<ul>
<li><strong>Third-shot drop</strong> — the standard; a soft arc that lands in the kitchen and forces the net team to hit up.</li>
<li><strong>Third-shot drive</strong> — a hard flat shot to disrupt the net team's positioning, typically used against partners who are out of sync.</li>
<li><strong>Lob</strong> — occasional option when the net pair is crowding the line; risky but effective if executed deep.</li>
</ul>
<p>On CourtDraw, draw arrows showing the intended arc, landing zone, and the serving team's forward movement path for each option. Players immediately see why the third-shot drop is called a "reset" — it resets the point from a defensive position into a neutral one.</p>

<h2>Kitchen Line Battle and Dinking</h2>
<p>Once both teams are at the kitchen line, the <strong>dink rally</strong> begins. Dinks are soft shots played just over the net and into or near the kitchen. The goal is not to win the point with a dink but to <strong>set up an attack</strong> — either by moving a dink cross-court to pull an opponent wide, or by speeding up when the opponent pops a dink above net height.</p>
<p>Diagram the cross-court dink rally pattern: Player A dinks cross-court, both teams shift slightly, Player A then dinks down the middle to exploit the seam between the opponents. Show when Player A should accelerate — only when the opponent's paddle is below net height and the ball is above the tape.</p>

<h2>Stacking and Formation Play</h2>
<p>Stacking is a positioning strategy where both players start on the same side of the court to ensure a specific player (usually the stronger or more forehand-dominant player) covers more of the court. It looks unusual to beginners but is tactically logical. On CourtDraw you can show the pre-serve positions, the movement paths after each return, and how to cover the middle gap that stacking briefly creates.</p>

<h2>Speed-Up and Transition</h2>
<p>Knowing when to speed up a dink rally — attacking a ball that sits above the net — is the skill that separates intermediate from advanced pickleball. Diagram the body position and target zone: aim at the opponent's near hip or shoulder, force a reactionary block, and immediately follow the speed-up to close the net gap. The split-second window for this attack is much easier to understand from a diagram than from verbal description mid-rally.</p>`,
    faqSport: 'pickleball',
  },

  {
    slug: 'badminton',
    name: 'Badminton',
    primaryKeyword: 'badminton tactics board',
    title: 'Badminton Tactics Board — Draw & Share Plays | CourtDraw',
    metaDesc: 'Free online badminton tactics board for singles and doubles. Draw rotation patterns, smash-and-recover, net-kill setups, and serve tactics. Works on iPad.',
    h1: 'Badminton Tactics Board',
    emoji: '🏸',
    courtIds: [['badminton_singles', 'Singles Court'], ['badminton_doubles', 'Doubles Court']],
    primaryCourtId: 'badminton_singles',
    family: 'racquet',
    plays: [
      { id: 'badminton_smash_defense', name: 'Smash & Defense', desc: 'Diagonal smash to the body followed by recovery to the T-position.' },
      { id: 'badminton_net_kill', name: 'Net Kill', desc: 'Intercept a rising net shot with a flat punch to the floor, cutting off the dink.' },
      { id: 'badminton_attacking_clear', name: 'Attacking Clear', desc: 'Deep clear to the rear court to reset position or set up a follow-up smash.' },
    ],
    intro: `<p>Badminton's explosive speed means tactical patterns get lost in the blur of a rally. CourtDraw lets you freeze the action — show where the smash should land, where both players need to position after it, and why the net-kill trigger matters — so players build pattern recognition before they step on court. Separate singles and doubles courts let you cover both formats without confusion.</p>`,
    body: `<h2>Singles Tactics: The Four Corners</h2>
<p>Singles badminton is fundamentally a game of controlling the four corners of the court and forcing your opponent to cover the maximum distance on every shot. Coaches talk about the <strong>"four-corners" training drill</strong>, but the underlying tactic is this: always reply to a shot aimed at one corner with a return aimed at the diagonally opposite corner, forcing the opponent to travel the longest possible distance.</p>
<p>Key singles patterns to diagram:</p>
<ul>
<li><strong>Net lift to rear court</strong> — when pressed at the net with a low net shot, lift cross-court to the deep rear corner, forcing the opponent back and creating time to recover to the T-position.</li>
<li><strong>Smash to body</strong> — a steep smash aimed at the opponent's right hip forces a cramped forehand block that often pops up for a follow-up kill.</li>
<li><strong>Deceptive drop shot</strong> — using identical backswing to a clear but slowing at contact; draw the shuttle's path and the opponent's mistaken footwork to illustrate why the deception works.</li>
<li><strong>T-position recovery</strong> — after every attacking shot, show the exact recovery position (slightly behind centre) and the split-step timing relative to the opponent's contact.</li>
</ul>

<h2>Doubles Tactics: Rotation Systems</h2>
<p>In doubles, the most important tactical concept is <strong>position rotation</strong> — transitioning seamlessly between the attack formation (front-and-back: one player at net, one at the rear) and the defensive formation (side-by-side: both players covering half the court each). Most intermediate doubles players never master this rotation, usually because they've never seen it drawn out.</p>
<p>On CourtDraw, diagram the two core formations and show the specific trigger for transitioning between them:</p>
<ul>
<li><strong>Attack formation</strong> — triggered when your pair has just smashed or played a tight net shot; the rear-court player follows up aggressively, the net player intercepts any lift.</li>
<li><strong>Defense formation</strong> — triggered when opponents lift high; both players spread to their half to cover angled smashes and flick serves.</li>
<li><strong>Rotation trigger</strong> — the exact moment to switch: when the shuttle crosses the net going up (defenders spread) or going down at pace (attackers form front-back).</li>
</ul>

<h2>Serve and Return Strategy</h2>
<p>In doubles, the <strong>low serve to the T</strong> is the default — tight to the net, landing on the centre line, minimising the returner's angle. Show the server's position relative to the centre line, the net player's forward stance ready to intercept a flick, and the two danger zones (flick to the rear, net push cross-court) that the non-serving partner must cover.</p>
<p>Against a player who consistently returns to the net, show the <strong>flick serve variation</strong> — identical swing path to the low serve but with a flick of the wrist to send the shuttle high and deep. Diagram the arc, the intended landing zone just inside the rear service line, and the returning player's likely defensive response.</p>

<h2>Mixed Doubles Positioning</h2>
<p>In mixed doubles, convention places the female player at the front and the male player at the rear, though modern top pairs are more fluid. The key principle is that the rear player should always play smashes and drops while the front player intercepts at the net. Diagram the communication zones — which shots belong to whom — and the specific situations where this convention breaks down (e.g., when the rear player's forehand smash from the left of the court passes through the front player's territory).</p>`,
    faqSport: 'badminton',
  },

  {
    slug: 'squash',
    name: 'Squash',
    primaryKeyword: 'squash tactics board',
    title: 'Squash Tactics Board — Draw & Share Plays | CourtDraw',
    metaDesc: 'Free online squash tactics board for coaches. Draw T-control patterns, attacking boasts, ghost drills, and serving tactics. Works on iPad, offline.',
    h1: 'Squash Tactics Board',
    emoji: '🎾',
    courtIds: [['squash', 'Squash Court']],
    primaryCourtId: 'squash',
    family: 'racquet',
    plays: [],
    intro: `<p>Squash tactics are invisible during a rally — players are moving too fast for observers to track positioning logic. CourtDraw's squash board freezes the geometry: where the T-position is, why a nick target is so dangerous, how a width-then-boast sequence creates the opening. Diagram it before the session, share it to phones, and watch players start making better decisions under pressure.</p>`,
    body: `<h2>The T is Everything</h2>
<p>Every tactical concept in squash connects back to the <strong>T-position</strong> — the junction of the floor's T-line near the centre of the court. Whoever controls the T controls the rally. Every shot your players hit should either (a) be hit from the T, (b) move the opponent off the T, or (c) recover toward the T. Teaching this principle visually — with arrows showing the ideal recovery path after each type of shot — immediately clarifies decisions that took months to internalise verbally.</p>
<p>On CourtDraw, mark the T-position and draw the recovery path after a straight drive, a cross-court drive, and a boast. Players immediately see that recovering to the T after a cross-court is shorter than after a straight drive to the same corner — counterintuitive but geometrically true.</p>

<h2>Length and Width</h2>
<p>The two foundational tools for creating and closing openings in squash are <strong>length</strong> (deep, tight drives to the back corners) and <strong>width</strong> (cross-court drives that pull the opponent across the court). Coaches structure entire sessions around these two ideas:</p>
<ul>
<li><strong>Tight drive</strong> — a straight drive that "dies" in the back corner, clinging to the side wall and leaving no angle to attack. The ideal contact point and wall distance to achieve this are much easier to show than describe.</li>
<li><strong>Cross-court drive</strong> — played with enough angle to reach the opposite side wall before the back wall; if executed well, the opponent must cover 8–10 metres of lateral distance.</li>
<li><strong>Width-then-boast</strong> — a cross-court drive to pull the opponent wide, then a boast (a shot off the side wall) into the front corner when they overcommit. The timing between these two shots is the crux of the tactic.</li>
</ul>

<h2>Attacking Shots: Boast, Drop, and Nick</h2>
<p>Three attacking shots create winning openings in squash:</p>
<ul>
<li><strong>Boast</strong> — played off the side wall to the opposite front corner; dangerous if the opponent is caught deep and extremely effective as a change of direction.</li>
<li><strong>Drop shot</strong> — a soft shot aimed just above the tin, ideally tight to the side wall. Draw the intended landing zone and how the T-recovery path differs from a length shot.</li>
<li><strong>Nick</strong> — the junction of the side wall and the floor, usually in the front corners. A ball that rolls out of the nick is unplayable. Diagram the target angle for each type of nick: straight nick from a cross-court, reverse angle nick from the back.</li>
</ul>

<h2>Serve and Return</h2>
<p>The serve in squash is a tactical opportunity, not just a starting shot. The <strong>high lob serve</strong> — aimed at the side wall near the service box boundary so it rebounds to the back corner — forces the returner into a defensive position immediately. Show the intended arc, wall contact point, and the server's recovery path to the T. Contrast this with the <strong>hard low serve</strong> hit at pace to the body, used to disrupt rhythm and force a rushed return.</p>
<p>Diagram the most common return zones and how the server positions themselves to cover each. Players who understand the return options available to their opponent will position after the serve far more intelligently.</p>`,
    faqSport: 'squash',
  },

  {
    slug: 'table-tennis',
    name: 'Table Tennis',
    primaryKeyword: 'table tennis tactics board',
    title: 'Table Tennis Tactics Board — Draw Plays | CourtDraw',
    metaDesc: 'Free online table tennis tactics board for coaches. Draw serve patterns, loop-kill setups, backhand flick tactics, and footwork patterns. Works on iPad.',
    h1: 'Table Tennis Tactics Board',
    emoji: '🏓',
    courtIds: [['table_tennis', 'Table Tennis Court']],
    primaryCourtId: 'table_tennis',
    family: 'racquet',
    plays: [],
    intro: `<p>Table tennis tactics happen at a pace where spoken coaching can't keep up. Before and after each session, CourtDraw lets you diagram serve patterns, explain why the cross-table pendulum serve opens a forehand loop opportunity, and show the footwork triangle that lets players cover both wings efficiently. Visual coaching closes the gap between knowing a tactic and executing it.</p>`,
    body: `<h2>Serve and Service Return Tactics</h2>
<p>In table tennis, roughly 40% of points are determined directly by the serve and the first two or three shots. A coach who doesn't diagram serve patterns is leaving points on the table. The three key serves to illustrate:</p>
<ul>
<li><strong>Pendulum serve</strong> — sidespin serve using a pendulum swing motion, contact from right-to-left producing heavy left-sidespin; returners must adjust blade angle and aim toward the server's backhand to cancel the spin.</li>
<li><strong>Reverse pendulum</strong> — identical windup but contact from left-to-right producing reverse sidespin; returners expecting the pendulum are caught completely off guard.</li>
<li><strong>Short push to the crossover point</strong> — targeting the opponent's crossover zone (elbow) with a short, heavy backspin serve forces a cramped response.</li>
</ul>
<p>Diagram each serve's contact point, the resulting spin direction (arrows on the board), the likely return direction, and how the server should position for the third ball attack.</p>

<h2>Third Ball Attack</h2>
<p>The <strong>third ball attack</strong> is table tennis's equivalent of padel's net domination principle — it's the tactical framework that justifies serve selection. After a serve designed to elicit a specific return, the server loops or drives the third ball (their second shot) at the predetermined target. Draw the serve, the anticipated return trajectory, and the third ball placement in one connected diagram. Players immediately understand why the serve type and target are chosen together.</p>

<h2>Forehand Loop and Loop-Kill Sequences</h2>
<p>The loop — a heavy topspin stroke that accelerates off the table edge — is modern table tennis's dominant attacking stroke. Coaching the loop tactically means showing when to loop and where to aim:</p>
<ul>
<li><strong>Opening loop</strong> — looping the first backspin ball, usually targeting the wide backhand or the crossover point at medium pace to establish the rally.</li>
<li><strong>Accelerating loop (kill)</strong> — following the opening loop with a faster, flatter loop aimed at the same side or crossing over to the wide forehand.</li>
<li><strong>Loop vs block pattern</strong> — diagram the looper's footwork positioning and the blocker's counter-strategy of redirecting at sharp angles.</li>
</ul>

<h2>Footwork and Coverage</h2>
<p>Show the <strong>two-step side shuffle</strong> and the <strong>in-out footwork</strong> (forward for short balls, backward for long) as positioning arrows from the ready position. Players who see the footwork pattern mapped on a court understand the concept far more quickly than those who only hear "stay low and balanced."</p>
<p>Diagram the <strong>coverage triangle</strong>: a player's optimal ready position covers the backhand side, the crossover zone, and the forehand side with roughly equal time to reach each. Moving this triangle forward (aggressive) versus backward (defensive) completely changes the tactical nature of a player's game.</p>`,
    faqSport: 'table tennis',
  },

  {
    slug: 'racquetball',
    name: 'Racquetball',
    primaryKeyword: 'racquetball tactics board',
    title: 'Racquetball Tactics Board — Draw Plays | CourtDraw',
    metaDesc: 'Free online racquetball tactics board for coaches. Draw ceiling ball patterns, pinch shots, Z-ball strategy, and center-court control. Works on iPad.',
    h1: 'Racquetball Tactics Board',
    emoji: '🎾',
    courtIds: [['racquetball', 'Racquetball Court']],
    primaryCourtId: 'racquetball',
    family: 'racquet',
    plays: [],
    intro: `<p>Racquetball's four walls make tactical instruction uniquely complex — shots change direction twice before landing, and verbal description of a pinch-to-back-wall pattern leaves players guessing. CourtDraw's racquetball board lets you diagram wall interactions, show the ideal landing zones for kill shots and ceiling balls, and map the center-court position that controls every rally.</p>`,
    body: `<h2>Center Court Control</h2>
<p>The <strong>center court position</strong> in racquetball — roughly five feet behind the short line in the middle of the court — is the tactical equivalent of squash's T-position. From here, a player can reach any corner of the court in the fewest possible steps. Every shot in racquetball should either be hit from center court or should force the opponent out of center court so you can occupy it. Draw this zone on CourtDraw and it immediately clarifies why players should return there after every exchange.</p>

<h2>Kill Shots and Pinch Shots</h2>
<p>The <strong>kill shot</strong> — aimed at the front wall as low as possible so it barely rebounds and "dies" before the opponent can retrieve it — is racquetball's most decisive weapon. Coaches should diagram the three main kill shot types:</p>
<ul>
<li><strong>Straight kill</strong> — front wall target just above the floor, rebounding straight back along the same wall.</li>
<li><strong>Cross-court kill</strong> — angled into the opposite side of the front wall to die in the opposite corner.</li>
<li><strong>Pinch shot</strong> — aimed at the side wall near the front corner so it hits side wall first, then front wall at a very low height; the resulting short, low rebound is almost impossible to retrieve.</li>
</ul>
<p>For each, diagram the contact point, the wall target (including the specific height), and the expected rebound path. Players who see this geometry beat players who only heard about it.</p>

<h2>Ceiling Ball Strategy</h2>
<p>The <strong>ceiling ball</strong> is racquetball's defensive reset — hit high onto the ceiling so it bounces off the front wall and dies deep in the back court, forcing the opponent away from center court. It's the tactical equivalent of squash's length drive and serves the same purpose: prevent the opponent from attacking while you reclaim center position.</p>
<p>Diagram the ceiling contact point (just past the front wall), the arc, and the intended landing zone in the back corners. Show how a ceiling ball aimed at the backhand corner creates a left-to-right footwork obligation for the opponent, while you recover to center court.</p>

<h2>Z-Ball and Around-the-Wall Ball</h2>
<p>Two advanced shots create unexpected rebound patterns that opponents struggle to read:</p>
<ul>
<li><strong>Z-ball</strong> — hit high into the front wall near one corner, rebounds to the side wall, crosses the court, and hits the opposite side wall before dying near the back wall. The angled path is very difficult to anticipate.</li>
<li><strong>Around-the-wall ball (AWB)</strong> — similar to the Z-ball but hit higher; rebounds from the front wall to the side wall, across the ceiling, and into the back corner.</li>
</ul>
<p>These shots are most effective as passing shots when an opponent is camped at center court. Diagram the wall contact sequence and the final landing zone so players understand the geometry before attempting them in a game.</p>`,
    faqSport: 'racquetball',
  },

  {
    slug: 'beach-tennis',
    name: 'Beach Tennis',
    primaryKeyword: 'beach tennis tactics board',
    title: 'Beach Tennis Tactics Board — Draw Plays | CourtDraw',
    metaDesc: 'Free online beach tennis tactics board for coaches. Draw net-domination patterns, overhead smash setups, and defensive lob sequences for 2v2 beach tennis.',
    h1: 'Beach Tennis Tactics Board',
    emoji: '🎾',
    courtIds: [['beach_tennis', 'Beach Tennis Court']],
    primaryCourtId: 'beach_tennis',
    family: 'racquet',
    plays: [],
    intro: `<p>Beach tennis combines the 2v2 geometry of padel with the speed of tennis on sand — where footing is unpredictable and overheads dominate. CourtDraw's beach tennis board lets you diagram the net positioning battle, show the lob-over-the-net-player pattern, and explain smash placement before your players set foot on the sand.</p>`,
    body: `<h2>Net Domination on Sand</h2>
<p>Like padel, beach tennis rewards the pair that controls the net. With no walls to exploit, the net position is even more decisive — every exchange either keeps the net team attacking or forces them back with a successful lob. Coaching the net approach on sand requires diagramming different footwork patterns because lunges and splits behave differently on an unstable surface. Show players the shorter, choppier steps needed to maintain balance while pressing forward.</p>

<h2>Overhead and Smash Placement</h2>
<p>The overhead smash is the most decisive shot in beach tennis and the one that most differentiates advanced pairs. Diagram the three primary smash targets:</p>
<ul>
<li><strong>Body smash</strong> — aimed at the body of the opponent closer to the ball, forcing a cramped defensive block.</li>
<li><strong>Wide angle smash</strong> — aimed sharply cross-court beyond the sideline; effective when both opponents are stacked centrally.</li>
<li><strong>Down the middle</strong> — aimed between the two opponents to exploit the communication gap; most effective when the opponents' positioning is wide.</li>
</ul>
<p>For each, also draw the expected defensive response and how the smashing pair should follow up. A well-placed body smash usually produces a short, floating reply that invites a second, more aggressive smash.</p>

<h2>Lob Defense and Reset</h2>
<p>When pinned at the baseline by an aggressive net pair, the lob is the primary escape route. Teach players the two lob options:</p>
<ul>
<li><strong>Central deep lob</strong> — safest option; lands between the opponents and forces them both to move back, giving the defensive team time to advance.</li>
<li><strong>Cross-court lob</strong> — more aggressive; if the net player crosses to intercept, it opens the down-the-line lane for a passing shot.</li>
</ul>
<p>Diagram both lob types and the simultaneous forward movement the lobbing pair should make while the opponents retreat. The timing of this advance is crucial: move as soon as the lob clears the net players' reach.</p>

<h2>Serve Patterns</h2>
<p>In beach tennis, serve selection focuses on placement over spin because the no-bounce rule (the ball may not bounce before being struck by the returning team) means every rally starts at the net. Diagram the three serve zones — wide, body, and T — and show how the serving pair should position immediately after serving to cover the likely return angles. Players who anticipate the return direction will reach the net first and take the initiative for the rally.</p>`,
    faqSport: 'beach tennis',
  },

  {
    slug: 'padbol',
    name: 'Padbol',
    primaryKeyword: 'padbol tactics board',
    title: 'Padbol Tactics Board — Draw & Share Plays | CourtDraw',
    metaDesc: 'Free online padbol tactics board for coaches. Draw 2v2 positioning, wall-play combinations, and net attack patterns for this exciting padel-football hybrid.',
    h1: 'Padbol Tactics Board',
    emoji: '🎾',
    courtIds: [['padbol', 'Padbol Court']],
    primaryCourtId: 'padbol',
    family: 'racquet',
    plays: [],
    intro: `<p>Padbol merges the glass-wall geometry of padel with foot and body striking, creating a unique 2v2 game where positioning and wall-reading are as important as technique. CourtDraw's padbol board helps coaches diagram the net dominance principles, explain the wall rebound angles unique to padbol's smaller court, and plan training drills before the session starts.</p>`,
    body: `<h2>Padbol Court and Positioning</h2>
<p>The padbol court is smaller than a padel court and fully enclosed with glass walls and a metallic grid. The shorter distances make net dominance even more critical — the team at the net can volley almost anything before it reaches the back glass. Position diagrams on CourtDraw help players understand the key positioning principles: both players in the attacking formation should be roughly 1–1.5 metres from the net, covering the width of the court without leaving the central gap unprotected.</p>

<h2>Wall Combinations</h2>
<p>Padbol's back and side glass walls create rebound combinations that are almost impossible to explain without a diagram. A ball struck at a side glass at a 45-degree angle will rebound across the court and, if hit with the right pace, reach the opposite back glass — forcing both opponents to choose who tracks the cross-court rebound. Draw these angles on CourtDraw's board so players understand the geometry before trying to execute it at pace.</p>
<p>Key combinations to diagram:</p>
<ul>
<li><strong>Side glass to back glass</strong> — attacking ball struck at the side glass to redirect into the back corner.</li>
<li><strong>Back glass cross-court</strong> — defensive ball off the back glass redirected across the court with angle to wrong-foot the net players.</li>
<li><strong>Lob over the net to back glass</strong> — when pressed, a lob that lands near the back glass and bounces unpredictably gives the lobbing team time to advance.</li>
</ul>

<h2>Net Attack Patterns</h2>
<p>The attacking formation in padbol — both players at the net, volleying aggressively — is won or lost on communication. Draw the coverage zones for each player: the right-net player covers their half plus the central corridor, the left-net player mirrors. When an opponent's ball is coming cross-court, the near-net player calls and attacks while the partner holds position to cover the rebound. Diagram this communication on the board and players start making the calls automatically in matches.</p>

<h2>Training Drills on the Board</h2>
<p>Because padbol is a relatively new sport, many coaches are also learning the tactical concepts alongside their players. CourtDraw is ideal for planning drills before the session: draw the feeding position, the movement paths, and the target zones for each drill. Players who see the drill diagrammed before they execute it make fewer positioning errors and need less corrective coaching mid-drill.</p>`,
    faqSport: 'padbol',
  },

  // ─── HAND / GOAL TEAM ───────────────────────────────────────────────────────

  {
    slug: 'handball',
    name: 'Handball',
    primaryKeyword: 'handball tactics board',
    title: 'Handball Tactics Board — Draw & Share Plays | CourtDraw',
    metaDesc: 'Free online handball tactics board for coaches. Draw 6-0 defense, fast-break wings, pivot screens, and 9m crossing plays. Works on iPad offline.',
    h1: 'Handball Tactics Board',
    emoji: '🤾',
    courtIds: [['handball', 'Handball Court']],
    primaryCourtId: 'handball',
    family: 'hand',
    plays: [
      { id: 'handball_positional_attack', name: 'Positional Attack', desc: 'Structured 3-3 attack building through the backcourt against a set 6-0 defense.' },
      { id: 'handball_fast_break', name: 'Fast Break', desc: 'Wing sprints ahead of the defense to receive a long outlet pass for a clear run at goal.' },
      { id: 'handball_pivot_play', name: 'Pivot Screen', desc: 'Pivot blocks a defender to create a shooting lane for the centre-back or right-back.' },
    ],
    intro: `<p>Handball is a game of structured systems — both in attack and defense — where every player has a defined role and triggers specific movement from their teammates. Trying to explain a 6-0 block defense or a crossing play at the 9-metre line in words alone leaves players guessing. CourtDraw gives you an accurate 7v7 handball court where you can diagram every formation and movement before the session begins.</p>`,
    body: `<h2>Defensive Systems</h2>
<p>Handball defense is defined by its formation — the shape in which the six outfield defenders position themselves relative to the 6-metre line:</p>
<ul>
<li><strong>6-0 defense</strong> — all six defenders on or just inside the 6-metre line, forming a compact wall. Difficult to penetrate but leaves the backcourt shooters with space for long-range shots. Show the spacing (roughly 2–3 metres between each player) and the sliding coordination when the ball moves between positions.</li>
<li><strong>5-1 defense</strong> — one defender moves out to pressure the opponent's centre-back at 9 metres; the remaining five hold the 6-metre line. Show how this changes the spacing requirements for the five back players and the communication triggers for the "1" to retreat.</li>
<li><strong>3-2-1 defense</strong> — aggressive man-to-man hybrid; one defender at 9m, two at 7m, three at 6m. Show the specific assignment for each attacker and how the formation adjusts when the ball is passed.</li>
</ul>

<h2>Attacking Formations</h2>
<p>Handball attack is built around the <strong>3-3 structure</strong>: three backcourt players (left-back, centre-back, right-back) outside the 9-metre line, two wings, and one pivot inside or near the 6-metre line. Every attack pattern is a variant of how these six positions interact:</p>
<ul>
<li><strong>Crossing play at 9m</strong> — centre-back and a back player cross paths to force a defensive switch; the player receiving after the cross has a half-second of separation to shoot. Diagram the cross paths, the pivot's screen to delay pursuit, and the shooting angle.</li>
<li><strong>Pivot screen</strong> — the pivot (PV) sets a body screen on the defender covering the shooting back player; show the timing relative to the ball position and the screen angle required to create the lane.</li>
<li><strong>Wing break</strong> — when a wing player cuts inside after their marker pushes the 6-metre line, creating a run behind the defense; show the wing's cut path and the trigger pass from the centre-back.</li>
</ul>

<h2>Fast Break Organisation</h2>
<p>The fast break is handball's highest-percentage scoring opportunity — a transition directly from defense to a numerical advantage in attack before the opposition defense can reset. There are two types to diagram:</p>
<ul>
<li><strong>Wing fast break</strong> — the wing player sprints immediately on change of possession; the goalkeeper or pivoting defender targets them with a long outlet pass. Show the wing's run path, the pass target zone, and the finish angle at the post.</li>
<li><strong>Organised counter-attack</strong> — a slightly slower transition where two or three players push forward together; diagram their lanes and the passing options available at each stage of the break.</li>
</ul>

<h2>7-Metre Throw (Penalty)</h2>
<p>The 7-metre throw is a guaranteed shooting opportunity and should be rehearsed as a tactical element. Show the shooter's approach angle, the two primary aiming zones (low corner vs high corner), and — for training purposes — the goalkeeper's statistical tendencies for guessing direction. Many coaches use CourtDraw to show the data: if your goalkeeper dives right 70% of the time, aim left.</p>`,
    faqSport: 'handball',
  },

  {
    slug: 'beach-handball',
    name: 'Beach Handball',
    primaryKeyword: 'beach handball tactics board',
    title: 'Beach Handball Tactics Board — Draw Plays | CourtDraw',
    metaDesc: 'Free online beach handball tactics board for coaches. Draw 2-1 defense setups, spin shot positions, and fast-break patterns on sand. Works on iPad.',
    h1: 'Beach Handball Tactics Board',
    emoji: '🤾',
    courtIds: [['beach_handball', 'Beach Handball Court']],
    primaryCourtId: 'beach_handball',
    family: 'hand',
    plays: [],
    intro: `<p>Beach handball's smaller court and double-point scoring for spectacular plays — spin shots, 360s, inflight goals — creates a tactical environment very different from indoor handball. CourtDraw's beach handball board helps coaches design the fast, dynamic plays and set pieces that score double and plan the defensive rotations needed to shut down quick transitions on a compact sand court.</p>`,
    body: `<h2>Beach Handball's Unique Rules</h2>
<p>Before diagramming tactics, make sure your players understand the double-point scoring system: any goal scored with a spin shot, 360-degree movement, in-flight (caught and thrown before landing), or from the goalkeeper constitutes a spectacular goal worth two points. This completely changes the tactical calculus — attacking teams should actively seek double-point opportunities, not just the easiest shot.</p>
<p>Diagram the positioning and movement required for each spectacular goal type:</p>
<ul>
<li><strong>Spin shot setup</strong> — show the approach angle, the body rotation, and the release point that makes a spin shot legal and effective.</li>
<li><strong>In-flight goal</strong> — map the pass-and-catch-in-the-air sequence; the timing of the jump and throw must be precisely rehearsed.</li>
<li><strong>Goalkeeper goal</strong> — the goalkeeper's transition from defense to an attacking goalscoring position; show their movement path and the passing combination that sets them up.</li>
</ul>

<h2>Defense on a Compact Court</h2>
<p>The beach handball court (27×12m) is roughly half the size of an indoor court, giving defenders much less time to react to incoming plays. The standard defensive alignment is a <strong>2-1 zone</strong> — two defenders flanking the goalkeeper area, one defender covering the front zone. Diagram the spacing responsibilities, the lateral slide triggers, and how the zone adjusts when the ball goes wide to the corner.</p>
<p>Against teams that favour spin shots, the defending player must stay tight without fouling — a balance that requires specific positioning: arms up, body balanced, and one step closer to the thrower than the standard gap to reduce the spinning space.</p>

<h2>Fast Break and Counter-Attack</h2>
<p>Given the court's small size, fast breaks in beach handball are even more explosive than in the indoor game. A goalkeeper who catches a thrown ball and immediately targets a sprinting forward with a long pass can create a 1v1 or 2v1 situation in under three seconds. Diagram:</p>
<ul>
<li>The goalkeeper's outlet pass options (right wing vs left wing vs central forward)</li>
<li>The forward's run line to receive without a step violation</li>
<li>The finishing shot type recommended based on the defensive positioning</li>
</ul>

<h2>Set Plays and Free Throws</h2>
<p>Set plays from free throws are critical in beach handball because the compact court means even a marginal advantage in positioning creates a quality shot. Design a three-player combination: one player sets a screen for the thrower, one cuts behind the screen to receive the pass, and the third occupies the goalkeeper's angle. Draw all three players' movements simultaneously on CourtDraw so the coordination becomes clear before the players walk through it on court.</p>`,
    faqSport: 'beach handball',
  },

  {
    slug: 'basketball',
    name: 'Basketball',
    primaryKeyword: 'basketball tactics board',
    title: 'Basketball Tactics Board — Draw & Share Plays | CourtDraw',
    metaDesc: 'Free online basketball tactics board for coaches. Draw pick-and-roll, zone defense, baseline plays, and BLOB sets. Full and half-court views. Works on iPad.',
    h1: 'Basketball Tactics Board',
    emoji: '🏀',
    courtIds: [['basketball_full', 'Full Court'], ['basketball_half', 'Half-Court']],
    primaryCourtId: 'basketball_full',
    family: 'hand',
    plays: [
      { id: 'basketball_pick_roll', name: 'Pick & Roll', desc: 'Ball handler uses a screen; screener rolls to the basket for the pass or scoring opportunity.' },
      { id: 'basketball_zone_23', name: '2-3 Zone Defense', desc: 'Two guards up top, three players covering the paint and corners against zone-busting actions.' },
      { id: 'basketball_inbound', name: 'Baseline Inbound', desc: 'BLOB (Baseline Out-of-Bounds) set creating a catch-and-shoot or drive option.' },
    ],
    intro: `<p>Basketball's pace makes real-time tactical instruction almost impossible — plays develop and resolve in two or three seconds. CourtDraw's basketball board gives you full-court and half-court views so you can diagram everything from transition sets to late-game play calls, share them to the team's phones at halftime, and walk through each movement before it's run in practice.</p>`,
    body: `<h2>Half-Court Offense</h2>
<p>Half-court basketball is where most games are decided, and the <strong>pick-and-roll</strong> is its most fundamental action. But coaching the pick-and-roll means coaching all the options that come from it: the ball handler can reject the screen, use it with a middle drive, use it with a pull-up jumper, or dump off to the rolling big. On CourtDraw you can diagram the decision tree for a single pick-and-roll action as separate phases — each option represented with arrows showing ball movement and player movement in the correct order.</p>
<p>Beyond pick-and-roll, diagram these core half-court principles:</p>
<ul>
<li><strong>Give-and-go</strong> — pass, cut backdoor to the basket; simple but devastatingly effective against over-helping defenders.</li>
<li><strong>Motion offense principles</strong> — ball reversal, skip passes, corner cuts; show the spacing responsibilities that prevent defensive recovery.</li>
<li><strong>High-low action</strong> — pass to the high post, opposite forward cuts to the low post; the timing of the cut relative to the high-post reception is the key coaching point.</li>
<li><strong>Horns set</strong> — two bigs at each elbow, three guards on the perimeter; highly versatile starting formation that can flow into multiple actions.</li>
</ul>

<h2>Zone Defense</h2>
<p>Zone defense confuses attackers who've only been taught to beat man-to-man. The <strong>2-3 zone</strong> is the most common: two guards on the perimeter covering guards and the corners, three players across the paint covering the posts and wing drives. Teams attack the 2-3 by placing a shooter in the high post (the gap above the foul line between the two guards) and hitting the corners rapidly. Diagram the defensive rotations required to close this gap, and show the seam passes attackers use to exploit it.</p>
<p>The <strong>1-3-1 zone</strong> is more aggressive and also more risky — one player pressures the ball at the top, three across the middle level, one at the basket. It creates turnovers but is vulnerable in the corners. Draw the attack pattern (swing to corner, then swing back to opposite corner for a shot) alongside the defensive recovery rotation, so defenders understand exactly what they must prevent.</p>

<h2>Transition and Fast Break</h2>
<p>Transition offense should be diagrammed as a set of rules, not a play: the primary break (leading outlet pass to the wing), the secondary break (if the primary is closed, push the ball to the paint for a post-up), and the set play from the half court (if the defense gets back). Show the sprint lanes for each position and the decision-making triggers at each stage.</p>
<p>Similarly, <strong>transition defense</strong> — getting back in position before the opponent can score — requires diagrammed responsibilities: who sprints back first, who pressures the outlet pass, and who protects the paint. Many coaches diagram this as a numbered priority list with player positions shown at each stage.</p>

<h2>Set Plays: BLOB and SLOB</h2>
<p>Set plays from out-of-bounds situations are among the most rehearsed elements of basketball coaching — and the most in need of visual diagrams. A baseline out-of-bounds (BLOB) play typically involves four options, each triggered by different defensive alignments. A well-designed BLOB creates a catch-and-shoot, a lob to the basket, a mismatch post-up, and an escape option for the inbounder all in one action. Draw each option as a separate phase on CourtDraw, and players will know exactly which option to execute based on what the defense gives them.</p>`,
    faqSport: 'basketball',
  },

  {
    slug: 'netball',
    name: 'Netball',
    primaryKeyword: 'netball tactics board',
    title: 'Netball Tactics Board — Draw & Share Plays | CourtDraw',
    metaDesc: 'Free online netball tactics board for coaches. Draw circle-edge attacks, center-pass patterns, defensive pressures, and GS positioning. Works on iPad.',
    h1: 'Netball Tactics Board',
    emoji: '🏐',
    courtIds: [['netball', 'Netball Court']],
    primaryCourtId: 'netball',
    family: 'hand',
    plays: [],
    intro: `<p>Netball's strict positional zones and no-run rule make spatial awareness the sport's central coaching challenge. Players need to understand not just where to move but exactly how much space is available in each zone. CourtDraw's netball board shows all seven court zones with position labels so you can diagram centre-pass patterns, circle-edge attack combinations, and defensive press systems accurately and share them before every match.</p>`,
    body: `<h2>Centre Pass Patterns</h2>
<p>Every goal begins with a centre pass, and elite teams have multiple rehearsed patterns to give them an early advantage. A centre pass pattern involves two or three players making coordinated drives from their zones to create a clear lead for the first pass:</p>
<ul>
<li><strong>WA cut</strong> — Wing Attack (WA) cuts sharply across toward the transverse line; Centre (C) passes; WA immediately passes to Goal Attack (GA) who has driven into the centre third.</li>
<li><strong>Double lead</strong> — both GA and WA make simultaneous drives in different directions, forcing the opponent's defensive pair to choose one; the centre reads the space and passes to the player whose defender moved toward the other lead.</li>
<li><strong>Stack and split</strong> — GA and WA start together ("stack") then split in opposite directions simultaneously, creating two leads from one starting position.</li>
</ul>
<p>Draw each pattern showing the starting positions, the movement arrows, the pass timing, and the court zone boundaries that constrain each movement. Players who see the geometric constraints will make smarter positional decisions.</p>

<h2>Circle Edge Attack</h2>
<p>The shooting circle edge is where most attacking play is created. The Goal Attack (GA) must find space to receive a pass that either gives them a shooting opportunity or creates a rebound position. Key circle-edge principles to diagram:</p>
<ul>
<li><strong>GA driving post</strong> — GA drives toward the post, creating space for Goal Shooter (GS) to receive at the circle edge; if the pass goes to GS, GA drives for the rebound position.</li>
<li><strong>Double-post attack</strong> — GS and GA both position in the circle, one high and one low; the pass to the high player opens a quick pass to the low player who has the clearest shot.</li>
<li><strong>Roll around the circle</strong> — GA rolls from the outside of the circle edge around the defender to receive a pass from Wing Attack on the move.</li>
</ul>

<h2>Defensive Systems</h2>
<p>Netball defense is primarily man-to-man, but the three-foot rule (defenders must stand at least three feet from the ball-holder) creates specific coaching challenges. Diagram the correct defensive position (three feet from the holder, arms up, balanced stance) and show how it shifts when the ball is passed — the defender must rotate immediately to achieve correct positioning on the new ball-holder within three seconds.</p>
<p>The <strong>defensive press</strong> — applying pressure from the centre circle outward to disrupt the centre pass — involves all players in their zones attempting to intercept or disrupt the first two passes. Draw the press triggers (which player pressures first), the recovery positions if the press fails, and the off-ball interception positions for WD, GD, and GK.</p>`,
    faqSport: 'netball',
  },

  {
    slug: 'korfball',
    name: 'Korfball',
    primaryKeyword: 'korfball tactics board',
    title: 'Korfball Tactics Board — Draw & Share Plays | CourtDraw',
    metaDesc: 'Free online korfball tactics board for coaches. Draw defender-dodging patterns, post play, penalty shot positions, and zone transitions. Works on iPad.',
    h1: 'Korfball Tactics Board',
    emoji: '🏐',
    courtIds: [['korfball', 'Korfball Court']],
    primaryCourtId: 'korfball',
    family: 'hand',
    plays: [],
    intro: `<p>Korfball's mixed-gender 8v8 format and fixed zone system create unique tactical challenges rarely found in other sports. The court splits into two identical zones — each with four attackers and four defenders who swap roles after two goals — and coaching the timing of that zone transition alongside attacking combination plays demands clear visual diagrams. CourtDraw's korfball board covers both zones with accurate post positions so you can map every tactical concept precisely.</p>`,
    body: `<h2>The Korfball System</h2>
<p>Understanding korfball's fundamental structure is the starting point for all tactical coaching. The court is divided into two equal zones, one at each end, each containing a post (the target). Four players from each team are assigned to each zone — one team's attackers in one zone, the other team's attackers in the other. After every two goals scored (by either team), all players switch zones, meaning attackers become defenders and vice versa. This zone-switching requirement makes tactical flexibility essential.</p>

<h2>Attacking Patterns</h2>
<p>In the attacking zone, your four players (two female, two male in mixed korfball) must create shooting opportunities against four defenders. The key attacking principles:</p>
<ul>
<li><strong>Defender-dodging</strong> — the fundamental 1v1 move in korfball; the attacker must get the defender's back to the post to create a legal shooting position (you cannot shoot with a defender directly between you and the post who is within reach). Show the approach angle, the step-across body movement, and the resulting shooting position.</li>
<li><strong>Penalty shot</strong> — awarded when a defender illegally obstructs a clear shot; diagram the positioning requirements for a penalty (2.5m in front of the post, one attempt).</li>
<li><strong>Post play</strong> — a player positioned close behind the post can receive a pass and take a near-post shot; show the route around the post and the ideal reception angle.</li>
<li><strong>Support and combination</strong> — two attackers creating a screen for the third; show the movement of all four attackers simultaneously to demonstrate how combinations open individual shooting lanes.</li>
</ul>

<h2>Defensive Positioning</h2>
<p>Korfball defense requires man-to-man coverage within the zone. The key defensive principle is that a defender must position between their assigned attacker and the post, staying close enough to constitute "defending" (within arm's reach). Diagram the correct defensive angle — slightly to one side so the attacker cannot step through cleanly — and show how the defender adjusts as the ball moves.</p>
<p>When defending against the post play, show how the defending player must go around the same side of the post as the attacker to stay in legal defending position, and how this creates a potential scoring lane if they go the wrong way.</p>

<h2>Zone Transition</h2>
<p>The two-goal zone switch is a distinctive tactical moment. Diagram the communication and positioning protocol: which players cross first, how to communicate the switch mid-play, and the initial positioning each player should take in the new zone. Teams that transition quickly and decisively often score in the first thirty seconds after a switch because the newly attacking players are more aggressive while the newly defensive players are still orienting.</p>`,
    faqSport: 'korfball',
  },

  {
    slug: 'water-polo',
    name: 'Water Polo',
    primaryKeyword: 'water polo tactics board',
    title: 'Water Polo Tactics Board — Draw Plays | CourtDraw',
    metaDesc: 'Free online water polo tactics board for coaches. Draw 3D positioning, 6v5 power play sets, man-up offenses, and goalkeeper angles. Works on iPad.',
    h1: 'Water Polo Tactics Board',
    emoji: '🏊',
    courtIds: [['water_polo', 'Water Polo Pool']],
    primaryCourtId: 'water_polo',
    family: 'hand',
    plays: [],
    intro: `<p>Water polo coaching without a tactics board means miming movement patterns on the pool deck and hoping players transpose it to three dimensions in the water. CourtDraw's water polo board gives you an overhead pool view where you can diagram the 6v5 power-play arc, show the 2-meter player positioning, draw driving lanes, and plan counter-attack patterns before players enter the water.</p>`,
    body: `<h2>Man-Up (6v5) Power Play</h2>
<p>The exclusion foul and resulting man-up is the most tactically structured situation in water polo. Elite teams run rehearsed power-play sets that create high-percentage shooting positions before the excluded defender returns. The standard <strong>arc formation</strong> — six attackers forming a semi-circle around the goal — is the starting point:</p>
<ul>
<li><strong>1-3-2 formation</strong> — centre forward (2-metre player) at the post, three wide players, two guards at the top; ball moves quickly to exploit any gap in the five-player defense.</li>
<li><strong>Point-to-post combination</strong> — ball begins at the "1" (top of the arc), swings quickly to the "2" position wide, then a quick drive to the 2-metre player who shoots from inside the 2-metre area.</li>
<li><strong>Skip pass</strong> — bypassing the near-side defenders by passing directly across the top of the arc to the opposite weak side; diagram the ball path and the intended shooter's positioning before receiving.</li>
</ul>
<p>Diagram these man-up plays showing the numbered positions, ball movement arrows, player drives, and shooting positions. The power play lasts 20 seconds — every player must know their role immediately.</p>

<h2>6v6 Half-Court Offense</h2>
<p>In even-strength situations, water polo offense is built around the 2-metre player (also called the centre forward or "hole set"). The 2-metre player operates just in front of the goal in the exclusion zone and represents the highest-percentage scoring position on the field. Diagram:</p>
<ul>
<li><strong>Drive and kick-out</strong> — a wide player drives hard toward the 2-metre area to draw the opposing 2-metre defender out of position; if the 2-metre player gets behind them, an immediate pass creates a shooting opportunity.</li>
<li><strong>Cross attack</strong> — two wing players exchange positions simultaneously to create mismatches in the resulting defensive recovery.</li>
<li><strong>Weak-side attack</strong> — when the ball is on one wing, the opposite wing drives unseen to the 2-metre area; a skip pass across the pool creates a point-blank shooting position before the defense can recover.</li>
</ul>

<h2>Counter-Attack</h2>
<p>Water polo's counter-attack is among the most explosive in any team sport — a goalkeeper throw to a sprinting forward can create a 2v1 or 1v0 situation in two seconds. Diagram the goalkeeper's outlet throw options, the sprinting lanes for the two forwards, and the trailing player's responsibility to cover a turnover. Teams that have rehearsed counter-attack roles score a disproportionate share of their goals from this situation.</p>

<h2>Goalkeeper Positioning</h2>
<p>The goalkeeper's angle positioning — moving off the line to reduce the visible scoring area — is a teachable tactical skill. Diagram the goalkeeper's optimal position for shots from different angles: further off the line for the top of the arc (wider angle), closer to the line for shots from the wings (narrower angle). Showing this geometry on a bird's-eye view gives goalkeepers a reference frame they can apply automatically during the game.</p>`,
    faqSport: 'water polo',
  },

  // ─── VOLLEY / NET TEAM ─────────────────────────────────────────────────────

  {
    slug: 'volleyball',
    name: 'Volleyball',
    primaryKeyword: 'volleyball tactics board',
    title: 'Volleyball Tactics Board — Draw & Share Plays | CourtDraw',
    metaDesc: 'Free online volleyball tactics board for coaches. Draw 5-1 rotation, libero systems, serve receive patterns, and block-dig coverages. Works on iPad.',
    h1: 'Volleyball Tactics Board',
    emoji: '🏐',
    courtIds: [['volleyball', 'Volleyball Court']],
    primaryCourtId: 'volleyball',
    family: 'volley',
    plays: [
      { id: 'volleyball_serve_receive', name: 'Serve Receive (W Pattern)', desc: 'Classic W-formation receive with three passers and two net players in serving position.' },
      { id: 'volleyball_quick_set', name: 'Quick Set Attack', desc: 'Setter delivers a fast short set to the middle hitter to attack before the block forms.' },
      { id: 'volleyball_libero_rotation', name: 'Libero Coverage', desc: 'Libero covers the entire back row, freeing both outside hitters from passing duties.' },
    ],
    intro: `<p>Volleyball's six-player rotation system means every player's position changes continuously, and ensuring all six players know their responsibilities in every rotation is a constant coaching challenge. CourtDraw's volleyball board shows all six positions simultaneously, making it straightforward to diagram serve-receive formations, rotation responsibilities, and attack patterns that vary by rotation number.</p>`,
    body: `<h2>Rotation and System</h2>
<p>The two most common serving/setting systems — the <strong>5-1</strong> (one setter, five hitters) and the <strong>6-2</strong> (two setters, three active hitters) — have entirely different rotation implications. In a 5-1 system, the setter is in the right-back position when serving, which creates a three-passer serve receive in the front court. In a 6-2, the setter coming from the back row must navigate around the libero. Diagram both systems showing which players are where in each of the six rotations, and teams will stop making position errors before referees call them.</p>

<h2>Serve Receive Formations</h2>
<p>The serve receive formation determines how much court each passer covers and which attackers are free from passing duties. Three common formations to diagram:</p>
<ul>
<li><strong>W-formation (five passers)</strong> — the traditional serve receive with three passers in a diagonal row and two players near the net free to attack immediately. Shows clearly which zones each of the five passers covers.</li>
<li><strong>Three-passer system</strong> — in a 5-1 with a strong libero, only three players pass and three are free at the net. Diagram the specific coverage zones (overlap areas between adjacent passers are the most common miscommunication point).</li>
<li><strong>Two-passer system</strong> — against teams with only one dangerous server, limiting passing to two specialised players; show their movement patterns to cover the entire court from starting positions.</li>
</ul>

<h2>Attack Patterns by Rotation</h2>
<p>Which attack options are available depends on the rotation. In rotation 1 (setter in right back), the outside hitter (OH) is in the front left, the middle is front centre, and the opposite is in the right front — three front-row attackers are available. Diagram the primary attack call (usually OH or middle quick set) and the back-row attack options (pipe from position 6, right-side from position 1) for each rotation. Teams that understand their attack options in every rotation make better play-call decisions under pressure.</p>

<h2>Blocking Systems</h2>
<p>Two blocking systems are used in elite volleyball:</p>
<ul>
<li><strong>Reading blocking</strong> — blockers read the setter's hands and the hitter's approach angle before committing to a block position; show the decision tree as two phases on CourtDraw.</li>
<li><strong>Commit blocking</strong> — middle blocker pre-commits to the quick attacker; show the middle's movement and the outside blockers' responsibility for the back-up attack options.</li>
</ul>
<p>Diagram the blocker's angle relative to the antenna and the coverage zone each defender covers behind the block. The gap between the block and the sideline is the most common undefended area — show which player is responsible and where they should position.</p>

<h2>Libero Responsibilities</h2>
<p>The libero is the most complex positional role in volleyball because their substitution happens mid-rotation without a whistle. Diagram the libero's entry trigger (back row, behind the ten-foot line), their serve-receive coverage zone, and their digging responsibilities in different serve patterns. A well-deployed libero allows both outside hitters to focus entirely on attacking, dramatically increasing the team's offensive firepower.</p>`,
    faqSport: 'volleyball',
  },

  {
    slug: 'beach-volleyball',
    name: 'Beach Volleyball',
    primaryKeyword: 'beach volleyball tactics board',
    title: 'Beach Volleyball Tactics Board — Draw Plays | CourtDraw',
    metaDesc: 'Free online beach volleyball tactics board for coaches. Draw line-cut-angle decisions, poaching, sun tactics, wind adjustments, and defensive positioning.',
    h1: 'Beach Volleyball Tactics Board',
    emoji: '🏐',
    courtIds: [['beach_volleyball', 'Beach Volleyball Court']],
    primaryCourtId: 'beach_volleyball',
    family: 'volley',
    plays: [],
    intro: `<p>Beach volleyball's 2v2 format means every tactical decision has immediate, high-stakes consequences — there's no teammate to cover a positioning error. CourtDraw's beach volleyball board helps coaches diagram the line-vs-cut-angle attack decision, show the block-dig partnership coordination, and plan the serve-and-receive strategy before players face the sun, wind, and sand.</p>`,
    body: `<h2>Attack Decisions: Line, Cut, and Angle</h2>
<p>In beach volleyball, the primary attacker has three main shot options — and the choice between them should be driven by the blocker's position and the defensive partner's coverage. Diagram all three from the same left-side attack position:</p>
<ul>
<li><strong>Line shot</strong> — down the left sideline past the blocker's line-hand; most effective when the blocker is taking angle.</li>
<li><strong>Cut shot (angle)</strong> — hit sharply cross-court to the right front corner; most effective when the blocker is taking line.</li>
<li><strong>High line (roll shot)</strong> — a controlled high-arcing shot down the line when the blocker is taking line and the defender covers angle deeply.</li>
</ul>
<p>Show the attacker's view: the blocker's hand position tells the attacker which option is open. Draw the blocker's hands blocking line, and the resulting open angle. Draw the hands blocking angle, and the open line. This visual decision tree takes seconds to create and permanently improves attack selection.</p>

<h2>Blocking and Defensive Partnership</h2>
<p>Because there are only two players, blocking requires a precise agreement between partners about who blocks and what the defender covers:</p>
<ul>
<li><strong>One-person block</strong> — the blocker takes one direction; the defender takes everything else. Diagram the blocker's hand position and the defender's deep coverage zone.</li>
<li><strong>No-block (peel defense)</strong> — the blocker drops back to defend; both players cover the court without a block. Effective against players with excellent off-speed shots but risky against hard drivers.</li>
<li><strong>Pointer system</strong> — the blocker signals to the setter before the serve which direction they'll block (line or cut), allowing the defender to pre-position. Draw the hand signal and the resulting defensive coverage as two separate diagrams.</li>
</ul>

<h2>Serve Strategy</h2>
<p>The serve in beach volleyball is a primary tactical weapon. Aggressive float serves into the wind create movement difficulties for the passer; topspin jump serves targeting a specific player's weaker arm can disrupt the entire offensive system. Diagram the target zones for each serve type and the resulting passing angles that force the set to a less-preferred attacker.</p>
<p>Also diagram the <strong>serve-receive formation</strong>: in most pairs, the better passer covers slightly more court, but the exact positioning depends on the sun angle, wind direction, and the opponent server's tendencies. Show these adjustments on the board before each match.</p>

<h2>Environmental Factors</h2>
<p>Unlike indoor volleyball, environmental factors are tactical inputs in beach volleyball. Diagram the sun angle impact: if the sun is in the right-side attacker's eyes, shift the serve target accordingly. Show how wind affects the float serve's movement path. Mapping these environmental adjustments on CourtDraw's board before a match gives your players a clear game plan for conditions they can't control but can prepare for.</p>`,
    faqSport: 'beach volleyball',
  },

  {
    slug: 'fistball',
    name: 'Fistball',
    primaryKeyword: 'fistball tactics board',
    title: 'Fistball Tactics Board — Draw & Share Plays | CourtDraw',
    metaDesc: 'Free online fistball tactics board for coaches. Draw 5v5 attack patterns, jump serve tactics, libero coverage systems, and back-line defense setups.',
    h1: 'Fistball Tactics Board',
    emoji: '🏐',
    courtIds: [['fistball', 'Fistball Court']],
    primaryCourtId: 'fistball',
    family: 'volley',
    plays: [],
    intro: `<p>Fistball's 5v5 format with a three-touch limit (one player may touch the ball up to three consecutive times) and one bounce allowed per side creates tactical patterns unlike any other net sport. CourtDraw's fistball board helps coaches design attack combinations, diagram serve-and-receive positioning, and show defensive coverage responsibilities for both the deep and front-court zones.</p>`,
    body: `<h2>Fistball Basics for Tactical Coaching</h2>
<p>Fistball is played with a closed fist or forearm on a rectangular court divided by a net. Each team gets up to three contacts before the ball must cross the net, and one bounce per contact is allowed (touching the ground). The three-contact pattern — typically receive, set, attack — parallels volleyball but the bounce option creates additional strategic depth: a controlled bounce can reset a difficult receive and allow a higher-quality set and attack sequence.</p>

<h2>Attack Patterns</h2>
<p>Five players on the court means attack assignments must be clearly defined. The standard attack formation uses one player as the primary hitter positioned just behind the net to attack high sets, with two secondary attackers available from deeper positions. Diagram:</p>
<ul>
<li><strong>Net attack</strong> — front player receives a set and attacks with a downward strike aimed at the far-court defensive gaps.</li>
<li><strong>Back-court power attack</strong> — deep player receives the set and attacks with a high-arcing power shot aimed beyond the opponent's defenders.</li>
<li><strong>Cross-court attack</strong> — diagonal attack to expose the defensive gap when the opponent's coverage is weighted toward one side.</li>
</ul>

<h2>Serve and Receive</h2>
<p>The serve in fistball is a jump or standing punch aimed to make accurate receive difficult. The jump serve from the baseline with spin is the most advanced option. Show target zones:</p>
<ul>
<li><strong>Short serve</strong> — low over the net, bouncing close to the net to force a difficult reach-forward receive.</li>
<li><strong>Deep line serve</strong> — deep to a corner, forcing the back-court player to travel maximum distance.</li>
<li><strong>Body serve</strong> — aimed at the receiver's dominant arm to force an awkward contact.</li>
</ul>
<p>The receive formation — typically two deep players and two mid-court players with one near the net — should be diagrammed showing which player calls for the ball and which back player provides secondary support.</p>

<h2>Defense</h2>
<p>With five players defending, coverage is primarily man-zone: each player covers an assigned zone but can assist the adjacent player's zone when the ball is clearly heading there. Diagram the coverage responsibility for each position, the communication protocol between the front-court players and the deep players, and the specific defensive positioning adjustments required when the opponent has a strong cross-court attack.</p>`,
    faqSport: 'fistball',
  },

  // ─── FOOTBALL CODES ─────────────────────────────────────────────────────────

  {
    slug: 'football',
    name: 'Football / Soccer',
    primaryKeyword: 'football tactics board',
    title: 'Football Tactics Board — Draw & Share Plays | CourtDraw',
    metaDesc: 'Free online football tactics board for coaches. Draw formations, high press, corner routines, set pieces, and build-up patterns. Full and half pitch. Works on iPad.',
    h1: 'Football Tactics Board',
    emoji: '⚽',
    courtIds: [['football_full', 'Full Pitch'], ['football_half', 'Half Pitch']],
    primaryCourtId: 'football_full',
    family: 'football',
    plays: [
      { id: 'football_high_press', name: 'High Press', desc: 'Aggressive press triggers in the opponent\'s defensive third to force turnovers near goal.' },
      { id: 'football_corner_kick', name: 'Corner Kick Routine', desc: 'Near-post flick-on with blockers and a back-post runner creating a layered threat.' },
      { id: 'football_tiki_taka', name: 'Tiki-Taka Build-Up', desc: 'Short-pass possession play from the back to draw opponents out of shape.' },
    ],
    intro: `<p>Football tactics exist at every level — from positioning your back four against a high press to rehearsing a dead-ball routine your opponents haven't seen. CourtDraw's football board provides both full and half-pitch views so you can diagram 11v11 formations and half-pitch set pieces side by side, then share them to WhatsApp before training. No more whiteboard scrawls that get erased.</p>`,
    body: `<h2>Formation and Shape</h2>
<p>A team's formation is its default shape when not in possession, and the choice between a back four (4-3-3, 4-2-3-1, 4-4-2) and a back three (3-4-3, 3-5-2, 5-3-2) determines the entire tactical framework. On CourtDraw you can diagram both and show players how the midfield compactness changes based on the shape:</p>
<ul>
<li><strong>4-3-3 vs 4-3-3</strong> — show how the number-10 finding pockets of space between the opponent's lines changes with different midfield orientations.</li>
<li><strong>Back three with wing-backs</strong> — diagram how the wing-backs provide width in attack while the back three holds defensive shape, creating a 5-2-3 in defense and a 3-4-3 in attack.</li>
<li><strong>Double pivot</strong> — two defensive midfielders in front of the back four; show the coverage responsibilities when one pivots steps out to press and the other holds.</li>
</ul>

<h2>High Press and Pressing Triggers</h2>
<p>A high press is not random aggression — it's a structured system with specific triggers. The most common trigger is a pass to the goalkeeper or a centre-back who receives under pressure with their back to the field. Show on CourtDraw:</p>
<ul>
<li>The <strong>trigger moment</strong> — the exact ball position that activates the press.</li>
<li>The <strong>pressing shape</strong> — which player attacks the ball-carrier, which player covers the primary pass option, and which players block the secondary options.</li>
<li>The <strong>pressing traps</strong> — how the press forces the ball toward the sideline where space is compressed; the sideline acts as an extra defender.</li>
</ul>

<h2>Build-Up Play</h2>
<p>Coaching build-up from the back requires players to understand the spacing principles that create passing lanes and how to position in relation to the opponent's press. Diagram:</p>
<ul>
<li><strong>Back three under press</strong> — goalkeeper dropping to form a three with the center-backs; the two holding midfielders positioning in the half-spaces to receive.</li>
<li><strong>Overlaps and underlaps</strong> — when full-backs overlap (run outside the winger) versus underlap (run inside); show the geometry that makes each more effective against different defensive shapes.</li>
<li><strong>Third-man runs</strong> — the player who runs beyond the immediate pass receiver to create the next passing option; diagram the timing of this run relative to the first pass.</li>
</ul>

<h2>Set Pieces</h2>
<p>Set pieces represent the most rehearsable, coachable situations in football. Detailed diagrams on CourtDraw make the difference between a set piece that looks polished and one that dissolves into confusion:</p>
<ul>
<li><strong>Corner routines</strong> — show blocker positions, decoy runners, and the primary attacker's run path; include the goalkeeper's expected positioning and how this influences the ball target.</li>
<li><strong>Free kicks</strong> — diagram the wall position, the runner who delays in the wall to create a route, and the alternative direct-shot targeting zone.</li>
<li><strong>Throw-ins in the final third</strong> — structured throw-in patterns that create an immediate shooting opportunity or a combination into the box.</li>
</ul>`,
    faqSport: 'football',
  },

  {
    slug: 'futsal',
    name: 'Futsal',
    primaryKeyword: 'futsal tactics board',
    title: 'Futsal Tactics Board — Draw & Share Plays | CourtDraw',
    metaDesc: 'Free online futsal tactics board for coaches. Draw 1-2-1 rotations, pivot play, 4v4 mini-futsal sets, pressing systems, and power-play patterns. Works on iPad.',
    h1: 'Futsal Tactics Board',
    emoji: '⚽',
    courtIds: [['futsal', 'Futsal Court (5v5)'], ['futsal_mini', 'Futsal Mini / 5-a-side (4v4)']],
    primaryCourtId: 'futsal',
    family: 'football',
    plays: [],
    intro: `<p>Futsal is the chess board of football — every pass, rotation, and pressing trigger is calculated on a compressed court where mistakes are immediately punished. CourtDraw provides both the standard futsal court (5v5) and the futsal mini / 5-a-side court (4v4), so you can diagram the rotation systems, pivot combinations, and power-play sets that define modern futsal coaching.</p>`,
    body: `<h2>The 1-2-1 Rotation System</h2>
<p>Futsal's attacking structure is built around continuous rotation. The standard 1-2-1 formation places one fixo (defender), two alas (wingers), and one pivô (centre forward). But the tactical power is in the rotation: as the ball moves, each player shifts into a new role fluidly. Coaches who diagram this rotation clearly prevent the most common futsal error — two players occupying the same zone while leaving another empty.</p>
<p>Draw the 1-2-1 rotation as a sequential animation: ball to the right ala → ala passes to the pivô → pivô lays off to the arriving left ala → left ala shoots or returns to fixo. Show each player's movement path as the ball progresses. Players who see the full rotation cycle understand why they must move when they don't have the ball.</p>

<h2>Pivot Play</h2>
<p>The <strong>pivô</strong> is futsal's most influential position — a physically strong, technically precise player who operates with their back to goal, holds the ball under pressure, and plays combination passes with the alas. Key pivô plays to diagram:</p>
<ul>
<li><strong>Back-to-goal hold and lay-off</strong> — pivô receives, holds against the pressing defender, waits for an ala's run, then lays off first-time for a shot.</li>
<li><strong>Pivô screen and spin</strong> — pivô screens the defender, receives a pass, and spins for a direct shot.</li>
<li><strong>Pivô decoy run</strong> — pivô's run pulls the defender away from the zone, creating space for a late-arriving ala to receive in the vacated area.</li>
</ul>

<h2>Pressing Systems</h2>
<p>Because the court is small and there's no throw-ins (the ball stays live off the boards), pressing in futsal is extremely effective. The three main pressing shapes:</p>
<ul>
<li><strong>4-0 high press</strong> — all four outfield players press aggressively in the opponent's half, trapping the ball against the boards.</li>
<li><strong>2-2 press</strong> — two players press the ball, two cover the passing options; more structured but less intense than the 4-0.</li>
<li><strong>Drop and trap</strong> — allow the opponent to bring the ball forward, then spring a pressing trap at the halfway line using the touchline as an additional boundary.</li>
</ul>

<h2>Power Play (Goalkeeper as Outfield Player)</h2>
<p>One of futsal's most dramatic tactical situations is the power play — when a team trailing by one goal pulls the goalkeeper to field five outfield players. Diagram the resulting 5v4 formation: where the "false goalkeeper" positions, how the five outfield players create an extra passing option in the final third, and the defensive transition responsibilities if possession is lost. This power play is extremely high-risk but potentially game-changing, making it one of the most valuable diagrams to have prepared.</p>

<h2>Futsal Mini / 5-a-Side</h2>
<p>The 4v4 format on a smaller court amplifies every principle: rotations happen faster, the pivô has even less space to operate, and pressing yields turnover opportunities within seconds. Diagram the 1-1-1 rotation triangle for 4-player futsal and the specific positioning for set pieces (kick-ins, corner kicks, free kicks) that differ from the full futsal rules.</p>`,
    faqSport: 'futsal',
  },

  {
    slug: 'beach-soccer',
    name: 'Beach Soccer',
    primaryKeyword: 'beach soccer tactics board',
    title: 'Beach Soccer Tactics Board — Draw Plays | CourtDraw',
    metaDesc: 'Free online beach soccer tactics board for coaches. Draw volley finishing patterns, high-ball strategy, overhead kick setups, and pressing on sand. Works on iPad.',
    h1: 'Beach Soccer Tactics Board',
    emoji: '⚽',
    courtIds: [['beach_soccer', 'Beach Soccer Pitch']],
    primaryCourtId: 'beach_soccer',
    family: 'football',
    plays: [],
    intro: `<p>Beach soccer's spectacular scoring — volleys, overhead kicks, scissor shots — demands a tactical understanding of high-ball play, aerial positioning, and sand-specific movement. CourtDraw's beach soccer board helps coaches diagram the 5v5 attacking patterns, plan free kick routines that set up overhead kick finishes, and show the defensive positioning required against a fast, vertical game on sand.</p>`,
    body: `<h2>High-Ball and Aerial Play</h2>
<p>Unlike grass football, beach soccer rewards spectacular technique — goals scored by volley, overhead kick, or bicycle kick count as any other goal, and the combination of sand (which limits running speed) and the no-bounce preference creates a naturally aerial game. Every tactical system in beach soccer must account for aerial duels:</p>
<ul>
<li><strong>Pivot aerial target</strong> — the front player jumps for high balls and flicks them down to arriving teammates; diagram the jumping position, flick direction, and the supporting runners' lanes.</li>
<li><strong>Overhead kick sequence</strong> — a lofted pass into a specific zone where the attacker can position for an overhead kick; diagram the passer's position, the target aerial zone, and the two secondary positions covering the rebound.</li>
<li><strong>Volley from wide delivery</strong> — a wide player delivers a cross; the central player jumps for a volley finish; diagram the cross trajectory and the striker's run to the correct aerial contact point.</li>
</ul>

<h2>5v5 Attack Patterns</h2>
<p>With five players and no offside rule, beach soccer attack is fluid and vertical. The standard formation (1 GK + 4 outfield) uses positional principles rather than fixed formations:</p>
<ul>
<li><strong>Overloading the central channel</strong> — three players driving through the middle simultaneously, forcing the defense to choose; diagram the three runs and the goalkeeper's outlet pass to the centre player.</li>
<li><strong>Wide-and-cross</strong> — a player makes a wide run to the touchline; a long pass creates a 1v1 with the central defender; the cross is aimed at the back post for an attacking run by two teammates.</li>
<li><strong>Goalkeeper counter-throw</strong> — the goalkeeper's long throw directly to a striker running in behind the defense is one of beach soccer's most effective transition plays; diagram the striker's run angle and the timing of the release.</li>
</ul>

<h2>Free Kicks and Set Pieces</h2>
<p>Free kicks in beach soccer are among the most entertaining set pieces in sport — specialists can curl, dip, and rainbow the ball over walls with extraordinary precision. As a coach, diagram the wall position, the fake run to distract the wall, and the intended ball flight path. Also show the secondary option: a pass around the wall to a player who volleys first-time while the goalkeeper is committed to the direct shot.</p>

<h2>Pressing on Sand</h2>
<p>Because footing is less secure on sand, pressing in beach soccer is more targeted than in grass football. Show the pressing trigger (usually a loose heavy touch) and the compact pressing shape that cuts off the lateral pass while allowing the ball carrier to only play forward into a waiting defender. Sand reduces acceleration, meaning a player who commits to a press has less recovery ability — diagram the cover positions carefully to avoid being caught on a turnover.</p>`,
    faqSport: 'beach soccer',
  },

  {
    slug: 'rugby-union',
    name: 'Rugby Union',
    primaryKeyword: 'rugby union tactics board',
    title: 'Rugby Union Tactics Board — Draw & Share Plays | CourtDraw',
    metaDesc: 'Free online rugby union tactics board for coaches. Draw lineout drives, scrum plays, back-line moves, kick tactics, and defensive patterns. Works on iPad.',
    h1: 'Rugby Union Tactics Board',
    emoji: '🏉',
    courtIds: [['rugby_union', 'Rugby Union Pitch']],
    primaryCourtId: 'rugby_union',
    family: 'football',
    plays: [
      { id: 'rugby_lineout', name: 'Lineout Drive', desc: 'Structured lineout with maul formation driving toward the try line.' },
      { id: 'rugby_scrum', name: 'Scrum — Blindside Attack', desc: 'Ball out to the blindside flanker exploiting the space between scrum and touchline.' },
      { id: 'rugby_line_break', name: 'Line Break & Support', desc: 'Fly-half breaks the defensive line; supporting runners provide angles for continuation.' },
    ],
    intro: `<p>Rugby union's 15-player game is among the most tactically complex in team sport — lineout calls, scrum plays, kick-chase patterns, and backline moves all require detailed pre-match preparation. CourtDraw's rugby union board gives coaches an accurate full-pitch view for diagramming defensive systems and attack plays, and a touchline-to-touchline width view for showing lineout and scrum plays in detail.</p>`,
    body: `<h2>Set Piece: Lineout and Maul</h2>
<p>The lineout is rugby union's most structured set piece and one where a tactical advantage is most achievable. Diagram the lineout as a choreographed operation:</p>
<ul>
<li><strong>Jumping position calls</strong> — front of the lineout (position 2), middle (position 4 or 6), or tail (position 7 or 8); show how the jumper's position alters the defensive shape and the available receivers.</li>
<li><strong>Driving maul</strong> — receiver from the lineout is immediately bound by supporting forwards; show the individual binding positions and the coordinated drive direction.</li>
<li><strong>Peel around the maul</strong> — number 8 or a back row peels off the maul end and attacks the channel between the maul and the defensive line before they can set.</li>
</ul>

<h2>Scrum Plays</h2>
<p>From a scrum, the halfback has multiple distribution options, each with specific supporting runs:</p>
<ul>
<li><strong>Blindside attack</strong> — ball out to the blindside flanker or wing in the narrow channel between scrum and touchline; effective when the defensive scrum-half is slow to cover.</li>
<li><strong>Number 8 pick-and-go</strong> — number 8 picks the ball from the base of the scrum and drives directly into the defensive line; diagram the forwards' pod formation ahead of the pick to give the 8 a blockers' advantage.</li>
<li><strong>Wide backline play</strong> — quick delivery to the halfback who pops it to the fly-half and the centres run an attacking move (scissors, miss-pass, crash ball) before the opposition defense can reorganise.</li>
</ul>

<h2>Attack Play Patterns</h2>
<p>Modern rugby union attack is built around creating width and then exploiting the overlaps that the defense's rush creates. Key patterns to diagram:</p>
<ul>
<li><strong>Pod attack</strong> — forward pods of three hit the defense in succession, each taking the ball to contact and recycling; show the pods' positions relative to the previous ruck and the halfback's role in committing to each pod.</li>
<li><strong>Offload game</strong> — players who take contact at pace with arms free can offload to a support runner before the tackle completes; show the body position and the support runner's line to receive.</li>
<li><strong>Back-three counter-attack</strong> — full-back or wingers who catch a kick behind the gain line and counter-attack; diagram the two support runners' angles and how they create a 3v2 situation against the covering defense.</li>
</ul>

<h2>Defensive Systems</h2>
<p>Two primary defensive systems in modern rugby union:</p>
<ul>
<li><strong>Blitz defense</strong> — the entire defensive line advances quickly as the ball leaves the ruck, reducing the attacker's space and time; diagram the alignment relative to the ball and the timing trigger.</li>
<li><strong>Drift defense</strong> — the line holds and forces the ball wide toward the touchline rather than advancing; diagram the drift angle for each defender relative to their opposite number's inside shoulder.</li>
</ul>`,
    faqSport: 'rugby union',
  },

  {
    slug: 'rugby-league',
    name: 'Rugby League',
    primaryKeyword: 'rugby league tactics board',
    title: 'Rugby League Tactics Board — Draw & Share Plays | CourtDraw',
    metaDesc: 'Free online rugby league tactics board for coaches. Draw six-tackle sets, kick on last, dummy-half plays, and backline attack patterns. Works on iPad.',
    h1: 'Rugby League Tactics Board',
    emoji: '🏉',
    courtIds: [['rugby_league', 'Rugby League Pitch']],
    primaryCourtId: 'rugby_league',
    family: 'football',
    plays: [],
    intro: `<p>Rugby league's six-tackle possession structure creates a very different tactical environment from union — every set of six is a managed sequence of play, a kick return, and a defensive reset. CourtDraw's rugby league board helps coaches design dummy-half plays, diagram the kick-on-last game plan, and draw defensive line spacing before the session, so players arrive understanding the week's tactical focus without spending the entire training session on whiteboard talk.</p>`,
    body: `<h2>Six-Tackle Structure</h2>
<p>Every set of six tackles in rugby league should be a planned sequence, not a series of individual decisions. Coaches diagram the six tackles as a progression:</p>
<ul>
<li><strong>Tackles 1–3 (territory phase)</strong> — use the first three tackles to gain ground and reset field position; show the carry lanes for each carry and the dummy-half's position after each play-the-ball.</li>
<li><strong>Tackles 4–5 (attack build)</strong> — set up the attacking opportunity with a structured move — a wide carry, a dummy-half run, or a backline attack — on tackle 4, with the 5th tackle setting the platform for the kick.</li>
<li><strong>Tackle 6 (kick game)</strong> — the grubber, chip, or bomb on the last tackle; diagram the kick type, the target zone, and the four chasing players' sprint lanes.</li>
</ul>

<h2>Dummy-Half Plays</h2>
<p>The dummy-half (the player who picks up the ball from the play-the-ball) has two options: distribute immediately or run. Dummy-half runs are most effective when the defense is out of line or the dummy-half has a clear gap to the side of the ruck. Show on CourtDraw the defensive trigger that creates the run opportunity and the lane the dummy-half should target.</p>
<p>The <strong>dummy-half play</strong> on tackle 3 or 4 — rather than waiting for the standard carry — is especially effective when the defense has settled into a flat line and the gap is between the marker and the first defender. Diagram this as a two-phase play: the carry into contact on tackle 3, the dummy-half spotting the gap, and the run on the resulting play-the-ball.</li>

<h2>Kick Game</h2>
<p>The kick on the last tackle is the most analysed decision in professional rugby league. Three main options:</p>
<ul>
<li><strong>Grubber</strong> — low-bouncing kick along the ground; aimed at the corner or the space behind the defensive line; diagram the target zone and the two chasers' sprint lines.</li>
<li><strong>Bomb (up-and-under)</strong> — high kick into a contest zone; most effective in the rain or against teams with weak aerial ability; show the target landing zone and the two contesters' approach paths.</li>
<li><strong>Chip over the line</strong> — short kick over the first line of defense for a chasing player to regather; diagram the trajectory and the chasing player's starting position relative to the kick.</li>
</ul>

<h2>Defensive Line Spacing</h2>
<p>Rugby league defense is a line — 13 players closing the width of the field in coordination. Show the standard defensive alignment (one marker, two flanking the ruck, line defense across the width) and the communication protocols when the line must shift for a wide attack. The most common defensive error — gaps forming between adjacent defenders — is corrected more effectively with a visual diagram than with verbal instruction.</p>`,
    faqSport: 'rugby league',
  },

  {
    slug: 'gaelic-football',
    name: 'Gaelic Football',
    primaryKeyword: 'gaelic football tactics board',
    title: 'Gaelic Football Tactics Board — Draw Plays | CourtDraw',
    metaDesc: 'Free online gaelic football tactics board for coaches. Draw kickout strategies, sweeper systems, attacking half-forward play, and set piece routines. Works on iPad.',
    h1: 'Gaelic Football Tactics Board',
    emoji: '⛳',
    courtIds: [['gaelic_football', 'GAA Pitch']],
    primaryCourtId: 'gaelic_football',
    family: 'football',
    plays: [],
    intro: `<p>Gaelic football's unique blend of skill — hand-passing, solo-running, and point-scoring from distance — creates tactical patterns unlike any other football code. The kickout contest, the sweeper system debate, and the half-forward line's dual attack-defense role are all coaching challenges that benefit enormously from visual diagrams. CourtDraw's Gaelic football board gives you an accurate GAA pitch view to diagram every tactical concept before your players leave the dressing room.</p>`,
    body: `<h2>Kickout Strategy</h2>
<p>The kickout is one of the most contested moments in Gaelic football. A short kickout (under 45m) is safe but limits attacking momentum; a long kickout (to the half-forward or full-forward line) is ambitious but rewards teams with superior aerial ability. Diagram two approaches:</p>
<ul>
<li><strong>Short kickout pattern</strong> — goalkeeper to the corner-backs who recycle through the half-backs; show the positioning of the defending team and how the short kickout draws them forward before switching to a long delivery to the forward line.</li>
<li><strong>Targeted long kickout</strong> — goalkeeper targets a specific half-forward who makes a lead run into a chosen zone; show the runner's path and the two secondary runners who contest the loose ball if the first recipient is disrupted.</li>
</ul>

<h2>Sweeper System</h2>
<p>The sweeper system — placing one player as a deep defender covering the space behind the main defensive line — has been a defining tactical debate in Gaelic football for the past decade. Diagram it from both the defending team's perspective and the attacking team's response:</p>
<ul>
<li><strong>Defensive sweeper position</strong> — where the sweeper positions relative to the full-back line, how they communicate position changes based on ball location, and the space they protect.</li>
<li><strong>Attacking against the sweeper</strong> — drawing the sweeper by circulating the ball wide, then playing a ball into the space the sweeper vacated when they pressed across.</li>
</ul>

<h2>Half-Forward Play</h2>
<p>The half-forward line is Gaelic football's most versatile sector — responsible for winning kickouts, initiating attacks, and tracking back to support the midfield when the team is under pressure. Show players how to:</p>
<ul>
<li>Position to receive a kickout and immediately transition to attack</li>
<li>Support runs from half-forward into the full-forward line</li>
<li>The pressing shape when the opponents are kicking out</li>
</ul>

<h2>Point-Scoring and Shot Selection</h2>
<p>Because Gaelic football rewards both goals (3 points) and points (1 point from between the posts above the bar), the decision between shooting for a point and going for goal is a key tactical choice. Diagram the zones from which a point attempt is high-percentage versus when driving forward for a goal attempt is preferred. Show the goalkeeper positioning that makes a low goal-bound shot more or less likely to succeed, and how attackers should approach based on what the score differential requires.</p>`,
    faqSport: 'gaelic football',
  },

  {
    slug: 'american-football',
    name: 'American Football',
    primaryKeyword: 'american football playbook',
    title: 'American Football Playbook — Draw & Share Plays | CourtDraw',
    metaDesc: 'Free online American football playbook tool for coaches. Draw offensive formations, blitz packages, cover-2 zones, red zone plays, and kickoff returns. Works on iPad.',
    h1: 'American Football Playbook',
    emoji: '🏈',
    courtIds: [['american_football', 'Football Field']],
    primaryCourtId: 'american_football',
    family: 'football',
    plays: [
      { id: 'amfootball_shotgun', name: 'Shotgun Formation', desc: 'QB lines up in shotgun; WRs split wide with a slot receiver in the middle.' },
      { id: 'amfootball_blitz', name: 'Blitz Package', desc: 'Send extra rushers to overwhelm the offensive line and pressure the QB.' },
      { id: 'amfootball_zone_coverage', name: 'Cover 2 Zone', desc: 'Two safeties split the deep field; cornerbacks take the flats.' },
    ],
    intro: `<p>American football is the most diagram-intensive team sport in the world — professional teams carry hundreds of plays in their playbook. CourtDraw gives coaches at every level a digital playbook tool where you can draw offensive formations, defensive coverages, and special teams plays and share them with players before game day. No printing, no laminating, no lost sheets.</p>`,
    body: `<h2>Offensive Formation Design</h2>
<p>American football offense begins with formation — the alignment of players before the snap that determines the available routes, blocking assignments, and defensive matchups. CourtDraw lets you diagram any formation accurately:</p>
<ul>
<li><strong>Shotgun vs under-centre</strong> — show how the QB's starting position changes the timing of handoffs, play-action fakes, and the offensive line's protection responsibilities.</li>
<li><strong>Personnel groupings</strong> — 11 (one TE, one RB), 12 (two TE, one RB), 21 (two RB, one TE) packages each create different blocking and receiving options. Diagram how each grouping changes the defensive alignment before the play begins.</li>
<li><strong>Pre-snap motion</strong> — a receiver in motion before the snap can reveal man or zone coverage; diagram the motion path and the two defensive responses (a defender following indicates man coverage; no follow indicates zone).</li>
</ul>

<h2>Route Trees and Passing Concepts</h2>
<p>A passing play is more than one route — it's a concept where multiple routes combine to attack the same defensive zone from different angles. Three essential concepts to diagram:</p>
<ul>
<li><strong>Mesh concept</strong> — two receivers cross paths in the middle of the field; the QBs reads which receiver comes open first based on the linebacker's decision to follow which crosser.</li>
<li><strong>Smash concept</strong> — corner route from the outside receiver with a hitch route from the inside receiver; attacks the cornerback's deep-or-shallow decision.</li>
<li><strong>Four verticals</strong> — all four receivers run vertical routes; the safety's decision to cover one side opens the other; QB identifies the open lane based on pre-snap safety position.</li>
</ul>

<h2>Defensive Coverage Systems</h2>
<p>Defensive coverage is the chess game within the game. Cover 2 is the foundation; Cover 3 adds a middle safety; Cover 4 is a quarters scheme:</p>
<ul>
<li><strong>Cover 2</strong> — two safeties cover the deep halves; cornerbacks sink to the flats. Vulnerable to the seam route (between safety and cornerback in the middle depth). Show the seam gap and how offenses attack it.</li>
<li><strong>Cover 3</strong> — three defenders cover deep thirds (free safety and both corners); four defenders cover short zones. Vulnerable to the 4-verticals concept when four receivers flood the three deep zones.</li>
<li><strong>Man coverage</strong> — each defender covers a specific receiver regardless of their route; show the leverage position for each defensive assignment (inside leverage, outside leverage, press).</li>
</ul>

<h2>Red Zone and Short-Yardage</h2>
<p>The red zone (inside the opponent's 20-yard line) is where field goal opportunities end and touchdown attempts begin. Diagram the specific plays that work in compressed space — shorter routes, more motion, and tighter formations that create mismatches. Show the difference between a standard passing play and its red zone adaptation, and why certain concepts are specifically designed for the reduced field depth.</p>`,
    faqSport: 'american football',
  },

  {
    slug: 'australian-rules',
    name: 'Australian Rules Football',
    primaryKeyword: 'australian rules football tactics board',
    title: 'Australian Rules Tactics Board — Draw Plays | CourtDraw',
    metaDesc: 'Free online Australian rules football tactics board for coaches. Draw zone defense, stoppage patterns, forward structure, and kick-in plays. Works on iPad.',
    h1: 'Australian Rules Football Tactics Board',
    emoji: '🏈',
    courtIds: [['australian_rules', 'AFL Oval']],
    primaryCourtId: 'australian_rules',
    family: 'football',
    plays: [],
    intro: `<p>Australian rules football's giant oval and 18-player teams create a tactical environment unlike any other sport. CourtDraw's AFL board gives coaches an accurate oval view for diagramming centre-bounce positioning, forward structure, and zone-defense patterns before training — bringing a level of visual tactical preparation that was previously only available at elite club level.</p>`,
    body: `<h2>Centre Bounce Setup</h2>
<p>The centre bounce is AFL's equivalent of a set piece — 36 players position themselves across the oval before the umpire bounces the ball at centre, creating a structured contest. The four players in the centre square (two ruckmen and two followers) contest the bounce while the remaining 28 position to best receive the cleared ball. Diagram your setup:</p>
<ul>
<li>The ruckman's jump target direction (favouring the right or left based on wind and your player's strength)</li>
<li>The two followers' starting positions and movement path to contest the second ball</li>
<li>The midfielders' "wings" positions and the half-forward's position as the first receiver out of the stoppage</li>
</ul>

<h2>Forward Structure</h2>
<p>The forward fifty is where games are won and lost. Show players the standard forward structure — two key forwards in the forward pockets, one tall centre-forward as the marking target, and two forward flanks creating lead and contest options:</p>
<ul>
<li><strong>Lead patterns</strong> — the centre-forward's lead away from the ball to create a marking position; the timing of the lead relative to the midfielder's entry into the fifty.</li>
<li><strong>Second-effort pack position</strong> — when the key forward contests a mark they won't win, where they position to receive the spill.</li>
<li><strong>Goal-square position</strong> — the designated player who positions for a snap or a loose ball in the goal square during a pack contest.</li>
</ul>

<h2>Zone Defense</h2>
<p>Zone defense in AFL — players covering areas of the ground rather than man-marking opponents — has become increasingly common, particularly across the half-forward line to stop teams breaking from defense:</p>
<ul>
<li><strong>Spread zone</strong> — half-back line and midfielders form a curtain across the centre of the ground; diagram the individual zone responsibilities and the triggers for breaking the zone to chase the ball.</li>
<li><strong>Forward press</strong> — applying zone pressure in the forward fifty to stop the opposition running the ball out of defense; show the triggering moments (when to press vs when to recover).</li>
</ul>

<h2>Kick-In Plays</h2>
<p>After a behind is scored, the defending team kicks in from the goal square. The kick-in is a strategic opportunity — the ball can be played to a specific target immediately rather than kicked long into a contest. Diagram the kick-in options: short to the goal square pocket, medium-range to a leading defender, or long to a full-back who has led forward. Show the positioning of the kicking team and how the forward press from the opposition affects the choice.</p>`,
    faqSport: 'australian rules football',
  },

  // ─── STICK / HOCKEY ─────────────────────────────────────────────────────────

  {
    slug: 'field-hockey',
    name: 'Field Hockey',
    primaryKeyword: 'field hockey tactics board',
    title: 'Field Hockey Tactics Board — Draw & Share Plays | CourtDraw',
    metaDesc: 'Free online field hockey tactics board for coaches. Draw penalty corner routines, high press, 3-5-2 formations, and circle attack patterns. Works on iPad.',
    h1: 'Field Hockey Tactics Board',
    emoji: '🏑',
    courtIds: [['field_hockey', 'Field Hockey Pitch']],
    primaryCourtId: 'field_hockey',
    family: 'hockey',
    plays: [
      { id: 'fieldhockey_penalty_corner', name: 'Penalty Corner — Drag Flick', desc: 'Injector hits to the top of the D; striker drag-flicks at goal while blockers hold runner lanes.' },
      { id: 'fieldhockey_high_press', name: 'High Press — Circle Entry Force', desc: 'Press the opponent high in their defensive third to force errors near their shooting circle.' },
      { id: 'fieldhockey_short_corner_variant', name: 'Short Corner — Pass & Shot', desc: 'Injector passes short; first receiver passes to the penalty spot for a first-time shot.' },
    ],
    intro: `<p>Field hockey is a high-tempo, highly structured sport where tactical preparation directly translates to on-pitch execution. The penalty corner routine, the high-press trigger, and the circle entry combination all require visual rehearsal before players can execute them reliably under pressure. CourtDraw's field hockey board gives you an accurate pitch view with the shooting circles marked so you can diagram every set piece and tactical system precisely.</p>`,
    body: `<h2>Penalty Corner Routines</h2>
<p>The penalty corner is field hockey's most structured and rehearsed moment — every player has an exact position and role, and the execution window from injection to shot is typically under three seconds. At elite level, teams rehearse five or six corner variations. Two to diagram immediately:</p>
<ul>
<li><strong>Drag flick</strong> — the most common and most dangerous corner option; injector pushes hard to the top of the circle, the "stopper" traps the ball, and the "flicker" executes a drag flick aimed at the post or corner of the goal. Show the stopper's position relative to the top of the D, the flicker's run, and the runners blocking defensive outlets.</li>
<li><strong>Short corner</strong> — a pass variation; instead of a direct shot, the stopper passes sideways to a second player who shoots first-time from a different angle. Show the second shooter's starting position and run path so the move can be executed at pace.</li>
</ul>
<p>Also diagram the defensive corner structure — five players defending at the goal line before the injection, their sprint paths to pressure the shot, and the goalkeeper's angle positioning for each shot type.</p>

<h2>Formation Play</h2>
<p>Field hockey formations are typically described as a defensive-midfield-forward split. The standard 3-5-2 (three defenders, five midfielders, two forwards) creates defensive compactness while giving the midfield freedom to both support attack and press defensively. Diagram the 3-5-2's key spatial relationships:</p>
<ul>
<li>The three defenders' line spacing relative to the shooting circle</li>
<li>The midfield five's press triggers when the opponent has the ball in their defensive third</li>
<li>The two forwards' role in the press (first and second presser) and their position when the team is in defensive shape</li>
</ul>

<h2>High Press System</h2>
<p>The high press in field hockey — pressing the opposition in their own half — is most effective from corner presses after a sideline deflection or when the ball is played back to the goalkeeper. The key principles to diagram:</p>
<ul>
<li><strong>Press trigger</strong> — the exact moment to press (back pass to goalkeeper, goalkeeper receiving, defender under pressure on the sideline).</li>
<li><strong>First presser</strong> — forward or midfielder who attacks the ball carrier immediately; position should cut off the easiest lateral pass option.</li>
<li><strong>Second presser</strong> — covers the primary pass option; forces the ball backward or toward the sideline.</li>
<li><strong>Rest of team</strong> — show how the remaining seven outfield players compress into the opposition half when the press is on.</li>
</ul>

<h2>Circle Attack</h2>
<p>Creating circle entries — getting the ball into the shooting circle in a position to shoot — is the central challenge of field hockey attacking play. Three common entry patterns:</p>
<ul>
<li><strong>Diagonal injection</strong> — winger runs at the defender diagonally and injects the ball into the circle for a forward running from depth.</li>
<li><strong>Overload and switch</strong> — three players overload one side of the circle, forcing the defense to shift; a quick switch to the opposite side creates a shooting position from the opposite post.</li>
<li><strong>Reverse stick switch</strong> — a pass to the left channel where a right-footed attacker runs onto the ball and reverse-stick injects into the circle from a sharp angle.</li>
</ul>`,
    faqSport: 'field hockey',
  },

  {
    slug: 'ice-hockey',
    name: 'Ice Hockey',
    primaryKeyword: 'ice hockey tactics board',
    title: 'Ice Hockey Tactics Board — Draw & Share Plays | CourtDraw',
    metaDesc: 'Free online ice hockey tactics board for coaches. Draw power plays, breakout patterns, forecheck systems, and defensive zone coverage. Works on iPad.',
    h1: 'Ice Hockey Tactics Board',
    emoji: '🏒',
    courtIds: [['ice_hockey', 'Ice Hockey Rink']],
    primaryCourtId: 'ice_hockey',
    family: 'hockey',
    plays: [
      { id: 'icehockey_breakout', name: 'Defensive Zone Breakout', desc: 'Defensemen retrieve the puck behind the net and launch a wheel or direct pass to the wingers.' },
      { id: 'icehockey_forecheck_212', name: '2-1-2 Aggressive Forecheck', desc: 'Two forwards attack hard; center supports; defensemen pinch at the blue line to stop exit.' },
    ],
    intro: `<p>Ice hockey's speed makes tactical understanding impossible to develop during play alone. Coaches who diagram the breakout, the forecheck system, and the power-play formation before practice give their players the mental framework to execute correctly even when the puck is moving at 150 km/h. CourtDraw's ice hockey rink accurately represents blue lines, face-off circles, and goal positions for precise tactical diagrams.</p>`,
    body: `<h2>Breakout Systems</h2>
<p>The breakout is the sequence of plays that moves the puck from the defensive zone to the neutral or offensive zone. Two main systems:</p>
<ul>
<li><strong>Wheel breakout</strong> — defenseman retrieves the puck behind the net, skates around the net ("wheels"), and outlets to the near-side winger on the boards. Show the D's retrieval path, the winger's position below the red line, and the outlet pass timing.</li>
<li><strong>Direct breakout</strong> — defenseman retrieves and passes directly to the far-side winger or to the centre who drops into support. Diagram all three outlet pass options and the conditions under which each is preferred (near-side winger open, near-side covered, centre dropping late).</li>
</ul>
<p>Also show the breakout failure option — if the outlets are covered, the defenseman circles back and restarts; diagram this "re-group" as a deliberate tactical choice rather than a mistake.</p>

<h2>Forecheck Systems</h2>
<p>The forecheck is the pressure system applied to the opponent when they have the puck in their defensive zone. Three common systems:</p>
<ul>
<li><strong>1-2-2 forecheck</strong> — one forward pressures the puck, two forwards take the high boards position, two defensemen hold the blue line. Conservative but effective against teams that dump the puck out.</li>
<li><strong>2-1-2 aggressive forecheck</strong> — two forwards chase hard, centre supports in the middle, defensemen pinch aggressively to prevent easy exits. High-risk, high-reward; diagram the defensive recovery positions if the forecheck is broken.</li>
<li><strong>2-3 trap</strong> — two forwards forecheck lightly, three players hold the neutral zone in a defensive trap. Most effective when protecting a lead late in a game.</li>
</ul>

<h2>Power Play Formation</h2>
<p>With a man advantage (5v4), the power play is ice hockey's most structured tactical situation. Two standard formations:</p>
<ul>
<li><strong>Umbrella (1-3-1)</strong> — one defenseman at the point, three players across the middle (two half-walls, one below-the-circles), one player in front of the net. The point player orchestrates; show the movement patterns when the point walks in for a shot versus cycles the puck.</li>
<li><strong>Overload (2-1-2)</strong> — two players on one side with a one-timer threat; diagram the cross-ice pass to the one-timer position and the alternative high-slot shot option.</li>
</ul>
<p>Also diagram the <strong>penalty kill</strong> — the two common formations (box kill and diamond kill) and the aggressive clearing options from each zone of the ice.</p>

<h2>Defensive Zone Coverage</h2>
<p>Two defensive zone systems compete at all levels of hockey:</p>
<ul>
<li><strong>Zone defense</strong> — each player covers an assigned area of the ice; show the zones and the hand-off protocol when an opponent moves from one zone to another.</li>
<li><strong>Man-to-man</strong> — each defender follows their assigned player; show the assignments by number (which forward marks which opposing forward) and how these switch after a line change.</li>
</ul>`,
    faqSport: 'ice hockey',
  },

  {
    slug: 'roller-hockey',
    name: 'Roller Hockey',
    primaryKeyword: 'roller hockey tactics board',
    title: 'Roller Hockey Tactics Board — Draw Plays | CourtDraw',
    metaDesc: 'Free online roller hockey tactics board for coaches. Draw 4v4 power plays, forecheck patterns, defensive positioning, and rink-specific transition plays. Works on iPad.',
    h1: 'Roller Hockey Tactics Board',
    emoji: '🏒',
    courtIds: [['roller_hockey', 'Roller Hockey Rink']],
    primaryCourtId: 'roller_hockey',
    family: 'hockey',
    plays: [],
    intro: `<p>Roller hockey's 4-aside format (with smaller boards and different playing surfaces than ice) creates fast, tight tactical situations that reward good positioning and transition speed. CourtDraw's roller hockey board helps coaches diagram the compact breakout options, design power-play plays for a one-man advantage, and plan the forecheck systems that generate turnovers in a smaller competitive space.</p>`,
    body: `<h2>4v4 Tactical Principles</h2>
<p>Roller hockey is typically played 4v4 (excluding goalkeepers), which makes spacing and positional responsibility even more critical than in ice hockey's 5v5 format. With fewer players on a smaller surface, every positional error creates an immediate scoring chance. Diagram the standard positional alignment:</p>
<ul>
<li>Two forwards up the court creating width and depth</li>
<li>Two defenders providing coverage behind the forwards and initiating play from the back</li>
<li>The diagonal structure: one forward at the back-post area, one at the front; one defender supporting high, one low — creating a rotational diamond rather than two parallel rows</li>
</ul>

<h2>Breakout and Transition</h2>
<p>Because the boards in roller hockey don't always have the same rebound properties as ice, breakout plays must account for board work being less predictable. Diagram breakout options that minimise board reliance:</p>
<ul>
<li><strong>Short passing breakout</strong> — goalkeeper to the nearest defender, quick pass to the opposite winger, long outlet to the breaking forward.</li>
<li><strong>Power skate (carry-out)</strong> — defender or goalkeeper carries the puck out of their own zone rather than passing, using skating speed to beat the forecheck before distributing.</li>
</ul>
<p>Show the support positions for each breakout option: where the non-primary receivers position to receive a secondary pass if the first option is covered.</p>

<h2>Power Play in Roller Hockey</h2>
<p>A 4v3 power play in roller hockey lasts two minutes and creates significant scoring pressure. The most effective formation places one player at the top of the zone (point) and two players in the half-space flanking the goal, with the fourth player near the net:</p>
<ul>
<li>Diagram the rotation when the point player moves in — the half-wall player should rise to cover the vacated point position.</li>
<li>Show the primary shooting option (point shot or half-wall one-timer) and the screening position in front of the goalkeeper.</li>
<li>Diagram the transition when possession is lost on the power play — who sprints back first and which player covers the goalkeeper on a potential breakaway.</li>
</ul>

<h2>Forecheck and Defensive Zone</h2>
<p>The forecheck in roller hockey is aggressive — with fewer players, the immediate press after a turnover can create a numerical advantage before the opponent organises. Diagram the 2-forward forecheck (one pressures, one covers the primary outlet) and the two defenders' responsibility to read the forecheck result and advance or hold accordingly.</p>
<p>In the defensive zone, show the positioning for man-to-man versus zone coverage and how to defend against an overload power play (which zones to prioritise and where the goalkeeper must be positioned to minimise the angle on the primary power-play shot).</p>`,
    faqSport: 'roller hockey',
  },

  {
    slug: 'indoor-hockey',
    name: 'Indoor Hockey',
    primaryKeyword: 'indoor hockey tactics board',
    title: 'Indoor Hockey Tactics Board — Draw Plays | CourtDraw',
    metaDesc: 'Free online indoor hockey tactics board for coaches. Draw 6v6 formations, penalty corner plays, board-work combinations, and fast-break patterns. Works on iPad.',
    h1: 'Indoor Hockey Tactics Board',
    emoji: '🏑',
    courtIds: [['indoor_hockey', 'Indoor Hockey Court']],
    primaryCourtId: 'indoor_hockey',
    family: 'hockey',
    plays: [],
    intro: `<p>Indoor hockey's smaller court, board-work, and faster tempo demand a different tactical vocabulary from field hockey. The six-player format creates unique 1v1 and 2v2 combinations, and the penalty corner — even more critical in indoor hockey than field hockey — requires meticulous rehearsal. CourtDraw's indoor hockey board helps coaches diagram all of this precisely before training begins.</p>`,
    body: `<h2>Indoor vs Field Hockey Tactics</h2>
<p>Indoor hockey shares rules and skills with field hockey but the tactical environment is completely different. The court is roughly one-quarter the size, played 6v6 (including goalkeeper), with boards along the sides instead of sideline throw-ins. Board work — using the side and back boards to keep the ball in play — is an essential skill that requires tactical coaching: show players which board angles create attacking opportunities versus which ones gift possession to the opponent.</p>

<h2>Penalty Corner in Indoor Hockey</h2>
<p>Indoor hockey penalty corners are even more decisive than field hockey corners because the shorter distance from the injection point to the circle creates a more immediate shooting opportunity. Diagram the injection sequence showing:</p>
<ul>
<li>The injector's push into the top of the D</li>
<li>The stopper's position and the required trap quality</li>
<li>The shooter's run and the two alternative shot options (direct shot vs pass-to-shooter)</li>
<li>The defensive response — one player rushing the stopper, one the shooter, the rest retreating to the goal line</li>
</ul>

<h2>6v6 Formations</h2>
<p>The standard indoor hockey formation is 1-2-2 (goalkeeper, two defenders, two midfielders, two forwards) but variations exist. Draw the formation and show the specific coverage responsibilities for each position:</p>
<ul>
<li><strong>Defenders</strong> — one covers the centre, one covers the shooting circle approach; show the switch when the ball moves from side to side.</li>
<li><strong>Midfielders</strong> — responsible for pressing high and recovering quickly; diagram the pressing trigger and the recovery path.</li>
<li><strong>Forwards</strong> — one presses the ball carrier, one covers the central passing option; show the co-ordination between the two forwards when pressing.</li>
</ul>

<h2>Board Work and Transition</h2>
<p>Playing the ball off the board at the right angle is a key indoor hockey skill. Show players the geometric principles: a ball struck at 45 degrees rebounds at 45 degrees; played harder toward the end boards, it wraps around into the circle. Diagram the two most common board-work plays:</p>
<ul>
<li><strong>Circle wrap</strong> — board pass to the end wall, ball wraps around into the circle for a running attacker.</li>
<li><strong>Side board and follow</strong> — play the ball off the side board and follow the rebound; the board controls direction while the player controls timing.</li>
</ul>`,
    faqSport: 'indoor hockey',
  },

  {
    slug: 'floorball',
    name: 'Floorball',
    primaryKeyword: 'floorball tactics board',
    title: 'Floorball Tactics Board — Draw & Share Plays | CourtDraw',
    metaDesc: 'Free online floorball tactics board for coaches. Draw 5v5 formations, power-play sets, forecheck patterns, and defensive zone coverage. Works on iPad.',
    h1: 'Floorball Tactics Board',
    emoji: '🏒',
    courtIds: [['floorball', 'Floorball Court']],
    primaryCourtId: 'floorball',
    family: 'hockey',
    plays: [],
    intro: `<p>Floorball's 6v6 format (five outfield players plus goalkeeper) on a 40x20m court creates a high-speed game where tactical preparation is the difference between a reactive team and a cohesive one. CourtDraw's floorball board lets coaches design the 2-2-1 pressing system, plan the power-play overload, and diagram the fast break patterns that exploit defensive transitions before players arrive at training.</p>`,
    body: `<h2>Formation and Positioning</h2>
<p>The standard floorball formation is 2-2-1: two defenders, two midfielders, one forward. But the game's speed means positions are fluid — midfielders frequently press forward into attack and defenders push up to support the build-up. Diagram the formation not as fixed positions but as a dynamic shape:</p>
<ul>
<li>When in possession in the opponents' half: forward at the top, both midfielders supporting wide, both defenders at the halfway line or slightly into the opponent's half.</li>
<li>When defending in your own half: forward presses from the front, midfielders compact the central channel, defenders protect the circle approach.</li>
<li>The transition position: both midfielders recover quickly when possession is lost; diagram their recovery paths relative to the ball position.</li>
</ul>

<h2>Power Play (5v4)</h2>
<p>A floorball power play lasts two minutes and typically uses a 1-3-1 or 2-3 formation. The key principle is to create a high-percentage shot quickly rather than circulating indefinitely:</p>
<ul>
<li><strong>1-3-1 formation</strong> — one player at the top, three across the middle (two half-wall, one in the hole), one in front of the goal. Diagram the rotation when the top player moves to shoot — the near half-wall covers the vacated position.</li>
<li><strong>2-3 overload</strong> — two players high, three low; aims to create quick one-timers from the corners. Show the cross-court pass for the one-timer and the position in front of the goal for the rebound.</li>
</ul>

<h2>Fast Break</h2>
<p>Floorball's most exciting and productive transitions come from fast breaks — quick counter-attacks before the opponent's defense resets. Show the two most common scenarios:</p>
<ul>
<li><strong>2v1 breakaway</strong> — two attackers vs one defender; the attacker with the ball draws the defender and passes at the last moment to the open teammate for a tap-in.</li>
<li><strong>Goalkeeper outlet</strong> — goalkeeper catches or stops the ball and immediately outlets with a long throw or kick to a forward breaking the other way before the opponent has transitioned.</li>
</ul>

<h2>Defensive Zone</h2>
<p>Defending the shooting circle is floorball's most critical defensive moment. Show the circle coverage positions for the five outfield players when the opponent is in possession near the circle:</p>
<ul>
<li>Two defenders inside the circle approach, one covering the centre and one the side</li>
<li>Two midfielders pressing the wide players to prevent the cross</li>
<li>The forward pressing the highest ball carrier to delay the attack</li>
</ul>
<p>Also diagram the penalty shot rules — awarded after a clear scoring opportunity is fouled — and the goalkeeper's positioning and technique for facing a penalty shot.</p>`,
    faqSport: 'floorball',
  },

  {
    slug: 'hurling',
    name: 'Hurling / Camogie',
    primaryKeyword: 'hurling tactics board',
    title: 'Hurling Tactics Board — Draw & Share Plays | CourtDraw',
    metaDesc: 'Free online hurling and camogie tactics board for coaches. Draw puckout strategies, half-back sweeper systems, forward line positioning, and sideline plays. Works on iPad.',
    h1: 'Hurling Tactics Board',
    emoji: '🏑',
    courtIds: [['hurling', 'Hurling Pitch']],
    primaryCourtId: 'hurling',
    family: 'hockey',
    plays: [],
    intro: `<p>Hurling is played at pace too fast for players to consciously process tactical decisions during a game — tactical patterns must be rehearsed until they're automatic. CourtDraw's hurling board gives coaches an accurate pitch view for diagramming puckout patterns, half-back attacking plays, and 15-player positional systems that apply equally to hurling and camogie. Share plays before the match — players arrive with the game plan already visualised.</p>`,
    body: `<h2>Puckout Strategy</h2>
<p>The puckout is one of hurling's most tactical moments — equivalent to a goalkeeper distribution in football. Short puckouts (to the backs or midfielders) invite pressure; long puckouts (to the half-forwards or full-forwards) require aerial superiority. Diagram two puckout patterns:</p>
<ul>
<li><strong>Short puckout loop</strong> — goalkeeper to corner back, corner back to centre-back who has broken forward; centre-back to midfielder who has positioned in the half-forward zone. Show the positioning of all players and the decoy runs that create this opening.</li>
<li><strong>Long puckout target</strong> — goalkeeper targets a specific half-forward who has timed their run to meet the ball at a precise landing zone; show the half-forward's run, the two other half-forwards creating the option space, and the remaining forwards clearing for the incoming ball.</li>
</ul>

<h2>Half-Back Sweeper</h2>
<p>The sweeper system — a half-back who drops behind the midfield line to clog the space between the half-forward and full-back lines — has transformed tactical hurling over the past decade. Diagram the sweeper's positioning responsibilities:</p>
<ul>
<li>Central position covering the corridor between midfielders</li>
<li>Lateral adjustment when the ball is on the wing (must track across without losing the central channel)</li>
<li>The trigger for breaking forward — when the opposition defense is committed and the sweeper can join the attack</li>
</ul>
<p>Also diagram the attacking team's response to the sweeper: drawing the sweeper out of position by overloading one side and then switching quickly to the vacated space.</p>

<h2>Forward Line Positioning</h2>
<p>Six forward positions in hurling — full-forward, two corner-forwards, and three half-forwards — create a layered attacking structure. The tactical challenge is ensuring the forwards offer depth and width while the half-forwards track back to contest midfield when possession is lost.</p>
<ul>
<li><strong>Full-forward as target</strong> — the centre full-forward's role in winning aerial contests and laying off to incoming corner-forwards; diagram their position relative to the full-back and the two corner-forward entry angles.</li>
<li><strong>Half-forward press</strong> — when the opposition is playing short from their goalkeeper, the half-forwards push up to the half-way to contest; diagram the press triggers and the transition when the ball is cleared.</li>
</ul>

<h2>Sideline and Free-Puck Routines</h2>
<p>Frees and sideline cuts offer set-play opportunities in hurling that coaches should rehearse as structured combinations. A sideline cut aimed at the half-forward line with a running half-back available behind gives the taker two options; diagram both and the defensive shape that determines which is taken. Show players the two key variables in free-taking: the number of runners and their starting positions relative to the taker, and the decoy runs that manipulate the defensive wall before the ball is struck.</p>`,
    faqSport: 'hurling',
  },

  {
    slug: 'lacrosse',
    name: 'Lacrosse',
    primaryKeyword: 'lacrosse tactics board',
    title: 'Lacrosse Tactics Board — Draw & Share Plays | CourtDraw',
    metaDesc: 'Free online lacrosse tactics board for coaches. Draw 2-3-1 formations, fast break patterns, man-up offenses, clearing plays, and pick-and-roll dodges. Works on iPad.',
    h1: 'Lacrosse Tactics Board',
    emoji: '🥍',
    courtIds: [['lacrosse', 'Lacrosse Field']],
    primaryCourtId: 'lacrosse',
    family: 'hockey',
    plays: [],
    intro: `<p>Lacrosse combines the field structure of football with the individual skill of hockey — fast breaks, man-up offenses, and clearing plays all require precise spatial understanding that verbal coaching can't easily convey. CourtDraw's lacrosse board gives coaches an accurate field view for designing attack patterns, mapping defensive rotations, and diagramming the set plays that turn possession into goals.</p>`,
    body: `<h2>Offensive Formation: 2-3-1</h2>
<p>The 2-3-1 is the standard lacrosse offensive formation: two attackers behind the goal, three midfielders across the middle, one attacker at the top of the crease. From this formation, all offensive plays begin. Diagram the formation and show the key spacing rules:</p>
<ul>
<li>The two behind-the-goal attackers should always be positioned to force the defense to choose between covering the pass and covering the driving line to goal.</li>
<li>The three midfielders form a wide arc that denies the defense from collapsing entirely onto the crease player.</li>
<li>The crease attacker's position must be fluid — showing at the front of the crease when the ball is behind, moving to the back side when the ball is on the wing.</li>
</ul>

<h2>Pick-and-Roll in Lacrosse</h2>
<p>Like basketball, lacrosse uses picks (screens) to create open shots or driving lanes. The key difference is that the pick is legal only if the picker is stationary at the point of contact. Diagram the three types of picks commonly used:</p>
<ul>
<li><strong>On-ball pick</strong> — picker sets a screen for the ball carrier; the ball carrier dodges off the screen; the picker rolls to the crease for a pass.</li>
<li><strong>Off-ball pick</strong> — a player without the ball sets a screen for a teammate to receive a pass in a better position; diagram the screener's roll and the receiver's cut.</li>
<li><strong>Down-screen</strong> — a midfielder sets a screen for the crease attacker to free them for a pass from behind the goal.</li>
</ul>

<h2>Fast Break</h2>
<p>Lacrosse fast breaks are among the most dynamic and highest-percentage scoring opportunities in the sport. A 3v2 fast break should be taught as a structured play, not improvisation:</p>
<ul>
<li>The central ball carrier draws the first defender and dishes to the open shooter on the outside</li>
<li>If the defender commits to the outside pass, the ball carrier continues to the crease</li>
<li>Diagram both options as two separate arrows from the same starting moment — the decision reads the defender's weight</li>
</ul>

<h2>Clearing</h2>
<p>Clearing — moving the ball from the defensive half to the offensive half — is a structured tactical operation in lacrosse. The most common system uses a "push" (three defenders pushing up to the midfield line) and a "pull" (two midfielders holding the midfield line to receive the cleared ball). Diagram the clearing system showing each player's position, the movement paths, and the two options when the primary clear is blocked.</p>

<h2>Man-Up Offense</h2>
<p>Like ice hockey, lacrosse's man-up situations (when the opposing team has a player serving a penalty) are prepared as set plays. The standard 6v5 man-up formation adds one player to the standard 2-3-1 formation; diagram where the extra player positions and how the rotation adjusts. Show the primary shot opportunity, the alternative feeds to the crease, and the skip pass to the weak side that creates a catch-and-shoot position.</p>`,
    faqSport: 'lacrosse',
  },
];

// ─── INTERNAL LINK HELPERS ───────────────────────────────────────────────────

function getSportName(slug) {
  const s = SPORTS.find(x => x.slug === slug);
  return s ? s.name : slug;
}

function getRelatedLinks(sport, count = 5) {
  const family = FAMILIES[sport.family];
  const sameFamily = family.slugs.filter(s => s !== sport.slug);
  // Pick up to 4 from same family + 1–2 cross-family
  const primary = sameFamily.slice(0, Math.min(4, count - 1));
  const allOther = Object.entries(FAMILIES)
    .filter(([k]) => k !== sport.family)
    .flatMap(([, v]) => v.slugs)
    .filter(s => !primary.includes(s) && s !== sport.slug);
  const secondary = allOther.slice(0, count - primary.length);
  return [...primary, ...secondary].slice(0, count);
}

// ─── HTML TEMPLATE ───────────────────────────────────────────────────────────

function buildPage(sport) {
  const url = `https://courtdraw.app/${sport.slug}-tactics-board/`;
  const related = getRelatedLinks(sport, 5);
  const hasPlays = sport.plays && sport.plays.length > 0;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name: `CourtDraw — ${sport.name} Tactics Board`,
        applicationCategory: 'SportsApplication',
        operatingSystem: 'Web',
        url: 'https://courtdraw.app/courtdraw-app.html',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
        description: sport.metaDesc,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://courtdraw.app/' },
          { '@type': 'ListItem', position: 2, name: 'Sports', item: 'https://courtdraw.app/sports/' },
          { '@type': 'ListItem', position: 3, name: sport.name, item: url },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: `Is there a free ${sport.faqSport} tactics board?`,
            acceptedAnswer: { '@type': 'Answer', text: `Yes — CourtDraw is completely free to start. Open the ${sport.name} tactics board in your browser at courtdraw.app, no account or install required. The free plan gives you access to one court and three saved tactics. Pro unlocks all 38+ sports, unlimited saves, and shareable links.` },
          },
          {
            '@type': 'Question',
            name: `How do I draw ${sport.faqSport} plays online?`,
            acceptedAnswer: { '@type': 'Answer', text: `Open CourtDraw, select the ${sport.name} court, and use the drawing tools to drag player tokens, draw arrows (solid for passes/runs, dashed for off-ball movement), and add circles and zones. Save your tactic, then share it via a link or export as PNG or PDF. No drawing experience required.` },
          },
          {
            '@type': 'Question',
            name: `Does the ${sport.faqSport} tactics board work on iPad and offline?`,
            acceptedAnswer: { '@type': 'Answer', text: `Yes. CourtDraw is a Progressive Web App (PWA) that works on any browser including iPad Safari and Chrome. Once loaded, it works fully offline — diagrams and saved tactics are stored on the device. Add it to your home screen for instant access on the touchline.` },
          },
        ],
      },
    ],
  };

  const courtList = sport.courtIds.length > 1
    ? `<p>This page covers the <strong>${sport.courtIds.map(([,n]) => n).join(' and the ')}</strong>. All court variants are available in the app with a single tap.</p>`
    : '';

  const consolidatesNote = sport.courtIds.length > 1
    ? `<div class="consolidation-note"><strong>Covers:</strong> ${sport.courtIds.map(([id, n]) => `<a href="/courtdraw-app.html?court=${id}">${n}</a>`).join(' · ')}</div>`
    : '';

  const playsSection = hasPlays ? `
  <section class="sp-section sp-plays">
    <div class="container">
      <div class="section-header">
        <span class="badge"><span class="badge-dot"></span>Tactics Library</span>
        <h2 class="gradient-text">Ready-Made ${sport.name} Plays</h2>
        <p>Load any play directly into your board and customise it.</p>
      </div>
      <div class="plays-grid">
        ${sport.plays.map(p => `
        <div class="play-card">
          <div class="play-card-name">${p.name}</div>
          <p class="play-card-desc">${p.desc}</p>
          <a href="/courtdraw-app.html?court=${sport.primaryCourtId}" class="play-load-btn">Load in Board →</a>
        </div>`).join('')}
      </div>
    </div>
  </section>` : '';

  const relatedLinks = related.map(slug =>
    `<a href="/${slug}-tactics-board/" class="related-link">${getSportName(slug)} Tactics Board</a>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <!-- Google tag -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-9NZSFKFV1N"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-9NZSFKFV1N');</script>

  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${sport.title}</title>
  <meta name="description" content="${sport.metaDesc}" />
  <link rel="canonical" href="${url}" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${url}" />
  <meta property="og:title" content="${sport.title}" />
  <meta property="og:description" content="${sport.metaDesc}" />
  <meta property="og:image" content="https://courtdraw.app/assets/og-image.svg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:site_name" content="CourtDraw" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${sport.title}" />
  <meta name="twitter:description" content="${sport.metaDesc}" />
  <meta name="twitter:image" content="https://courtdraw.app/assets/og-image.svg" />

  <!-- PWA -->
  <link rel="manifest" href="/manifest.json" />
  <meta name="theme-color" content="#1d4ed8" />
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="CourtDraw">
  <link rel="apple-touch-icon" href="/assets/icons/icon-192.png" />

  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <link rel="preconnect" href="https://fonts.bunny.net" />
  <link href="https://fonts.bunny.net/css?family=cabinet-grotesk:700,900" rel="stylesheet" />

  <!-- JSON-LD -->
  <script type="application/ld+json">${JSON.stringify(jsonLd, null, 2)}</script>

  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0a1628; --bg2: #0d1f3c; --bg3: #1a2d4a;
      --border: #1a2d4a; --border2: #2a3f5c;
      --text: #f1f5f9; --muted: #94a3b8;
      --accent: #3b82f6; --accent2: #2563eb; --accent-glow: rgba(59,130,246,0.18);
      --amber: #f59e0b; --radius: 14px; --radius-lg: 22px;
    }
    html { scroll-behavior: smooth; }
    body { background: var(--bg); color: var(--text); font-family: 'Plus Jakarta Sans', system-ui, sans-serif; line-height: 1.6; -webkit-font-smoothing: antialiased; }
    a { color: inherit; text-decoration: none; }
    img, svg { display: block; }
    .container { max-width: 1160px; margin: 0 auto; padding: 0 24px; }
    .badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(59,130,246,0.12); border: 1px solid rgba(59,130,246,0.3); color: var(--accent); border-radius: 100px; padding: 4px 14px; font-size: 0.78rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
    .badge-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); animation: pulse 2s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
    .btn { display: inline-flex; align-items: center; gap: 8px; font-family: inherit; font-weight: 700; border-radius: 12px; cursor: pointer; transition: all .18s; border: none; text-decoration: none; }
    .btn-primary { background: var(--accent); color: #fff; padding: 14px 28px; font-size: 1rem; }
    .btn-primary:hover { background: #60a5fa; transform: translateY(-1px); box-shadow: 0 8px 30px rgba(59,130,246,0.4); }
    .btn-ghost { background: transparent; color: var(--text); border: 1.5px solid var(--border2); padding: 13px 26px; font-size: 1rem; }
    .btn-ghost:hover { border-color: var(--accent); color: var(--accent); }
    .btn-lg { padding: 18px 36px; font-size: 1.1rem; border-radius: 14px; }
    .gradient-text { background: linear-gradient(135deg,#3b82f6 0%,#60a5fa 50%,#93c5fd 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }

    /* Nav */
    nav { position: sticky; top: 0; z-index: 100; background: rgba(10,22,40,0.85); backdrop-filter: blur(16px); border-bottom: 1px solid var(--border); }
    .nav-inner { display: flex; align-items: center; justify-content: space-between; height: 64px; }
    .nav-logo { display: flex; align-items: center; gap: 10px; font-size: 1.3rem; font-weight: 800; letter-spacing: -0.03em; }
    .nav-logo-mark { width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .nav-links { display: flex; align-items: center; gap: 8px; }
    .nav-links a { color: var(--muted); font-size: 0.9rem; font-weight: 500; padding: 6px 12px; border-radius: 8px; transition: color .15s; }
    .nav-links a:hover, .nav-links a.active { color: var(--text); }
    .nav-cta { display: flex; align-items: center; gap: 10px; }
    @media (max-width: 680px) { .nav-links { display: none; } }

    /* Page hero */
    .sp-hero { padding: 72px 0 56px; text-align: center; position: relative; overflow: hidden; }
    .sp-hero::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse 80% 60% at 50% -10%, rgba(59,130,246,0.15) 0%, transparent 70%); pointer-events: none; }
    .sp-hero-badge { margin-bottom: 20px; }
    .sp-hero h1 { font-size: clamp(2rem, 5vw, 3.4rem); font-weight: 800; line-height: 1.1; letter-spacing: -0.04em; margin-bottom: 20px; }
    .sp-hero-sub { font-size: 1.1rem; color: var(--muted); max-width: 560px; margin: 0 auto 36px; line-height: 1.65; }
    .sp-hero-actions { display: flex; align-items: center; justify-content: center; gap: 14px; flex-wrap: wrap; }
    .sp-hero-fine { font-size: 0.82rem; color: var(--muted); margin-top: 12px; }

    /* Breadcrumb */
    .breadcrumb { padding: 12px 0; border-bottom: 1px solid var(--border); }
    .breadcrumb nav { position: static; background: none; backdrop-filter: none; border: none; }
    .breadcrumb ol { list-style: none; display: flex; gap: 8px; align-items: center; font-size: 0.82rem; color: var(--muted); }
    .breadcrumb ol li + li::before { content: '/'; color: var(--border2); }
    .breadcrumb ol li a { color: var(--accent); }

    /* Consolidation note */
    .consolidation-note { display: inline-flex; gap: 8px; align-items: center; background: var(--bg2); border: 1px solid var(--border2); border-radius: var(--radius); padding: 8px 16px; font-size: 0.85rem; color: var(--muted); margin-top: 16px; flex-wrap: wrap; }
    .consolidation-note a { color: var(--accent); }

    /* Content sections */
    .sp-section { padding: 72px 0; }
    .sp-section:nth-child(even) { background: var(--bg2); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
    .section-header { text-align: center; margin-bottom: 48px; }
    .section-header h2 { font-size: clamp(1.6rem, 3vw, 2.4rem); font-weight: 800; letter-spacing: -0.03em; margin-top: 14px; margin-bottom: 16px; }
    .section-header p { color: var(--muted); max-width: 520px; margin: 0 auto; }

    /* Body content */
    .sp-body { max-width: 820px; margin: 0 auto; }
    .sp-body h2 { font-size: 1.4rem; font-weight: 800; letter-spacing: -0.02em; margin: 40px 0 16px; color: var(--text); }
    .sp-body h2:first-child { margin-top: 0; }
    .sp-body p { color: var(--muted); line-height: 1.75; margin-bottom: 16px; font-size: 0.975rem; }
    .sp-body ul { color: var(--muted); padding-left: 20px; margin-bottom: 16px; display: flex; flex-direction: column; gap: 10px; }
    .sp-body ul li { line-height: 1.65; font-size: 0.95rem; }
    .sp-body strong { color: var(--text); }

    /* How it works */
    .how-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; }
    @media (max-width: 860px) { .how-grid { grid-template-columns: repeat(2, 1fr); gap: 32px; } }
    @media (max-width: 500px) { .how-grid { grid-template-columns: 1fr; } }
    .how-step { text-align: center; padding: 0 24px; position: relative; }
    .how-step + .how-step::before { content: ''; position: absolute; left: 0; top: 24px; width: 1px; height: 48px; background: var(--border2); }
    @media (max-width: 860px) { .how-step + .how-step::before { display: none; } }
    .how-num { width: 48px; height: 48px; border-radius: 50%; background: var(--bg3); border: 2px solid var(--border2); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1rem; margin: 0 auto 20px; color: var(--accent); }
    .how-step h3 { font-size: 1rem; font-weight: 700; margin-bottom: 10px; }
    .how-step p { color: var(--muted); font-size: 0.875rem; line-height: 1.6; }

    /* Plays grid */
    .plays-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
    .play-card { background: var(--bg3); border: 1px solid var(--border2); border-radius: var(--radius); padding: 24px; transition: border-color .18s; }
    .play-card:hover { border-color: var(--accent); }
    .play-card-name { font-size: 1rem; font-weight: 700; margin-bottom: 10px; color: var(--text); }
    .play-card-desc { color: var(--muted); font-size: 0.875rem; line-height: 1.6; margin-bottom: 16px; }
    .play-load-btn { color: var(--accent); font-size: 0.85rem; font-weight: 700; }
    .play-load-btn:hover { text-decoration: underline; }

    /* FAQ */
    .faq-list { max-width: 700px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
    .faq-item { background: var(--bg3); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px 28px; }
    .faq-item h3 { font-size: 1rem; font-weight: 700; margin-bottom: 10px; }
    .faq-item p { color: var(--muted); font-size: 0.9rem; line-height: 1.65; }

    /* Related links */
    .related-grid { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
    .related-link { background: var(--bg2); border: 1px solid var(--border2); border-radius: 100px; padding: 8px 18px; font-size: 0.85rem; font-weight: 600; color: var(--muted); transition: all .15s; }
    .related-link:hover { border-color: var(--accent); color: var(--accent); }

    /* CTA section */
    .sp-cta { text-align: center; padding: 80px 0; }
    .sp-cta h2 { font-size: clamp(1.8rem, 3.5vw, 2.8rem); font-weight: 800; letter-spacing: -0.03em; margin-bottom: 16px; }
    .sp-cta p { color: var(--muted); max-width: 480px; margin: 0 auto 36px; }

    /* Footer */
    footer { border-top: 1px solid var(--border); padding: 48px 0 32px; }
    .footer-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 48px; margin-bottom: 32px; }
    @media (max-width: 780px) { .footer-grid { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 480px) { .footer-grid { grid-template-columns: 1fr; } }
    .footer-brand p { color: var(--muted); font-size: 0.875rem; margin-top: 14px; line-height: 1.6; max-width: 260px; }
    .footer-col h4 { font-size: 0.78rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); margin-bottom: 16px; }
    .footer-col ul { list-style: none; display: flex; flex-direction: column; gap: 10px; }
    .footer-col ul li a { color: var(--muted); font-size: 0.875rem; transition: color .15s; }
    .footer-col ul li a:hover { color: var(--text); }
    .footer-bottom { display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--border); padding-top: 24px; flex-wrap: wrap; gap: 16px; }
    .footer-bottom p { color: var(--muted); font-size: 0.8rem; }
    .footer-legal { display: flex; gap: 20px; }
    .footer-legal a { color: var(--muted); font-size: 0.8rem; }
    .footer-legal a:hover { color: var(--text); }
  </style>
</head>
<body>

<!-- NAV -->
<nav>
  <div class="container nav-inner">
    <a href="/" class="nav-logo">
      <div class="nav-logo-mark">${LOGO_SVG}</div>
      CourtDraw
    </a>
    <div class="nav-links">
      <a href="/sports/">All Sports</a>
      <a href="/#features">Features</a>
      <a href="/#pricing">Pricing</a>
      <a href="/#faq">FAQ</a>
    </div>
    <div class="nav-cta">
      <a href="/login.html" class="btn btn-ghost" style="padding:9px 18px;font-size:.875rem;">Sign in</a>
      <a href="/courtdraw-app.html?court=${sport.primaryCourtId}" class="btn btn-primary" style="padding:9px 18px;font-size:.875rem;">Try Free</a>
    </div>
  </div>
</nav>

<!-- BREADCRUMB -->
<div class="breadcrumb">
  <div class="container">
    <nav aria-label="Breadcrumb">
      <ol>
        <li><a href="/">Home</a></li>
        <li><a href="/sports/">Sports</a></li>
        <li>${sport.name}</li>
      </ol>
    </nav>
  </div>
</div>

<!-- HERO -->
<section class="sp-hero">
  <div class="container">
    <div class="sp-hero-badge">
      <span class="badge"><span class="badge-dot"></span>${sport.emoji} ${sport.name}</span>
    </div>
    <h1>${sport.h1}</h1>
    <div class="sp-hero-sub">
      ${sport.intro}
    </div>
    ${courtList}
    ${consolidatesNote}
    <div class="sp-hero-actions" style="margin-top:28px;">
      <a href="/courtdraw-app.html?court=${sport.primaryCourtId}" class="btn btn-primary btn-lg">Start Drawing ${sport.name} Free →</a>
      <a href="/sports/" class="btn btn-ghost btn-lg">Browse All Sports</a>
    </div>
    <p class="sp-hero-fine">Free forever · No install · Works on iPad offline</p>
  </div>
</section>

<!-- BODY CONTENT -->
<section class="sp-section sp-content">
  <div class="container">
    <div class="sp-body">
      ${sport.body}
    </div>
  </div>
</section>

${playsSection}

<!-- HOW IT WORKS -->
<section class="sp-section sp-how">
  <div class="container">
    <div class="section-header">
      <span class="badge"><span class="badge-dot"></span>How It Works</span>
      <h2>From blank court to shared play in 60 seconds</h2>
    </div>
    <div class="how-grid">
      <div class="how-step">
        <div class="how-num">1</div>
        <h3>Choose ${sport.name}</h3>
        <p>Open CourtDraw and select the ${sport.name} court. The board loads instantly in your browser — no install, no account required.</p>
      </div>
      <div class="how-step">
        <div class="how-num">2</div>
        <h3>Place & Draw</h3>
        <p>Drag player tokens into position. Draw arrows for passes and runs, zones for pressing areas, and add text annotations. Multiple phases for complex plays.</p>
      </div>
      <div class="how-step">
        <div class="how-num">3</div>
        <h3>Save</h3>
        <p>Name and save your tactic to your library. Saved plays are stored on device and available offline — perfect for touchline coaching sessions.</p>
      </div>
      <div class="how-step">
        <div class="how-num">4</div>
        <h3>Share</h3>
        <p>Export as PNG or PDF, or share a direct link. Players can open it on their phone before the game — no app download needed.</p>
      </div>
    </div>
  </div>
</section>

<!-- FAQ -->
<section class="sp-section sp-faq">
  <div class="container">
    <div class="section-header">
      <span class="badge"><span class="badge-dot"></span>FAQ</span>
      <h2>${sport.name} Tactics Board — Questions</h2>
    </div>
    <div class="faq-list">
      <div class="faq-item">
        <h3>Is there a free ${sport.faqSport} tactics board?</h3>
        <p>Yes — CourtDraw is completely free to start. Open the ${sport.name} board in your browser at courtdraw.app, no account required. The free plan includes one court and three saved tactics. The Pro plan (€6/month) unlocks all 38+ sports, unlimited saves, clean exports, and shareable links.</p>
      </div>
      <div class="faq-item">
        <h3>How do I draw ${sport.faqSport} plays online?</h3>
        <p>Open CourtDraw, select the ${sport.name} court, and use the drawing tools: drag player tokens, draw solid arrows for passes and runs, dashed arrows for off-ball movement, and add circles and zones for areas. Save your tactic, then share it via a link or export as PNG or PDF. No drawing experience needed.</p>
      </div>
      <div class="faq-item">
        <h3>Does it work on iPad and offline?</h3>
        <p>Yes. CourtDraw is a Progressive Web App (PWA) that works on any browser including iPad Safari and Chrome. Once loaded it works fully offline — diagrams and saved tactics are stored on the device. Add it to your home screen for instant touchline access.</p>
      </div>
    </div>
  </div>
</section>

<!-- RELATED SPORTS -->
<section class="sp-section sp-related" style="padding:56px 0;">
  <div class="container">
    <div class="section-header" style="margin-bottom:28px;">
      <h2 style="font-size:1.4rem;">Related Sports</h2>
    </div>
    <div class="related-grid">
      ${relatedLinks}
      <a href="/" class="related-link">← CourtDraw Home</a>
      <a href="/sports/" class="related-link">All 38+ Sports →</a>
    </div>
  </div>
</section>

<!-- CTA -->
<section class="sp-cta" style="background:var(--bg2);border-top:1px solid var(--border);border-bottom:1px solid var(--border);">
  <div class="container">
    <h2>Start Drawing <span class="gradient-text">${sport.name} Plays</span> Free</h2>
    <p>No install. No credit card. Works on every device, even offline on the touchline.</p>
    <a href="/courtdraw-app.html?court=${sport.primaryCourtId}" class="btn btn-primary btn-lg">Open ${sport.name} Tactics Board →</a>
    <p style="margin-top:16px;font-size:0.82rem;color:var(--muted);">Free forever · Pro from €6/month · Club from €99/year</p>
  </div>
</section>

<!-- FOOTER -->
<footer>
  <div class="container">
    <div class="footer-grid">
      <div class="footer-brand">
        <a href="/" class="nav-logo">
          <div class="nav-logo-mark">${LOGO_SVG}</div>
          CourtDraw
        </a>
        <p>The tactics board for every coach. Draw plays for 38+ sports in your browser — free, fast, and offline-ready.</p>
      </div>
      <div class="footer-col">
        <h4>Sports</h4>
        <ul>
          <li><a href="/sports/">All Sports Hub</a></li>
          <li><a href="/football-tactics-board/">Football</a></li>
          <li><a href="/basketball-tactics-board/">Basketball</a></li>
          <li><a href="/tennis-tactics-board/">Tennis</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Product</h4>
        <ul>
          <li><a href="/courtdraw-app.html">Open App</a></li>
          <li><a href="/#features">Features</a></li>
          <li><a href="/#pricing">Pricing</a></li>
          <li><a href="/#faq">FAQ</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Legal</h4>
        <ul>
          <li><a href="/privacy.html">Privacy Policy</a></li>
          <li><a href="/terms.html">Terms of Service</a></li>
          <li><a href="mailto:hello@courtdraw.app">Contact</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <p>© 2026 CourtDraw. All rights reserved.</p>
      <div class="footer-legal">
        <a href="/privacy.html">Privacy</a>
        <a href="/terms.html">Terms</a>
        <a href="mailto:hello@courtdraw.app">Contact</a>
      </div>
    </div>
  </div>
</footer>

</body>
</html>`;
}

// ─── SPORTS HUB PAGE ─────────────────────────────────────────────────────────

function buildHubPage() {
  const familyGroups = Object.entries(FAMILIES).map(([key, fam]) => {
    const sports = fam.slugs.map(slug => SPORTS.find(s => s.slug === slug)).filter(Boolean);
    const cards = sports.map(s =>
      `<a href="/${s.slug}-tactics-board/" class="hub-card">
        <span class="hub-card-icon">${s.emoji}</span>
        <span class="hub-card-name">${s.name}</span>
      </a>`
    ).join('');
    return `
    <div class="hub-family">
      <h2 class="hub-family-title">${fam.label}</h2>
      <div class="hub-family-grid">${cards}</div>
    </div>`;
  }).join('');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: 'Sports Tactics Boards — CourtDraw',
        description: 'Browse tactics boards for 38+ sports including football, basketball, tennis, ice hockey, volleyball, and more. Free online coach tool.',
        url: 'https://courtdraw.app/sports/',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://courtdraw.app/' },
          { '@type': 'ListItem', position: 2, name: 'Sports', item: 'https://courtdraw.app/sports/' },
        ],
      },
    ],
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-9NZSFKFV1N"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-9NZSFKFV1N');</script>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sports Tactics Boards — All 38+ Sports | CourtDraw</title>
  <meta name="description" content="Browse free online tactics boards for 38+ sports: football, basketball, tennis, ice hockey, volleyball, padel, handball, and more. Draw and share plays instantly." />
  <link rel="canonical" href="https://courtdraw.app/sports/" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://courtdraw.app/sports/" />
  <meta property="og:title" content="Sports Tactics Boards — All 38+ Sports | CourtDraw" />
  <meta property="og:description" content="Free online tactics boards for 38+ sports. Draw plays, share strategy, coach better." />
  <meta property="og:image" content="https://courtdraw.app/assets/og-image.svg" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Sports Tactics Boards — All 38+ Sports | CourtDraw" />
  <meta name="twitter:image" content="https://courtdraw.app/assets/og-image.svg" />
  <link rel="manifest" href="/manifest.json" />
  <meta name="theme-color" content="#1d4ed8" />
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <link rel="apple-touch-icon" href="/assets/icons/icon-192.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <script type="application/ld+json">${JSON.stringify(jsonLd, null, 2)}</script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root { --bg:#0a1628;--bg2:#0d1f3c;--bg3:#1a2d4a;--border:#1a2d4a;--border2:#2a3f5c;--text:#f1f5f9;--muted:#94a3b8;--accent:#3b82f6;--accent-glow:rgba(59,130,246,0.18);--radius:14px;--radius-lg:22px; }
    html { scroll-behavior: smooth; }
    body { background: var(--bg); color: var(--text); font-family: 'Plus Jakarta Sans', system-ui, sans-serif; line-height: 1.6; -webkit-font-smoothing: antialiased; }
    a { color: inherit; text-decoration: none; }
    .container { max-width: 1160px; margin: 0 auto; padding: 0 24px; }
    .badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(59,130,246,0.12); border: 1px solid rgba(59,130,246,0.3); color: var(--accent); border-radius: 100px; padding: 4px 14px; font-size: 0.78rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
    .badge-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); animation: pulse 2s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
    .btn { display: inline-flex; align-items: center; gap: 8px; font-family: inherit; font-weight: 700; border-radius: 12px; cursor: pointer; transition: all .18s; border: none; text-decoration: none; }
    .btn-primary { background: var(--accent); color: #fff; padding: 14px 28px; font-size: 1rem; }
    .btn-primary:hover { background: #60a5fa; transform: translateY(-1px); box-shadow: 0 8px 30px rgba(59,130,246,0.4); }
    .btn-ghost { background: transparent; color: var(--text); border: 1.5px solid var(--border2); padding: 13px 26px; font-size: 1rem; }
    .gradient-text { background: linear-gradient(135deg,#3b82f6 0%,#60a5fa 50%,#93c5fd 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    nav { position: sticky; top: 0; z-index: 100; background: rgba(10,22,40,0.85); backdrop-filter: blur(16px); border-bottom: 1px solid var(--border); }
    .nav-inner { display: flex; align-items: center; justify-content: space-between; height: 64px; }
    .nav-logo { display: flex; align-items: center; gap: 10px; font-size: 1.3rem; font-weight: 800; letter-spacing: -0.03em; }
    .nav-logo-mark { width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .nav-links { display: flex; align-items: center; gap: 8px; }
    .nav-links a { color: var(--muted); font-size: 0.9rem; font-weight: 500; padding: 6px 12px; border-radius: 8px; transition: color .15s; }
    .nav-links a.active { color: var(--text); }
    .nav-cta { display: flex; align-items: center; gap: 10px; }
    @media (max-width: 680px) { .nav-links { display: none; } }
    .hub-hero { padding: 72px 0 56px; text-align: center; }
    .hub-hero h1 { font-size: clamp(2rem, 4vw, 3.2rem); font-weight: 800; letter-spacing: -0.04em; margin: 16px 0; }
    .hub-hero p { color: var(--muted); max-width: 520px; margin: 0 auto; font-size: 1.05rem; }
    .hub-content { padding: 0 0 80px; }
    .hub-family { margin-bottom: 56px; }
    .hub-family-title { font-size: 1.05rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-bottom: 20px; border-bottom: 1px solid var(--border); padding-bottom: 12px; }
    .hub-family-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
    .hub-card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px 16px; text-align: center; transition: all .18s; display: flex; flex-direction: column; align-items: center; gap: 8px; }
    .hub-card:hover { border-color: var(--accent); background: var(--bg3); transform: translateY(-2px); }
    .hub-card-icon { font-size: 1.8rem; }
    .hub-card-name { font-size: 0.82rem; font-weight: 600; color: var(--muted); line-height: 1.3; }
    .hub-cta { text-align: center; padding: 48px 0; background: var(--bg2); border-top: 1px solid var(--border); }
    .hub-cta h2 { font-size: clamp(1.5rem, 3vw, 2.2rem); font-weight: 800; letter-spacing: -0.03em; margin-bottom: 16px; }
    .hub-cta p { color: var(--muted); margin-bottom: 28px; }
    footer { border-top: 1px solid var(--border); padding: 48px 0 32px; }
    .footer-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 48px; margin-bottom: 32px; }
    @media (max-width: 780px) { .footer-grid { grid-template-columns: 1fr 1fr; } }
    .footer-brand p { color: var(--muted); font-size: 0.875rem; margin-top: 14px; line-height: 1.6; max-width: 260px; }
    .footer-col h4 { font-size: 0.78rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); margin-bottom: 16px; }
    .footer-col ul { list-style: none; display: flex; flex-direction: column; gap: 10px; }
    .footer-col ul li a { color: var(--muted); font-size: 0.875rem; transition: color .15s; }
    .footer-col ul li a:hover { color: var(--text); }
    .footer-bottom { display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--border); padding-top: 24px; flex-wrap: wrap; gap: 16px; }
    .footer-bottom p { color: var(--muted); font-size: 0.8rem; }
    .footer-legal { display: flex; gap: 20px; }
    .footer-legal a { color: var(--muted); font-size: 0.8rem; }
  </style>
</head>
<body>

<nav>
  <div class="container nav-inner">
    <a href="/" class="nav-logo">
      <div class="nav-logo-mark">${LOGO_SVG}</div>
      CourtDraw
    </a>
    <div class="nav-links">
      <a href="/sports/" class="active">All Sports</a>
      <a href="/#features">Features</a>
      <a href="/#pricing">Pricing</a>
      <a href="/#faq">FAQ</a>
    </div>
    <div class="nav-cta">
      <a href="/login.html" class="btn btn-ghost" style="padding:9px 18px;font-size:.875rem;">Sign in</a>
      <a href="/courtdraw-app.html" class="btn btn-primary" style="padding:9px 18px;font-size:.875rem;">Try Free</a>
    </div>
  </div>
</nav>

<section class="hub-hero">
  <div class="container">
    <span class="badge"><span class="badge-dot"></span>38+ Sports</span>
    <h1>Sports <span class="gradient-text">Tactics Boards</span></h1>
    <p>Every sport. One free tool. Draw plays, share strategy, and coach better — no install required.</p>
  </div>
</section>

<div class="hub-content">
  <div class="container">
    ${familyGroups}
  </div>
</div>

<div class="hub-cta">
  <div class="container">
    <h2>Start Drawing for Free</h2>
    <p>No account required. Works on iPad offline.</p>
    <a href="/courtdraw-app.html" class="btn btn-primary">Open CourtDraw →</a>
  </div>
</div>

<footer>
  <div class="container">
    <div class="footer-grid">
      <div class="footer-brand">
        <a href="/" class="nav-logo">
          <div class="nav-logo-mark">${LOGO_SVG}</div>
          CourtDraw
        </a>
        <p>The tactics board for every coach. 38+ sports, free forever.</p>
      </div>
      <div class="footer-col">
        <h4>Sports</h4>
        <ul>
          <li><a href="/sports/">All Sports</a></li>
          <li><a href="/football-tactics-board/">Football</a></li>
          <li><a href="/basketball-tactics-board/">Basketball</a></li>
          <li><a href="/tennis-tactics-board/">Tennis</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Product</h4>
        <ul>
          <li><a href="/courtdraw-app.html">Open App</a></li>
          <li><a href="/#features">Features</a></li>
          <li><a href="/#pricing">Pricing</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Legal</h4>
        <ul>
          <li><a href="/privacy.html">Privacy Policy</a></li>
          <li><a href="/terms.html">Terms of Service</a></li>
          <li><a href="mailto:hello@courtdraw.app">Contact</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <p>© 2026 CourtDraw. All rights reserved.</p>
      <div class="footer-legal">
        <a href="/privacy.html">Privacy</a>
        <a href="/terms.html">Terms</a>
      </div>
    </div>
  </div>
</footer>

</body>
</html>`;
}

// ─── SITEMAP ─────────────────────────────────────────────────────────────────

function buildSitemap() {
  const sportUrls = SPORTS.map(s =>
    `  <url>\n    <loc>https://courtdraw.app/${s.slug}-tactics-board/</loc>\n    <lastmod>${TODAY}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>`
  ).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://courtdraw.app/</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://courtdraw.app/sports/</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
${sportUrls}
</urlset>`;
}

// ─── GENERATE ────────────────────────────────────────────────────────────────

let generated = 0;

for (const sport of SPORTS) {
  const dir = path.join(BASE, `${sport.slug}-tactics-board`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), buildPage(sport), 'utf8');
  console.log(`✓ ${sport.slug}-tactics-board/index.html`);
  generated++;
}

// Hub page
const hubDir = path.join(BASE, 'sports');
fs.mkdirSync(hubDir, { recursive: true });
fs.writeFileSync(path.join(hubDir, 'index.html'), buildHubPage(), 'utf8');
console.log(`✓ sports/index.html`);

// Sitemap
fs.writeFileSync(path.join(BASE, 'sitemap.xml'), buildSitemap(), 'utf8');
console.log(`✓ sitemap.xml`);

console.log(`\n✅ Done — ${generated} sport pages + hub page + sitemap.`);
console.log(`Pages missing play library data (no sample-plays section):`);
SPORTS.filter(s => !s.plays || s.plays.length === 0).forEach(s => console.log(`  - ${s.name} (${s.slug})`));
