# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

```bash
npm run dev      # Start dev server (Next.js, usually port 3000/3001)
npm run build    # Production build — run this to verify changes compile
npm run start    # Start production server
```

No test suite or linter is configured.

## Architecture

**Pitch** is a 4-player trick-taking card game (High-Low-Jack) built with Next.js 14. It supports solo play (1 human + 3 AI) and 2-player online multiplayer (each human gets an AI partner).

### Game Flow (Phases)

`cutForDeal` → `dealing` → `bidding` → `pitching` → `trickPlay` → `trickCollect` → `handOver` → (repeat or `gameOver`)

### Seating & Teams

| Seat | Constant | Solo Mode | Online Mode |
|------|----------|-----------|-------------|
| SOUTH (0) | `SOUTH` | Human (YOU) | Player 1 (human, Team A) |
| WEST (1) | `WEST` | AI (SPIKE) | Player 2 (human, Team B) |
| NORTH (2) | `NORTH` | AI (ACE) | AI partner of P1 (Team A) |
| EAST (3) | `EAST` | AI (BLITZ) | AI partner of P2 (Team B) |

Player 2 sees a rotated view: `displayPosition = (serverSeat - mySeat + 4) % 4`

### Solo vs Online Mode

- **Solo mode**: All game logic runs client-side in `Game.jsx`. AI decisions happen via `setTimeout` with `AI_DELAY`/`AI_BID_DELAY` constants.
- **Online mode**: Game state lives in Upstash Redis (4hr TTL). Clients poll `GET /api/room` every 700ms. Human actions go via `POST /api/room`. AI runs server-side, triggered by polling (one AI action per poll tick).

### Key Files

| File | Role |
|------|------|
| `components/Game.jsx` | Main game controller (~1600 lines). Manages both solo and online modes, lobby UI, all game phases, rendering. |
| `lib/game.js` | Pure game logic: dealing, bid validation, playable cards, trick evaluation, hand scoring. No side effects. |
| `lib/ai.js` | AI decision functions: `getAiBid`, `getAiPlay`, `getAiTrumpCard`. Three difficulty levels (easy/medium/hard). |
| `app/api/room/route.js` | Multiplayer API. POST handles create/join/bid/play/rematch. GET handles polling + server-side AI processing. |
| `lib/redis.js` | Upstash Redis client. `getRoom(code)` / `setRoom(code, room)` with 4hr TTL. |
| `lib/api-client.js` | Client-side fetch wrapper (`roomApi.create/join/poll/bid/play/rematch`). |
| `lib/sounds.js` | Web Audio API synthesized sounds (no audio files). |

### Multiplayer Architecture

```
Browser (P1)  ─── poll 700ms ──→  GET /api/room  ←──→  Upstash Redis
Browser (P2)  ─── poll 700ms ──→       ↑               (pitch:<CODE>, 4hr TTL)
                                       │
                                  AI runs here
                                  (one action per poll tick)
```

Server filters state per player — each client only receives their own hand. Playable cards and valid bids are computed server-side.

### Styling Approach

- Tailwind CSS 3.4 + extensive inline styles (not CSS modules)
- `clamp()` used throughout for responsive sizing on mobile
- Custom keyframe animations in `app/globals.css` (bidPop, glowPulse, slideUp, edgeGlow, etc.)
- Dark green felt table aesthetic with gold (#c8aa50) accents
- Mobile-first: touch targets ≥44px, safe area insets, `-webkit-tap-highlight-color: transparent`

## Environment Variables

Required for multiplayer (`.env.local`):
```
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

Solo mode works without these. Build will show Redis config warnings — this is expected since `.env.local` isn't available at build time.

## Path Alias

`@/*` maps to project root (`./`) via `jsconfig.json`.
