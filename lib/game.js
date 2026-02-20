// ── Seat positions (clockwise) ──
export const SOUTH = 0; // Human player
export const WEST  = 1; // AI opponent
export const NORTH = 2; // AI partner
export const EAST  = 3; // AI opponent

// ── Teams ──
export const TEAM_A = 0; // SOUTH + NORTH (human's team)
export const TEAM_B = 1; // WEST + EAST (opponent team)

export function getTeam(seat) {
  return (seat === SOUTH || seat === NORTH) ? TEAM_A : TEAM_B;
}

export function getPartner(seat) {
  return (seat + 2) % 4;
}

// ── Suits ──
export const SPADES   = 'S';
export const HEARTS   = 'H';
export const DIAMONDS = 'D';
export const CLUBS    = 'C';
export const SUITS = [SPADES, HEARTS, DIAMONDS, CLUBS];

// ── Ranks (2=2 ... 14=Ace) ──
export const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export const RANK_NAMES = {
  2:'2', 3:'3', 4:'4', 5:'5', 6:'6', 7:'7', 8:'8', 9:'9',
  10:'10', 11:'J', 12:'Q', 13:'K', 14:'A'
};

export const SUIT_SYMBOLS = { S: '\u2660', H: '\u2665', D: '\u2666', C: '\u2663' };

// Game-point values for the "Game" point
export const GAME_POINT_VALUES = {
  10: 10, 14: 4, 13: 3, 12: 2, 11: 1
};

export const WIN_SCORE = 11;

export const SEAT_NAMES = ['You', 'West', 'Partner', 'East'];

// ── Card helpers ──

export function makeCard(rank, suit) {
  return { rank, suit };
}

export function cardId(card) {
  return `${card.rank}-${card.suit}`;
}

export function cardEquals(a, b) {
  return a.rank === b.rank && a.suit === b.suit;
}

export function cardDisplay(card) {
  return `${RANK_NAMES[card.rank]}${SUIT_SYMBOLS[card.suit]}`;
}

export function isRedSuit(suit) {
  return suit === HEARTS || suit === DIAMONDS;
}

// ── Deck ──

export function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(makeCard(rank, suit));
    }
  }
  return deck;
}

export function shuffleDeck(deck) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// ── Dealing ──

export function dealHands(dealer) {
  const deck = shuffleDeck(createDeck());
  const hands = [[], [], [], []];
  let idx = 0;

  // Two rounds of 3 cards, starting left of dealer
  for (let round = 0; round < 2; round++) {
    for (let i = 1; i <= 4; i++) {
      const seat = (dealer + i) % 4;
      for (let c = 0; c < 3; c++) {
        hands[seat].push(deck[idx++]);
      }
    }
  }

  // Sort each hand: group by suit, then rank high→low
  for (const hand of hands) {
    hand.sort((a, b) => {
      const si = SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
      if (si !== 0) return si;
      return b.rank - a.rank;
    });
  }

  return hands;
}

// ── Bid validation ──

export function getValidBids(currentHighBid, isDealer, allPassedToDealer) {
  if (allPassedToDealer && isDealer) {
    return [2, 3, 4]; // forced — no pass option
  }
  const bids = [0]; // 0 = pass
  for (let b = Math.max(2, currentHighBid + 1); b <= 4; b++) {
    bids.push(b);
  }
  return bids;
}

// ── Card play validation ──

export function getPlayableCards(hand, trumpSuit, ledSuit) {
  if (!ledSuit) {
    return [...hand]; // leading: play anything
  }

  // Trump led: must follow with trump if you have it
  if (ledSuit === trumpSuit) {
    const trumpCards = hand.filter(c => c.suit === trumpSuit);
    return trumpCards.length > 0 ? trumpCards : [...hand];
  }

  // Non-trump led: play any card (no follow-suit requirement in Pitch)
  return [...hand];
}

// ── Trick evaluation ──

export function evaluateTrick(trickPlays, trumpSuit) {
  const ledSuit = trickPlays[0].card.suit;
  let winnerIdx = 0;
  let winCard = trickPlays[0].card;

  for (let i = 1; i < trickPlays.length; i++) {
    const card = trickPlays[i].card;
    if (cardBeats(card, winCard, trumpSuit, ledSuit)) {
      winnerIdx = i;
      winCard = card;
    }
  }

  return trickPlays[winnerIdx].player;
}

export function cardBeats(a, b, trumpSuit, ledSuit) {
  const aT = a.suit === trumpSuit;
  const bT = b.suit === trumpSuit;
  if (aT && !bT) return true;
  if (!aT && bT) return false;
  if (aT && bT) return a.rank > b.rank;
  // Neither trump
  if (a.suit === ledSuit && b.suit === ledSuit) return a.rank > b.rank;
  if (a.suit === ledSuit && b.suit !== ledSuit) return true;
  return false;
}

// ── Hand scoring ──

export function scoreHand(originalHands, capturedTricks, trumpSuit) {
  // Collect all captured cards per team
  const captured = { [TEAM_A]: [], [TEAM_B]: [] };
  for (const trick of capturedTricks) {
    const team = getTeam(trick.winner);
    for (const play of trick.cards) {
      captured[team].push(play.card);
    }
  }

  // Find all trump cards that were dealt
  const allDealt = originalHands.flat();
  const trumpsDealt = allDealt.filter(c => c.suit === trumpSuit);

  // HIGH: team that was DEALT the highest trump
  let high = null;
  if (trumpsDealt.length > 0) {
    const highest = trumpsDealt.reduce((a, b) => a.rank > b.rank ? a : b);
    for (let seat = 0; seat < 4; seat++) {
      if (originalHands[seat].some(c => cardEquals(c, highest))) {
        high = getTeam(seat);
        break;
      }
    }
  }

  // LOW: team that was DEALT the lowest trump
  let low = null;
  if (trumpsDealt.length > 0) {
    const lowest = trumpsDealt.reduce((a, b) => a.rank < b.rank ? a : b);
    for (let seat = 0; seat < 4; seat++) {
      if (originalHands[seat].some(c => cardEquals(c, lowest))) {
        low = getTeam(seat);
        break;
      }
    }
  }

  // JACK: team that CAPTURED the Jack of trump
  let jack = null;
  const jackCard = makeCard(11, trumpSuit);
  if (trumpsDealt.some(c => c.rank === 11)) {
    for (const team of [TEAM_A, TEAM_B]) {
      if (captured[team].some(c => cardEquals(c, jackCard))) {
        jack = team;
        break;
      }
    }
  }

  // GAME: team with highest game-point total (all suits)
  const gameTotals = { [TEAM_A]: 0, [TEAM_B]: 0 };
  for (const team of [TEAM_A, TEAM_B]) {
    for (const card of captured[team]) {
      gameTotals[team] += GAME_POINT_VALUES[card.rank] || 0;
    }
  }
  let game = null;
  if (gameTotals[TEAM_A] > gameTotals[TEAM_B]) game = TEAM_A;
  else if (gameTotals[TEAM_B] > gameTotals[TEAM_A]) game = TEAM_B;
  // tied = no award

  // Count points per team
  const pointsWon = { [TEAM_A]: 0, [TEAM_B]: 0 };
  for (const key of [high, low, jack, game]) {
    if (key !== null) pointsWon[key]++;
  }

  return { high, low, jack, game, pointsWon, gameTotals };
}

// ── Live point tracking (during play) ──

export function getLivePoints(originalHands, capturedTricks, trumpSuit) {
  if (!trumpSuit) return null;

  // HIGH & LOW: known from dealt hands
  const allDealt = originalHands.flat();
  const trumpsDealt = allDealt.filter(c => c.suit === trumpSuit);

  let high = null;
  let highCard = null;
  let low = null;
  let lowCard = null;

  if (trumpsDealt.length > 0) {
    const highest = trumpsDealt.reduce((a, b) => a.rank > b.rank ? a : b);
    highCard = highest;
    for (let seat = 0; seat < 4; seat++) {
      if (originalHands[seat].some(c => cardEquals(c, highest))) {
        high = getTeam(seat);
        break;
      }
    }
    const lowest = trumpsDealt.reduce((a, b) => a.rank < b.rank ? a : b);
    lowCard = lowest;
    for (let seat = 0; seat < 4; seat++) {
      if (originalHands[seat].some(c => cardEquals(c, lowest))) {
        low = getTeam(seat);
        break;
      }
    }
  }

  // JACK: live — check captured tricks
  let jack = null;
  let jackExists = trumpsDealt.some(c => c.rank === 11);
  if (jackExists) {
    const jackCard = makeCard(11, trumpSuit);
    for (const trick of capturedTricks) {
      for (const play of trick.cards) {
        if (cardEquals(play.card, jackCard)) {
          jack = getTeam(trick.winner);
          break;
        }
      }
      if (jack !== null) break;
    }
  }

  // GAME: running totals from captured cards
  const gameA = capturedTricks
    .filter(t => getTeam(t.winner) === TEAM_A)
    .flatMap(t => t.cards)
    .reduce((sum, play) => sum + (GAME_POINT_VALUES[play.card.rank] || 0), 0);
  const gameB = capturedTricks
    .filter(t => getTeam(t.winner) === TEAM_B)
    .flatMap(t => t.cards)
    .reduce((sum, play) => sum + (GAME_POINT_VALUES[play.card.rank] || 0), 0);

  return { high, highCard, low, lowCard, jack, jackExists, gameA, gameB };
}

// ── Score update ──

export function updateScores(currentScores, biddingTeam, bidAmount, handResult) {
  const scores = { ...currentScores };
  const defending = biddingTeam === TEAM_A ? TEAM_B : TEAM_A;

  // Defending team always scores
  scores[defending] += handResult.pointsWon[defending];

  // Bidding team: make or set
  const wasSet = handResult.pointsWon[biddingTeam] < bidAmount;
  if (wasSet) {
    scores[biddingTeam] -= bidAmount;
  } else {
    scores[biddingTeam] += handResult.pointsWon[biddingTeam];
  }

  // Check for winner (bidding team first)
  let gameWinner = null;
  if (scores[biddingTeam] >= WIN_SCORE) gameWinner = biddingTeam;
  else if (scores[defending] >= WIN_SCORE) gameWinner = defending;

  return { newScores: scores, wasSet, gameWinner };
}

// ── Dealer rotation ──

export function nextDealer(current) {
  return (current + 1) % 4;
}
