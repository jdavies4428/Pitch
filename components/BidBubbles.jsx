"use client";
import React from "react";
import { SOUTH, WEST, NORTH, EAST } from "@/lib/game";
import { COLORS, Z } from "@/lib/constants";

const BUBBLE_POSITIONS = {
  [SOUTH]: { top: '72%', left: '50%' },
  [NORTH]: { top: '28%', left: '50%' },
  [WEST]:  { top: '42%', left: '20%' },
  [EAST]:  { top: '42%', left: '80%' },
};

const DISPLAY_POSITIONS = [SOUTH, WEST, NORTH, EAST];

function BidBubbles({ bidBubbles, getSeatInfo }) {
  return DISPLAY_POSITIONS.map(dp => {
    const { svrSeat } = getSeatInfo(dp);
    const bubble = bidBubbles[svrSeat];
    if (!bubble) return null;
    const pos = BUBBLE_POSITIONS[dp];
    const isBid = bubble !== 'PASS';
    return (
      <div key={`bid-bubble-${dp}`} style={{
        position: 'absolute',
        ...pos,
        zIndex: Z.bubbles,
        animation: 'bidPop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        pointerEvents: 'none',
      }}>
        <div style={{
          padding: 'clamp(8px, 2vw, 12px) clamp(16px, 4vw, 24px)',
          borderRadius: 14,
          background: isBid ? 'rgba(200,170,80,0.15)' : 'rgba(0,0,0,0.3)',
          border: isBid ? `1.5px solid rgba(200,170,80,0.4)` : `1px solid ${COLORS.glassBorderFaint}`,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: isBid
            ? '0 4px 20px rgba(200,170,80,0.2), 0 0 40px rgba(200,170,80,0.08)'
            : '0 4px 12px rgba(0,0,0,0.3)',
        }}>
          <div style={{
            fontSize: isBid ? 'clamp(16px, 4.5vw, 22px)' : 'clamp(13px, 3.5vw, 16px)',
            fontWeight: 700,
            color: isBid ? COLORS.gold : COLORS.textLabel,
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
}

export default React.memo(BidBubbles);
