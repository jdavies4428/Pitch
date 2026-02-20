"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  SOUTH, WEST, NORTH, EAST, TEAM_A, TEAM_B,
  getTeam, SUITS, SUIT_SYMBOLS, WIN_SCORE, SEAT_NAMES,
  dealHands, getValidBids, getPlayableCards, evaluateTrick,
  scoreHand, updateScores, nextDealer, cardEquals, cardId,
  getLivePoints, cardDisplay, createDeck, shuffleDeck,
} from "@/lib/game";
import { getAiBid, getAiPlay, getAiTrumpCard } from "@/lib/ai";
import { sounds } from "@/lib/sounds";
import Hand from "./Hand";
import TrickArea from "./TrickArea";
import ScoreBoard from "./ScoreBoard";
import Confetti from "./Confetti";

const AI_DELAY = 700;
const TRICK_PAUSE = 1400;

const DIFF_LABELS = { easy: "ROOKIE", medium: "STANDARD", hard: "SHARK" };
const DIFF_COLORS = { easy: "#7a9b8a", medium: "#6b8aad", hard: "#ad6b6b" };
const DIFF_DESC = {
  easy: "Still learning the ropes",
  medium: "Knows when to hold 'em",
  hard: "Reads you like a book",
};

// Player info
const PLAYER_INFO = {
  [SOUTH]: { name: 'YOU',   initial: 'Y', color: '#6b8aad' },
  [NORTH]: { name: 'ACE',   initial: 'A', color: '#6b8aad' },
  [WEST]:  { name: 'SPIKE', initial: 'S', color: '#ad6b6b' },
  [EAST]:  { name: 'BLITZ', initial: 'B', color: '#ad6b6b' },
};

export default function Game() {
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
  const [bidBubbles, setBidBubbles] = useState({}); // { [seat]: "BID 3" | "PASS" }

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

  // ── Audio init ──
  const initAudio = useCallback(async () => {
    if (!audioReady) {
      await sounds.init();
      setAudioReady(true);
    }
  }, [audioReady]);

  // ── Cleanup ──
  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  // ── Go to lobby ──
  const goToLobby = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setScreen("lobby");
    setPhase("idle");
    setScores({ [TEAM_A]: 0, [TEAM_B]: 0 });
    setHandNumber(1);
    setDealer(EAST);
    setGameWinner(null);
    setShowConfetti(false);
  }, []);

  // ── Start game ──
  const startGame = useCallback((diff) => {
    setDifficulty(diff);
    setScores({ [TEAM_A]: 0, [TEAM_B]: 0 });
    setHandNumber(1);
    setGameWinner(null);
    setHands([[], [], [], []]);
    setScreen("playing");
    setPhase("cutForDeal");
  }, []);

  // ── CUT FOR DEAL ──
  useEffect(() => {
    if (phase !== "cutForDeal") return;

    const deck = shuffleDeck(createDeck());
    const order = [SOUTH, WEST, NORTH, EAST];
    const cards = order.map((seat, i) => ({ player: seat, card: deck[i] }));

    // Determine winner upfront (highest rank, suit tiebreak: S>H>D>C)
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

    // Deal one card at a time
    cards.forEach((c, i) => {
      timeouts.push(setTimeout(() => {
        setCutCards(prev => [...prev, c]);
        sounds.cardPlay();
      }, 600 + i * 450));
    });

    // Highlight winner
    timeouts.push(setTimeout(() => {
      setCutWinner(winner.player);
      setStatusMsg(`${PLAYER_INFO[winner.player].name} deals first`);
      sounds.trickWon();
    }, 600 + 4 * 450 + 400));

    // Transition to dealing
    timeouts.push(setTimeout(() => {
      setDealer(winner.player);
      setCutCards([]);
      setCutWinner(null);
      setPhase("dealing");
    }, 600 + 4 * 450 + 400 + 2000));

    return () => timeouts.forEach(t => clearTimeout(t));
  }, [phase]);

  // ── DEALING ──
  useEffect(() => {
    if (screen !== "playing" || phase !== "dealing") return;

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
  }, [screen, phase, dealer]);

  // ── BIDDING (AI) ──
  useEffect(() => {
    if (phase !== "bidding" || currentBidder === null || currentBidder === SOUTH) return;
    if (bids.length >= 4) return; // Guard: bidding already complete

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
        // Bidding complete — transition to pitching phase (no nested timeout)
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
    }, AI_DELAY);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [phase, currentBidder, bids, highBid, dealer, difficulty, hands]);

  // ── AI PITCHING (bid winner sets trump) ──
  useEffect(() => {
    if (phase !== "pitching" || currentPlayer === null || currentPlayer === SOUTH) return;

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
  }, [phase, currentPlayer, hands, difficulty]);

  // ── TRICK PLAY (AI) ──
  useEffect(() => {
    if (phase !== "trickPlay" || currentPlayer === null || currentPlayer === SOUTH) return;
    if (trickPlays.length >= 4) return;

    timerRef.current = setTimeout(() => {
      const ledSuit = trickPlays.length > 0 ? trickPlays[0].card.suit : null;
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
  }, [phase, currentPlayer, trickPlays, trumpSuit, capturedTricks, difficulty, hands]);

  // ── TRICK COLLECT ──
  useEffect(() => {
    if (phase !== "trickCollect") return;
    if (trickPlays.length < 4) return; // Guard: already collected

    const winner = evaluateTrick(trickPlays, trumpSuit);
    setTrickWinner(winner);
    const winTeam = getTeam(winner);
    setStatusMsg(`${SEAT_NAMES[winner]} wins the trick!`);
    sounds.trickWon();

    timerRef.current = setTimeout(() => {
      const completedTrick = { winner, cards: [...trickPlays] };
      const newCaptured = [...capturedTricks, completedTrick];
      setCapturedTricks(newCaptured);
      setTrickPlays([]);
      setTrickWinner(null);

      if (trickNumber >= 6) {
        // Hand complete
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
  }, [phase, trickPlays, trumpSuit, trickNumber, capturedTricks, originalHands, scores, biddingTeam, bidAmount]);

  // ── Human: make bid ──
  const makeBid = useCallback((amount) => {
    initAudio();
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
  }, [bids, highBid, hands, difficulty, initAudio]);

  // ── Human: play card ──
  const playCard = useCallback((card) => {
    initAudio();
    sounds.cardPlay();

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
  }, [phase, trickPlays, initAudio]);

  // ── Next hand ──
  const nextHand = useCallback(() => {
    setDealer(prev => nextDealer(prev));
    setHandNumber(prev => prev + 1);
    setPhase("dealing");
    setScreen("playing");
  }, []);

  // ── Play again ──
  const playAgain = useCallback(() => {
    setScores({ [TEAM_A]: 0, [TEAM_B]: 0 });
    setHandNumber(1);
    setGameWinner(null);
    setShowConfetti(false);
    setHands([[], [], [], []]);
    setPhase("cutForDeal");
    setScreen("playing");
  }, []);

  // ── Derived state ──
  const ledSuit = trickPlays.length > 0 ? trickPlays[0].card.suit : null;
  const playableCards = (phase === "trickPlay" && currentPlayer === SOUTH)
    ? getPlayableCards(hands[SOUTH], trumpSuit, ledSuit)
    : (phase === "pitching" && currentPlayer === SOUTH)
      ? [...hands[SOUTH]]
      : [];

  const validBids = (phase === "bidding" && currentBidder === SOUTH)
    ? getValidBids(
        highBid.amount,
        dealer === SOUTH,
        bids.length === 3 && bids.every(b => b.bid === 0)
      )
    : [];

  // ── Derived UI state ──
  const isHumanTurn = (phase === 'trickPlay' || phase === 'pitching') && currentPlayer === SOUTH;
  const mustFollow = isHumanTurn && ledSuit && ledSuit !== trumpSuit &&
    playableCards.length < hands[SOUTH].length;
  const livePoints = getLivePoints(originalHands, capturedTricks, trumpSuit);

  const getDimLevel = (seat) => {
    if (!isHumanTurn) return 'primary';
    return seat === SOUTH ? 'primary' : 'background';
  };

  // Is this player leading the current trick?
  const isLeading = (seat) => {
    return (phase === 'trickPlay' && currentPlayer === seat && trickPlays.length === 0) ||
      (phase === 'pitching' && currentPlayer === seat);
  };

  // ── Seat label renderer — glowing pill when active ──
  const renderSeatLabel = (seat) => {
    const info = PLAYER_INFO[seat];
    const isActive = (phase === 'trickPlay' && currentPlayer === seat) ||
      (phase === 'pitching' && currentPlayer === seat) ||
      (phase === 'bidding' && currentBidder === seat);
    const leading = isLeading(seat);
    const isD = dealer === seat;
    const bubble = bidBubbles[seat];
    const teamColor = getTeam(seat) === TEAM_A ? '#6b8aad' : '#ad6b6b';

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
        {/* Active dot */}
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
        }}>{info.name}</span>
        {isD && (
          <span style={{
            fontSize: 'clamp(8px, 2vw, 9px)', fontWeight: 800,
            color: '#1a1a1a',
            background: 'linear-gradient(135deg, #e8c840, #c8aa50)',
            width: 'clamp(16px, 4vw, 20px)', height: 'clamp(16px, 4vw, 20px)',
            borderRadius: '50%',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 1px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3)',
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
        {bubble && (
          <span style={{
            fontSize: 'clamp(8px, 2.2vw, 10px)', fontWeight: 600,
            color: bubble === 'PASS' ? 'rgba(255,255,255,0.2)' : '#c8aa50',
            letterSpacing: 0.5,
          }}>{bubble}</span>
        )}
      </div>
    );
  };

  // ── Point tracker row renderer ──
  const renderPointRow = (label, team, card) => (
    <div>
      <span style={{ color: 'rgba(255,255,255,0.3)' }}>{label}: </span>
      {team !== null ? (
        <>
          <span style={{ color: team === TEAM_A ? '#6b8aad' : '#ad6b6b' }}>
            {team === TEAM_A ? 'US' : 'THEM'}
          </span>
          {card && (
            <span style={{ color: 'rgba(255,255,255,0.2)', marginLeft: 3 }}>{cardDisplay(card)}</span>
          )}
        </>
      ) : (
        <span style={{ color: 'rgba(255,255,255,0.15)' }}>?</span>
      )}
    </div>
  );

  // ═══════════════════════════════════════
  // ── RENDER ──
  // ═══════════════════════════════════════

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden no-select room-bg"
      style={{ height: '100dvh' }}
      onClick={initAudio}>

      {/* Scanlines */}
      <div className="scanlines" />

      {/* Confetti */}
      {showConfetti && <Confetti />}

      {/* ── LOBBY ── */}
      {screen === "lobby" && (
        <div className="flex flex-col items-center w-full px-4"
          style={{ maxWidth: 'min(340px, calc(100vw - 32px))' }}>
          <div className="w-full rounded-2xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                     boxShadow: '0 20px 60px rgba(0,0,0,0.5)', backdropFilter: 'blur(20px)',
                     WebkitBackdropFilter: 'blur(20px)' }}>
            {/* Accent line */}
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

              {/* Minimal suit icons */}
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

              <button className="btn w-full" onClick={() => setScreen("difficulty")}
                style={{ color: '#c8aa50', borderColor: 'rgba(200,170,80,0.3)' }}>
                PLAY
              </button>

              <button className="btn btn-sm w-full" onClick={() => setScreen("howToPlay")}
                style={{ color: 'rgba(255,255,255,0.35)', borderColor: 'rgba(255,255,255,0.08)' }}>
                HOW TO PLAY
              </button>

              <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: 'rgba(255,255,255,0.15)', textAlign: 'center', lineHeight: 1.6 }}>
                BID. PITCH TRUMP. TAKE TRICKS.<br />
                FIRST TEAM TO {WIN_SCORE} WINS.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DIFFICULTY ── */}
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

            {/* Steps */}
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
          {/* Vignette — edge darkening */}
          <div className="vignette" />

          {/* Overhead light — warm glow from above */}
          <div style={{
            position: 'fixed', top: '-10%', left: '50%', transform: 'translateX(-50%)',
            width: '60%', height: '40%',
            background: 'radial-gradient(ellipse, rgba(255,230,180,0.03) 0%, transparent 65%)',
            pointerEvents: 'none', zIndex: 1,
          }} />

          {/* Full-screen game area — the table IS the screen */}
          <div style={{
            position: 'relative',
            width: '100%', height: '100%',
            maxWidth: 960, margin: '0 auto',
          }}>
            {/* Scoreboard — minimal, top center */}
            <ScoreBoard
              scores={scores}
              bidInfo={bidAmount > 0 ? { amount: bidAmount, team: biddingTeam } : null}
              trumpSuit={trumpSuit}
              trickNumber={trickNumber}
              handNumber={handNumber}
              wasSet={wasSet}
            />

            {/* ── NORTH ── */}
            <div style={{
              position: 'absolute',
              top: trumpSuit ? 'clamp(76px, 18vw, 100px)' : 'clamp(38px, 9vw, 52px)',
              left: '50%', transform: 'translateX(-50%)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 4, zIndex: 10,
            }}>
              {renderSeatLabel(NORTH)}
              <Hand cards={hands[NORTH]} position="north" faceDown
                isCurrentTurn={currentPlayer === NORTH && phase === 'trickPlay'}
                dimLevel={getDimLevel(NORTH)} backColor="blue" />
            </div>

            {/* ── WEST ── */}
            <div style={{
              position: 'absolute',
              left: 'clamp(12px, 3vw, 28px)',
              top: '42%', transform: 'translateY(-50%)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 4, zIndex: 10,
            }}>
              {renderSeatLabel(WEST)}
              <Hand cards={hands[WEST]} position="west" faceDown
                isCurrentTurn={currentPlayer === WEST && phase === 'trickPlay'}
                dimLevel={getDimLevel(WEST)} backColor="red" />
            </div>

            {/* ── EAST ── */}
            <div style={{
              position: 'absolute',
              right: 'clamp(12px, 3vw, 28px)',
              top: '42%', transform: 'translateY(-50%)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 4, zIndex: 10,
            }}>
              {renderSeatLabel(EAST)}
              <Hand cards={hands[EAST]} position="east" faceDown
                isCurrentTurn={currentPlayer === EAST && phase === 'trickPlay'}
                dimLevel={getDimLevel(EAST)} backColor="red" />
            </div>

            {/* ── TRUMP INDICATOR — large, prominent, above table ── */}
            {trumpSuit && (
              <div style={{
                position: 'absolute',
                top: 'clamp(40px, 10vw, 56px)',
                left: '50%', transform: 'translateX(-50%)',
                display: 'flex', alignItems: 'center', gap: 8,
                zIndex: 20,
              }}>
                <span style={{
                  fontSize: 'clamp(28px, 8vw, 42px)',
                  color: '#c8aa50',
                  filter: 'drop-shadow(0 2px 8px rgba(200,170,80,0.3))',
                  lineHeight: 1,
                }}>{SUIT_SYMBOLS[trumpSuit]}</span>
              </div>
            )}

            {/* ── TRICK AREA / CUT FOR DEAL ── */}
            <TrickArea
              trickPlays={phase === 'cutForDeal' ? cutCards : trickPlays}
              trickWinner={phase === 'cutForDeal' ? cutWinner : trickWinner}
            />

            {/* Cut for deal label — fixed near top, prominent when winner found */}
            {phase === 'cutForDeal' && (
              <div style={{
                position: 'absolute',
                top: 'clamp(40px, 10vw, 60px)',
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
                  {statusMsg}
                </div>
                {cutWinner && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <span style={{
                      fontSize: 'clamp(8px, 2vw, 9px)', fontWeight: 800,
                      color: '#1a1a1a',
                      background: 'linear-gradient(135deg, #e8c840, #c8aa50)',
                      width: 'clamp(20px, 5vw, 26px)', height: 'clamp(20px, 5vw, 26px)',
                      borderRadius: '50%',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3)',
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

            {/* ── LIVE POINT TRACKER ── */}
            {trumpSuit && livePoints && (
              <div className="point-tracker" style={{
                position: 'absolute',
                right: 'clamp(12px, 3vw, 24px)',
                bottom: 'clamp(110px, 28vw, 150px)',
                zIndex: 15,
                display: 'flex', flexDirection: 'column', gap: 1,
                lineHeight: 1.5,
              }}>
                {renderPointRow('H', livePoints.high, livePoints.highCard)}
                {renderPointRow('L', livePoints.low, livePoints.lowCard)}
                <div>
                  <span style={{ color: 'rgba(255,255,255,0.3)' }}>J: </span>
                  {livePoints.jackExists
                    ? (livePoints.jack !== null
                      ? <span style={{ color: livePoints.jack === TEAM_A ? '#6b8aad' : '#ad6b6b' }}>
                          {livePoints.jack === TEAM_A ? 'US' : 'THEM'}
                        </span>
                      : <span style={{ color: 'rgba(255,255,255,0.15)' }}>?</span>)
                    : <span style={{ color: 'rgba(255,255,255,0.08)' }}>&mdash;</span>
                  }
                </div>
                <div>
                  <span style={{ color: 'rgba(255,255,255,0.3)' }}>G: </span>
                  <span style={{ color: '#6b8aad' }}>{livePoints.gameA}</span>
                  <span style={{ color: 'rgba(255,255,255,0.1)' }}>{' - '}</span>
                  <span style={{ color: '#ad6b6b' }}>{livePoints.gameB}</span>
                </div>
              </div>
            )}

            {/* ── SOUTH AREA ── */}
            <div style={{
              position: 'absolute',
              bottom: 0, left: 0, right: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              zIndex: 10,
              paddingBottom: 'max(6px, env(safe-area-inset-bottom, 0px))',
            }}>
              {/* Follow-suit / turn status badge */}
              {isHumanTurn && phase === 'trickPlay' && (
                mustFollow ? (
                  <div className="status-bar status-bar--follow" style={{ marginBottom: 6 }}>
                    <span>{SUIT_SYMBOLS[ledSuit]}</span>
                    <span>MUST FOLLOW SUIT</span>
                  </div>
                ) : (
                  <div className="status-bar status-bar--turn" style={{ marginBottom: 6 }}>
                    {trickPlays.length === 0 ? 'YOUR LEAD' : 'YOUR TURN'}
                  </div>
                )
              )}

              {/* Pitching prompt */}
              {phase === 'pitching' && currentPlayer === SOUTH && (
                <div className="status-bar status-bar--follow" style={{ marginBottom: 6 }}>
                  PICK YOUR TRUMP &mdash; PLAY A CARD
                </div>
              )}

              {/* Bid buttons */}
              {phase === 'bidding' && currentBidder === SOUTH && (
                <div style={{
                  display: 'flex', gap: 'clamp(6px, 2vw, 10px)',
                  flexWrap: 'wrap', justifyContent: 'center',
                  maxWidth: 'calc(100vw - 24px)',
                  marginBottom: 6,
                }}>
                  {validBids.map(b => (
                    <button key={b} className="btn btn-sm" onClick={() => {
                      if (navigator.vibrate) navigator.vibrate(10);
                      makeBid(b);
                    }}
                      style={{
                        color: b === 0 ? 'rgba(255,255,255,0.3)' : '#c8aa50',
                        borderColor: b === 0 ? 'rgba(255,255,255,0.1)' : 'rgba(200,170,80,0.3)',
                        background: 'rgba(0,0,0,0.2)',
                      }}>
                      {b === 0 ? 'PASS' : `BID ${b}`}
                    </button>
                  ))}
                </div>
              )}

              {/* South hand */}
              <Hand cards={hands[SOUTH]} position="south"
                playableCards={playableCards}
                onCardClick={playCard}
                isCurrentTurn={isHumanTurn}
                dimLevel="primary" />

              {/* South label */}
              <div style={{ marginTop: 3 }}>
                {renderSeatLabel(SOUTH)}
              </div>

              {/* Status message */}
              {!isHumanTurn && statusMsg && (
                <div style={{
                  fontSize: 'clamp(9px, 2.5vw, 11px)', color: 'rgba(255,255,255,0.25)',
                  marginTop: 2, whiteSpace: 'nowrap',
                }}>
                  {statusMsg}
                </div>
              )}
            </div>

            {/* Turn glow */}
            {isHumanTurn && <div className="turn-glow" />}
          </div>
        </>
      )}

      {/* ── HAND OVER ── */}
      {screen === "handOver" && (
        <div className="flex flex-col items-center px-4"
          style={{ gap: 'clamp(12px, 3vw, 20px)', maxWidth: 'min(300px, calc(100vw - 32px))' }}>
          <div style={{ fontSize: 'clamp(9px, 2.5vw, 10px)', color: 'rgba(255,255,255,0.25)', letterSpacing: 3, fontWeight: 500 }}>
            HAND {handNumber} RESULTS
          </div>

          {/* Points breakdown */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: 'clamp(4px, 1.5vw, 8px)', width: '100%',
          }}>
            {['high', 'low', 'jack', 'game'].map(pt => {
              const winner = handResult?.[pt];
              return (
                <div key={pt} style={{
                  padding: 'clamp(6px, 1.5vw, 10px) clamp(8px, 2vw, 14px)',
                  borderRadius: 8, background: 'rgba(255,255,255,0.02)',
                  border: `1px solid ${winner === TEAM_A ? 'rgba(107,138,173,0.2)' : winner === TEAM_B ? 'rgba(173,107,107,0.2)' : 'rgba(255,255,255,0.04)'}`,
                }}>
                  <div style={{ fontSize: 'clamp(8px, 2vw, 9px)', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: 1 }}>{pt}</div>
                  <div style={{
                    fontSize: 'clamp(11px, 3vw, 14px)', fontWeight: 600, marginTop: 2,
                    color: winner === TEAM_A ? '#6b8aad' : winner === TEAM_B ? '#ad6b6b' : 'rgba(255,255,255,0.1)',
                  }}>
                    {winner === TEAM_A ? 'US' : winner === TEAM_B ? 'THEM' : '--'}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Set back alert */}
          {wasSet && (
            <div style={{
              color: '#ad6b6b', fontSize: 'clamp(10px, 2.8vw, 12px)', fontWeight: 500,
            }}>
              {biddingTeam === TEAM_A ? 'WE WERE' : 'THEY WERE'} SET BACK! (-{bidAmount})
            </div>
          )}

          {/* Scores */}
          <div style={{ fontSize: 'clamp(18px, 5vw, 22px)', fontWeight: 700 }}>
            <span style={{ color: '#6b8aad' }}>{scores[TEAM_A]}</span>
            <span style={{ color: 'rgba(255,255,255,0.1)', margin: '0 8px', fontSize: '0.7em' }}>/</span>
            <span style={{ color: '#ad6b6b' }}>{scores[TEAM_B]}</span>
          </div>

          <button className="btn" onClick={() => {
            if (navigator.vibrate) navigator.vibrate(10);
            nextHand();
          }}
            style={{ color: '#c8aa50', borderColor: 'rgba(200,170,80,0.3)' }}>
            NEXT HAND
          </button>
        </div>
      )}

      {/* ── GAME OVER ── */}
      {screen === "gameOver" && (
        <div className="flex flex-col items-center px-4"
          style={{ gap: 'clamp(12px, 3vw, 20px)' }}>
          <div style={{
            fontSize: 'clamp(22px, 7vw, 28px)', fontWeight: 700,
            color: gameWinner === TEAM_A ? '#7a9b8a' : '#ad6b6b',
            letterSpacing: 2,
          }}>
            {gameWinner === TEAM_A ? 'YOU WIN' : 'YOU LOSE'}
          </div>

          <div style={{ fontSize: 'clamp(18px, 5vw, 22px)', fontWeight: 700 }}>
            <span style={{ color: '#6b8aad' }}>{scores[TEAM_A]}</span>
            <span style={{ color: 'rgba(255,255,255,0.1)', margin: '0 8px', fontSize: '0.7em' }}>/</span>
            <span style={{ color: '#ad6b6b' }}>{scores[TEAM_B]}</span>
          </div>

          <div style={{ fontSize: 'clamp(8px, 2vw, 10px)', color: 'rgba(255,255,255,0.2)' }}>
            {handNumber} hands played
          </div>

          <div style={{ display: 'flex', gap: 'clamp(6px, 2vw, 12px)' }}>
            <button className="btn" onClick={() => {
              if (navigator.vibrate) navigator.vibrate(10);
              playAgain();
            }}
              style={{ color: '#c8aa50', borderColor: 'rgba(200,170,80,0.3)' }}>
              PLAY AGAIN
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
