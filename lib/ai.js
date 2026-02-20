import {
  SUITS, GAME_POINT_VALUES,
  getPlayableCards, cardEquals, cardBeats,
} from './game';

// ── Bid evaluation ──

function evaluateSuitStrength(hand, suit) {
  const cards = hand.filter(c => c.suit === suit);
  let str = cards.length * 1.5;
  for (const c of cards) {
    if (c.rank === 14) str += 4;       // Ace
    else if (c.rank === 13) str += 2;  // King
    else if (c.rank === 12) str += 1;  // Queen
    else if (c.rank === 11) str += 3;  // Jack (capture value)
    else if (c.rank === 10) str += 1.5; // Ten (game points)
    else if (c.rank <= 3) str += 0.5;  // Low cards (Low point)
  }
  return str;
}

export function getAiBid(hand, currentHighBid, isDealer, allPassedToDealer, difficulty) {
  // Evaluate each suit
  let bestSuit = SUITS[0];
  let bestStr = -1;
  for (const suit of SUITS) {
    const s = evaluateSuitStrength(hand, suit);
    if (s > bestStr) { bestStr = s; bestSuit = suit; }
  }

  // Determine bid from strength
  let bid = 0;
  if (bestStr >= 12) bid = 4;
  else if (bestStr >= 8) bid = 3;
  else if (bestStr >= 5) bid = 2;

  // Add partner bonus (~1 extra expected point)
  if (bid > 0 && bestStr >= 4.5 && bid < 4) {
    // partner likely contributes, slightly more aggressive
  }

  // Difficulty noise
  if (difficulty === 'easy') {
    if (Math.random() < 0.25) {
      bid += Math.random() < 0.5 ? 1 : -1;
    }
  } else if (difficulty === 'medium') {
    if (Math.random() < 0.1) {
      bid = Math.max(0, bid - 1);
    }
  }

  // Clamp
  bid = Math.max(0, Math.min(4, bid));
  if (bid > 0 && bid <= currentHighBid) bid = 0; // must bid higher
  if (allPassedToDealer && isDealer && bid === 0) bid = 2; // forced

  return { bid, preferredSuit: bestSuit };
}

// ── Card play ──

export function getAiPlay(hand, trumpSuit, trickPlays, seat, capturedTricks, difficulty) {
  const ledSuit = trickPlays.length > 0 ? trickPlays[0].card.suit : null;
  const playable = getPlayableCards(hand, trumpSuit, ledSuit);

  if (playable.length === 1) return playable[0];

  // Easy: 40% random
  if (difficulty === 'easy' && Math.random() < 0.4) {
    return playable[Math.floor(Math.random() * playable.length)];
  }

  const isLeading = trickPlays.length === 0;

  if (isLeading) {
    return pickLead(playable, trumpSuit, difficulty);
  }
  return pickFollow(playable, trumpSuit, trickPlays, seat, difficulty);
}

// ── AI trump selection (when AI wins bid) ──

export function getAiTrumpCard(hand, preferredSuit) {
  // Lead the highest card of the preferred trump suit
  const suitCards = hand.filter(c => c.suit === preferredSuit);
  if (suitCards.length > 0) {
    // Lead highest to draw out opponents' trump
    return suitCards.reduce((a, b) => a.rank > b.rank ? a : b);
  }
  // Fallback: highest card in hand
  return hand.reduce((a, b) => a.rank > b.rank ? a : b);
}

// ── Lead strategy ──

function pickLead(playable, trumpSuit, difficulty) {
  const trumps = playable.filter(c => c.suit === trumpSuit);
  const nonTrumps = playable.filter(c => c.suit !== trumpSuit);

  // Lead Ace of trump to strip opponents
  const aceTrump = trumps.find(c => c.rank === 14);
  if (aceTrump) return aceTrump;

  // Lead King of trump if no Ace
  const kingTrump = trumps.find(c => c.rank === 13);
  if (kingTrump && !trumps.find(c => c.rank === 11)) return kingTrump;

  // If holding Jack of trump, avoid leading trump (protect it)
  const jackTrump = trumps.find(c => c.rank === 11);
  if (jackTrump && trumps.length <= 2 && nonTrumps.length > 0) {
    // Lead high non-trump instead
    return nonTrumps.reduce((a, b) => a.rank > b.rank ? a : b);
  }

  // Lead high non-trump (Aces/Kings for game points)
  if (nonTrumps.length > 0) {
    const highNonTrump = nonTrumps.filter(c => c.rank >= 13);
    if (highNonTrump.length > 0) {
      return highNonTrump.reduce((a, b) => a.rank > b.rank ? a : b);
    }
    // Lead lowest non-trump
    return nonTrumps.reduce((a, b) => a.rank < b.rank ? a : b);
  }

  // Only trump left: lead highest
  return trumps.reduce((a, b) => a.rank > b.rank ? a : b);
}

// ── Follow strategy ──

function pickFollow(playable, trumpSuit, trickPlays, seat, difficulty) {
  const ledSuit = trickPlays[0].card.suit;
  const partnerSeat = (seat + 2) % 4;

  // Find current trick winner
  let winCard = trickPlays[0].card;
  let winnerSeat = trickPlays[0].player;
  for (let i = 1; i < trickPlays.length; i++) {
    if (cardBeats(trickPlays[i].card, winCard, trumpSuit, ledSuit)) {
      winCard = trickPlays[i].card;
      winnerSeat = trickPlays[i].player;
    }
  }

  const partnerWinning = winnerSeat === partnerSeat;

  // Partner is winning: don't override, throw low or dump game points
  if (partnerWinning) {
    if (difficulty === 'hard' && trickPlays.length === 3) {
      // Last to play, partner winning: dump highest game-point non-trump
      const gameCards = playable
        .filter(c => c.suit !== trumpSuit && (GAME_POINT_VALUES[c.rank] || 0) > 0);
      if (gameCards.length > 0) {
        return gameCards.reduce((a, b) =>
          (GAME_POINT_VALUES[a.rank] || 0) > (GAME_POINT_VALUES[b.rank] || 0) ? a : b
        );
      }
    }
    // Throw lowest card
    return playable.reduce((a, b) => a.rank < b.rank ? a : b);
  }

  // Try to win with the lowest winning card
  const winners = playable.filter(c => cardBeats(c, winCard, trumpSuit, ledSuit));
  if (winners.length > 0) {
    return winners.reduce((a, b) => a.rank < b.rank ? a : b);
  }

  // Can't win: throw lowest non-valuable card
  const lowValue = playable.filter(c => !(GAME_POINT_VALUES[c.rank]));
  if (lowValue.length > 0) {
    return lowValue.reduce((a, b) => a.rank < b.rank ? a : b);
  }
  return playable.reduce((a, b) => a.rank < b.rank ? a : b);
}
