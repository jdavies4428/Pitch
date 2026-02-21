"use client";
import React from "react";
import { COLORS } from "@/lib/constants";

function SeatLabel({ name, isActive, isDealer, isLeading }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      whiteSpace: 'nowrap',
      padding: isActive ? '3px 10px' : '3px 6px',
      borderRadius: 12,
      background: isActive ? COLORS.goldText : 'transparent',
      border: isActive ? `1px solid ${COLORS.goldBorder}` : '1px solid transparent',
      transition: 'all 0.3s',
    }}>
      {isActive && (
        <div style={{
          width: 5, height: 5, borderRadius: '50%',
          background: COLORS.gold,
          boxShadow: '0 0 6px rgba(200,170,80,0.5)',
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      )}
      <span style={{
        fontSize: 'clamp(10px, 2.8vw, 12px)', fontWeight: 700,
        color: isActive ? COLORS.gold : COLORS.textMuted,
        letterSpacing: 1.5, textTransform: 'uppercase',
        transition: 'color 0.3s',
      }}>{name}</span>
      {isDealer && (
        <span style={{
          fontSize: 'clamp(10px, 2.8vw, 12px)', fontWeight: 800,
          color: '#1a1a1a',
          background: `linear-gradient(135deg, ${COLORS.goldLight}, ${COLORS.gold})`,
          width: 'clamp(22px, 6vw, 28px)', height: 'clamp(22px, 6vw, 28px)',
          borderRadius: '50%',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 6px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.3), 0 0 10px rgba(200,170,80,0.2)',
          letterSpacing: 0, lineHeight: 1, flexShrink: 0,
        }}>D</span>
      )}
      {isLeading && (
        <span style={{
          fontSize: 'clamp(8px, 2vw, 9px)', fontWeight: 700,
          color: COLORS.gold,
          letterSpacing: 1,
          background: 'rgba(200,170,80,0.15)',
          padding: '1px 5px',
          borderRadius: 4,
        }}>LEADS</span>
      )}
    </div>
  );
}

export default React.memo(SeatLabel);
