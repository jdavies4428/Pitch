import { NextResponse } from 'next/server';
import { getRoom, setRoom } from '@/lib/redis';
import {
  SOUTH, WEST, NORTH, EAST, TEAM_A, TEAM_B,
  getTeam, getPartner, dealHands, getValidBids,
  getPlayableCards, evaluateTrick, scoreHand,
  updateScores, nextDealer, cardEquals, createDeck, shuffleDeck,
} from '@/lib/game';
import { getAiBid, getAiPlay, getAiTrumpCard } from '@/lib/ai';

const ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const AI_DELAY = 800; // ms between AI actions
const PHASE_DELAY = 1500; // ms for phase transitions (trick collect, etc.)

function generateCode() {
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += ROOM_CHARS[Math.floor(Math.random() * ROOM_CHARS.length)];
  }
  return code;
}

function isAiSeat(room, seat) {
  // Co-op: humans at SOUTH+NORTH, AI at WEST+EAST
  // Versus: humans at SOUTH+WEST, AI at NORTH+EAST
  if (room.gameMode === 'coop') {
    return seat === WEST || seat === EAST;
  }
  return seat === NORTH || seat === EAST;
}

function getPlayer2Seat(room) {
  return room.gameMode === 'coop' ? NORTH : WEST;
}

function getPlayerSeat(room, playerId) {
  if (room.player1?.id === playerId) return SOUTH;
  if (room.player2?.id === playerId) return getPlayer2Seat(room);
  return null;
}

// Filter game state so a player only sees their own hand
function filterForPlayer(room, playerId) {
  const mySeat = getPlayerSeat(room, playerId);
  if (mySeat === null) return { error: 'Not in this room' };

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

  return {
    roomCode: room.roomCode,
    gameMode: room.gameMode || 'versus',
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
    bidBubbles: room.bidBubbles || {},
    trickPlays: room.trickPlays || [],
    trickNumber: room.trickNumber || 1,
    trickWinner: room.trickWinner,
    scores: room.scores,
    handNumber: room.handNumber || 0,
    gameNumber: room.gameNumber || 0,
    playableCards,
    validBids,
    playerNames: room.playerNames || {},
    cutCards: room.cutCards || [],
    cutWinner: room.cutWinner,
    handResult: room.handResult,
    wasSet: room.wasSet,
    gameWinner: room.gameWinner,
    waiting: !room.player2,
    rematch: room.rematch || { p1: false, p2: false },
    statusMsg: room.statusMsg || '',
    difficulty: room.difficulty || 'medium',
  };
}

// ── Phase transition helpers ──

function startCutForDeal(room) {
  const deck = shuffleDeck(createDeck());
  const cutCards = [
    { player: SOUTH, card: deck[0] },
    { player: WEST, card: deck[1] },
    { player: NORTH, card: deck[2] },
    { player: EAST, card: deck[3] },
  ];
  // Highest card wins deal
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
  room.statusMsg = '';
  room.lastActionAt = Date.now();
}

function applyBid(room, seat, bidAmount) {
  room.bids.push({ seat, bid: bidAmount });
  room.bidBubbles[seat] = bidAmount === 0 ? 'PASS' : `BID ${bidAmount}`;

  if (bidAmount > 0 && bidAmount >= (room.highBid?.amount || 0)) {
    room.highBid = { seat, amount: bidAmount };
  }

  if (room.bids.length >= 4) {
    // Bidding complete
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

  if (room.trickPlays.length >= 4) {
    // Trick complete
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
    // Hand over — score it
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
    // Next trick
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

// Process one AI action if it's an AI's turn
function processAiTick(room) {
  const now = Date.now();
  const elapsed = now - (room.lastActionAt || 0);

  // Phase transitions that need timing
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

  // AI bidding
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
    // Store preferred suit for pitching
    if (bid > 0) room.aiPreferredSuit = room.aiPreferredSuit || {};
    if (bid > 0) room.aiPreferredSuit[seat] = preferredSuit;
    applyBid(room, seat, bid);
    return true;
  }

  // AI pitching
  if (room.phase === 'pitching' && isAiSeat(room, room.currentPlayer) && elapsed >= AI_DELAY) {
    const seat = room.currentPlayer;
    const hand = room.hands[seat];
    const preferredSuit = room.aiPreferredSuit?.[seat] || hand[0]?.suit;
    const card = getAiTrumpCard(hand, preferredSuit);
    applyPitch(room, seat, card);
    return true;
  }

  // AI trick play
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

  // Process AI tick (one per poll)
  if (processAiTick(room)) {
    await setRoom(code, room);
  }

  return NextResponse.json(filterForPlayer(room, playerId));
}

// ── POST: Player actions ──

export async function POST(request) {
  const body = await request.json();
  const { action } = body;

  // ── CREATE ──
  if (action === 'create') {
    const { playerId, playerName, difficulty, gameMode } = body;
    const isCoop = gameMode === 'coop';
    let code;
    let attempts = 0;
    do {
      code = generateCode();
      const existing = await getRoom(code);
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    // Co-op: P1=SOUTH, P2=NORTH (partners), AI=WEST+EAST
    // Versus: P1=SOUTH, P2=WEST (opponents), AI=NORTH+EAST
    const playerNames = isCoop
      ? { [SOUTH]: playerName, [WEST]: 'SPIKE', [NORTH]: 'Waiting...', [EAST]: 'BLITZ' }
      : { [SOUTH]: playerName, [WEST]: 'Waiting...', [NORTH]: 'ACE', [EAST]: 'BLITZ' };

    const room = {
      roomCode: code,
      gameMode: gameMode || 'versus',
      player1: { id: playerId, name: playerName },
      player2: null,
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
      rematch: { p1: false, p2: false },
      playerNames,
      statusMsg: '',
    };

    await setRoom(code, room);
    return NextResponse.json({ roomCode: code, mySeat: SOUTH });
  }

  // ── JOIN ──
  if (action === 'join') {
    const { code, playerId, playerName } = body;
    const room = await getRoom(code);

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }
    const p2Seat = getPlayer2Seat(room);
    if (room.player2) {
      // Check if it's a rejoin
      if (room.player2.id === playerId) {
        return NextResponse.json({ roomCode: code, mySeat: p2Seat });
      }
      return NextResponse.json({ error: 'Room is full' }, { status: 400 });
    }
    // Check if player1 is rejoining
    if (room.player1.id === playerId) {
      return NextResponse.json({ roomCode: code, mySeat: SOUTH });
    }

    room.player2 = { id: playerId, name: playerName };
    room.playerNames[p2Seat] = playerName;
    startCutForDeal(room);

    await setRoom(code, room);
    return NextResponse.json({ roomCode: code, mySeat: p2Seat });
  }

  // ── BID ──
  if (action === 'bid') {
    const { code, playerId, bid } = body;
    const room = await getRoom(code);
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    const seat = getPlayerSeat(room, playerId);
    if (seat === null) return NextResponse.json({ error: 'Not in room' }, { status: 403 });
    if (room.phase !== 'bidding') return NextResponse.json({ error: 'Not bidding phase' }, { status: 400 });
    if (room.currentBidder !== seat) return NextResponse.json({ error: 'Not your turn to bid' }, { status: 403 });

    // Validate bid
    const allPassedToDealer = room.bids.length === 3 && (room.highBid?.amount || 0) === 0;
    const validBids = getValidBids(room.highBid?.amount || 0, seat === room.dealer, allPassedToDealer);
    if (!validBids.includes(bid)) {
      return NextResponse.json({ error: 'Invalid bid' }, { status: 400 });
    }

    applyBid(room, seat, bid);
    await setRoom(code, room);
    return NextResponse.json({ ok: true });
  }

  // ── PLAY (pitch or trick play) ──
  if (action === 'play') {
    const { code, playerId, card } = body;
    const room = await getRoom(code);
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    const seat = getPlayerSeat(room, playerId);
    if (seat === null) return NextResponse.json({ error: 'Not in room' }, { status: 403 });
    if (room.currentPlayer !== seat) return NextResponse.json({ error: 'Not your turn' }, { status: 403 });

    // Validate card is in hand
    const hand = room.hands[seat];
    const cardInHand = hand.find(c => cardEquals(c, card));
    if (!cardInHand) return NextResponse.json({ error: 'Card not in hand' }, { status: 400 });

    if (room.phase === 'pitching') {
      applyPitch(room, seat, card);
    } else if (room.phase === 'trickPlay') {
      // Validate card is playable
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

  // ── REMATCH ──
  if (action === 'rematch') {
    const { code, playerId } = body;
    const room = await getRoom(code);
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    const seat = getPlayerSeat(room, playerId);
    if (seat === null) return NextResponse.json({ error: 'Not in room' }, { status: 403 });

    if (seat === SOUTH) room.rematch.p1 = true;
    if (seat === getPlayer2Seat(room)) room.rematch.p2 = true;

    if (room.rematch.p1 && room.rematch.p2) {
      // Both want rematch — reset game
      room.scores = { [TEAM_A]: 0, [TEAM_B]: 0 };
      room.gameNumber = (room.gameNumber || 0) + 1;
      room.handNumber = 0;
      room.rematch = { p1: false, p2: false };
      room.gameWinner = null;
      startCutForDeal(room);
    }

    await setRoom(code, room);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
