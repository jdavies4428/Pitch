// ── Phase names ──
export const PHASE_IDLE = 'idle';
export const PHASE_WAITING = 'waiting';
export const PHASE_CUT = 'cutForDeal';
export const PHASE_DEALING = 'dealing';
export const PHASE_BIDDING = 'bidding';
export const PHASE_PITCHING = 'pitching';
export const PHASE_TRICK_PLAY = 'trickPlay';
export const PHASE_TRICK_COLLECT = 'trickCollect';
export const PHASE_HAND_OVER = 'handOver';
export const PHASE_GAME_OVER = 'gameOver';

// ── Timing (ms) ──
export const AI_DELAY = 700;
export const AI_BID_DELAY = 1400;
export const TRICK_PAUSE = 1400;
export const POLL_MS = 700;
export const CONFETTI_DURATION = 4000;
// Server-side timings (slightly longer for network latency)
export const SERVER_AI_DELAY = 800;
export const SERVER_PHASE_DELAY = 1500;

// ── Colors ──
export const COLORS = {
  teamA: '#6b8aad',
  teamB: '#ad6b6b',
  gold: '#c8aa50',
  goldLight: '#e8c840',
  green: '#7a9b8a',
  greenDark: '#5a8a6a',
  text: '#e0e0e0',
  textMuted: 'rgba(255,255,255,0.35)',
  textDim: 'rgba(255,255,255,0.25)',
  textFaint: 'rgba(255,255,255,0.15)',
  textLabel: 'rgba(255,255,255,0.3)',
  glassBg: 'rgba(255,255,255,0.04)',
  glassBorder: 'rgba(255,255,255,0.12)',
  glassBorderFaint: 'rgba(255,255,255,0.06)',
  goldBg: 'rgba(200,170,80,0.08)',
  goldBorder: 'rgba(200,170,80,0.2)',
  goldBorderStrong: 'rgba(200,170,80,0.3)',
  goldText: 'rgba(200,170,80,0.12)',
  teamABg: 'rgba(107,138,173,0.08)',
  teamABorder: 'rgba(107,138,173,0.2)',
  teamBBg: 'rgba(173,107,107,0.08)',
  teamBBorder: 'rgba(173,107,107,0.2)',
};

// ── Z-index scale ──
export const Z = {
  vignette: 1,
  turnEdge: 2,
  spotlight: 5,
  seats: 10,
  pointTracker: 15,
  ui: 20,
  bubbles: 25,
  overlay: 50,
};

// ── AI bid thresholds ──
export const BID_THRESHOLDS = {
  bid4: 3.2,
  bid3: 2.5,
  bid2: 1.8,
};

// ── Difficulty randomness ──
export const DIFFICULTY_RANDOM = {
  easy: 0.4,   // 40% random play
  easyUnderbid: 0.2,
  mediumUnderbid: 0.15,
};
