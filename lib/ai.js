import {
  SUITS, GAME_POINT_VALUES,
  getPlayableCards, cardEquals, cardBeats,
} from './game';

// ── Bid evaluation ──

function evaluateExpectedPoints(hand, suit) {
  const trumpCards = hand.filter(c => c.suit === suit);
  if (trumpCards.length === 0) return 0;

  const ranks = trumpCards.map(c => c.rank);
  const hasAce = ranks.includes(14);
  const hasKing = ranks.includes(13);
  const hasQueen = ranks.includes(12);
  const hasJack = ranks.includes(11);
  const hasTen = ranks.includes(10);
  const lowestTrump = Math.min(...ranks);
  const trumpCount = trumpCards.length;

  let expected = 0;

  // HIGH: do we have the highest trump?
  if (hasAce) expected += 0.95;
  else if (hasKing && trumpCount >= 3) expected += 0.55;
  else if (hasKing) expected += 0.3;

  // LOW: do we have the lowest trump in play?
  if (lowestTrump === 2) expected += 0.85;
  else if (lowestTrump === 3) expected += 0.55;
  else if (lowestTrump === 4) expected += 0.3;
  else if (lowestTrump === 5) expected += 0.15;

  // JACK: can we capture / protect the Jack?
  if (hasJack) {
    if (hasAce && trumpCount >= 3) expected += 0.75;
    else if (hasAce) expected += 0.55;
    else if (trumpCount >= 3) expected += 0.4;
    else expected += 0.25;
  } else if (hasAce && trumpCount >= 3) {
    expected += 0.15; // might snag opponent's Jack
  }

  // TRUMP STRENGTH: high-trump combinations
  if (hasAce && hasKing) expected += 0.8;
  else if (hasAce && trumpCount >= 2) expected += 0.2;
  else if (hasKing && hasQueen) expected += 0.3;

  // TRUMP DEPTH: more trumps = more tricks = more control
  if (trumpCount >= 4) expected += 0.4;
  else if (trumpCount >= 3) expected += 0.2;

  // TEN OF TRUMP: strong for game points and trick-winning
  if (hasTen) expected += 0.15;

  // PARTNER SUPPORT: with 24 cards dealt (6 each), partner likely has ~1.3
  // trumps if we hold 3. Boost for biddable hands since partner can help
  // win tricks, protect Jack, or contribute game points.
  if (trumpCount >= 2 && (hasAce || hasKing)) expected += 0.25;
  else if (trumpCount >= 3) expected += 0.15;

  // GAME: total game-point value across whole hand
  let myGamePts = 0;
  for (const c of hand) {
    myGamePts += (GAME_POINT_VALUES[c.rank] || 0);
  }
  if (myGamePts >= 16) expected += 0.7;
  else if (myGamePts >= 12) expected += 0.45;
  else if (myGamePts >= 8) expected += 0.25;
  else expected += 0.1;

  return expected;
}

export function getAiBid(hand, currentHighBid, isDealer, allPassedToDealer, difficulty) {
  // Evaluate each suit by expected points
  let bestSuit = SUITS[0];
  let bestExp = -1;
  for (const suit of SUITS) {
    const exp = evaluateExpectedPoints(hand, suit);
    if (exp > bestExp) { bestExp = exp; bestSuit = suit; }
  }

  // Bid based on expected points (need margin above bid amount)
  let bid = 0;
  if (bestExp >= 3.0) bid = 4;
  else if (bestExp >= 2.4) bid = 3;
  else if (bestExp >= 1.3) bid = 2;

  // Difficulty adjustments
  if (difficulty === 'easy') {
    // Occasionally underbid
    if (Math.random() < 0.2 && bid > 2) bid--;
  } else if (difficulty === 'medium') {
    // Slightly conservative
    if (Math.random() < 0.15 && bid > 2) bid--;
  }

  // Must bid higher than current or pass (dealer can match to steal)
  if (bid > 0) {
    if (isDealer) {
      if (bid < currentHighBid) bid = 0;
    } else {
      if (bid <= currentHighBid) bid = 0;
    }
  }
  // Dealer forced to bid 2 if everyone passed
  if (allPassedToDealer && isDealer && bid === 0) bid = 2;

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
  const jackTrump = trumps.find(c => c.rank === 11);

  // Lead Ace of trump to strip opponents
  const aceTrump = trumps.find(c => c.rank === 14);
  if (aceTrump) return aceTrump;

  // Lead King of trump (skip only if we have Jack with thin trump)
  const kingTrump = trumps.find(c => c.rank === 13);
  if (kingTrump && (!jackTrump || trumps.length >= 3)) return kingTrump;

  // Lead Queen of trump to continue stripping opponents
  const queenTrump = trumps.find(c => c.rank === 12);
  if (queenTrump && (!jackTrump || trumps.length >= 3)) return queenTrump;

  // If holding Jack of trump with thin support, protect it
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
  const isLastToPlay = trickPlays.length === 3;

  // Protect low trump (rank <= 5) — they can win the Low point.
  // Only safe to throw when our team is guaranteed to capture the trick.
  const safeLowThrow = (cards) => {
    const safe = cards.filter(c => c.suit !== trumpSuit || c.rank > 5);
    if (safe.length > 0) return safe.reduce((a, b) => a.rank < b.rank ? a : b);
    // Only low trump left: throw highest to keep the very lowest for Low
    return cards.reduce((a, b) => a.rank > b.rank ? a : b);
  };

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
    if (difficulty === 'hard' && isLastToPlay) {
      // Last to play, partner winning: dump highest game-point non-trump
      const gameCards = playable
        .filter(c => c.suit !== trumpSuit && (GAME_POINT_VALUES[c.rank] || 0) > 0);
      if (gameCards.length > 0) {
        return gameCards.reduce((a, b) =>
          (GAME_POINT_VALUES[a.rank] || 0) > (GAME_POINT_VALUES[b.rank] || 0) ? a : b
        );
      }
    }
    // Last to play: safe to throw anything (partner captures the trick)
    if (isLastToPlay) {
      return playable.reduce((a, b) => a.rank < b.rank ? a : b);
    }
    // Opponents still to play: protect low trump in case they overtake
    return safeLowThrow(playable);
  }

  // Check if trick contains the low trump (2) played by an opponent — worth capturing
  const trickHasEnemyLow = trickPlays.some(p =>
    p.card.suit === trumpSuit && p.card.rank <= 3 && p.player !== partnerSeat && p.player !== seat
  );

  // Try to win with the lowest winning card, but protect our low trump
  const winners = playable.filter(c => cardBeats(c, winCard, trumpSuit, ledSuit));
  if (winners.length > 0) {
    // Don't waste low trump (rank <= 5) to win — they're worth the Low point
    const safeWinners = winners.filter(c => c.suit !== trumpSuit || c.rank > 5);
    if (safeWinners.length > 0) {
      // If enemy low trump is in the trick, win decisively with higher card
      if (trickHasEnemyLow) {
        return safeWinners.reduce((a, b) => a.rank > b.rank ? a : b);
      }
      return safeWinners.reduce((a, b) => a.rank < b.rank ? a : b);
    }
    // Only low trump can win: play highest of them to keep the very lowest
    return winners.reduce((a, b) => a.rank > b.rank ? a : b);
  }

  // Can't win: opponent will likely capture — protect low trump
  const lowValue = playable.filter(c => !(GAME_POINT_VALUES[c.rank]));
  if (lowValue.length > 0) {
    return safeLowThrow(lowValue);
  }
  return safeLowThrow(playable);
}
