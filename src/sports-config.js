// src/sports-config.js
// Court coordinate system: x = 0.0 (left) → 1.0 (right), y = 0.0 (top) → 1.0 (bottom)
// SVG viewBox: "0 0 1000 600" — court is landscape orientation
// Team A (blue) attacks right → starts LEFT half (x ≈ 0.08–0.45)
// Team B (red) attacks left  → starts RIGHT half (x ≈ 0.55–0.92)
// Goalkeeper x is sport-specific: placed at the centre of the goal mouth, INSIDE the field.
// Court boundaries vary: handball/futsal x=70–930, football x=130–870, field hockey x=101–899, etc.

export const SPORT_TOKENS = {

  // ─── RACKET / NET SPORTS ────────────────────────────────────────────────────

  tennis_singles: [
    // A: left baseline, B: right baseline
    { team: 'blue', label: 'A', pct: [0.12, 0.50] },
    { team: 'red',  label: 'B', pct: [0.88, 0.50] },
  ],

  tennis_doubles: [
    // Each team: baseline player + net player
    { team: 'blue', label: 'A1', pct: [0.12, 0.35] },
    { team: 'blue', label: 'A2', pct: [0.28, 0.65] },
    { team: 'red',  label: 'B1', pct: [0.88, 0.35] },
    { team: 'red',  label: 'B2', pct: [0.72, 0.65] },
  ],

  padel: [
    // 2v2, each pair on their half; one at back glass, one mid
    { team: 'blue', label: 'A1', pct: [0.10, 0.32] },
    { team: 'blue', label: 'A2', pct: [0.10, 0.68] },
    { team: 'red',  label: 'B1', pct: [0.90, 0.32] },
    { team: 'red',  label: 'B2', pct: [0.90, 0.68] },
  ],

  pickleball: [
    // 2v2 (doubles is standard); kitchen line + baseline
    { team: 'blue', label: 'A1', pct: [0.30, 0.35] },
    { team: 'blue', label: 'A2', pct: [0.30, 0.65] },
    { team: 'red',  label: 'B1', pct: [0.70, 0.35] },
    { team: 'red',  label: 'B2', pct: [0.70, 0.65] },
  ],

  badminton_singles: [
    { team: 'blue', label: 'A', pct: [0.14, 0.50] },
    { team: 'red',  label: 'B', pct: [0.86, 0.50] },
  ],

  badminton_doubles: [
    // Doubles: one player near net, one at rear — vertically separated
    { team: 'blue', label: 'A1', pct: [0.20, 0.33] },
    { team: 'blue', label: 'A2', pct: [0.10, 0.67] },
    { team: 'red',  label: 'B1', pct: [0.80, 0.33] },
    { team: 'red',  label: 'B2', pct: [0.90, 0.67] },
  ],

  squash: [
    // 1v1, both start near T-line on their side
    { team: 'blue', label: 'A', pct: [0.32, 0.50] },
    { team: 'red',  label: 'B', pct: [0.68, 0.50] },
  ],

  table_tennis: [
    { team: 'blue', label: 'A', pct: [0.10, 0.50] },
    { team: 'red',  label: 'B', pct: [0.90, 0.50] },
  ],

  racquetball: [
    { team: 'blue', label: 'A', pct: [0.32, 0.50] },
    { team: 'red',  label: 'B', pct: [0.68, 0.50] },
  ],

  beach_tennis: [
    // 2v2 like beach volleyball but smaller court
    { team: 'blue', label: 'A1', pct: [0.18, 0.32] },
    { team: 'blue', label: 'A2', pct: [0.18, 0.68] },
    { team: 'red',  label: 'B1', pct: [0.82, 0.32] },
    { team: 'red',  label: 'B2', pct: [0.82, 0.68] },
  ],

  // ─── TEAM SPORTS — BALL / GOAL ──────────────────────────────────────────────

  handball: [
    // IHF: 7v7 (6 outfield + GK). 4-2 outfield formation.
    // Court x=70–930. Goal mouth centre: left x=80, right x=920. GK placed in goal.
    // Team A (blue) — left half, attacking right
    { team: 'blue', label: 'GK', pct: [0.08, 0.50] },
    { team: 'blue', label: 'LW', pct: [0.25, 0.15] },
    { team: 'blue', label: 'LB', pct: [0.30, 0.35] },
    { team: 'blue', label: 'CB', pct: [0.32, 0.50] },
    { team: 'blue', label: 'RB', pct: [0.30, 0.65] },
    { team: 'blue', label: 'RW', pct: [0.25, 0.85] },
    { team: 'blue', label: 'PV', pct: [0.40, 0.50] },
    // Team B (red) — right half, attacking left
    { team: 'red',  label: 'GK', pct: [0.92, 0.50] },
    { team: 'red',  label: 'LW', pct: [0.75, 0.15] },
    { team: 'red',  label: 'LB', pct: [0.70, 0.35] },
    { team: 'red',  label: 'CB', pct: [0.68, 0.50] },
    { team: 'red',  label: 'RB', pct: [0.70, 0.65] },
    { team: 'red',  label: 'RW', pct: [0.75, 0.85] },
    { team: 'red',  label: 'PV', pct: [0.60, 0.50] },
  ],

  futsal: [
    // FIFA Futsal: 5v5 (4 outfield + GK). 1-2-1 formation.
    // Court x=70–930. Goal centre: left x=80, right x=920.
    { team: 'blue', label: 'GK', pct: [0.08, 0.50] },
    { team: 'blue', label: 'FX', pct: [0.20, 0.50] },
    { team: 'blue', label: 'AL', pct: [0.30, 0.28] },
    { team: 'blue', label: 'AR', pct: [0.30, 0.72] },
    { team: 'blue', label: 'PI', pct: [0.42, 0.50] },
    { team: 'red',  label: 'GK', pct: [0.92, 0.50] },
    { team: 'red',  label: 'FX', pct: [0.80, 0.50] },
    { team: 'red',  label: 'AL', pct: [0.70, 0.28] },
    { team: 'red',  label: 'AR', pct: [0.70, 0.72] },
    { team: 'red',  label: 'PI', pct: [0.58, 0.50] },
  ],

  futsal_mini: [
    // 4v4 variant (3 outfield + GK). 1-1-1.
    // Court x=140–860. Goal centre: left x=150, right x=850.
    { team: 'blue', label: 'GK', pct: [0.15, 0.50] },
    { team: 'blue', label: 'DF', pct: [0.22, 0.50] },
    { team: 'blue', label: 'MF', pct: [0.33, 0.50] },
    { team: 'blue', label: 'FW', pct: [0.43, 0.50] },
    { team: 'red',  label: 'GK', pct: [0.85, 0.50] },
    { team: 'red',  label: 'DF', pct: [0.78, 0.50] },
    { team: 'red',  label: 'MF', pct: [0.67, 0.50] },
    { team: 'red',  label: 'FW', pct: [0.57, 0.50] },
  ],

  basketball_full: [
    // FIBA: 5v5. PG, SG, SF, PF, C
    // Team A (blue) — left half in half-court attack shape
    { team: 'blue', label: 'PG', pct: [0.30, 0.50] },
    { team: 'blue', label: 'SG', pct: [0.36, 0.22] },
    { team: 'blue', label: 'SF', pct: [0.36, 0.78] },
    { team: 'blue', label: 'PF', pct: [0.43, 0.30] },
    { team: 'blue', label: 'C',  pct: [0.43, 0.70] },
    // Team B (red) — right half
    { team: 'red',  label: 'PG', pct: [0.70, 0.50] },
    { team: 'red',  label: 'SG', pct: [0.64, 0.22] },
    { team: 'red',  label: 'SF', pct: [0.64, 0.78] },
    { team: 'red',  label: 'PF', pct: [0.57, 0.30] },
    { team: 'red',  label: 'C',  pct: [0.57, 0.70] },
  ],

  basketball_half: [
    // Half-court: Team A attacks basket on right side, Team B defends
    // Both teams compressed to the right half of the canvas (left half = backcourt not shown)
    { team: 'blue', label: 'PG', pct: [0.38, 0.50] },
    { team: 'blue', label: 'SG', pct: [0.42, 0.22] },
    { team: 'blue', label: 'SF', pct: [0.42, 0.78] },
    { team: 'blue', label: 'PF', pct: [0.48, 0.30] },
    { team: 'blue', label: 'C',  pct: [0.48, 0.70] },
    { team: 'red',  label: 'PG', pct: [0.22, 0.50] },
    { team: 'red',  label: 'SG', pct: [0.26, 0.22] },
    { team: 'red',  label: 'SF', pct: [0.26, 0.78] },
    { team: 'red',  label: 'PF', pct: [0.30, 0.35] },
    { team: 'red',  label: 'C',  pct: [0.30, 0.65] },
  ],

  volleyball: [
    // FIVB: 6v6. Rotation positions 1–6.
    // Team A (blue) — left side (serving/receiving end)
    { team: 'blue', label: 'P1', pct: [0.28, 0.75] },
    { team: 'blue', label: 'P2', pct: [0.18, 0.75] },
    { team: 'blue', label: 'P3', pct: [0.18, 0.50] },
    { team: 'blue', label: 'P4', pct: [0.18, 0.25] },
    { team: 'blue', label: 'P5', pct: [0.28, 0.25] },
    { team: 'blue', label: 'P6', pct: [0.28, 0.50] },
    // Team B (red) — right side
    { team: 'red',  label: 'P1', pct: [0.72, 0.25] },
    { team: 'red',  label: 'P2', pct: [0.82, 0.25] },
    { team: 'red',  label: 'P3', pct: [0.82, 0.50] },
    { team: 'red',  label: 'P4', pct: [0.82, 0.75] },
    { team: 'red',  label: 'P5', pct: [0.72, 0.75] },
    { team: 'red',  label: 'P6', pct: [0.72, 0.50] },
  ],

  floorball: [
    // IFF: 6v6 (5 outfield + GK). 2-2-1 formation.
    // Court x=70–930. Goal centre: left x=80, right x=920.
    { team: 'blue', label: 'GK', pct: [0.08, 0.50] },
    { team: 'blue', label: 'LD', pct: [0.20, 0.28] },
    { team: 'blue', label: 'RD', pct: [0.20, 0.72] },
    { team: 'blue', label: 'LM', pct: [0.30, 0.28] },
    { team: 'blue', label: 'RM', pct: [0.30, 0.72] },
    { team: 'blue', label: 'FW', pct: [0.40, 0.50] },
    { team: 'red',  label: 'GK', pct: [0.92, 0.50] },
    { team: 'red',  label: 'LD', pct: [0.80, 0.28] },
    { team: 'red',  label: 'RD', pct: [0.80, 0.72] },
    { team: 'red',  label: 'LM', pct: [0.70, 0.28] },
    { team: 'red',  label: 'RM', pct: [0.70, 0.72] },
    { team: 'red',  label: 'FW', pct: [0.60, 0.50] },
  ],

  korfball: [
    // IKF: 8v8. Court split into two halves (attack/defense zones).
    // Each team has 4 attackers in opponent half, 4 defenders in own half.
    // Team A: 4 defenders left, 4 attackers right-center
    { team: 'blue', label: 'D1', pct: [0.18, 0.25] },
    { team: 'blue', label: 'D2', pct: [0.18, 0.50] },
    { team: 'blue', label: 'D3', pct: [0.18, 0.75] },
    { team: 'blue', label: 'D4', pct: [0.26, 0.50] },
    { team: 'blue', label: 'A1', pct: [0.62, 0.25] },
    { team: 'blue', label: 'A2', pct: [0.62, 0.50] },
    { team: 'blue', label: 'A3', pct: [0.62, 0.75] },
    { team: 'blue', label: 'A4', pct: [0.70, 0.50] },
    // Team B: 4 defenders right, 4 attackers left-center
    { team: 'red',  label: 'D1', pct: [0.82, 0.25] },
    { team: 'red',  label: 'D2', pct: [0.82, 0.50] },
    { team: 'red',  label: 'D3', pct: [0.82, 0.75] },
    { team: 'red',  label: 'D4', pct: [0.74, 0.50] },
    { team: 'red',  label: 'A1', pct: [0.38, 0.25] },
    { team: 'red',  label: 'A2', pct: [0.38, 0.50] },
    { team: 'red',  label: 'A3', pct: [0.38, 0.75] },
    { team: 'red',  label: 'A4', pct: [0.30, 0.50] },
  ],

  netball: [
    // INF: 7v7. Positions: GS, GA, WA, C, WD, GD, GK
    { team: 'blue', label: 'GK', pct: [0.08, 0.50] },
    { team: 'blue', label: 'GD', pct: [0.18, 0.38] },
    { team: 'blue', label: 'WD', pct: [0.25, 0.62] },
    { team: 'blue', label: 'C',  pct: [0.34, 0.50] },
    { team: 'blue', label: 'WA', pct: [0.40, 0.38] },
    { team: 'blue', label: 'GA', pct: [0.40, 0.62] },
    { team: 'blue', label: 'GS', pct: [0.45, 0.50] },
    { team: 'red',  label: 'GK', pct: [0.92, 0.50] },
    { team: 'red',  label: 'GD', pct: [0.82, 0.62] },
    { team: 'red',  label: 'WD', pct: [0.75, 0.38] },
    { team: 'red',  label: 'C',  pct: [0.66, 0.50] },
    { team: 'red',  label: 'WA', pct: [0.60, 0.62] },
    { team: 'red',  label: 'GA', pct: [0.60, 0.38] },
    { team: 'red',  label: 'GS', pct: [0.55, 0.50] },
  ],

  // ─── FOOTBALL / SOCCER ──────────────────────────────────────────────────────

  football_full: [
    // FIFA: 11v11. 4-3-3 formation.
    // Court x=130–870. Goal line: left x=130, right x=870. GK on goal line (inside).
    // Team A (blue) — left half
    { team: 'blue', label: 'GK', pct: [0.14, 0.50] },
    { team: 'blue', label: 'LB', pct: [0.18, 0.82] },
    { team: 'blue', label: 'CB', pct: [0.18, 0.62] },
    { team: 'blue', label: 'CB', pct: [0.18, 0.38] },
    { team: 'blue', label: 'RB', pct: [0.18, 0.18] },
    { team: 'blue', label: 'LM', pct: [0.30, 0.72] },
    { team: 'blue', label: 'CM', pct: [0.30, 0.50] },
    { team: 'blue', label: 'RM', pct: [0.30, 0.28] },
    { team: 'blue', label: 'LW', pct: [0.40, 0.82] },
    { team: 'blue', label: 'ST', pct: [0.40, 0.50] },
    { team: 'blue', label: 'RW', pct: [0.40, 0.18] },
    // Team B (red) — right half
    { team: 'red',  label: 'GK', pct: [0.86, 0.50] },
    { team: 'red',  label: 'LB', pct: [0.82, 0.18] },
    { team: 'red',  label: 'CB', pct: [0.82, 0.38] },
    { team: 'red',  label: 'CB', pct: [0.82, 0.62] },
    { team: 'red',  label: 'RB', pct: [0.82, 0.82] },
    { team: 'red',  label: 'LM', pct: [0.70, 0.28] },
    { team: 'red',  label: 'CM', pct: [0.70, 0.50] },
    { team: 'red',  label: 'RM', pct: [0.70, 0.72] },
    { team: 'red',  label: 'LW', pct: [0.60, 0.18] },
    { team: 'red',  label: 'ST', pct: [0.60, 0.50] },
    { team: 'red',  label: 'RW', pct: [0.60, 0.82] },
  ],

  football_half: [
    // Half pitch: Team A attacking in the right half. 4-3-3 compressed.
    { team: 'blue', label: 'LB', pct: [0.38, 0.82] },
    { team: 'blue', label: 'CB', pct: [0.35, 0.62] },
    { team: 'blue', label: 'CB', pct: [0.35, 0.38] },
    { team: 'blue', label: 'RB', pct: [0.38, 0.18] },
    { team: 'blue', label: 'LM', pct: [0.44, 0.72] },
    { team: 'blue', label: 'CM', pct: [0.44, 0.50] },
    { team: 'blue', label: 'RM', pct: [0.44, 0.28] },
    { team: 'blue', label: 'LW', pct: [0.48, 0.82] },
    { team: 'blue', label: 'ST', pct: [0.48, 0.50] },
    { team: 'blue', label: 'RW', pct: [0.48, 0.18] },
    // Defending team (red) — compressed, facing left; their goal is left boundary x=130
    { team: 'red',  label: 'GK', pct: [0.14, 0.50] },
    { team: 'red',  label: 'LB', pct: [0.80, 0.18] },
    { team: 'red',  label: 'CB', pct: [0.78, 0.38] },
    { team: 'red',  label: 'CB', pct: [0.78, 0.62] },
    { team: 'red',  label: 'RB', pct: [0.80, 0.82] },
    { team: 'red',  label: 'LM', pct: [0.68, 0.28] },
    { team: 'red',  label: 'CM', pct: [0.68, 0.50] },
    { team: 'red',  label: 'RM', pct: [0.68, 0.72] },
    { team: 'red',  label: 'LW', pct: [0.60, 0.18] },
    { team: 'red',  label: 'ST', pct: [0.60, 0.50] },
    { team: 'red',  label: 'RW', pct: [0.60, 0.82] },
  ],

  // ─── RUGBY ──────────────────────────────────────────────────────────────────

  rugby_union: [
    // World Rugby: 15v15. 3-4-1-2-3 (scrum formation → attacking spread)
    // Using a typical attacking spread: 1-3-4-3-4 across pitch
    // Team A (blue)
    { team: 'blue', label: '15', pct: [0.08, 0.50] },  // fullback
    { team: 'blue', label: '11', pct: [0.12, 0.88] },  // left wing
    { team: 'blue', label: '12', pct: [0.16, 0.65] },  // inside centre
    { team: 'blue', label: '13', pct: [0.16, 0.35] },  // outside centre
    { team: 'blue', label: '14', pct: [0.12, 0.12] },  // right wing
    { team: 'blue', label: '10', pct: [0.22, 0.55] },  // fly-half
    { team: 'blue', label: '9',  pct: [0.26, 0.45] },  // scrum-half
    { team: 'blue', label: '8',  pct: [0.30, 0.50] },  // number 8
    { team: 'blue', label: '7',  pct: [0.30, 0.30] },  // openside flanker
    { team: 'blue', label: '6',  pct: [0.30, 0.70] },  // blindside flanker
    { team: 'blue', label: '5',  pct: [0.35, 0.38] },  // lock
    { team: 'blue', label: '4',  pct: [0.35, 0.62] },  // lock
    { team: 'blue', label: '3',  pct: [0.40, 0.28] },  // tighthead prop
    { team: 'blue', label: '2',  pct: [0.40, 0.50] },  // hooker
    { team: 'blue', label: '1',  pct: [0.40, 0.72] },  // loosehead prop
    // Team B (red)
    { team: 'red',  label: '15', pct: [0.92, 0.50] },
    { team: 'red',  label: '11', pct: [0.88, 0.12] },
    { team: 'red',  label: '12', pct: [0.84, 0.35] },
    { team: 'red',  label: '13', pct: [0.84, 0.65] },
    { team: 'red',  label: '14', pct: [0.88, 0.88] },
    { team: 'red',  label: '10', pct: [0.78, 0.45] },
    { team: 'red',  label: '9',  pct: [0.74, 0.55] },
    { team: 'red',  label: '8',  pct: [0.70, 0.50] },
    { team: 'red',  label: '7',  pct: [0.70, 0.70] },
    { team: 'red',  label: '6',  pct: [0.70, 0.30] },
    { team: 'red',  label: '5',  pct: [0.65, 0.62] },
    { team: 'red',  label: '4',  pct: [0.65, 0.38] },
    { team: 'red',  label: '3',  pct: [0.60, 0.72] },
    { team: 'red',  label: '2',  pct: [0.60, 0.50] },
    { team: 'red',  label: '1',  pct: [0.60, 0.28] },
  ],

  rugby_league: [
    // World Rugby League: 13v13. 6 forwards + 6 backs + halfback.
    // Team A (blue)
    { team: 'blue', label: '1',  pct: [0.08, 0.50] },  // fullback
    { team: 'blue', label: '2',  pct: [0.12, 0.12] },  // right wing
    { team: 'blue', label: '3',  pct: [0.16, 0.28] },  // right centre
    { team: 'blue', label: '4',  pct: [0.16, 0.72] },  // left centre
    { team: 'blue', label: '5',  pct: [0.12, 0.88] },  // left wing
    { team: 'blue', label: '6',  pct: [0.22, 0.38] },  // stand-off
    { team: 'blue', label: '7',  pct: [0.26, 0.62] },  // halfback
    { team: 'blue', label: '8',  pct: [0.32, 0.28] },  // prop
    { team: 'blue', label: '9',  pct: [0.32, 0.50] },  // hooker
    { team: 'blue', label: '10', pct: [0.32, 0.72] },  // prop
    { team: 'blue', label: '11', pct: [0.38, 0.35] },  // second row
    { team: 'blue', label: '12', pct: [0.38, 0.65] },  // second row
    { team: 'blue', label: '13', pct: [0.38, 0.50] },  // loose forward
    // Team B (red)
    { team: 'red',  label: '1',  pct: [0.92, 0.50] },
    { team: 'red',  label: '2',  pct: [0.88, 0.88] },
    { team: 'red',  label: '3',  pct: [0.84, 0.72] },
    { team: 'red',  label: '4',  pct: [0.84, 0.28] },
    { team: 'red',  label: '5',  pct: [0.88, 0.12] },
    { team: 'red',  label: '6',  pct: [0.78, 0.62] },
    { team: 'red',  label: '7',  pct: [0.74, 0.38] },
    { team: 'red',  label: '8',  pct: [0.68, 0.72] },
    { team: 'red',  label: '9',  pct: [0.68, 0.50] },
    { team: 'red',  label: '10', pct: [0.68, 0.28] },
    { team: 'red',  label: '11', pct: [0.62, 0.65] },
    { team: 'red',  label: '12', pct: [0.62, 0.35] },
    { team: 'red',  label: '13', pct: [0.62, 0.50] },
  ],

  // ─── FIELD HOCKEY ───────────────────────────────────────────────────────────

  field_hockey: [
    // FIH: 11v11. 4-3-3 / 1-4-3-3.
    // Court x=101–899. Goal rect: left x=101 w=16, right x=883 w=16. Centre: left x=109, right x=891.
    { team: 'blue', label: 'GK', pct: [0.11, 0.50] },
    { team: 'blue', label: 'LB', pct: [0.18, 0.80] },
    { team: 'blue', label: 'CB', pct: [0.18, 0.60] },
    { team: 'blue', label: 'CB', pct: [0.18, 0.40] },
    { team: 'blue', label: 'RB', pct: [0.18, 0.20] },
    { team: 'blue', label: 'LM', pct: [0.30, 0.72] },
    { team: 'blue', label: 'CM', pct: [0.30, 0.50] },
    { team: 'blue', label: 'RM', pct: [0.30, 0.28] },
    { team: 'blue', label: 'LF', pct: [0.40, 0.80] },
    { team: 'blue', label: 'CF', pct: [0.40, 0.50] },
    { team: 'blue', label: 'RF', pct: [0.40, 0.20] },
    { team: 'red',  label: 'GK', pct: [0.89, 0.50] },
    { team: 'red',  label: 'LB', pct: [0.82, 0.20] },
    { team: 'red',  label: 'CB', pct: [0.82, 0.40] },
    { team: 'red',  label: 'CB', pct: [0.82, 0.60] },
    { team: 'red',  label: 'RB', pct: [0.82, 0.80] },
    { team: 'red',  label: 'LM', pct: [0.70, 0.28] },
    { team: 'red',  label: 'CM', pct: [0.70, 0.50] },
    { team: 'red',  label: 'RM', pct: [0.70, 0.72] },
    { team: 'red',  label: 'LF', pct: [0.60, 0.20] },
    { team: 'red',  label: 'CF', pct: [0.60, 0.50] },
    { team: 'red',  label: 'RF', pct: [0.60, 0.80] },
  ],

  indoor_hockey: [
    // FIH Indoor: 6v6 (5 outfield + GK). 2-2-1 formation.
    // Court x=70–930. Goal rect: left x=70 w=20, right x=910 w=20. Centre: left x=80, right x=920.
    { team: 'blue', label: 'GK', pct: [0.08, 0.50] },
    { team: 'blue', label: 'LD', pct: [0.20, 0.30] },
    { team: 'blue', label: 'RD', pct: [0.20, 0.70] },
    { team: 'blue', label: 'LM', pct: [0.30, 0.30] },
    { team: 'blue', label: 'RM', pct: [0.30, 0.70] },
    { team: 'blue', label: 'FW', pct: [0.40, 0.50] },
    { team: 'red',  label: 'GK', pct: [0.92, 0.50] },
    { team: 'red',  label: 'LD', pct: [0.80, 0.70] },
    { team: 'red',  label: 'RD', pct: [0.80, 0.30] },
    { team: 'red',  label: 'LM', pct: [0.70, 0.70] },
    { team: 'red',  label: 'RM', pct: [0.70, 0.30] },
    { team: 'red',  label: 'FW', pct: [0.60, 0.50] },
  ],

  // ─── GAELIC GAMES ───────────────────────────────────────────────────────────

  gaelic_football: [
    // GAA: 15v15. Goalkeeper + 6 backs + 2 midfielders + 6 forwards.
    // Court x=105–895. Goal line at x=105/895. GK at x=115/885 (10px inside boundary).
    // Team A (blue)
    { team: 'blue', label: 'GK', pct: [0.12, 0.50] },
    { team: 'blue', label: 'FB', pct: [0.12, 0.22] },
    { team: 'blue', label: 'FB', pct: [0.12, 0.50] },
    { team: 'blue', label: 'FB', pct: [0.12, 0.78] },
    { team: 'blue', label: 'HB', pct: [0.20, 0.22] },
    { team: 'blue', label: 'HB', pct: [0.20, 0.50] },
    { team: 'blue', label: 'HB', pct: [0.20, 0.78] },
    { team: 'blue', label: 'MF', pct: [0.28, 0.38] },
    { team: 'blue', label: 'MF', pct: [0.28, 0.62] },
    { team: 'blue', label: 'HF', pct: [0.36, 0.22] },
    { team: 'blue', label: 'HF', pct: [0.36, 0.50] },
    { team: 'blue', label: 'HF', pct: [0.36, 0.78] },
    { team: 'blue', label: 'FF', pct: [0.43, 0.22] },
    { team: 'blue', label: 'FF', pct: [0.43, 0.50] },
    { team: 'blue', label: 'FF', pct: [0.43, 0.78] },
    // Team B (red)
    { team: 'red',  label: 'GK', pct: [0.88, 0.50] },
    { team: 'red',  label: 'FB', pct: [0.88, 0.78] },
    { team: 'red',  label: 'FB', pct: [0.88, 0.50] },
    { team: 'red',  label: 'FB', pct: [0.88, 0.22] },
    { team: 'red',  label: 'HB', pct: [0.80, 0.78] },
    { team: 'red',  label: 'HB', pct: [0.80, 0.50] },
    { team: 'red',  label: 'HB', pct: [0.80, 0.22] },
    { team: 'red',  label: 'MF', pct: [0.72, 0.62] },
    { team: 'red',  label: 'MF', pct: [0.72, 0.38] },
    { team: 'red',  label: 'HF', pct: [0.64, 0.78] },
    { team: 'red',  label: 'HF', pct: [0.64, 0.50] },
    { team: 'red',  label: 'HF', pct: [0.64, 0.22] },
    { team: 'red',  label: 'FF', pct: [0.57, 0.78] },
    { team: 'red',  label: 'FF', pct: [0.57, 0.50] },
    { team: 'red',  label: 'FF', pct: [0.57, 0.22] },
  ],

  hurling: [
    // GAA Hurling: same 15v15 structure as Gaelic football.
    // Court x=105–895. GK at x=115/885.
    // Team A (blue)
    { team: 'blue', label: 'GK', pct: [0.12, 0.50] },
    { team: 'blue', label: 'FB', pct: [0.12, 0.22] },
    { team: 'blue', label: 'FB', pct: [0.12, 0.50] },
    { team: 'blue', label: 'FB', pct: [0.12, 0.78] },
    { team: 'blue', label: 'HB', pct: [0.20, 0.22] },
    { team: 'blue', label: 'HB', pct: [0.20, 0.50] },
    { team: 'blue', label: 'HB', pct: [0.20, 0.78] },
    { team: 'blue', label: 'MF', pct: [0.28, 0.38] },
    { team: 'blue', label: 'MF', pct: [0.28, 0.62] },
    { team: 'blue', label: 'HF', pct: [0.36, 0.22] },
    { team: 'blue', label: 'HF', pct: [0.36, 0.50] },
    { team: 'blue', label: 'HF', pct: [0.36, 0.78] },
    { team: 'blue', label: 'FF', pct: [0.43, 0.22] },
    { team: 'blue', label: 'FF', pct: [0.43, 0.50] },
    { team: 'blue', label: 'FF', pct: [0.43, 0.78] },
    // Team B (red)
    { team: 'red',  label: 'GK', pct: [0.88, 0.50] },
    { team: 'red',  label: 'FB', pct: [0.88, 0.78] },
    { team: 'red',  label: 'FB', pct: [0.88, 0.50] },
    { team: 'red',  label: 'FB', pct: [0.88, 0.22] },
    { team: 'red',  label: 'HB', pct: [0.80, 0.78] },
    { team: 'red',  label: 'HB', pct: [0.80, 0.50] },
    { team: 'red',  label: 'HB', pct: [0.80, 0.22] },
    { team: 'red',  label: 'MF', pct: [0.72, 0.62] },
    { team: 'red',  label: 'MF', pct: [0.72, 0.38] },
    { team: 'red',  label: 'HF', pct: [0.64, 0.78] },
    { team: 'red',  label: 'HF', pct: [0.64, 0.50] },
    { team: 'red',  label: 'HF', pct: [0.64, 0.22] },
    { team: 'red',  label: 'FF', pct: [0.57, 0.78] },
    { team: 'red',  label: 'FF', pct: [0.57, 0.50] },
    { team: 'red',  label: 'FF', pct: [0.57, 0.22] },
  ],

  // ─── AMERICAN FOOTBALL ──────────────────────────────────────────────────────

  american_football: [
    // NFL/NCAA: 11v11. Offensive formation (shotgun spread) vs 4-3 defense.
    // Team A (blue) = offense (left, attacking right)
    { team: 'blue', label: 'QB', pct: [0.36, 0.50] },
    { team: 'blue', label: 'LT', pct: [0.40, 0.40] },
    { team: 'blue', label: 'LG', pct: [0.40, 0.45] },
    { team: 'blue', label: 'C',  pct: [0.40, 0.50] },
    { team: 'blue', label: 'RG', pct: [0.40, 0.55] },
    { team: 'blue', label: 'RT', pct: [0.40, 0.60] },
    { team: 'blue', label: 'TE', pct: [0.40, 0.65] },
    { team: 'blue', label: 'WR', pct: [0.34, 0.20] },
    { team: 'blue', label: 'WR', pct: [0.34, 0.80] },
    { team: 'blue', label: 'RB', pct: [0.32, 0.50] },
    { team: 'blue', label: 'FB', pct: [0.30, 0.50] },
    // Team B (red) = defense: 4-3
    { team: 'red',  label: 'DE', pct: [0.44, 0.35] },
    { team: 'red',  label: 'DT', pct: [0.44, 0.44] },
    { team: 'red',  label: 'DT', pct: [0.44, 0.56] },
    { team: 'red',  label: 'DE', pct: [0.44, 0.65] },
    { team: 'red',  label: 'LB', pct: [0.50, 0.38] },
    { team: 'red',  label: 'LB', pct: [0.50, 0.50] },
    { team: 'red',  label: 'LB', pct: [0.50, 0.62] },
    { team: 'red',  label: 'CB', pct: [0.55, 0.20] },
    { team: 'red',  label: 'CB', pct: [0.55, 0.80] },
    { team: 'red',  label: 'SS', pct: [0.58, 0.38] },
    { team: 'red',  label: 'FS', pct: [0.62, 0.62] },
  ],

  // ─── AUSTRALIAN RULES ───────────────────────────────────────────────────────

  australian_rules: [
    // AFL: 18v18 (+ 4 interchange). Field displayed: 18 per side.
    // Positions: 6 backs, 3 midfielders, 1 ruck, 6 forwards, 2 wings
    // Team A (blue) — left half
    { team: 'blue', label: 'B1', pct: [0.08, 0.20] },
    { team: 'blue', label: 'B2', pct: [0.08, 0.50] },
    { team: 'blue', label: 'B3', pct: [0.08, 0.80] },
    { team: 'blue', label: 'HB', pct: [0.16, 0.20] },
    { team: 'blue', label: 'HB', pct: [0.16, 0.50] },
    { team: 'blue', label: 'HB', pct: [0.16, 0.80] },
    { team: 'blue', label: 'W',  pct: [0.24, 0.18] },
    { team: 'blue', label: 'C',  pct: [0.26, 0.38] },
    { team: 'blue', label: 'RK', pct: [0.26, 0.50] },
    { team: 'blue', label: 'C',  pct: [0.26, 0.62] },
    { team: 'blue', label: 'W',  pct: [0.24, 0.82] },
    { team: 'blue', label: 'HF', pct: [0.34, 0.20] },
    { team: 'blue', label: 'HF', pct: [0.34, 0.50] },
    { team: 'blue', label: 'HF', pct: [0.34, 0.80] },
    { team: 'blue', label: 'FF', pct: [0.42, 0.20] },
    { team: 'blue', label: 'FF', pct: [0.42, 0.50] },
    { team: 'blue', label: 'FF', pct: [0.42, 0.80] },
    { team: 'blue', label: 'GK', pct: [0.46, 0.50] },
    // Team B (red) — right half
    { team: 'red',  label: 'B1', pct: [0.92, 0.80] },
    { team: 'red',  label: 'B2', pct: [0.92, 0.50] },
    { team: 'red',  label: 'B3', pct: [0.92, 0.20] },
    { team: 'red',  label: 'HB', pct: [0.84, 0.80] },
    { team: 'red',  label: 'HB', pct: [0.84, 0.50] },
    { team: 'red',  label: 'HB', pct: [0.84, 0.20] },
    { team: 'red',  label: 'W',  pct: [0.76, 0.82] },
    { team: 'red',  label: 'C',  pct: [0.74, 0.62] },
    { team: 'red',  label: 'RK', pct: [0.74, 0.50] },
    { team: 'red',  label: 'C',  pct: [0.74, 0.38] },
    { team: 'red',  label: 'W',  pct: [0.76, 0.18] },
    { team: 'red',  label: 'HF', pct: [0.66, 0.80] },
    { team: 'red',  label: 'HF', pct: [0.66, 0.50] },
    { team: 'red',  label: 'HF', pct: [0.66, 0.20] },
    { team: 'red',  label: 'FF', pct: [0.58, 0.80] },
    { team: 'red',  label: 'FF', pct: [0.58, 0.50] },
    { team: 'red',  label: 'FF', pct: [0.58, 0.20] },
    { team: 'red',  label: 'GK', pct: [0.54, 0.50] },
  ],

  // ─── ICE / ROLLER HOCKEY ────────────────────────────────────────────────────

  ice_hockey: [
    // IIHF: 6v6 (5 skaters + GK). 2-1-2 formation.
    // Court x=70–930. Crease: left x=127 w=40 → centre x=147; right x=833 w=40 → centre x=853.
    { team: 'blue', label: 'GK', pct: [0.15, 0.50] },
    { team: 'blue', label: 'LD', pct: [0.22, 0.30] },
    { team: 'blue', label: 'RD', pct: [0.22, 0.70] },
    { team: 'blue', label: 'C',  pct: [0.32, 0.50] },
    { team: 'blue', label: 'LW', pct: [0.38, 0.25] },
    { team: 'blue', label: 'RW', pct: [0.38, 0.75] },
    { team: 'red',  label: 'GK', pct: [0.85, 0.50] },
    { team: 'red',  label: 'LD', pct: [0.78, 0.70] },
    { team: 'red',  label: 'RD', pct: [0.78, 0.30] },
    { team: 'red',  label: 'C',  pct: [0.68, 0.50] },
    { team: 'red',  label: 'LW', pct: [0.62, 0.75] },
    { team: 'red',  label: 'RW', pct: [0.62, 0.25] },
  ],

  roller_hockey: [
    // FIRS: 5v5 (4 skaters + GK) — no blue lines, more open game.
    // Court x=70–930. Goal rect: left x=70 w=40 → centre x=90; right x=890 w=40 → centre x=910.
    { team: 'blue', label: 'GK', pct: [0.09, 0.50] },
    { team: 'blue', label: 'LD', pct: [0.24, 0.30] },
    { team: 'blue', label: 'RD', pct: [0.24, 0.70] },
    { team: 'blue', label: 'LW', pct: [0.38, 0.28] },
    { team: 'blue', label: 'RW', pct: [0.38, 0.72] },
    { team: 'red',  label: 'GK', pct: [0.91, 0.50] },
    { team: 'red',  label: 'LD', pct: [0.76, 0.70] },
    { team: 'red',  label: 'RD', pct: [0.76, 0.30] },
    { team: 'red',  label: 'LW', pct: [0.62, 0.72] },
    { team: 'red',  label: 'RW', pct: [0.62, 0.28] },
  ],

  // ─── BEACH SPORTS ───────────────────────────────────────────────────────────

  beach_volleyball: [
    // FIVB Beach: 2v2.
    { team: 'blue', label: 'A1', pct: [0.18, 0.30] },
    { team: 'blue', label: 'A2', pct: [0.18, 0.70] },
    { team: 'red',  label: 'B1', pct: [0.82, 0.30] },
    { team: 'red',  label: 'B2', pct: [0.82, 0.70] },
  ],

  beach_handball: [
    // IHF Beach: 4v4 (3 outfield + GK). Rotating GK/field.
    // Court x=176–824. Goal rect: left x=176 w=20 → centre x=186; right x=804 w=20 → centre x=814.
    { team: 'blue', label: 'GK', pct: [0.19, 0.50] },
    { team: 'blue', label: 'LW', pct: [0.25, 0.25] },
    { team: 'blue', label: 'PV', pct: [0.32, 0.50] },
    { team: 'blue', label: 'RW', pct: [0.25, 0.75] },
    { team: 'red',  label: 'GK', pct: [0.81, 0.50] },
    { team: 'red',  label: 'LW', pct: [0.75, 0.75] },
    { team: 'red',  label: 'PV', pct: [0.68, 0.50] },
    { team: 'red',  label: 'RW', pct: [0.75, 0.25] },
  ],

  beach_soccer: [
    // FIFA Beach Soccer: 5v5 (4 outfield + GK).
    // Court x=130–870. Goal rect: left x=130 w=35 → centre x=147; right x=835 w=35 → centre x=852.
    { team: 'blue', label: 'GK', pct: [0.15, 0.50] },
    { team: 'blue', label: 'DF', pct: [0.20, 0.50] },
    { team: 'blue', label: 'LW', pct: [0.30, 0.25] },
    { team: 'blue', label: 'RW', pct: [0.30, 0.75] },
    { team: 'blue', label: 'FW', pct: [0.40, 0.50] },
    { team: 'red',  label: 'GK', pct: [0.85, 0.50] },
    { team: 'red',  label: 'DF', pct: [0.80, 0.50] },
    { team: 'red',  label: 'LW', pct: [0.70, 0.75] },
    { team: 'red',  label: 'RW', pct: [0.70, 0.25] },
    { team: 'red',  label: 'FW', pct: [0.60, 0.50] },
  ],

  padbol: [
    // Padbol (padel + football): 2v2.
    { team: 'blue', label: 'A1', pct: [0.18, 0.32] },
    { team: 'blue', label: 'A2', pct: [0.18, 0.68] },
    { team: 'red',  label: 'B1', pct: [0.82, 0.32] },
    { team: 'red',  label: 'B2', pct: [0.82, 0.68] },
  ],

  // ─── LACROSSE ───────────────────────────────────────────────────────────────

  lacrosse: [
    // World Lacrosse (field): 10v10. GK + 3 defense + 3 midfield + 3 attack.
    // Court x=70–930. Goal rect: left x=70 w=25 → centre x=82; right x=905 w=25 → centre x=918.
    { team: 'blue', label: 'GK', pct: [0.08, 0.50] },
    { team: 'blue', label: 'D',  pct: [0.16, 0.28] },
    { team: 'blue', label: 'D',  pct: [0.16, 0.50] },
    { team: 'blue', label: 'D',  pct: [0.16, 0.72] },
    { team: 'blue', label: 'M',  pct: [0.28, 0.28] },
    { team: 'blue', label: 'M',  pct: [0.28, 0.50] },
    { team: 'blue', label: 'M',  pct: [0.28, 0.72] },
    { team: 'blue', label: 'A',  pct: [0.40, 0.28] },
    { team: 'blue', label: 'A',  pct: [0.40, 0.50] },
    { team: 'blue', label: 'A',  pct: [0.40, 0.72] },
    { team: 'red',  label: 'GK', pct: [0.92, 0.50] },
    { team: 'red',  label: 'D',  pct: [0.84, 0.72] },
    { team: 'red',  label: 'D',  pct: [0.84, 0.50] },
    { team: 'red',  label: 'D',  pct: [0.84, 0.28] },
    { team: 'red',  label: 'M',  pct: [0.72, 0.72] },
    { team: 'red',  label: 'M',  pct: [0.72, 0.50] },
    { team: 'red',  label: 'M',  pct: [0.72, 0.28] },
    { team: 'red',  label: 'A',  pct: [0.60, 0.72] },
    { team: 'red',  label: 'A',  pct: [0.60, 0.50] },
    { team: 'red',  label: 'A',  pct: [0.60, 0.28] },
  ],

  // ─── WATER POLO ─────────────────────────────────────────────────────────────

  water_polo: [
    // FINA: 7v7 (6 field + GK). 3-3 formation.
    // Court x=140–860. Goal rect: left x=140 w=55 → centre x=167; right x=805 w=55 → centre x=832.
    { team: 'blue', label: 'GK', pct: [0.17, 0.50] },
    { team: 'blue', label: 'L1', pct: [0.20, 0.22] },
    { team: 'blue', label: 'C',  pct: [0.20, 0.50] },
    { team: 'blue', label: 'R1', pct: [0.20, 0.78] },
    { team: 'blue', label: 'L2', pct: [0.32, 0.28] },
    { team: 'blue', label: 'CF', pct: [0.38, 0.50] },
    { team: 'blue', label: 'R2', pct: [0.32, 0.72] },
    { team: 'red',  label: 'GK', pct: [0.83, 0.50] },
    { team: 'red',  label: 'L1', pct: [0.80, 0.78] },
    { team: 'red',  label: 'C',  pct: [0.80, 0.50] },
    { team: 'red',  label: 'R1', pct: [0.80, 0.22] },
    { team: 'red',  label: 'L2', pct: [0.68, 0.72] },
    { team: 'red',  label: 'CF', pct: [0.62, 0.50] },
    { team: 'red',  label: 'R2', pct: [0.68, 0.28] },
  ],

  fistball: [
    // IFA standard: 5v5 on a 50m×20m court, net at centre.
    // Court x=70–930, y=124–476. Net at x=500.
    // Formation: 1 back (x≈0.15/0.85) + 2 mid (x≈0.28/0.72) + 2 front (x≈0.41/0.59)
    { team: 'blue', label: 'P1', pct: [0.15, 0.50] },
    { team: 'blue', label: 'P2', pct: [0.28, 0.28] },
    { team: 'blue', label: 'P3', pct: [0.28, 0.72] },
    { team: 'blue', label: 'P4', pct: [0.41, 0.33] },
    { team: 'blue', label: 'P5', pct: [0.41, 0.67] },
    { team: 'red',  label: 'P1', pct: [0.85, 0.50] },
    { team: 'red',  label: 'P2', pct: [0.72, 0.72] },
    { team: 'red',  label: 'P3', pct: [0.72, 0.28] },
    { team: 'red',  label: 'P4', pct: [0.59, 0.67] },
    { team: 'red',  label: 'P5', pct: [0.59, 0.33] },
  ],

  // ─── WHITEBOARD (blank canvas — no default tokens) ────────────────────────
  whiteboard: [],

};

/**
 * Returns a deep copy of the default token list for the given court ID.
 * Falls back to basketball_full if the courtId is not recognised.
 * Whiteboard intentionally has no tokens — coaches start fresh.
 *
 * @param {string} courtId
 * @returns {{ team: string, label: string, pct: [number, number] }[]}
 */
export function getDefaultTokens(courtId) {
  if (courtId === 'whiteboard') return [];
  return (SPORT_TOKENS[courtId] || SPORT_TOKENS['basketball_full'])
    .map(t => ({ ...t, pct: [...t.pct] }));
}
