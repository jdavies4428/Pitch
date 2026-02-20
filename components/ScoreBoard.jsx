"use client";
import { TEAM_A, TEAM_B } from '@/lib/game';

export default function ScoreBoard({
  scores, bidInfo, trickNumber, handNumber, wasSet,
}) {
  return (
    <div style={{
      position: 'absolute',
      top: 'max(8px, env(safe-area-inset-top, 0px))',
      left: '50%', transform: 'translateX(-50%)',
      display: 'flex', alignItems: 'center',
      gap: 'clamp(10px, 3vw, 16px)',
      background: 'rgba(0,0,0,0.3)',
      borderRadius: 20,
      padding: 'clamp(5px, 1.2vw, 7px) clamp(14px, 4vw, 22px)',
      zIndex: 20,
      fontWeight: 500,
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      maxWidth: 'calc(100vw - 16px)',
      whiteSpace: 'nowrap',
    }}>
      {/* Scores */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: '#6b8aad', fontSize: 'clamp(9px, 2.5vw, 11px)', fontWeight: 700, letterSpacing: 1 }}>US</span>
        <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 'clamp(16px, 4.5vw, 20px)', fontWeight: 700 }}>{scores[TEAM_A]}</span>
        <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 'clamp(10px, 2.5vw, 12px)' }}>:</span>
        <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 'clamp(16px, 4.5vw, 20px)', fontWeight: 700 }}>{scores[TEAM_B]}</span>
        <span style={{ color: '#ad6b6b', fontSize: 'clamp(9px, 2.5vw, 11px)', fontWeight: 700, letterSpacing: 1 }}>THEM</span>
      </div>

      {/* Divider */}
      {bidInfo && (
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.08)' }} />
      )}

      {/* Bid + Trick info */}
      {bidInfo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(6px, 2vw, 10px)', fontSize: 'clamp(9px, 2.5vw, 11px)' }}>
          <span style={{
            color: bidInfo.team === TEAM_A ? '#6b8aad' : '#ad6b6b',
            fontWeight: 600,
          }}>
            BID {bidInfo.amount}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.2)' }}>
            T{trickNumber}/6
          </span>
        </div>
      )}
    </div>
  );
}
