"use client";
import Card from './Card';
import { cardId, cardEquals } from '@/lib/game';

export default function Hand({
  cards, position, faceDown = false, playableCards = [],
  onCardClick, isCurrentTurn = false, dimLevel = 'primary',
  backColor = 'blue',
}) {
  const isPlayer = position === 'south';
  const isHorizontal = position === 'south' || position === 'north';

  const isPlayable = (card) => playableCards.some(pc => cardEquals(pc, card));

  // Responsive overlap: tighter on small screens
  const playerOverlap = cards.length > 4 ? `clamp(-24px, -4vw, -12px)` : `clamp(-18px, -3vw, -10px)`;
  const aiHOverlap = 'clamp(-24px, -5vw, -16px)';
  const aiVOverlap = 'clamp(-30px, -6vw, -20px)';

  const opacityMap = { primary: 1, secondary: 0.6, background: 0.35 };

  return (
    <div style={{
      display: 'flex',
      alignItems: isHorizontal ? 'flex-end' : 'center',
      flexDirection: isHorizontal ? 'row' : 'column',
      justifyContent: 'center',
      opacity: opacityMap[dimLevel] || 1,
      transition: 'opacity 0.4s ease',
    }}>
      {cards.map((card, idx) => (
        <div key={cardId(card)} style={{
          marginLeft: isHorizontal && idx > 0
            ? (isPlayer ? playerOverlap : aiHOverlap)
            : 0,
          marginTop: !isHorizontal && idx > 0 ? aiVOverlap : 0,
          zIndex: idx,
        }}>
          <Card
            card={card}
            faceDown={faceDown}
            playable={isPlayer && isCurrentTurn && isPlayable(card)}
            dimmed={isPlayer && isCurrentTurn && playableCards.length > 0 && !isPlayable(card)}
            small={!isPlayer}
            onClick={() => onCardClick?.(card)}
            backColor={backColor}
          />
        </div>
      ))}
    </div>
  );
}
