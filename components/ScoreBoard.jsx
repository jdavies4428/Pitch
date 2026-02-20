"use client";
import { TEAM_A, TEAM_B, SUIT_SYMBOLS } from '@/lib/game';

export default function ScoreBoard({
  scores, bidInfo, trumpSuit, trickNumber, handNumber, wasSet,
}) {
  return (
    <div style={{
      position: 'absolute',
      top: 'max(8px, env(safe-area-inset-top, 0px))',
      left: '50%', transform: 'translateX(-50%)',
      display: 'flex', alignItems: 'center',
      gap: 14,
      background: 'rgba(0,0,0,0.25)',
      borderRadius: 20,
      padding: '5px 18px',
      zIndex: 20,
      fontSize: 12,
      fontWeight: 500,
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      maxWidth: 'calc(100vw - 16px)',
    }}>
      {/* Scores */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: 600, letterSpacing: 1 }}>US</span>
        <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 16, fontWeight: 700 }}>{scores[TEAM_A]}</span>
        <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 10 }}>:</span>
        <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 16, fontWeight: 700 }}>{scores[TEAM_B]}</span>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: 600, letterSpacing: 1 }}>THEM</span>
      </div>

      {/* Meta */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
        {bidInfo && (
          <span>
            B{bidInfo.amount}
            <span style={{ color: 'rgba(255,255,255,0.5)', marginLeft: 3 }}>
              {bidInfo.team === TEAM_A ? 'US' : 'THEM'}
            </span>
          </span>
        )}
        {trumpSuit && (
          <span style={{ color: '#c8aa50', fontSize: 13 }}>{SUIT_SYMBOLS[trumpSuit]}</span>
        )}
        <span>{trickNumber}/6</span>
      </div>
    </div>
  );
}
