"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  SOUTH, WEST, NORTH, EAST, TEAM_A, TEAM_B,
  getTeam, SUITS, SUIT_SYMBOLS, WIN_SCORE, SEAT_NAMES, isRedSuit,
  dealHands, getValidBids, getPlayableCards, evaluateTrick,
  scoreHand, updateScores, nextDealer, cardEquals, cardId,
  getLivePoints, cardDisplay, createDeck, shuffleDeck,
} from "@/lib/game";
import { getAiBid, getAiPlay, getAiTrumpCard } from "@/lib/ai";
import { roomApi } from "@/lib/api-client";
import { sounds } from "@/lib/sounds";
import Hand from "./Hand";
import TrickArea from "./TrickArea";
import ScoreBoard from "./ScoreBoard";
import Confetti from "./Confetti";

const AI_DELAY = 700;
const AI_BID_DELAY = 1400;
const TRICK_PAUSE = 1400;
const POLL_MS = 700;

const DIFF_LABELS = { easy: "ROOKIE", medium: "STANDARD", hard: "SHARK" };
const DIFF_COLORS = { easy: "#7a9b8a", medium: "#6b8aad", hard: "#ad6b6b" };
const DIFF_DESC = {
  easy: "Still learning the ropes",
  medium: "Knows when to hold 'em",
  hard: "Reads you like a book",
};

// Player info (solo mode defaults)
const PLAYER_INFO = {
  [SOUTH]: { name: 'YOU',   initial: 'Y', color: '#6b8aad' },
  [NORTH]: { name: 'ACE',   initial: 'A', color: '#6b8aad' },
  [WEST]:  { name: 'SPIKE', initial: 'S', color: '#ad6b6b' },
  [EAST]:  { name: 'BLITZ', initial: 'B', color: '#ad6b6b' },
};

// Display positions
const DISPLAY_POSITIONS = [SOUTH, WEST, NORTH, EAST];

export default function Game() {
  // ── Mode ──
  const [mode, setMode] = useState(null); // null | 'solo' | 'online'
  const [roomCode, setRoomCode] = useState(null);
  const [playerId] = useState(() =>
    typeof window !== 'undefined' ? (sessionStorage.getItem('pitchPlayerId') || (() => {
      const id = Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem('pitchPlayerId', id);
      return id;
    })()) : 'ssr'
  );
  const [playerName, setPlayerName] = useState('');
  const [mySeat, setMySeat] = useState(SOUTH);
  const [onlineNames, setOnlineNames] = useState({}); // { [seat]: name }
  const [lobbyAction, setLobbyAction] = useState(null); // 'create' | 'join'
  const [gameMode, setGameMode] = useState('versus'); // 'versus' | 'coop'
  const [joinCode, setJoinCode] = useState('');
  const [lobbyError, setLobbyError] = useState('');
  const [waiting, setWaiting] = useState(false);
  const [rematchState, setRematchState] = useState({ p1: false, p2: false });
  const [copied, setCopied] = useState(false);

  // ── Screen ──
  const [screen, setScreen] = useState("lobby");
  const [difficulty, setDifficulty] = useState("medium");

  // ── Game state ──
  const [dealer, setDealer] = useState(EAST);
  const [originalHands, setOriginalHands] = useState([[], [], [], []]);
  const [hands, setHands] = useState([[], [], [], []]);
  const [scores, setScores] = useState({ [TEAM_A]: 0, [TEAM_B]: 0 });
  const [handNumber, setHandNumber] = useState(1);

  // ── Bidding ──
  const [phase, setPhase] = useState("idle");
  const [currentBidder, setCurrentBidder] = useState(null);
  const [bids, setBids] = useState([]);
  const [highBid, setHighBid] = useState({ seat: null, amount: 0 });
  const [bidBubbles, setBidBubbles] = useState({});

  // ── Trick play ──
  const [trumpSuit, setTrumpSuit] = useState(null);
  const [biddingTeam, setBiddingTeam] = useState(null);
  const [bidAmount, setBidAmount] = useState(0);
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [trickPlays, setTrickPlays] = useState([]);
  const [trickNumber, setTrickNumber] = useState(1);
  const [capturedTricks, setCapturedTricks] = useState([]);
  const [trickWinner, setTrickWinner] = useState(null);

  // ── Results ──
  const [handResult, setHandResult] = useState(null);
  const [wasSet, setWasSet] = useState(false);
  const [gameWinner, setGameWinner] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);

  // ── Cut for deal ──
  const [cutCards, setCutCards] = useState([]);
  const [cutWinner, setCutWinner] = useState(null);

  // ── UI ──
  const [audioReady, setAudioReady] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const timerRef = useRef(null);
  const pollRef = useRef(null);
  const lastStateRef = useRef(null); // Track previous poll state for sound triggers

  // ── Seat rotation for multiplayer ──
  const displaySeat = useCallback((serverSeat) => {
    if (mode !== 'online') return serverSeat;
    return (serverSeat - mySeat + 4) % 4;
  }, [mode, mySeat]);

  const serverSeat = useCallback((displayPos) => {
    if (mode !== 'online') return displayPos;
    return (displayPos + mySeat) % 4;
  }, [mode, mySeat]);

  // Get player name for a seat
  const getPlayerName = useCallback((seat) => {
    if (mode === 'online' && onlineNames[seat]) {
      return seat === mySeat ? 'YOU' : onlineNames[seat];
    }
    return PLAYER_INFO[seat]?.name || 'Unknown';
  }, [mode, mySeat, onlineNames]);

  // ── Audio init ──
  const initAudio = useCallback(async () => {
    await sounds.init();
    if (!audioReady) setAudioReady(true);
  }, [audioReady]);

  // ── Cleanup ──
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ═══════════════════════════════════════
  // ── ONLINE MODE: POLLING ──
  // ═══════════════════════════════════════

  const applyServerState = useCallback((state) => {
    if (state.error) return;
    const prev = lastStateRef.current;

    setMySeat(state.mySeat);
    setWaiting(state.waiting);
    setOnlineNames(state.playerNames || {});
    setRematchState(state.rematch || { p1: false, p2: false });

    if (state.waiting) {
      setScreen('playing'); // show "waiting" overlay
      return;
    }

    // Map server phase to screen
    if (state.phase === 'gameOver') {
      setScreen('gameOver');
    } else if (state.phase === 'handOver') {
      setScreen('handOver');
    } else if (state.phase !== 'waiting') {
      setScreen('playing');
    }

    // Sound triggers on state changes
    if (prev) {
      if (state.phase === 'bidding' && prev.phase !== 'bidding') sounds.shuffle();
      if (state.trickPlays?.length > prev.trickPlays?.length) sounds.cardPlay();
      if (state.trickWinner !== null && prev.trickWinner === null) sounds.trickWon();
      if (state.phase === 'trickPlay' && state.currentPlayer === state.mySeat &&
          (prev.currentPlayer !== state.mySeat || prev.phase !== 'trickPlay')) sounds.turn();
      if (state.phase === 'bidding' && state.currentBidder === state.mySeat &&
          (prev.currentBidder !== state.mySeat || prev.phase !== 'bidding')) sounds.turn();
      if (state.phase === 'pitching' && state.currentPlayer === state.mySeat &&
          prev.phase !== 'pitching') sounds.turn();
      // Bid sounds
      if (state.bids?.length > (prev.bids?.length || 0)) {
        const lastBid = state.bids[state.bids.length - 1];
        if (lastBid.bid > 0) sounds.bidMade();
        else sounds.bidPass();
      }
    }

    // Update game state
    setPhase(state.phase);
    setDealer(state.dealer);
    setTrumpSuit(state.trumpSuit);
    setCurrentPlayer(state.currentPlayer);
    setCurrentBidder(state.currentBidder);
    setBids(state.bids || []);
    setHighBid(state.highBid || { seat: -1, amount: 0 });
    setBidBubbles(state.bidBubbles || {});
    setTrickPlays(state.trickPlays || []);
    setTrickNumber(state.trickNumber || 1);
    setTrickWinner(state.trickWinner);
    setScores(state.scores || { [TEAM_A]: 0, [TEAM_B]: 0 });
    setHandNumber(state.handNumber || 0);
    setHandResult(state.handResult);
    setWasSet(state.wasSet || false);
    setGameWinner(state.gameWinner);
    setCutCards(state.cutCards || []);
    setCutWinner(state.cutWinner);
    setStatusMsg(state.statusMsg || '');
    setBiddingTeam(state.highBid?.seat !== undefined ? getTeam(state.highBid.seat) : null);
    setBidAmount(state.highBid?.amount || 0);

    // Set hands for display — only my hand is real, others are faceDown by count
    if (state.myHand) {
      const newHands = [[], [], [], []];
      newHands[state.mySeat] = state.myHand;
      // For other seats, create placeholder arrays matching their card count
      for (let s = 0; s < 4; s++) {
        if (s !== state.mySeat) {
          newHands[s] = new Array(state.handCounts?.[s] || 0).fill(null);
        }
      }
      setHands(newHands);
    }

    // Handle confetti
    if (state.gameWinner !== null && !prev?.gameWinner) {
      if (getTeam(state.mySeat) === state.gameWinner) {
        sounds.win();
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 4000);
      } else {
        sounds.lose();
      }
    }

    // Handle set back sound
    if (state.phase === 'handOver' && prev?.phase !== 'handOver') {
      if (state.wasSet) sounds.setBack();
      else sounds.madeIt();
    }

    lastStateRef.current = state;
  }, []);

  // Start/stop polling
  useEffect(() => {
    if (mode !== 'online' || !roomCode) return;

    const poll = async () => {
      try {
        const state = await roomApi.poll(roomCode, playerId);
        applyServerState(state);
      } catch (e) {
        console.error('Poll error:', e);
      }
    };

    poll(); // immediate first poll
    pollRef.current = setInterval(poll, POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [mode, roomCode, playerId, applyServerState]);

  // ═══════════════════════════════════════
  // ── LOBBY ACTIONS ──
  // ═══════════════════════════════════════

  const createRoom = useCallback(async () => {
    setLobbyError('');
    try {
      const res = await roomApi.create(playerId, playerName, difficulty, gameMode);
      if (res.error) {
        setLobbyError(res.error);
        return;
      }
      setRoomCode(res.roomCode);
      setMySeat(res.mySeat);
      setMode('online');
      setWaiting(true);
      setScreen('playing');
    } catch (e) {
      setLobbyError('Failed to create room');
    }
  }, [playerId, playerName, difficulty, gameMode]);

  const joinRoom = useCallback(async () => {
    setLobbyError('');
    if (joinCode.length !== 4) {
      setLobbyError('Code must be 4 characters');
      return;
    }
    try {
      const res = await roomApi.join(joinCode, playerId, playerName);
      if (res.error) {
        setLobbyError(res.error);
        return;
      }
      setRoomCode(res.roomCode);
      setMySeat(res.mySeat);
      setMode('online');
      setScreen('playing');
    } catch (e) {
      setLobbyError('Failed to join room');
    }
  }, [joinCode, playerId, playerName]);

  // ═══════════════════════════════════════
  // ── SOLO MODE (existing logic, unchanged) ──
  // ═══════════════════════════════════════

  // ── Go to lobby ──
  const goToLobby = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (pollRef.current) clearInterval(pollRef.current);
    setMode(null);
    setRoomCode(null);
    setScreen("lobby");
    setPhase("idle");
    setScores({ [TEAM_A]: 0, [TEAM_B]: 0 });
    setHandNumber(1);
    setDealer(EAST);
    setGameWinner(null);
    setShowConfetti(false);
    setWaiting(false);
    setLobbyAction(null);
    setJoinCode('');
    setLobbyError('');
    setOnlineNames({});
    lastStateRef.current = null;
  }, []);

  // ── Start solo game ──
  const startGame = useCallback((diff) => {
    setMode('solo');
    setDifficulty(diff);
    setMySeat(SOUTH);
    setScores({ [TEAM_A]: 0, [TEAM_B]: 0 });
    setHandNumber(1);
    setGameWinner(null);
    setHands([[], [], [], []]);
    setScreen("playing");
    setPhase("cutForDeal");
  }, []);

  // ── CUT FOR DEAL (solo) ──
  useEffect(() => {
    if (mode !== 'solo' || phase !== "cutForDeal") return;

    const deck = shuffleDeck(createDeck());
    const order = [SOUTH, WEST, NORTH, EAST];
    const cards = order.map((seat, i) => ({ player: seat, card: deck[i] }));

    const suitRank = { S: 3, H: 2, D: 1, C: 0 };
    const winner = cards.reduce((best, curr) => {
      if (curr.card.rank > best.card.rank) return curr;
      if (curr.card.rank === best.card.rank &&
          suitRank[curr.card.suit] > suitRank[best.card.suit]) return curr;
      return best;
    });

    setStatusMsg("Cutting for deal...");
    setCutCards([]);
    setCutWinner(null);

    const timeouts = [];

    cards.forEach((c, i) => {
      timeouts.push(setTimeout(() => {
        setCutCards(prev => [...prev, c]);
        sounds.cardPlay();
      }, 600 + i * 450));
    });

    timeouts.push(setTimeout(() => {
      setCutWinner(winner.player);
      setStatusMsg(`${PLAYER_INFO[winner.player].name} deals first`);
      sounds.trickWon();
    }, 600 + 4 * 450 + 400));

    timeouts.push(setTimeout(() => {
      setDealer(winner.player);
      setCutCards([]);
      setCutWinner(null);
      setPhase("dealing");
    }, 600 + 4 * 450 + 400 + 2000));

    return () => timeouts.forEach(t => clearTimeout(t));
  }, [mode, phase]);

  // ── DEALING (solo) ──
  useEffect(() => {
    if (mode !== 'solo' || screen !== "playing" || phase !== "dealing") return;

    const dealt = dealHands(dealer);
    setOriginalHands(dealt.map(h => [...h]));
    setHands(dealt.map(h => [...h]));
    setCapturedTricks([]);
    setTrickPlays([]);
    setTrickNumber(1);
    setTrumpSuit(null);
    setBids([]);
    setHighBid({ seat: null, amount: 0 });
    setBidBubbles({});
    setTrickWinner(null);
    setHandResult(null);
    setWasSet(false);
    setStatusMsg("Dealing...");

    sounds.shuffle();

    timerRef.current = setTimeout(() => {
      const first = (dealer + 1) % 4;
      setCurrentBidder(first);
      setPhase("bidding");
      if (first === SOUTH) {
        setStatusMsg("Your bid");
        sounds.turn();
      } else {
        setStatusMsg(`${SEAT_NAMES[first]} is bidding...`);
      }
    }, 800);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [mode, screen, phase, dealer]);

  // ── BIDDING AI (solo) ──
  useEffect(() => {
    if (mode !== 'solo' || phase !== "bidding" || currentBidder === null || currentBidder === SOUTH) return;
    if (bids.length >= 4) return;

    timerRef.current = setTimeout(() => {
      const isD = currentBidder === dealer;
      const allPassed = bids.length === 3 && bids.every(b => b.bid === 0);
      const result = getAiBid(
        hands[currentBidder], highBid.amount, isD, allPassed, difficulty
      );

      const bubbleText = result.bid > 0 ? `BID ${result.bid}` : "PASS";
      setBidBubbles(prev => ({ ...prev, [currentBidder]: bubbleText }));

      let newHigh = highBid;
      if (result.bid > 0) {
        sounds.bidMade();
        newHigh = { seat: currentBidder, amount: result.bid };
        setHighBid(newHigh);
      } else {
        sounds.bidPass();
      }

      const newBids = [...bids, { seat: currentBidder, bid: result.bid }];
      setBids(newBids);

      if (newBids.length >= 4) {
        const winBid = newHigh;
        setBiddingTeam(getTeam(winBid.seat));
        setBidAmount(winBid.amount);
        setCurrentPlayer(winBid.seat);
        setPhase("pitching");
        if (winBid.seat === SOUTH) {
          setStatusMsg("Pick your trump \u2014 play a card!");
          sounds.turn();
        }
      } else {
        const next = (currentBidder + 1) % 4;
        setCurrentBidder(next);
        if (next === SOUTH) {
          setStatusMsg("Your bid");
          sounds.turn();
        } else {
          setStatusMsg(`${SEAT_NAMES[next]} is bidding...`);
        }
      }
    }, AI_BID_DELAY);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [mode, phase, currentBidder, bids, highBid, dealer, difficulty, hands]);

  // ── AI PITCHING (solo) ──
  useEffect(() => {
    if (mode !== 'solo' || phase !== "pitching" || currentPlayer === null || currentPlayer === SOUTH) return;

    timerRef.current = setTimeout(() => {
      const preferred = getAiBid(hands[currentPlayer], 0, false, false, difficulty).preferredSuit;
      const trumpCard = getAiTrumpCard(hands[currentPlayer], preferred);
      setTrumpSuit(trumpCard.suit);
      setTrickPlays([{ player: currentPlayer, card: trumpCard }]);
      setHands(prev => {
        const next = prev.map(h => [...h]);
        next[currentPlayer] = next[currentPlayer].filter(c => !cardEquals(c, trumpCard));
        return next;
      });
      const np = (currentPlayer + 1) % 4;
      setCurrentPlayer(np);
      setPhase("trickPlay");
      sounds.cardPlay();
      if (np === SOUTH) {
        setStatusMsg("Your turn");
        sounds.turn();
      } else {
        setStatusMsg(`${SEAT_NAMES[np]} is playing...`);
      }
    }, 600);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [mode, phase, currentPlayer, hands, difficulty]);

  // ── TRICK PLAY AI (solo) ──
  useEffect(() => {
    if (mode !== 'solo' || phase !== "trickPlay" || currentPlayer === null || currentPlayer === SOUTH) return;
    if (trickPlays.length >= 4) return;

    timerRef.current = setTimeout(() => {
      const card = getAiPlay(
        hands[currentPlayer], trumpSuit, trickPlays, currentPlayer, capturedTricks, difficulty
      );

      sounds.cardPlay();

      const newPlays = [...trickPlays, { player: currentPlayer, card }];
      setTrickPlays(newPlays);
      setHands(prev => {
        const next = prev.map(h => [...h]);
        next[currentPlayer] = next[currentPlayer].filter(c => !cardEquals(c, card));
        return next;
      });

      if (newPlays.length >= 4) {
        setPhase("trickCollect");
      } else {
        const np = (currentPlayer + 1) % 4;
        setCurrentPlayer(np);
        if (np === SOUTH) {
          setStatusMsg("Your turn");
          sounds.turn();
        } else {
          setStatusMsg(`${SEAT_NAMES[np]} is playing...`);
        }
      }
    }, AI_DELAY);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [mode, phase, currentPlayer, trickPlays, trumpSuit, capturedTricks, difficulty, hands]);

  // ── TRICK COLLECT (solo) ──
  useEffect(() => {
    if (mode !== 'solo' || phase !== "trickCollect") return;
    if (trickPlays.length < 4) return;

    const winner = evaluateTrick(trickPlays, trumpSuit);
    setTrickWinner(winner);
    setStatusMsg(`${SEAT_NAMES[winner]} wins the trick!`);
    sounds.trickWon();

    timerRef.current = setTimeout(() => {
      const completedTrick = { winner, cards: [...trickPlays] };
      const newCaptured = [...capturedTricks, completedTrick];
      setCapturedTricks(newCaptured);
      setTrickPlays([]);
      setTrickWinner(null);

      if (trickNumber >= 6) {
        const result = scoreHand(originalHands, newCaptured, trumpSuit);
        const { newScores, wasSet: ws, gameWinner: gw } = updateScores(
          scores, biddingTeam, bidAmount, result
        );

        setHandResult(result);
        setWasSet(ws);
        setScores(newScores);

        if (ws) sounds.setBack();
        else sounds.madeIt();

        if (gw !== null) {
          setGameWinner(gw);
          if (gw === TEAM_A) {
            sounds.win();
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 4000);
          } else {
            sounds.lose();
          }
          setScreen("gameOver");
        } else {
          setScreen("handOver");
        }
      } else {
        setTrickNumber(prev => prev + 1);
        setCurrentPlayer(winner);
        setPhase("trickPlay");
        if (winner === SOUTH) {
          setStatusMsg("Your lead");
          sounds.turn();
        } else {
          setStatusMsg(`${SEAT_NAMES[winner]} leads...`);
        }
      }
    }, TRICK_PAUSE);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [mode, phase, trickPlays, trumpSuit, trickNumber, capturedTricks, originalHands, scores, biddingTeam, bidAmount]);

  // ── Human: make bid ──
  const makeBid = useCallback((amount) => {
    initAudio();

    if (mode === 'online') {
      roomApi.bid(roomCode, playerId, amount);
      return;
    }

    // Solo mode
    const bubbleText = amount > 0 ? `BID ${amount}` : "PASS";
    setBidBubbles(prev => ({ ...prev, [SOUTH]: bubbleText }));

    let newHigh = highBid;
    if (amount > 0) {
      sounds.bidMade();
      newHigh = { seat: SOUTH, amount };
      setHighBid(newHigh);
    } else {
      sounds.bidPass();
    }

    const newBids = [...bids, { seat: SOUTH, bid: amount }];
    setBids(newBids);

    if (newBids.length >= 4) {
      const winBid = newHigh;
      setBiddingTeam(getTeam(winBid.seat));
      setBidAmount(winBid.amount);
      setCurrentPlayer(winBid.seat);
      setPhase("pitching");
      if (winBid.seat === SOUTH) {
        setStatusMsg("Pick your trump \u2014 play a card!");
      }
    } else {
      const next = (SOUTH + 1) % 4;
      setCurrentBidder(next);
      setStatusMsg(`${SEAT_NAMES[next]} is bidding...`);
    }
  }, [mode, roomCode, playerId, bids, highBid, initAudio]);

  // ── Human: play card ──
  const playCard = useCallback((card) => {
    initAudio();
    sounds.cardPlay();

    if (mode === 'online') {
      roomApi.play(roomCode, playerId, card);
      return;
    }

    // Solo mode
    if (phase === "pitching") {
      setTrumpSuit(card.suit);
      setPhase("trickPlay");
    }

    const newPlays = [...trickPlays, { player: SOUTH, card }];
    setTrickPlays(newPlays);
    setHands(prev => {
      const next = prev.map(h => [...h]);
      next[SOUTH] = next[SOUTH].filter(c => !cardEquals(c, card));
      return next;
    });

    if (newPlays.length >= 4) {
      setPhase("trickCollect");
    } else {
      const np = (SOUTH + 1) % 4;
      setCurrentPlayer(np);
      setStatusMsg(`${SEAT_NAMES[np]} is playing...`);
    }
  }, [mode, roomCode, playerId, phase, trickPlays, initAudio]);

  // ── Next hand (solo) ──
  const nextHand = useCallback(() => {
    if (mode === 'online') return; // handled by server
    setDealer(prev => nextDealer(prev));
    setHandNumber(prev => prev + 1);
    setPhase("dealing");
    setScreen("playing");
  }, [mode]);

  // ── Play again (solo) ──
  const playAgain = useCallback(() => {
    if (mode === 'online') {
      roomApi.rematch(roomCode, playerId);
      return;
    }
    setScores({ [TEAM_A]: 0, [TEAM_B]: 0 });
    setHandNumber(1);
    setGameWinner(null);
    setShowConfetti(false);
    setHands([[], [], [], []]);
    setPhase("cutForDeal");
    setScreen("playing");
  }, [mode, roomCode, playerId]);

  // ── Derived state ──
  const isOnline = mode === 'online';
  const myActualSeat = isOnline ? mySeat : SOUTH;

  const ledSuit = trickPlays.length > 0 ? trickPlays[0].card.suit : null;

  // In online mode, server provides playable cards; in solo, compute locally
  const playableCards = isOnline
    ? (lastStateRef.current?.playableCards || [])
    : (phase === "trickPlay" && currentPlayer === SOUTH)
      ? getPlayableCards(hands[SOUTH], trumpSuit, ledSuit)
      : (phase === "pitching" && currentPlayer === SOUTH)
        ? [...hands[SOUTH]]
        : [];

  const validBids = isOnline
    ? (lastStateRef.current?.validBids || [])
    : (phase === "bidding" && currentBidder === SOUTH)
      ? getValidBids(
          highBid.amount,
          dealer === SOUTH,
          bids.length === 3 && bids.every(b => b.bid === 0)
        )
      : [];

  // ── Derived UI state ──
  const isHumanTurn = (phase === 'trickPlay' || phase === 'pitching') && currentPlayer === myActualSeat;
  const isHumanBidding = phase === 'bidding' && currentBidder === myActualSeat;
  const mustFollow = isHumanTurn && ledSuit &&
    playableCards.length < hands[myActualSeat]?.length;
  const livePoints = mode === 'solo' ? getLivePoints(originalHands, capturedTricks, trumpSuit) : null;

  const getDimLevel = (seat) => {
    if (!isHumanTurn) return 'primary';
    return seat === myActualSeat ? 'primary' : 'background';
  };

  const isLeading = (seat) => {
    return (phase === 'trickPlay' && currentPlayer === seat && trickPlays.length === 0) ||
      (phase === 'pitching' && currentPlayer === seat);
  };

  // Get display info for a seat, accounting for rotation
  const getSeatInfo = useCallback((displayPos) => {
    const svrSeat = serverSeat(displayPos);
    const name = getPlayerName(svrSeat);
    const teamColor = getTeam(svrSeat) === TEAM_A ? '#6b8aad' : '#ad6b6b';
    const backColor = getTeam(svrSeat) === TEAM_A ? 'blue' : 'red';
    return { svrSeat, name, teamColor, backColor };
  }, [serverSeat, getPlayerName]);

  // ── Seat label renderer ──
  const renderSeatLabel = (displayPos) => {
    const { svrSeat, name } = getSeatInfo(displayPos);
    const isActive = (phase === 'trickPlay' && currentPlayer === svrSeat) ||
      (phase === 'pitching' && currentPlayer === svrSeat) ||
      (phase === 'bidding' && currentBidder === svrSeat);
    const leading = isLeading(svrSeat);
    const isD = dealer === svrSeat;
    const bubble = bidBubbles[svrSeat];

    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        whiteSpace: 'nowrap',
        padding: isActive ? '3px 10px' : '3px 6px',
        borderRadius: 12,
        background: isActive ? 'rgba(200,170,80,0.12)' : 'transparent',
        border: isActive ? '1px solid rgba(200,170,80,0.2)' : '1px solid transparent',
        transition: 'all 0.3s',
      }}>
        {isActive && (
          <div style={{
            width: 5, height: 5, borderRadius: '50%',
            background: '#c8aa50',
            boxShadow: '0 0 6px rgba(200,170,80,0.5)',
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
        )}
        <span style={{
          fontSize: 'clamp(10px, 2.8vw, 12px)', fontWeight: 700,
          color: isActive ? '#c8aa50' : 'rgba(255,255,255,0.35)',
          letterSpacing: 1.5, textTransform: 'uppercase',
          transition: 'color 0.3s',
        }}>{name}</span>
        {isD && (
          <span style={{
            fontSize: 'clamp(10px, 2.8vw, 12px)', fontWeight: 800,
            color: '#1a1a1a',
            background: 'linear-gradient(135deg, #e8c840, #c8aa50)',
            width: 'clamp(22px, 6vw, 28px)', height: 'clamp(22px, 6vw, 28px)',
            borderRadius: '50%',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.3), 0 0 10px rgba(200,170,80,0.2)',
            letterSpacing: 0, lineHeight: 1, flexShrink: 0,
          }}>D</span>
        )}
        {leading && (
          <span style={{
            fontSize: 'clamp(8px, 2vw, 9px)', fontWeight: 700,
            color: '#c8aa50',
            letterSpacing: 1,
            background: 'rgba(200,170,80,0.15)',
            padding: '1px 5px',
            borderRadius: 4,
          }}>LEADS</span>
        )}
      </div>
    );
  };


  // ── Rotate trick plays for display ──
  const displayTrickPlays = isOnline
    ? trickPlays.map(p => ({ ...p, player: displaySeat(p.player) }))
    : trickPlays;

  const displayCutCards = isOnline
    ? cutCards.map(c => ({ ...c, player: displaySeat(c.player) }))
    : cutCards;

  // ═══════════════════════════════════════
  // ── RENDER ──
  // ═══════════════════════════════════════

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden no-select room-bg"
      style={{ height: '100dvh' }}
      onClick={initAudio}>

      <div className="scanlines" />
      {showConfetti && <Confetti />}

      {/* ── LOBBY ── */}
      {screen === "lobby" && (
        <div className="flex flex-col items-center w-full px-4"
          style={{ maxWidth: 'min(340px, calc(100vw - 32px))' }}>
          <div className="w-full rounded-2xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                     boxShadow: '0 20px 60px rgba(0,0,0,0.5)', backdropFilter: 'blur(20px)',
                     WebkitBackdropFilter: 'blur(20px)' }}>
            <div style={{ height: 1, width: '100%', background: 'linear-gradient(90deg, transparent, rgba(200,170,80,0.3), transparent)' }} />
            <div style={{
              padding: 'clamp(24px, 6vw, 36px) clamp(20px, 5vw, 28px)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 'clamp(16px, 4vw, 24px)',
            }}>
              <div className="text-center">
                <div style={{
                  fontSize: 'clamp(8px, 2vw, 9px)', color: 'rgba(255,255,255,0.25)',
                  letterSpacing: 6, fontWeight: 500, marginBottom: 8,
                }}>
                  FOUR PLAYER
                </div>
                <div style={{
                  fontSize: 'clamp(36px, 10vw, 48px)', fontWeight: 700,
                  letterSpacing: '0.08em', lineHeight: 1,
                  color: '#e8e0d0',
                }}>
                  PITCH
                </div>
                <div style={{
                  fontSize: 'clamp(7px, 1.8vw, 9px)', color: 'rgba(255,255,255,0.2)',
                  letterSpacing: 4, marginTop: 8, fontWeight: 400,
                }}>
                  HIGH &middot; LOW &middot; JACK &middot; GAME
                </div>
              </div>

              <div style={{ display: 'flex', gap: 16, justifyContent: 'center', margin: '4px 0' }}>
                {[
                  { s: '\u2660', c: 'rgba(255,255,255,0.15)' },
                  { s: '\u2665', c: 'rgba(173,107,107,0.4)' },
                  { s: '\u2666', c: 'rgba(173,107,107,0.4)' },
                  { s: '\u2663', c: 'rgba(255,255,255,0.15)' },
                ].map((item, i) => (
                  <span key={i} style={{ fontSize: 20, color: item.c }}>{item.s}</span>
                ))}
              </div>

              {/* Mode not selected yet */}
              {!lobbyAction && (
                <>
                  <button className="btn w-full" onClick={() => setScreen("difficulty")}
                    style={{ color: '#c8aa50', borderColor: 'rgba(200,170,80,0.3)' }}>
                    PLAY SOLO
                  </button>

                  <button className="btn w-full" onClick={() => setLobbyAction('enterName')}
                    style={{ color: '#6b8aad', borderColor: 'rgba(107,138,173,0.3)' }}>
                    PLAY ONLINE
                  </button>

                  <button className="btn btn-sm w-full" onClick={() => setScreen("howToPlay")}
                    style={{ color: 'rgba(255,255,255,0.35)', borderColor: 'rgba(255,255,255,0.08)' }}>
                    HOW TO PLAY
                  </button>
                </>
              )}

              {/* Enter name */}
              {lobbyAction === 'enterName' && (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 3, fontWeight: 500 }}>
                    ENTER YOUR NAME
                  </div>
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value.slice(0, 12))}
                    placeholder="Your name"
                    maxLength={12}
                    autoFocus
                    style={{
                      width: '100%', padding: '10px 14px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 8, color: '#e0e0e0',
                      fontSize: 16, textAlign: 'center',
                      outline: 'none', fontFamily: 'Inter, sans-serif',
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'rgba(200,170,80,0.4)'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
                  />
                  <button className="btn w-full"
                    onClick={() => { if (playerName.trim()) setLobbyAction('chooseAction'); }}
                    disabled={!playerName.trim()}
                    style={{
                      color: playerName.trim() ? '#c8aa50' : 'rgba(255,255,255,0.15)',
                      borderColor: playerName.trim() ? 'rgba(200,170,80,0.3)' : 'rgba(255,255,255,0.06)',
                    }}>
                    CONTINUE
                  </button>
                  <button className="btn btn-sm" onClick={() => setLobbyAction(null)}
                    style={{ color: 'rgba(255,255,255,0.25)', borderColor: 'rgba(255,255,255,0.06)' }}>
                    BACK
                  </button>
                </div>
              )}

              {/* Create or Join */}
              {lobbyAction === 'chooseAction' && (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 3, fontWeight: 500 }}>
                    PLAYING AS {playerName.toUpperCase()}
                  </div>

                  {/* Difficulty selector */}
                  <div style={{ display: 'flex', gap: 6, width: '100%' }}>
                    {Object.entries(DIFF_LABELS).map(([key, label]) => (
                      <button key={key} className="btn btn-sm"
                        onClick={() => setDifficulty(key)}
                        style={{
                          flex: 1,
                          color: difficulty === key ? DIFF_COLORS[key] : 'rgba(255,255,255,0.2)',
                          borderColor: difficulty === key ? DIFF_COLORS[key] + '44' : 'rgba(255,255,255,0.06)',
                          background: difficulty === key ? DIFF_COLORS[key] + '10' : 'transparent',
                          fontSize: 9,
                        }}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)', marginTop: -8 }}>
                    AI DIFFICULTY
                  </div>

                  {/* Game mode selector */}
                  <div style={{ display: 'flex', gap: 6, width: '100%', marginTop: 4 }}>
                    <button className="btn btn-sm"
                      onClick={() => setGameMode('versus')}
                      style={{
                        flex: 1, fontSize: 9,
                        color: gameMode === 'versus' ? '#ad6b6b' : 'rgba(255,255,255,0.2)',
                        borderColor: gameMode === 'versus' ? 'rgba(173,107,107,0.4)' : 'rgba(255,255,255,0.06)',
                        background: gameMode === 'versus' ? 'rgba(173,107,107,0.1)' : 'transparent',
                      }}>
                      VS FRIEND
                    </button>
                    <button className="btn btn-sm"
                      onClick={() => setGameMode('coop')}
                      style={{
                        flex: 1, fontSize: 9,
                        color: gameMode === 'coop' ? '#6b8aad' : 'rgba(255,255,255,0.2)',
                        borderColor: gameMode === 'coop' ? 'rgba(107,138,173,0.4)' : 'rgba(255,255,255,0.06)',
                        background: gameMode === 'coop' ? 'rgba(107,138,173,0.1)' : 'transparent',
                      }}>
                      WITH FRIEND
                    </button>
                  </div>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)', marginTop: -8 }}>
                    {gameMode === 'versus' ? 'YOU + AI vs FRIEND + AI' : 'YOU + FRIEND vs 2 AIs'}
                  </div>

                  <button className="btn w-full" onClick={createRoom}
                    style={{ color: '#c8aa50', borderColor: 'rgba(200,170,80,0.3)' }}>
                    CREATE ROOM
                  </button>
                  <button className="btn w-full" onClick={() => setLobbyAction('joinRoom')}
                    style={{ color: '#6b8aad', borderColor: 'rgba(107,138,173,0.3)' }}>
                    JOIN ROOM
                  </button>
                  {lobbyError && (
                    <div style={{ color: '#ad6b6b', fontSize: 11 }}>{lobbyError}</div>
                  )}
                  <button className="btn btn-sm" onClick={() => setLobbyAction('enterName')}
                    style={{ color: 'rgba(255,255,255,0.25)', borderColor: 'rgba(255,255,255,0.06)' }}>
                    BACK
                  </button>
                </div>
              )}

              {/* Join room */}
              {lobbyAction === 'joinRoom' && (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 3, fontWeight: 500 }}>
                    ENTER ROOM CODE
                  </div>
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 4))}
                    placeholder="XXXX"
                    maxLength={4}
                    autoFocus
                    style={{
                      width: '100%', padding: '12px 14px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 8, color: '#e0e0e0',
                      fontSize: 28, textAlign: 'center',
                      outline: 'none', fontFamily: 'Inter, sans-serif',
                      letterSpacing: 12, fontWeight: 700,
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'rgba(200,170,80,0.4)'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
                  />
                  <button className="btn w-full" onClick={joinRoom}
                    disabled={joinCode.length !== 4}
                    style={{
                      color: joinCode.length === 4 ? '#c8aa50' : 'rgba(255,255,255,0.15)',
                      borderColor: joinCode.length === 4 ? 'rgba(200,170,80,0.3)' : 'rgba(255,255,255,0.06)',
                    }}>
                    JOIN
                  </button>
                  {lobbyError && (
                    <div style={{ color: '#ad6b6b', fontSize: 11 }}>{lobbyError}</div>
                  )}
                  <button className="btn btn-sm" onClick={() => { setLobbyAction('chooseAction'); setLobbyError(''); }}
                    style={{ color: 'rgba(255,255,255,0.25)', borderColor: 'rgba(255,255,255,0.06)' }}>
                    BACK
                  </button>
                </div>
              )}

              {!lobbyAction && (
                <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: 'rgba(255,255,255,0.15)', textAlign: 'center', lineHeight: 1.6 }}>
                  BID. PITCH TRUMP. TAKE TRICKS.<br />
                  FIRST TEAM TO {WIN_SCORE} WINS.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── DIFFICULTY (solo) ── */}
      {screen === "difficulty" && (
        <div className="flex flex-col items-center w-full max-w-[320px] px-4 gap-4">
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 3, fontWeight: 500 }}>SELECT DIFFICULTY</div>
          {Object.entries(DIFF_LABELS).map(([key, label]) => (
            <button key={key} className="btn w-full"
              onClick={() => startGame(key)}
              style={{ color: DIFF_COLORS[key], borderColor: DIFF_COLORS[key] + '44',
                       flexDirection: 'column', gap: 2 }}>
              <div>{label}</div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', marginTop: 2, textTransform: 'none', letterSpacing: 'normal' }}>
                {DIFF_DESC[key]}
              </div>
            </button>
          ))}
          <button className="btn btn-sm" onClick={goToLobby}
            style={{ color: 'rgba(255,255,255,0.25)', borderColor: 'rgba(255,255,255,0.06)', marginTop: 8 }}>
            BACK
          </button>
        </div>
      )}

      {/* ── HOW TO PLAY ── */}
      {screen === "howToPlay" && (
        <div className="flex flex-col items-center w-full px-4"
          style={{
            maxWidth: 'min(340px, calc(100vw - 24px))',
            maxHeight: 'calc(100dvh - 40px)',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}>
          <div style={{
            background: 'rgba(255,255,255,0.02)', borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.06)',
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            padding: 'clamp(16px, 4vw, 24px)',
            display: 'flex', flexDirection: 'column',
            gap: 'clamp(12px, 3vw, 18px)',
            width: '100%',
          }}>
            <div style={{
              fontSize: 'clamp(12px, 3.5vw, 14px)', fontWeight: 600,
              color: 'rgba(255,255,255,0.6)', textAlign: 'center', letterSpacing: 3,
            }}>
              HOW TO PLAY
            </div>

            {[
              { num: '1', title: 'TEAMS', color: '#6b8aad',
                text: 'You and your Partner (across) vs two Opponents. Work together to score points!' },
              { num: '2', title: 'DEAL', color: '#7a9b8a',
                text: 'Each player gets 6 cards. The dealer rotates each hand.' },
              { num: '3', title: 'BID', color: '#c8aa50',
                text: 'Bid 2, 3, or 4 \u2014 how many points your team will win. Highest bidder picks trump. Pass if your hand is weak.' },
              { num: '4', title: 'PITCH TRUMP', color: '#c8aa50',
                text: 'The bid winner plays the first card. Its suit becomes trump \u2014 the most powerful suit this hand.' },
              { num: '5', title: 'TAKE TRICKS', color: '#ad6b6b',
                text: 'Play 6 tricks. Follow the suit led, or play trump. Highest trump wins; otherwise highest of the led suit wins.' },
              { num: '6', title: '4 POINTS PER HAND', color: '#ad6b6b',
                text: 'HIGH \u2014 highest trump dealt\nLOW \u2014 lowest trump dealt\nJACK \u2014 capture the Jack of trump\nGAME \u2014 most card points (10s, Aces, Kings, Queens, Jacks)' },
              { num: '7', title: 'MAKE YOUR BID', color: '#6b8aad',
                text: 'Win enough points to cover your bid \u2014 or get SET BACK! The other team always keeps their points.' },
              { num: '\u2605', title: 'WIN THE GAME', color: '#c8aa50',
                text: `First team to ${WIN_SCORE} points wins!` },
            ].map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: step.color + '15', border: `1px solid ${step.color}33`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, color: step.color, flexShrink: 0, marginTop: 1,
                }}>{step.num}</div>
                <div>
                  <div style={{
                    fontSize: 'clamp(9px, 2.5vw, 10px)', color: step.color,
                    fontWeight: 600, letterSpacing: 1, marginBottom: 2,
                  }}>{step.title}</div>
                  <div style={{
                    fontSize: 'clamp(8px, 2.2vw, 10px)', color: 'rgba(255,255,255,0.35)',
                    lineHeight: 1.5, whiteSpace: 'pre-line',
                  }}>{step.text}</div>
                </div>
              </div>
            ))}

            <button className="btn w-full" onClick={() => setScreen("lobby")}
              style={{ color: '#c8aa50', borderColor: 'rgba(200,170,80,0.3)', marginTop: 4 }}>
              GOT IT!
            </button>
          </div>
        </div>
      )}

      {/* ── PLAYING ── */}
      {screen === "playing" && (
        <>
          <div className="vignette" />

          <div style={{
            position: 'fixed', top: '-10%', left: '50%', transform: 'translateX(-50%)',
            width: '60%', height: '40%',
            background: 'radial-gradient(ellipse, rgba(255,230,180,0.03) 0%, transparent 65%)',
            pointerEvents: 'none', zIndex: 1,
          }} />

          {/* Waiting for opponent overlay */}
          {isOnline && waiting && (
            <div style={{
              position: 'fixed', inset: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              zIndex: 50, gap: 16,
              background: 'rgba(6,14,8,0.95)',
            }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 3, fontWeight: 500 }}>
                ROOM CODE
              </div>
              <div style={{
                fontSize: 'clamp(36px, 10vw, 52px)', fontWeight: 700,
                letterSpacing: 12, color: '#c8aa50',
                fontFamily: 'Inter, monospace',
              }}>
                {roomCode}
              </div>
              <button className="btn btn-sm" onClick={() => {
                navigator.clipboard?.writeText(roomCode);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
                style={{ color: copied ? '#7a9b8a' : 'rgba(255,255,255,0.35)', borderColor: 'rgba(255,255,255,0.1)' }}>
                {copied ? 'COPIED!' : 'COPY CODE'}
              </button>
              <div style={{
                fontSize: 12, color: 'rgba(255,255,255,0.25)',
                animation: 'pulse 2s ease-in-out infinite',
              }}>
                Waiting for opponent to join...
              </div>
              <button className="btn btn-sm" onClick={goToLobby}
                style={{ color: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.06)', marginTop: 16 }}>
                LEAVE
              </button>
            </div>
          )}

          <div style={{
            position: 'relative',
            width: '100%', height: '100%',
            maxWidth: 960, margin: '0 auto',
          }}>
            {/* Home / menu button */}
            {!waiting && (
              <button
                onClick={() => { if (confirm('Leave game and return to lobby?')) goToLobby(); }}
                style={{
                  position: 'absolute',
                  top: 'max(10px, env(safe-area-inset-top, 0px))',
                  left: 8,
                  zIndex: 25,
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10,
                  padding: 'clamp(6px, 1.5vw, 8px)',
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: 'clamp(14px, 3.5vw, 16px)',
                  lineHeight: 1,
                  cursor: 'pointer',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                ✕
              </button>
            )}

            <ScoreBoard
              scores={scores}
              bidInfo={bidAmount > 0 ? { amount: bidAmount, team: biddingTeam } : null}
              trickNumber={trickNumber}
              handNumber={handNumber}
              wasSet={wasSet}
            />

            {/* Room code badge (online) */}
            {isOnline && !waiting && (
              <div style={{
                position: 'absolute', top: 6, right: 8,
                fontSize: 9, color: 'rgba(255,255,255,0.15)',
                letterSpacing: 2, fontWeight: 500, zIndex: 20,
              }}>
                {roomCode}
              </div>
            )}

            {/* ── NORTH (display position) ── */}
            {(() => {
              const { svrSeat, backColor } = getSeatInfo(NORTH);
              return (
                <div style={{
                  position: 'absolute',
                  top: 'clamp(52px, 12vw, 68px)',
                  left: '50%', transform: 'translateX(-50%)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: 4, zIndex: 10,
                }}>
                  {renderSeatLabel(NORTH)}
                  <Hand cards={hands[svrSeat]} position="north" faceDown
                    isCurrentTurn={currentPlayer === svrSeat && phase === 'trickPlay'}
                    dimLevel={getDimLevel(svrSeat)} backColor={backColor} />
                </div>
              );
            })()}

            {/* ── WEST (display position) ── */}
            {(() => {
              const { svrSeat, backColor } = getSeatInfo(WEST);
              return (
                <div style={{
                  position: 'absolute',
                  left: 'clamp(12px, 3vw, 28px)',
                  top: '42%', transform: 'translateY(-50%)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: 4, zIndex: 10,
                }}>
                  {renderSeatLabel(WEST)}
                  <Hand cards={hands[svrSeat]} position="west" faceDown
                    isCurrentTurn={currentPlayer === svrSeat && phase === 'trickPlay'}
                    dimLevel={getDimLevel(svrSeat)} backColor={backColor} />
                </div>
              );
            })()}

            {/* ── EAST (display position) ── */}
            {(() => {
              const { svrSeat, backColor } = getSeatInfo(EAST);
              return (
                <div style={{
                  position: 'absolute',
                  right: 'clamp(12px, 3vw, 28px)',
                  top: '42%', transform: 'translateY(-50%)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: 4, zIndex: 10,
                }}>
                  {renderSeatLabel(EAST)}
                  <Hand cards={hands[svrSeat]} position="east" faceDown
                    isCurrentTurn={currentPlayer === svrSeat && phase === 'trickPlay'}
                    dimLevel={getDimLevel(svrSeat)} backColor={backColor} />
                </div>
              );
            })()}

            {/* ── TRUMP INDICATOR — left side badge ── */}
            {trumpSuit && (
              <div style={{
                position: 'absolute',
                left: 'clamp(10px, 2.5vw, 24px)',
                top: 'clamp(42px, 10vw, 60px)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                zIndex: 20,
                padding: 'clamp(6px, 1.5vw, 10px) clamp(8px, 2vw, 14px)',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
              }}>
                <span style={{
                  fontSize: 'clamp(8px, 2vw, 9px)',
                  color: 'rgba(255,255,255,0.35)',
                  letterSpacing: 2, fontWeight: 600,
                }}>TRUMP</span>
                <span style={{
                  fontSize: 'clamp(32px, 9vw, 48px)',
                  color: isRedSuit(trumpSuit) ? '#c44' : '#ddd',
                  filter: `drop-shadow(0 2px 8px ${isRedSuit(trumpSuit) ? 'rgba(200,60,60,0.4)' : 'rgba(255,255,255,0.2)'})`,
                  lineHeight: 1,
                }}>{SUIT_SYMBOLS[trumpSuit]}</span>
              </div>
            )}

            {/* ── TRICK AREA / CUT FOR DEAL ── */}
            <TrickArea
              trickPlays={phase === 'cutForDeal' ? displayCutCards : displayTrickPlays}
              trickWinner={phase === 'cutForDeal'
                ? (cutWinner !== null ? displaySeat(cutWinner) : null)
                : (trickWinner !== null ? displaySeat(trickWinner) : null)}
            />

            {/* ── FLOATING BID BUBBLES ── */}
            {phase === 'bidding' && (() => {
              const bubblePositions = {
                [SOUTH]: { top: '72%', left: '50%' },
                [NORTH]: { top: '28%', left: '50%' },
                [WEST]:  { top: '42%', left: '20%' },
                [EAST]:  { top: '42%', left: '80%' },
              };
              return DISPLAY_POSITIONS.map(dp => {
                const { svrSeat } = getSeatInfo(dp);
                const bubble = bidBubbles[svrSeat];
                if (!bubble) return null;
                const pos = bubblePositions[dp];
                const isBid = bubble !== 'PASS';
                return (
                  <div key={`bid-bubble-${dp}`} style={{
                    position: 'absolute',
                    ...pos,
                    zIndex: 25,
                    animation: 'bidPop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
                    pointerEvents: 'none',
                  }}>
                    <div style={{
                      padding: 'clamp(8px, 2vw, 12px) clamp(16px, 4vw, 24px)',
                      borderRadius: 14,
                      background: isBid ? 'rgba(200,170,80,0.15)' : 'rgba(0,0,0,0.3)',
                      border: isBid ? '1.5px solid rgba(200,170,80,0.4)' : '1px solid rgba(255,255,255,0.08)',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      boxShadow: isBid
                        ? '0 4px 20px rgba(200,170,80,0.2), 0 0 40px rgba(200,170,80,0.08)'
                        : '0 4px 12px rgba(0,0,0,0.3)',
                    }}>
                      <div style={{
                        fontSize: isBid ? 'clamp(16px, 4.5vw, 22px)' : 'clamp(13px, 3.5vw, 16px)',
                        fontWeight: 700,
                        color: isBid ? '#c8aa50' : 'rgba(255,255,255,0.3)',
                        letterSpacing: isBid ? 3 : 2,
                        textAlign: 'center',
                        textShadow: isBid ? '0 0 12px rgba(200,170,80,0.4)' : 'none',
                      }}>
                        {bubble}
                      </div>
                    </div>
                  </div>
                );
              });
            })()}

            {/* Cut for deal label */}
            {phase === 'cutForDeal' && (
              <div style={{
                position: 'absolute',
                top: '28%',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                zIndex: 20,
                textAlign: 'center',
              }}>
                <div style={{
                  fontSize: cutWinner ? 'clamp(14px, 4vw, 18px)' : 'clamp(11px, 3vw, 13px)',
                  fontWeight: 700,
                  color: cutWinner ? '#c8aa50' : 'rgba(255,255,255,0.5)',
                  letterSpacing: cutWinner ? 3 : 2,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.3s',
                }}>
                  {isOnline
                    ? (cutWinner !== null
                      ? `${getPlayerName(cutWinner)} deals first`
                      : 'Cutting for deal...')
                    : statusMsg
                  }
                </div>
                {cutWinner && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <span style={{
                      fontSize: 'clamp(12px, 3.5vw, 14px)', fontWeight: 800,
                      color: '#1a1a1a',
                      background: 'linear-gradient(135deg, #e8c840, #c8aa50)',
                      width: 'clamp(28px, 7vw, 34px)', height: 'clamp(28px, 7vw, 34px)',
                      borderRadius: '50%',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.3), 0 0 12px rgba(200,170,80,0.25)',
                      lineHeight: 1,
                    }}>D</span>
                    <span style={{
                      fontSize: 'clamp(9px, 2.5vw, 11px)',
                      color: 'rgba(255,255,255,0.35)',
                      letterSpacing: 1,
                    }}>DEALER</span>
                  </div>
                )}
              </div>
            )}


            {/* ── SOUTH AREA (always the local player) ── */}
            <div style={{
              position: 'absolute',
              bottom: trumpSuit && livePoints ? 'clamp(60px, 14vw, 78px)' : 0,
              left: 0, right: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              zIndex: 10,
              paddingBottom: (!trumpSuit || !livePoints) ? 'max(6px, env(safe-area-inset-bottom, 0px))' : 0,
              transition: 'bottom 0.3s ease',
            }}>
              {/* Follow-suit / turn status badge */}
              {isHumanTurn && phase === 'trickPlay' && (
                mustFollow ? (
                  <div style={{
                    marginBottom: 8, padding: 'clamp(6px, 1.5vw, 8px) clamp(16px, 4vw, 24px)',
                    borderRadius: 20,
                    background: 'rgba(200,170,80,0.1)',
                    border: '1px solid rgba(200,170,80,0.25)',
                    color: '#c8aa50',
                    fontSize: 'clamp(11px, 3vw, 13px)', fontWeight: 600,
                    letterSpacing: 1,
                    display: 'flex', alignItems: 'center', gap: 6,
                    animation: 'slideUp 0.3s ease-out, glowPulse 2s ease-in-out infinite',
                    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                  }}>
                    <span style={{ fontSize: 'clamp(14px, 3.5vw, 16px)' }}>{SUIT_SYMBOLS[ledSuit]}</span>
                    <span>{ledSuit === trumpSuit ? 'MUST FOLLOW TRUMP' : 'FOLLOW SUIT OR TRUMP'}</span>
                  </div>
                ) : (
                  <div style={{
                    marginBottom: 8, padding: 'clamp(6px, 1.5vw, 8px) clamp(16px, 4vw, 24px)',
                    borderRadius: 20,
                    background: 'rgba(200,170,80,0.08)',
                    border: '1px solid rgba(200,170,80,0.2)',
                    color: '#c8aa50',
                    fontSize: 'clamp(11px, 3vw, 13px)', fontWeight: 600,
                    letterSpacing: 1.5,
                    animation: 'slideUp 0.3s ease-out, glowPulse 2s ease-in-out infinite',
                    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                  }}>
                    {trickPlays.length === 0 ? 'YOUR LEAD' : 'YOUR TURN'}
                  </div>
                )
              )}

              {/* Pitching prompt */}
              {phase === 'pitching' && currentPlayer === myActualSeat && (
                <div style={{
                  marginBottom: 8, padding: 'clamp(8px, 2vw, 10px) clamp(16px, 4vw, 24px)',
                  borderRadius: 20,
                  background: 'rgba(200,170,80,0.1)',
                  border: '1px solid rgba(200,170,80,0.3)',
                  color: '#c8aa50',
                  fontSize: 'clamp(11px, 3vw, 13px)', fontWeight: 600,
                  letterSpacing: 1,
                  animation: 'slideUp 0.3s ease-out, glowPulse 2s ease-in-out infinite',
                  backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                }}>
                  PICK YOUR TRUMP &mdash; PLAY A CARD
                </div>
              )}

              {/* Bid section — prominent when it's your turn */}
              {isHumanBidding && validBids.length > 0 && (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  marginBottom: 8,
                  animation: 'slideUp 0.3s ease-out',
                }}>
                  <div style={{
                    fontSize: 'clamp(12px, 3.5vw, 14px)', fontWeight: 700,
                    color: '#c8aa50', letterSpacing: 2,
                    animation: 'glowPulse 2s ease-in-out infinite',
                    padding: '4px 16px',
                    borderRadius: 12,
                    background: 'rgba(200,170,80,0.08)',
                    border: '1px solid rgba(200,170,80,0.2)',
                  }}>
                    YOUR BID
                  </div>
                  <div style={{
                    display: 'flex', gap: 'clamp(8px, 2.5vw, 12px)',
                    flexWrap: 'wrap', justifyContent: 'center',
                    maxWidth: 'calc(100vw - 24px)',
                  }}>
                    {validBids.map((b, i) => (
                      <button key={b} className="btn" onClick={() => {
                        if (navigator.vibrate) navigator.vibrate(10);
                        makeBid(b);
                      }}
                        style={{
                          color: b === 0 ? 'rgba(255,255,255,0.4)' : '#c8aa50',
                          borderColor: b === 0 ? 'rgba(255,255,255,0.1)' : 'rgba(200,170,80,0.35)',
                          background: b === 0 ? 'rgba(0,0,0,0.2)' : 'rgba(200,170,80,0.06)',
                          fontSize: 'clamp(12px, 3.2vw, 14px)',
                          fontWeight: 700,
                          padding: 'clamp(8px, 2vw, 12px) clamp(16px, 4vw, 24px)',
                          minWidth: b === 0 ? undefined : 'clamp(60px, 16vw, 80px)',
                          animation: b > 0 ? `slideUp ${0.3 + i * 0.08}s ease-out` : undefined,
                        }}>
                        {b === 0 ? 'PASS' : `BID ${b}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* South hand (local player's hand) */}
              <Hand cards={hands[myActualSeat] || []}
                position="south"
                playableCards={playableCards}
                onCardClick={playCard}
                isCurrentTurn={isHumanTurn}
                dimLevel="primary" />

              {/* South label */}
              <div style={{ marginTop: 3 }}>
                {renderSeatLabel(SOUTH)}
              </div>

              {/* Status message */}
              {!isHumanTurn && !isHumanBidding && statusMsg && (
                <div style={{
                  fontSize: 'clamp(9px, 2.5vw, 11px)', color: 'rgba(255,255,255,0.25)',
                  marginTop: 2, whiteSpace: 'nowrap',
                }}>
                  {isOnline && statusMsg ? statusMsg : (!isOnline ? statusMsg : '')}
                </div>
              )}
            </div>

            {/* ── HORIZONTAL POINT TRACKER BAR ── */}
            {trumpSuit && livePoints && (
              <div style={{
                position: 'absolute',
                bottom: 0, left: 0, right: 0,
                zIndex: 15,
                paddingBottom: 'max(4px, env(safe-area-inset-bottom, 0px))',
                background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.35) 70%, transparent 100%)',
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 'clamp(4px, 2vw, 12px)',
                  padding: 'clamp(6px, 1.5vw, 10px) clamp(12px, 3vw, 20px)',
                  margin: '0 auto',
                  maxWidth: 480,
                }}>
                  {[
                    { label: 'HIGH', team: livePoints.high, card: livePoints.highCard },
                    { label: 'LOW', team: livePoints.low, card: livePoints.lowCard },
                    { label: 'JACK', team: livePoints.jackExists ? livePoints.jack : 'none' },
                    { label: 'GAME', gameA: livePoints.gameA, gameB: livePoints.gameB },
                  ].map((pt, i) => (
                    <div key={pt.label} style={{
                      flex: 1,
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      gap: 2,
                      padding: 'clamp(4px, 1vw, 8px) 0',
                      borderRadius: 8,
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.05)',
                    }}>
                      <span style={{
                        fontSize: 'clamp(7px, 2vw, 9px)',
                        color: 'rgba(255,255,255,0.3)',
                        fontWeight: 600, letterSpacing: 1.5,
                      }}>{pt.label}</span>
                      {pt.label === 'GAME' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <span style={{ fontSize: 'clamp(12px, 3.5vw, 16px)', fontWeight: 700, color: '#6b8aad' }}>{pt.gameA}</span>
                          <span style={{ fontSize: 'clamp(8px, 2vw, 10px)', color: 'rgba(255,255,255,0.1)' }}>-</span>
                          <span style={{ fontSize: 'clamp(12px, 3.5vw, 16px)', fontWeight: 700, color: '#ad6b6b' }}>{pt.gameB}</span>
                        </div>
                      ) : (
                        <span style={{
                          fontSize: 'clamp(12px, 3.5vw, 16px)', fontWeight: 700,
                          color: pt.team === TEAM_A ? '#6b8aad'
                            : pt.team === TEAM_B ? '#ad6b6b'
                            : pt.team === 'none' ? 'rgba(255,255,255,0.08)'
                            : 'rgba(255,255,255,0.12)',
                        }}>
                          {pt.team === TEAM_A ? 'US'
                            : pt.team === TEAM_B ? 'THEM'
                            : pt.team === 'none' ? '\u2014'
                            : '?'}
                        </span>
                      )}
                      {pt.card && (
                        <span style={{ fontSize: 'clamp(7px, 2vw, 9px)', color: 'rgba(255,255,255,0.15)' }}>
                          {cardDisplay(pt.card)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Turn glow + edge glow */}
            {(isHumanTurn || isHumanBidding) && (
              <>
                <div className="turn-glow" />
                <div className="your-turn-edge" />
              </>
            )}
          </div>
        </>
      )}

      {/* ── HAND OVER ── */}
      {screen === "handOver" && (() => {
        const bidTeamIsUs = biddingTeam === TEAM_A;
        const bidTeamLabel = bidTeamIsUs ? 'WE' : 'THEY';
        const bidTeamColor = bidTeamIsUs ? '#6b8aad' : '#ad6b6b';
        const pointsWon = handResult?.pointsWon || { [TEAM_A]: 0, [TEAM_B]: 0 };
        const bidderPts = pointsWon[biddingTeam] || 0;
        const madeIt = bidderPts >= bidAmount;
        const points = [
          { key: 'high', label: 'HIGH', icon: '\u2191' },
          { key: 'low', label: 'LOW', icon: '\u2193' },
          { key: 'jack', label: 'JACK', icon: 'J' },
          { key: 'game', label: 'GAME', icon: '\u2605' },
        ];

        // Quips based on who bid and outcome
        const quips = (() => {
          const pick = (arr) => arr[handNumber % arr.length];
          if (bidTeamIsUs && !wasSet) {
            if (bidderPts === 4) return pick(["Clean sweep!", "All four! Dominant.", "Took everything. Wow."]);
            if (bidAmount === 4) return pick(["Gutsy bid. Paid off.", "Bid 4 and delivered.", "That takes nerve."]);
            return pick(["Nice call.", "That's how it's done.", "Right on the money.", "Smooth.", "Called your shot."]);
          }
          if (bidTeamIsUs && wasSet) {
            if (bidAmount === 4) return pick(["Swing and a miss.", "Ambitious. Too ambitious.", "That 4-bid was bold..."]);
            return pick(["Ouch.", "That one stings.", "Bit of a reach.", "Tough break.", "The table giveth..."]);
          }
          if (!bidTeamIsUs && !wasSet) {
            if (bidderPts === 4) return pick(["They ran the table.", "Nothing you could do.", "Tip of the cap."]);
            return pick(["Can't win 'em all.", "Their hand.", "Next time.", "They had the cards."]);
          }
          // opponent got set
          if (bidAmount === 4) return pick(["Love to see it.", "That 4-bid backfired.", "Way too greedy."]);
          return pick(["Ha. Sucks for them.", "Overplayed their hand.", "Love to see it.", "Don't reach.", "Get wrecked."]);
        })();

        return (
          <div className="flex flex-col items-center px-4"
            style={{ gap: 'clamp(14px, 3.5vw, 22px)', maxWidth: 'min(340px, calc(100vw - 24px))' }}>

            {/* Header */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'clamp(8px, 2vw, 9px)', color: 'rgba(255,255,255,0.2)', letterSpacing: 4, fontWeight: 500 }}>
                HAND {handNumber}
              </div>
              <div style={{
                fontSize: 'clamp(20px, 6vw, 28px)', fontWeight: 700, marginTop: 4,
                color: wasSet ? '#ad6b6b' : '#7a9b8a',
                letterSpacing: 2,
              }}>
                {wasSet ? 'SET BACK!' : 'MADE IT!'}
              </div>
              <div style={{
                fontSize: 'clamp(11px, 3vw, 14px)', fontWeight: 400,
                color: 'rgba(255,255,255,0.35)',
                marginTop: 4, fontStyle: 'italic',
                animation: 'fadeIn 0.5s ease-out',
              }}>
                {quips}
              </div>
            </div>

            {/* Bid vs Got meter */}
            <div style={{
              width: '100%',
              padding: 'clamp(12px, 3vw, 18px)',
              borderRadius: 14,
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${wasSet ? 'rgba(173,107,107,0.2)' : 'rgba(122,155,138,0.2)'}`,
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              {/* Who bid */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 'clamp(9px, 2.5vw, 11px)', color: 'rgba(255,255,255,0.3)', letterSpacing: 2, fontWeight: 500 }}>
                  {bidTeamLabel} BID
                </span>
                <span style={{ fontSize: 'clamp(22px, 6vw, 28px)', fontWeight: 700, color: bidTeamColor }}>
                  {bidAmount}
                </span>
              </div>

              {/* Progress bar: got vs needed */}
              <div style={{
                width: '100%', height: 8, borderRadius: 4,
                background: 'rgba(255,255,255,0.06)',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${Math.min((bidderPts / Math.max(bidAmount, 1)) * 100, 100)}%`,
                  height: '100%', borderRadius: 4,
                  background: madeIt
                    ? 'linear-gradient(90deg, #7a9b8a, #5a8a6a)'
                    : 'linear-gradient(90deg, #ad6b6b, #8a4a4a)',
                  transition: 'width 0.8s cubic-bezier(0.22, 1, 0.36, 1)',
                }} />
              </div>

              {/* Got count */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 'clamp(9px, 2.5vw, 11px)', color: 'rgba(255,255,255,0.3)', letterSpacing: 2, fontWeight: 500 }}>
                  {bidTeamLabel} GOT
                </span>
                <span style={{
                  fontSize: 'clamp(22px, 6vw, 28px)', fontWeight: 700,
                  color: madeIt ? '#7a9b8a' : '#ad6b6b',
                }}>
                  {bidderPts}
                </span>
              </div>
            </div>

            {/* Point breakdown — 4 columns */}
            <div style={{
              display: 'flex', gap: 'clamp(4px, 1.5vw, 8px)', width: '100%',
            }}>
              {points.map((pt, i) => {
                const winner = handResult?.[pt.key];
                const wonByUs = winner === TEAM_A;
                const wonByThem = winner === TEAM_B;
                const isBidTeam = winner === biddingTeam;
                return (
                  <div key={pt.key} style={{
                    flex: 1,
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: 4,
                    padding: 'clamp(8px, 2vw, 12px) 0',
                    borderRadius: 10,
                    background: winner !== null
                      ? (wonByUs ? 'rgba(107,138,173,0.08)' : 'rgba(173,107,107,0.08)')
                      : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${winner !== null
                      ? (wonByUs ? 'rgba(107,138,173,0.2)' : 'rgba(173,107,107,0.2)')
                      : 'rgba(255,255,255,0.04)'}`,
                    animation: `slideUp ${0.3 + i * 0.1}s ease-out`,
                  }}>
                    <div style={{
                      width: 'clamp(28px, 8vw, 36px)', height: 'clamp(28px, 8vw, 36px)',
                      borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 'clamp(12px, 3.5vw, 16px)', fontWeight: 700,
                      background: winner !== null
                        ? (wonByUs ? 'rgba(107,138,173,0.15)' : 'rgba(173,107,107,0.15)')
                        : 'rgba(255,255,255,0.03)',
                      color: winner !== null
                        ? (wonByUs ? '#6b8aad' : '#ad6b6b')
                        : 'rgba(255,255,255,0.08)',
                      border: `1px solid ${winner !== null
                        ? (isBidTeam ? (madeIt ? 'rgba(122,155,138,0.3)' : 'rgba(173,107,107,0.3)') : 'rgba(255,255,255,0.08)')
                        : 'rgba(255,255,255,0.04)'}`,
                    }}>
                      {winner !== null ? '\u2713' : '\u2014'}
                    </div>
                    <span style={{
                      fontSize: 'clamp(8px, 2.2vw, 10px)', fontWeight: 600,
                      color: 'rgba(255,255,255,0.3)', letterSpacing: 1,
                    }}>{pt.label}</span>
                    <span style={{
                      fontSize: 'clamp(10px, 2.8vw, 12px)', fontWeight: 700,
                      color: wonByUs ? '#6b8aad' : wonByThem ? '#ad6b6b' : 'rgba(255,255,255,0.08)',
                    }}>
                      {wonByUs ? 'US' : wonByThem ? 'THEM' : '--'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Set back penalty */}
            {wasSet && (
              <div style={{
                padding: '8px 16px', borderRadius: 8,
                background: 'rgba(173,107,107,0.08)',
                border: '1px solid rgba(173,107,107,0.15)',
                color: '#ad6b6b',
                fontSize: 'clamp(10px, 2.8vw, 12px)', fontWeight: 600,
                letterSpacing: 1, textAlign: 'center',
              }}>
                {bidTeamLabel} LOSE {bidAmount} POINTS
              </div>
            )}

            {/* Game Score */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: 'clamp(8px, 2.2vw, 10px)', fontWeight: 600,
                color: 'rgba(255,255,255,0.25)', letterSpacing: 2, marginBottom: 4,
              }}>GAME SCORE</div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '8px 24px', borderRadius: 12,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 'clamp(7px, 2vw, 9px)', color: '#6b8aad', letterSpacing: 2, fontWeight: 500 }}>US</div>
                  <div style={{ fontSize: 'clamp(22px, 6vw, 28px)', fontWeight: 700, color: '#6b8aad' }}>{scores[TEAM_A]}</div>
                </div>
                <div style={{ fontSize: 'clamp(10px, 2.5vw, 12px)', color: 'rgba(255,255,255,0.1)' }}>:</div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 'clamp(7px, 2vw, 9px)', color: '#ad6b6b', letterSpacing: 2, fontWeight: 500 }}>THEM</div>
                  <div style={{ fontSize: 'clamp(22px, 6vw, 28px)', fontWeight: 700, color: '#ad6b6b' }}>{scores[TEAM_B]}</div>
                </div>
              </div>
            </div>

            {isOnline ? (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', animation: 'pulse 2s ease-in-out infinite' }}>
                Next hand starting...
              </div>
            ) : (
              <button className="btn" onClick={() => {
                if (navigator.vibrate) navigator.vibrate(10);
                nextHand();
              }}
                style={{ color: '#c8aa50', borderColor: 'rgba(200,170,80,0.3)' }}>
                NEXT HAND
              </button>
            )}
          </div>
        );
      })()}

      {/* ── GAME OVER ── */}
      {screen === "gameOver" && (
        <div className="flex flex-col items-center px-4"
          style={{ gap: 'clamp(12px, 3vw, 20px)' }}>
          <div style={{
            fontSize: 'clamp(22px, 7vw, 28px)', fontWeight: 700,
            color: (() => {
              const myTeam = isOnline ? getTeam(mySeat) : TEAM_A;
              return gameWinner === myTeam ? '#7a9b8a' : '#ad6b6b';
            })(),
            letterSpacing: 2,
          }}>
            {(() => {
              const myTeam = isOnline ? getTeam(mySeat) : TEAM_A;
              return gameWinner === myTeam ? 'YOU WIN' : 'YOU LOSE';
            })()}
          </div>

          <div style={{ fontSize: 'clamp(18px, 5vw, 22px)', fontWeight: 700 }}>
            <span style={{ color: '#6b8aad' }}>{scores[TEAM_A]}</span>
            <span style={{ color: 'rgba(255,255,255,0.1)', margin: '0 8px', fontSize: '0.7em' }}>/</span>
            <span style={{ color: '#ad6b6b' }}>{scores[TEAM_B]}</span>
          </div>

          <div style={{ fontSize: 'clamp(8px, 2vw, 10px)', color: 'rgba(255,255,255,0.2)' }}>
            {handNumber} hands played
          </div>

          {isOnline && (
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>
              {rematchState.p1 && mySeat !== SOUTH && 'Opponent wants rematch'}
              {rematchState.p2 && mySeat !== WEST && 'Opponent wants rematch'}
              {((mySeat === SOUTH && rematchState.p1) || (mySeat === WEST && rematchState.p2)) && 'Waiting for opponent...'}
            </div>
          )}

          <div style={{ display: 'flex', gap: 'clamp(6px, 2vw, 12px)' }}>
            <button className="btn" onClick={() => {
              if (navigator.vibrate) navigator.vibrate(10);
              playAgain();
            }}
              style={{ color: '#c8aa50', borderColor: 'rgba(200,170,80,0.3)' }}>
              {isOnline ? 'REMATCH' : 'PLAY AGAIN'}
            </button>
            <button className="btn btn-sm" onClick={goToLobby}
              style={{ color: 'rgba(255,255,255,0.25)', borderColor: 'rgba(255,255,255,0.06)' }}>
              MENU
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
