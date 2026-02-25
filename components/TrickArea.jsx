"use client";
import Card from './Card';
import { SOUTH, WEST, NORTH, EAST } from '@/lib/game';

// Responsive offsets — tighter on mobile, spacious on desktop
const OFFSETS = {
  [SOUTH]: { top: 'clamp(38px, 10vw, 72px)', left: '0px' },
  [WEST]:  { top: '0px', left: 'clamp(-48px, -12vw, -96px)' },
  [NORTH]: { top: 'clamp(-38px, -10vw, -72px)', left: '0px' },
  [EAST]:  { top: '0px', left: 'clamp(48px, 12vw, 96px)' },
};

export default function TrickArea({ trickPlays, trickWinner, playerNames = {}, isCutForDeal = false }) {
  return (
    <div style={{
      position: 'absolute',
      top: '50%', left: '50%',
      transform: 'translate(-50%, -54%)',
      width: 'clamp(180px, 48vw, 370px)',
      height: 'clamp(160px, 42vw, 310px)',
    }}>
      {/* Played cards */}
      {trickPlays.map((play, idx) => {
        const off = OFFSETS[play.player];
        const isWinner = trickWinner === play.player;
        const isLead = idx === 0;
        return (
          <div key={idx} style={{
            position: 'absolute',
            top: `calc(50% + ${off.top} - clamp(40px, 9.5vw, 67px))`,
            left: `calc(50% + ${off.left} - clamp(28px, 6.5vw, 48px))`,
            transition: isCutForDeal ? 'none' : 'all 0.3s ease-out',
            filter: isWinner ? 'brightness(1.1)' : 'none',
            borderRadius: 7,
            animation: isCutForDeal ? `cardReveal 0.4s ${idx * 0.12}s ease-out both` : undefined,
          }}>
            <Card card={play.card} />
            {/* Lead card indicator */}
            {isLead && !trickWinner && trickPlays.length < 4 && (
              <div style={{
                position: 'absolute',
                bottom: -22,
                left: '50%', transform: 'translateX(-50%)',
                fontSize: 'clamp(8px, 2.2vw, 10px)', fontWeight: 700,
                color: 'rgba(200,170,80,0.6)',
                letterSpacing: 1.5,
                whiteSpace: 'nowrap',
              }}>LEAD</div>
            )}
            {/* Winner glow */}
            {isWinner && (
              <div style={{
                position: 'absolute', inset: -2, borderRadius: 10,
                border: '1px solid rgba(200,170,80,0.3)',
                pointerEvents: 'none',
                animation: 'winnerGlow 1.5s ease-in-out infinite',
              }} />
            )}
            {/* Winner name label */}
            {isWinner && playerNames[play.player] && (
              <div style={{
                position: 'absolute',
                bottom: -22,
                left: '50%', transform: 'translateX(-50%)',
                fontSize: 'clamp(8px, 2.2vw, 10px)',
                fontWeight: 700,
                color: '#c8aa50',
                letterSpacing: 1.5,
                whiteSpace: 'nowrap',
                textShadow: '0 1px 4px rgba(0,0,0,0.8)',
              }}>{playerNames[play.player]}</div>
            )}
            {/* Shine sweep on cut-for-deal winner */}
            {isWinner && isCutForDeal && (
              <div style={{
                position: 'absolute', inset: 0, borderRadius: 7,
                overflow: 'hidden', pointerEvents: 'none',
              }}>
                <div style={{
                  position: 'absolute',
                  top: 0, bottom: 0, width: '60%',
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                  animation: 'shine 1.5s 0.5s ease-in-out',
                  left: '-100%',
                }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
