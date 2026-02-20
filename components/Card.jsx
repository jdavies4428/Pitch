"use client";

const RANK_NAMES = {
  2:'2', 3:'3', 4:'4', 5:'5', 6:'6', 7:'7', 8:'8', 9:'9',
  10:'10', 11:'J', 12:'Q', 13:'K', 14:'A'
};
const SUIT_SYMBOLS = { S: '\u2660', H: '\u2665', D: '\u2666', C: '\u2663' };

function getSize(small) {
  if (small) return { w: 'clamp(38px, 8.5vw, 56px)', h: 'clamp(53px, 12vw, 78px)' };
  return { w: 'clamp(60px, 14vw, 100px)', h: 'clamp(84px, 19.5vw, 140px)' };
}

export default function Card({
  card, faceDown = false, playable = false, dimmed = false,
  onClick, small = false, style = {}, backColor = 'blue',
}) {
  const size = getSize(small);

  if (faceDown || !card) {
    const isBlue = backColor === 'blue';
    const mainBg = isBlue ? '#1c3a6e' : '#b22234';
    const lightBg = isBlue ? '#224b8a' : '#cc3344';
    const ar = isBlue ? '130,170,255' : '255,140,140';

    return (
      <div className="card-base" style={{
        width: size.w, height: size.h,
        borderRadius: small ? 5 : 7,
        flexShrink: 0,
        overflow: 'hidden',
        position: 'relative',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        background: 'rgba(255,255,255,0.85)',
        padding: small ? 2 : 3,
        ...style,
      }}>
        <div style={{
          width: '100%', height: '100%',
          borderRadius: small ? 3 : 5,
          background: `linear-gradient(170deg, ${lightBg}, ${mainBg})`,
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: small ? 2 : 4,
            borderRadius: 2,
            border: `1px solid rgba(${ar},0.25)`,
          }} />
          <div style={{
            position: 'absolute', inset: small ? 4 : 7,
            borderRadius: 1,
            border: `0.5px solid rgba(${ar},0.15)`,
          }} />
          <div style={{
            position: 'absolute', inset: small ? 5 : 8,
            background: [
              `repeating-linear-gradient(45deg, transparent, transparent ${small ? '3px' : '5px'}, rgba(${ar},0.06) ${small ? '3px' : '5px'}, rgba(${ar},0.06) ${small ? '4px' : '6px'})`,
              `repeating-linear-gradient(-45deg, transparent, transparent ${small ? '3px' : '5px'}, rgba(${ar},0.06) ${small ? '3px' : '5px'}, rgba(${ar},0.06) ${small ? '4px' : '6px'})`,
            ].join(', '),
          }} />
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '60%', height: '38%',
            borderRadius: '50%',
            border: `1px solid rgba(${ar},0.2)`,
            background: `radial-gradient(ellipse, rgba(${ar},0.06), transparent)`,
          }} />
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%) rotate(45deg)',
            width: small ? 7 : 12, height: small ? 7 : 12,
            border: `1.5px solid rgba(${ar},0.25)`,
            borderRadius: 1,
          }} />
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%) rotate(45deg)',
            width: small ? 13 : 22, height: small ? 13 : 22,
            border: `0.5px solid rgba(${ar},0.12)`,
            borderRadius: 1,
          }} />
          <div style={{
            position: 'absolute', top: small ? 5 : 8, bottom: small ? 5 : 8,
            left: '50%', width: 0,
            borderLeft: `0.5px solid rgba(${ar},0.07)`,
          }} />
          <div style={{
            position: 'absolute', left: small ? 5 : 8, right: small ? 5 : 8,
            top: '50%', height: 0,
            borderTop: `0.5px solid rgba(${ar},0.07)`,
          }} />
        </div>
      </div>
    );
  }

  const isRed = card.suit === 'H' || card.suit === 'D';
  const color = isRed ? '#d40000' : '#1a1a1a';

  const handleClick = (e) => {
    if (!playable) return;
    e.stopPropagation();
    if (navigator.vibrate) navigator.vibrate(10);
    onClick?.();
  };

  return (
    <div
      className={`card-base ${playable ? 'card-playable' : ''}`}
      onClick={handleClick}
      onTouchEnd={playable ? (e) => { e.preventDefault(); handleClick(e); } : undefined}
      style={{
        width: size.w, height: size.h,
        minWidth: playable ? 44 : undefined,
        minHeight: playable ? 44 : undefined,
        background: '#fff',
        border: playable ? '1.5px solid rgba(200,170,80,0.5)' : '1px solid rgba(0,0,0,0.12)',
        borderRadius: small ? 5 : 7,
        cursor: playable ? 'pointer' : 'default',
        position: 'relative',
        flexShrink: 0,
        opacity: dimmed ? 0.25 : 1,
        filter: dimmed ? 'saturate(0.3)' : 'none',
        transform: dimmed ? 'scale(0.96)' : 'none',
        pointerEvents: dimmed ? 'none' : undefined,
        boxShadow: playable
          ? '0 0 0 1px rgba(200,170,80,0.3), 0 4px 16px rgba(0,0,0,0.3)'
          : '0 1px 4px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.1)',
        transition: 'transform 0.2s, box-shadow 0.2s, opacity 0.2s, filter 0.2s',
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation',
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* Top-left rank + suit */}
      <div style={{
        position: 'absolute', top: small ? 3 : 6, left: small ? 4 : 7,
        fontSize: small ? 'clamp(11px, 2.6vw, 14px)' : 'clamp(16px, 3.8vw, 22px)',
        fontWeight: 900, color, lineHeight: 1, textAlign: 'center',
      }}>
        {RANK_NAMES[card.rank]}
        <div style={{
          fontSize: small ? 'clamp(9px, 2vw, 11px)' : 'clamp(13px, 3vw, 18px)',
          marginTop: 0, lineHeight: 1,
        }}>
          {SUIT_SYMBOLS[card.suit]}
        </div>
      </div>

      {/* Center suit — bold, visible */}
      <div style={{
        position: 'absolute', top: '52%', left: '50%',
        transform: 'translate(-50%, -50%)',
        fontSize: small ? 'clamp(20px, 4.5vw, 26px)' : 'clamp(34px, 9vw, 56px)',
        color, lineHeight: 1, opacity: 0.85,
        textShadow: isRed ? '0 1px 2px rgba(180,0,0,0.3)' : '0 1px 2px rgba(0,0,0,0.2)',
      }}>
        {SUIT_SYMBOLS[card.suit]}
      </div>

      {/* Bottom-right (inverted) */}
      <div style={{
        position: 'absolute', bottom: small ? 3 : 6, right: small ? 4 : 7,
        fontSize: small ? 'clamp(11px, 2.6vw, 14px)' : 'clamp(16px, 3.8vw, 22px)',
        fontWeight: 900, color, lineHeight: 1,
        transform: 'rotate(180deg)', textAlign: 'center',
      }}>
        {RANK_NAMES[card.rank]}
        <div style={{
          fontSize: small ? 'clamp(9px, 2vw, 11px)' : 'clamp(13px, 3vw, 18px)',
          marginTop: 0, lineHeight: 1,
        }}>
          {SUIT_SYMBOLS[card.suit]}
        </div>
      </div>
    </div>
  );
}
