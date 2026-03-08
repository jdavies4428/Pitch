import { NextResponse } from 'next/server';
import { getRoom, setRoom } from '@/lib/redis';
import {
  SOUTH, WEST, NORTH, EAST, TEAM_A, TEAM_B,
  getTeam, dealHands, getValidBids, isDealerStealBid, isWinningBid,
  getPlayableCards, evaluateTrick, scoreHand,
  updateScores, nextDealer, cardEquals, createDeck, shuffleDeck, getLivePoints,
} from '@/lib/game';
import { getAiBid, getAiPlay, getAiTrumpCard } from '@/lib/ai';

const ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const AI_DELAY = 800; // ms between AI actions
const PHASE_DELAY = 1500; // ms for phase transitions (trick collect, etc.)
const ALL_SEATS = [SOUTH, WEST, NORTH, EAST];
const HUMAN_COUNTS = new Set([1, 2, 4]);
const AI_NAMES = {
  [SOUTH]: 'MAV',
  [WEST]: 'SPIKE',
  [NORTH]: 'ACE',
  [EAST]: 'BLITZ',
};

function generateCode() {
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += ROOM_CHARS[Math.floor(Math.random() * ROOM_CHARS.length)];
  }
  return code;
}

function getHumanSeatPlan(targetHumans, gameMode) {
  if (targetHumans === 1) return [SOUTH];
  if (targetHumans === 2) {
    return gameMode === 'coop' ? [SOUTH, NORTH] : [SOUTH, WEST];
  }
  if (targetHumans === 4) return [...ALL_SEATS];
  return [];
}

function normalizeGameMode(targetHumans, gameMode) {
  if (targetHumans === 1) return 'solo';
  if (targetHumans === 4) return 'teams';
  return gameMode === 'coop' ? 'coop' : 'versus';
}

function syncPlayerNames(room) {
  const names = {};
  for (const seat of ALL_SEATS) {
    if (room.participantsBySeat?.[seat]) {
      names[seat] = room.participantsBySeat[seat].name;
    } else if (room.humanSeats.includes(seat)) {
      names[seat] = 'OPEN';
    } else {
      names[seat] = AI_NAMES[seat];
    }
  }
  room.playerNames = names;
}

function getJoinedHumanCount(room) {
  return room.humanSeats.filter(seat => !!room.participantsBySeat?.[seat]).length;
}

function getWaitingCount(room) {
  return Math.max(0, (room.targetHumans || 0) - getJoinedHumanCount(room));
}

function allHumansJoined(room) {
  return getWaitingCount(room) === 0;
}

function getOpenHumanSeat(room) {
  return room.humanSeats.find(seat => !room.participantsBySeat?.[seat]) ?? null;
}

function isAiSeat(room, seat) {
  return !room.humanSeats.includes(seat);
}

function getPlayerSeat(room, playerId) {
  for (const seat of ALL_SEATS) {
    if (room.participantsBySeat?.[seat]?.id === playerId) return seat;
  }
  return null;
}

function markWaiting(room) {
  room.phase = 'waiting';
  room.statusMsg = `Waiting for ${getWaitingCount(room)} more player${getWaitingCount(room) === 1 ? '' : 's'}`;
  room.lastActionAt = Date.now();
}

// Filter game state so a player only sees their own hand.
function filterForPlayer(room, playerId) {
  const mySeat = getPlayerSeat(room, playerId);
  if (mySeat === null) return { error: 'Not in this room' };

  syncPlayerNames(room);

  const handCounts = room.hands
    ? room.hands.map(h => h.length)
    : [0, 0, 0, 0];

  const ledSuit = room.trickPlays?.length > 0
    ? room.trickPlays[0].card.suit
    : null;

  const myHand = room.hands?.[mySeat] || [];
  const playableCards =
    room.phase === 'trickPlay' && room.currentPlayer === mySeat
      ? getPlayableCards(myHand, room.trumpSuit, ledSuit)
      : room.phase === 'pitching' && room.currentPlayer === mySeat
        ? myHand
        : [];

  const validBids =
    room.phase === 'bidding' && room.currentBidder === mySeat
      ? getValidBids(
          room.highBid?.amount || 0,
          mySeat === room.dealer,
          room.bids?.length === 3 && (room.highBid?.amount || 0) === 0
        )
      : [];
  const livePoints = getLivePoints(
    room.originalHands || [[], [], [], []],
    room.capturedTricks || [],
    room.trumpSuit
  );

  return {
    roomCode: room.roomCode,
    gameMode: room.gameMode,
    targetHumans: room.targetHumans,
    joinedHumans: getJoinedHumanCount(room),
    waitingCount: getWaitingCount(room),
    humanSeats: room.humanSeats,
    mySeat,
    phase: room.phase,
    dealer: room.dealer,
    trumpSuit: room.trumpSuit,
    myHand,
    handCounts,
    currentPlayer: room.currentPlayer,
    currentBidder: room.currentBidder,
    bids: room.bids || [],
    highBid: room.highBid || { seat: -1, amount: 0 },
    biddingTeam: room.biddingTeam ?? null,
    bidAmount: room.bidAmount ?? 0,
    bidBubbles: room.bidBubbles || {},
    trickPlays: room.trickPlays || [],
    trickNumber: room.trickNumber || 1,
    trickWinner: room.trickWinner,
    scores: room.scores,
    handNumber: room.handNumber || 0,
    gameNumber: room.gameNumber || 0,
    playableCards,
    validBids,
    livePoints,
    playerNames: room.playerNames || {},
    cutCards: room.cutCards || [],
    cutWinner: room.cutWinner,
    handResult: room.handResult,
    wasSet: room.wasSet,
    gameWinner: room.gameWinner,
    waiting: room.phase === 'waiting' || getWaitingCount(room) > 0,
    rematch: room.rematchBySeat || {},
    statusMsg: room.statusMsg || '',
    difficulty: room.difficulty || 'medium',
  };
}

// ── Phase transition helpers ──

function startCutForDeal(room) {
  syncPlayerNames(room);
  const deck = shuffleDeck(createDeck());
  const cutCards = [
    { player: SOUTH, card: deck[0] },
    { player: WEST, card: deck[1] },
    { player: NORTH, card: deck[2] },
    { player: EAST, card: deck[3] },
  ];

  let winner = cutCards[0];
  for (let i = 1; i < cutCards.length; i++) {
    if (cutCards[i].card.rank > winner.card.rank) winner = cutCards[i];
  }

  room.phase = 'cutForDeal';
  room.cutCards = cutCards;
  room.cutWinner = winner.player;
  room.dealer = winner.player;
  room.lastActionAt = Date.now();
  room.statusMsg = `${room.playerNames[winner.player]} deals first`;
}

function startDealing(room) {
  const hands = dealHands(room.dealer);
  room.hands = hands;
  room.originalHands = hands.map(h => [...h]);
  room.phase = 'bidding';
  room.bids = [];
  room.highBid = { seat: -1, amount: 0 };
  room.bidBubbles = {};
  room.biddingTeam = null;
  room.bidAmount = 0;
  room.currentBidder = (room.dealer + 1) % 4;
  room.trumpSuit = null;
  room.trickPlays = [];
  room.trickNumber = 1;
  room.capturedTricks = [];
  room.trickWinner = null;
  room.handResult = null;
  room.wasSet = false;
  room.gameWinner = null;
  room.cutCards = [];
  room.cutWinner = null;
  room.aiPreferredSuit = {};
  room.statusMsg = '';
  room.lastActionAt = Date.now();
}

function applyBid(room, seat, bidAmount) {
  const currentHighBid = room.highBid?.amount || 0;
  const isDealer = seat === room.dealer;
  room.bids.push({ seat, bid: bidAmount });
  const isDealerSteal = isDealerStealBid(bidAmount, currentHighBid, isDealer);
  room.bidBubbles[seat] = bidAmount === 0 ? 'PASS' : (isDealerSteal ? `STEAL ${bidAmount}` : `BID ${bidAmount}`);

  if (bidAmount > 0 && isWinningBid(bidAmount, currentHighBid, isDealer)) {
    room.highBid = { seat, amount: bidAmount };
  }

  if (room.bids.length >= ALL_SEATS.length) {
    const winner = room.highBid.seat;
    room.currentPlayer = winner;
    room.phase = 'pitching';
    room.statusMsg = `${room.playerNames[winner]} won the bid with ${room.highBid.amount}`;
    room.biddingTeam = getTeam(winner);
    room.bidAmount = room.highBid.amount;
  } else {
    room.currentBidder = (seat + 1) % 4;
  }

  room.lastActionAt = Date.now();
}

function applyPitch(room, seat, card) {
  room.trumpSuit = card.suit;
  room.trickPlays = [{ player: seat, card }];
  room.hands[seat] = room.hands[seat].filter(c => !cardEquals(c, card));
  room.currentPlayer = (seat + 1) % 4;
  room.phase = 'trickPlay';
  room.statusMsg = '';
  room.lastActionAt = Date.now();
}

function applyPlay(room, seat, card) {
  room.trickPlays.push({ player: seat, card });
  room.hands[seat] = room.hands[seat].filter(c => !cardEquals(c, card));

  if (room.trickPlays.length >= ALL_SEATS.length) {
    const winner = evaluateTrick(room.trickPlays, room.trumpSuit);
    room.trickWinner = winner;
    room.capturedTricks.push({
      winner,
      cards: [...room.trickPlays],
    });
    room.phase = 'trickCollect';
    room.lastActionAt = Date.now();
  } else {
    room.currentPlayer = (seat + 1) % 4;
    room.lastActionAt = Date.now();
  }
}

function advanceAfterTrickCollect(room) {
  if (room.trickNumber >= 6) {
    const result = scoreHand(room.originalHands, room.capturedTricks, room.trumpSuit);
    const { newScores, wasSet, gameWinner } = updateScores(
      room.scores, room.biddingTeam, room.bidAmount, result
    );
    room.scores = newScores;
    room.handResult = result;
    room.wasSet = wasSet;
    room.gameWinner = gameWinner;
    room.phase = gameWinner !== null ? 'gameOver' : 'handOver';
    room.lastActionAt = Date.now();
  } else {
    room.trickNumber += 1;
    room.trickPlays = [];
    room.trickWinner = null;
    room.currentPlayer = room.capturedTricks[room.capturedTricks.length - 1].winner;
    room.phase = 'trickPlay';
    room.lastActionAt = Date.now();
  }
}

function advanceAfterHandOver(room) {
  room.dealer = nextDealer(room.dealer);
  room.handNumber = (room.handNumber || 0) + 1;
  startDealing(room);
}

function processAiTick(room) {
  const now = Date.now();
  const elapsed = now - (room.lastActionAt || 0);

  if (room.phase === 'cutForDeal' && elapsed >= 2500) {
    startDealing(room);
    return true;
  }

  if (room.phase === 'trickCollect' && elapsed >= PHASE_DELAY) {
    advanceAfterTrickCollect(room);
    return true;
  }

  if (room.phase === 'handOver' && elapsed >= 3000) {
    advanceAfterHandOver(room);
    return true;
  }

  if (room.phase === 'bidding' && isAiSeat(room, room.currentBidder) && elapsed >= AI_DELAY) {
    const seat = room.currentBidder;
    const hand = room.hands[seat];
    const allPassedToDealer = room.bids.length === 3 && (room.highBid?.amount || 0) === 0;
    const { bid, preferredSuit } = getAiBid(
      hand,
      room.highBid?.amount || 0,
      seat === room.dealer,
      allPassedToDealer,
      room.difficulty || 'medium'
    );
    if (bid > 0) room.aiPreferredSuit[seat] = preferredSuit;
    applyBid(room, seat, bid);
    return true;
  }

  if (room.phase === 'pitching' && isAiSeat(room, room.currentPlayer) && elapsed >= AI_DELAY) {
    const seat = room.currentPlayer;
    const hand = room.hands[seat];
    const preferredSuit = room.aiPreferredSuit?.[seat] || hand[0]?.suit;
    const card = getAiTrumpCard(hand, preferredSuit);
    applyPitch(room, seat, card);
    return true;
  }

  if (room.phase === 'trickPlay' && isAiSeat(room, room.currentPlayer) && elapsed >= AI_DELAY) {
    const seat = room.currentPlayer;
    const hand = room.hands[seat];
    const card = getAiPlay(
      hand,
      room.trumpSuit,
      room.trickPlays,
      seat,
      room.capturedTricks,
      room.difficulty || 'medium'
    );
    applyPlay(room, seat, card);
    return true;
  }

  return false;
}

// ── GET: Poll room state ──

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const playerId = searchParams.get('playerId');

  if (!code || !playerId) {
    return NextResponse.json({ error: 'Missing code or playerId' }, { status: 400 });
  }

  const room = await getRoom(code);
  if (!room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }

  if (processAiTick(room)) {
    await setRoom(code, room);
  }

  return NextResponse.json(filterForPlayer(room, playerId));
}

// ── POST: Player actions ──

export async function POST(request) {
  const body = await request.json();
  const { action } = body;

  if (action === 'create') {
    const {
      playerId,
      playerName,
      difficulty,
      gameMode,
      humanCount,
    } = body;

    const targetHumans = Number(humanCount || 2);
    if (!HUMAN_COUNTS.has(targetHumans)) {
      return NextResponse.json({ error: 'Human count must be 1, 2, or 4' }, { status: 400 });
    }

    const trimmedName = String(playerName || '').trim().slice(0, 12);
    if (!trimmedName) {
      return NextResponse.json({ error: 'Missing player name' }, { status: 400 });
    }

    let code = null;
    let attempts = 0;
    do {
      const nextCode = generateCode();
      const existing = await getRoom(nextCode);
      if (!existing) {
        code = nextCode;
        break;
      }
      attempts++;
    } while (attempts < 10);

    if (!code) {
      return NextResponse.json({ error: 'Failed to create room' }, { status: 500 });
    }

    const normalizedGameMode = normalizeGameMode(targetHumans, gameMode);
    const humanSeats = getHumanSeatPlan(targetHumans, normalizedGameMode);
    const room = {
      roomCode: code,
      gameMode: normalizedGameMode,
      targetHumans,
      humanSeats,
      hostId: playerId,
      participantsBySeat: {
        [humanSeats[0]]: { id: playerId, name: trimmedName },
      },
      dealer: SOUTH,
      phase: 'waiting',
      hands: [[], [], [], []],
      originalHands: [[], [], [], []],
      trumpSuit: null,
      currentPlayer: null,
      currentBidder: null,
      bids: [],
      highBid: { seat: -1, amount: 0 },
      bidBubbles: {},
      biddingTeam: null,
      bidAmount: 0,
      trickPlays: [],
      trickNumber: 1,
      capturedTricks: [],
      trickWinner: null,
      scores: { [TEAM_A]: 0, [TEAM_B]: 0 },
      handNumber: 0,
      gameNumber: 0,
      difficulty: difficulty || 'medium',
      lastActionAt: Date.now(),
      cutCards: [],
      cutWinner: null,
      handResult: null,
      wasSet: false,
      gameWinner: null,
      rematchBySeat: {},
      playerNames: {},
      aiPreferredSuit: {},
      statusMsg: '',
    };

    syncPlayerNames(room);
    if (targetHumans === 1) {
      startCutForDeal(room);
    } else {
      markWaiting(room);
    }

    await setRoom(code, room);
    return NextResponse.json({
      roomCode: code,
      mySeat: humanSeats[0],
      waiting: targetHumans > 1,
      targetHumans,
    });
  }

  if (action === 'join') {
    const { code, playerId, playerName } = body;
    const room = await getRoom(code);

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const trimmedName = String(playerName || '').trim().slice(0, 12);
    if (!trimmedName) {
      return NextResponse.json({ error: 'Missing player name' }, { status: 400 });
    }

    const existingSeat = getPlayerSeat(room, playerId);
    if (existingSeat !== null) {
      return NextResponse.json({ roomCode: code, mySeat: existingSeat, waiting: room.phase === 'waiting' });
    }

    const openSeat = getOpenHumanSeat(room);
    if (openSeat === null) {
      return NextResponse.json({ error: 'Room is full' }, { status: 400 });
    }

    room.participantsBySeat[openSeat] = { id: playerId, name: trimmedName };
    syncPlayerNames(room);

    if (allHumansJoined(room)) {
      room.rematchBySeat = {};
      startCutForDeal(room);
    } else {
      markWaiting(room);
    }

    await setRoom(code, room);
    return NextResponse.json({ roomCode: code, mySeat: openSeat, waiting: room.phase === 'waiting' });
  }

  if (action === 'bid') {
    const { code, playerId, bid } = body;
    const room = await getRoom(code);
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    const seat = getPlayerSeat(room, playerId);
    if (seat === null) return NextResponse.json({ error: 'Not in room' }, { status: 403 });
    if (room.phase !== 'bidding') return NextResponse.json({ error: 'Not bidding phase' }, { status: 400 });
    if (room.currentBidder !== seat) return NextResponse.json({ error: 'Not your turn to bid' }, { status: 403 });

    const allPassedToDealer = room.bids.length === 3 && (room.highBid?.amount || 0) === 0;
    const validBids = getValidBids(room.highBid?.amount || 0, seat === room.dealer, allPassedToDealer);
    if (!validBids.includes(bid)) {
      return NextResponse.json({ error: 'Invalid bid' }, { status: 400 });
    }

    applyBid(room, seat, bid);
    await setRoom(code, room);
    return NextResponse.json({ ok: true });
  }

  if (action === 'play') {
    const { code, playerId, card } = body;
    const room = await getRoom(code);
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    const seat = getPlayerSeat(room, playerId);
    if (seat === null) return NextResponse.json({ error: 'Not in room' }, { status: 403 });
    if (room.currentPlayer !== seat) return NextResponse.json({ error: 'Not your turn' }, { status: 403 });

    const hand = room.hands[seat];
    const cardInHand = hand.find(c => cardEquals(c, card));
    if (!cardInHand) return NextResponse.json({ error: 'Card not in hand' }, { status: 400 });

    if (room.phase === 'pitching') {
      applyPitch(room, seat, card);
    } else if (room.phase === 'trickPlay') {
      const ledSuit = room.trickPlays.length > 0 ? room.trickPlays[0].card.suit : null;
      const playable = getPlayableCards(hand, room.trumpSuit, ledSuit);
      if (!playable.some(c => cardEquals(c, card))) {
        return NextResponse.json({ error: 'Card not playable' }, { status: 400 });
      }
      applyPlay(room, seat, card);
    } else {
      return NextResponse.json({ error: 'Cannot play now' }, { status: 400 });
    }

    await setRoom(code, room);
    return NextResponse.json({ ok: true });
  }

  if (action === 'rematch') {
    const { code, playerId } = body;
    const room = await getRoom(code);
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    const seat = getPlayerSeat(room, playerId);
    if (seat === null) return NextResponse.json({ error: 'Not in room' }, { status: 403 });

    room.rematchBySeat[seat] = true;

    const everyoneReady = room.humanSeats.every(humanSeat => room.rematchBySeat[humanSeat]);
    if (everyoneReady) {
      room.scores = { [TEAM_A]: 0, [TEAM_B]: 0 };
      room.gameNumber = (room.gameNumber || 0) + 1;
      room.handNumber = 0;
      room.rematchBySeat = {};
      room.gameWinner = null;
      room.handResult = null;
      room.wasSet = false;
      startCutForDeal(room);
    } else {
      room.lastActionAt = Date.now();
    }

    await setRoom(code, room);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
