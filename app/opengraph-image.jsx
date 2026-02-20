import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Pitch — Four Player Card Game';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(ellipse at 50% 40%, #1a3828 0%, #102418 35%, #0a1a10 60%, #060e08 100%)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Subtle vignette overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse at 50% 45%, transparent 40%, rgba(0,0,0,0.5) 100%)',
          }}
        />

        {/* Suit symbols background */}
        <div
          style={{
            position: 'absolute',
            top: 160,
            display: 'flex',
            gap: 60,
            opacity: 0.08,
            fontSize: 180,
          }}
        >
          <span style={{ color: '#fff' }}>{'\u2660'}</span>
          <span style={{ color: '#d40000' }}>{'\u2665'}</span>
          <span style={{ color: '#d40000' }}>{'\u2666'}</span>
          <span style={{ color: '#fff' }}>{'\u2663'}</span>
        </div>

        {/* Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            zIndex: 1,
          }}
        >
          <div
            style={{
              fontSize: 16,
              color: 'rgba(255,255,255,0.25)',
              letterSpacing: 8,
              fontWeight: 500,
              marginBottom: 12,
            }}
          >
            FOUR PLAYER
          </div>

          <div
            style={{
              fontSize: 120,
              fontWeight: 700,
              letterSpacing: 12,
              lineHeight: 1,
              color: '#e8e0d0',
            }}
          >
            PITCH
          </div>

          <div
            style={{
              fontSize: 14,
              color: 'rgba(255,255,255,0.2)',
              letterSpacing: 6,
              marginTop: 16,
              fontWeight: 400,
            }}
          >
            HIGH · LOW · JACK · GAME
          </div>

          {/* Card suit row */}
          <div
            style={{
              display: 'flex',
              gap: 24,
              marginTop: 40,
            }}
          >
            <span style={{ fontSize: 36, color: 'rgba(255,255,255,0.2)' }}>{'\u2660'}</span>
            <span style={{ fontSize: 36, color: 'rgba(173,107,107,0.5)' }}>{'\u2665'}</span>
            <span style={{ fontSize: 36, color: 'rgba(173,107,107,0.5)' }}>{'\u2666'}</span>
            <span style={{ fontSize: 36, color: 'rgba(255,255,255,0.2)' }}>{'\u2663'}</span>
          </div>

          {/* Tagline */}
          <div
            style={{
              display: 'flex',
              gap: 16,
              marginTop: 36,
              alignItems: 'center',
            }}
          >
            <div
              style={{
                fontSize: 18,
                color: '#c8aa50',
                letterSpacing: 3,
                fontWeight: 500,
                padding: '8px 20px',
                borderRadius: 8,
                border: '1px solid rgba(200,170,80,0.25)',
                background: 'rgba(200,170,80,0.08)',
              }}
            >
              PLAY ONLINE WITH FRIENDS
            </div>
          </div>
        </div>

        {/* Gold accent line at top */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: 'linear-gradient(90deg, transparent, rgba(200,170,80,0.4), transparent)',
          }}
        />
      </div>
    ),
    { ...size }
  );
}
