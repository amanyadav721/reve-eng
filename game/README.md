# Little Hamlet (working title)

A cozy roguelike deckbuilder. Build a tiny village through one year: each season you place
3 tiles from your hand, then the whole village scores **coins × joy**. Beat the season's goal
to reach the market, buy new cards and charms, and survive all 8 seasons.

## Run it

```bash
npm install
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server at http://localhost:5173 |
| `npm test` | Unit tests for scoring and run flow |
| `npm run sim -- 2000` | Plays 2,000 runs with a greedy bot and a random bot |
| `npm run build` | Typecheck and production build into `dist/` |

## Layout

- `src/engine/` holds the pure, deterministic rules: content, scoring, run state machine and RNG.
  It has no DOM code, so the same engine can move to a native or Capacitor app later.
- `src/ui/` holds the DOM rendering and save/resume through localStorage.
- `scripts/simulate.ts` is the balance harness.

## Balancing

All tuning numbers live in `src/engine/content.ts`. After changing tiles, charms or targets, run the
simulator. Try a new goal curve without editing code:

```bash
TARGETS="6,45,200,500,1100,1850,2900,4100" npm run sim -- 2000
```

Aim for a greedy-bot win rate of roughly 30–45% with near-certain survival in seasons 1–3.
The random bot should almost never win, which shows that placement skill matters.
