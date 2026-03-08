"use client";

import { TEAM_A, TEAM_B, SUIT_SYMBOLS, isRedSuit } from "@/lib/game";

const PHASE_LABELS = {
  cutForDeal: "CUT",
  dealing: "DEAL",
  bidding: "BID",
  pitching: "TRUMP",
  trickPlay: "PLAY",
  trickCollect: "TRICK",
  handOver: "SCORE",
  gameOver: "FINAL",
  idle: "TABLE",
};

function RailChip({ label, value, accent, mono = false, large = false }) {
  return (
    <div
      style={{
        minWidth: "clamp(48px, 12vw, 64px)",
        padding: "clamp(5px, 1.2vw, 7px) clamp(8px, 2vw, 10px)",
        borderRadius: 14,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
      }}
    >
      <span
        style={{
          fontSize: "clamp(7px, 1.9vw, 8px)",
          color: "rgba(255,255,255,0.26)",
          fontWeight: 700,
          letterSpacing: 1.6,
          lineHeight: 1,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: large ? "clamp(18px, 4.8vw, 24px)" : "clamp(10px, 2.6vw, 12px)",
          color: accent || "rgba(255,255,255,0.86)",
          fontWeight: 700,
          lineHeight: 1,
          letterSpacing: mono ? 2.2 : 0.6,
          fontFamily: mono ? "ui-monospace, SFMono-Regular, Menlo, monospace" : "inherit",
        }}
      >
        {value}
      </span>
    </div>
  );
}

export default function ScoreBoard({
  scores,
  bidInfo,
  trickNumber,
  handNumber,
  phase,
  roomCode,
  trumpSuit,
  onExit,
}) {
  const trumpAccent = trumpSuit ? (isRedSuit(trumpSuit) ? "#d16f6f" : "#f0f0f0") : "#c8aa50";
  const statusValue = trumpSuit ? SUIT_SYMBOLS[trumpSuit] : (PHASE_LABELS[phase] || "TABLE");

  return (
    <div
      style={{
        position: "absolute",
        top: "max(8px, env(safe-area-inset-top, 0px))",
        left: 8,
        right: 8,
        zIndex: 26,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto minmax(0, 1fr) auto",
          alignItems: "center",
          gap: "clamp(8px, 2vw, 14px)",
          padding: "clamp(6px, 1.5vw, 10px)",
          borderRadius: 22,
          background: "rgba(4,10,7,0.48)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.28)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        <button
          type="button"
          aria-label="Leave game"
          onClick={onExit}
          style={{
            width: "clamp(34px, 9vw, 40px)",
            height: "clamp(34px, 9vw, 40px)",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.03)",
            color: "rgba(255,255,255,0.42)",
            fontSize: "clamp(14px, 3.5vw, 16px)",
            lineHeight: 1,
            cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          ✕
        </button>

        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "center",
              gap: "clamp(6px, 2vw, 10px)",
              minWidth: 0,
            }}
          >
            <span
              style={{
                color: "#6b8aad",
                fontSize: "clamp(9px, 2.3vw, 10px)",
                fontWeight: 700,
                letterSpacing: 1.8,
                flexShrink: 0,
              }}
            >
              US
            </span>
            <span style={{ color: "rgba(255,255,255,0.92)", fontSize: "clamp(18px, 4.8vw, 24px)", fontWeight: 700 }}>
              {scores[TEAM_A]}
            </span>
            <span style={{ color: "rgba(255,255,255,0.14)", fontSize: "clamp(10px, 2.4vw, 12px)" }}>:</span>
            <span style={{ color: "rgba(255,255,255,0.92)", fontSize: "clamp(18px, 4.8vw, 24px)", fontWeight: 700 }}>
              {scores[TEAM_B]}
            </span>
            <span
              style={{
                color: "#ad6b6b",
                fontSize: "clamp(9px, 2.3vw, 10px)",
                fontWeight: 700,
                letterSpacing: 1.8,
                flexShrink: 0,
              }}
            >
              THEM
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "clamp(8px, 2vw, 12px)",
              flexWrap: "wrap",
              minWidth: 0,
            }}
          >
            <span
              style={{
                fontSize: "clamp(8px, 2vw, 9px)",
                color: "rgba(255,255,255,0.22)",
                fontWeight: 700,
                letterSpacing: 1.5,
              }}
            >
              HAND {handNumber}
            </span>
            {bidInfo && (
              <span
                style={{
                  fontSize: "clamp(8px, 2vw, 9px)",
                  color: bidInfo.team === TEAM_A ? "#6b8aad" : "#ad6b6b",
                  fontWeight: 700,
                  letterSpacing: 1.5,
                }}
              >
                BID {bidInfo.amount}
              </span>
            )}
            <span
              style={{
                fontSize: "clamp(8px, 2vw, 9px)",
                color: "rgba(255,255,255,0.22)",
                fontWeight: 700,
                letterSpacing: 1.5,
              }}
            >
              T{Math.min(trickNumber, 6)}/6
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "stretch", gap: 6 }}>
          {roomCode && <RailChip label="ROOM" value={roomCode} mono />}
          <RailChip
            label={trumpSuit ? "TRUMP" : "STATE"}
            value={statusValue}
            accent={trumpAccent}
            large={!!trumpSuit}
          />
        </div>
      </div>
    </div>
  );
}
