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

export default function TrickArea({ trickPlays, trickWinner }) {
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
            transition: 'all 0.3s ease-out',
            filter: isWinner ? 'brightness(1.1)' : 'none',
            borderRadius: 7,
          }}>
            <Card card={play.card} />
            {/* Lead card indicator */}
            {isLead && !trickWinner && trickPlays.length < 4 && (
              <div style={{
                position: 'absolute',
                bottom: -14,
                left: '50%', transform: 'translateX(-50%)',
                fontSize: 'clamp(8px, 2.2vw, 10px)', fontWeight: 700,
                color: 'rgba(200,170,80,0.6)',
                letterSpacing: 1.5,
                whiteSpace: 'nowrap',
              }}>LEAD</div>
            )}
            {isWinner && (
              <div style={{
                position: 'absolute', inset: -2, borderRadius: 10,
                boxShadow: '0 0 12px rgba(200,170,80,0.35)',
                border: '1px solid rgba(200,170,80,0.25)',
                pointerEvents: 'none',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
