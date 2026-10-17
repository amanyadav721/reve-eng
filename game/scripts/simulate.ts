/**
 * Plays many runs with simple bots to check the difficulty curve.
 * Usage: npm run sim -- [runs]
 */
import {
  SEASON_COUNT,
  SEASON_TARGETS,
  buyItem,
  canBuy,
  discardCard,
  leaveShop,
  newRun,
  openShop,
  placeCard,
  previewPlacement,
  type RunState,
} from '../src/engine';

type Bot = { name: string; play: (s: RunState) => RunState };

function bestMove(s: RunState): { hand: number; cell: number; gain: number } {
  let best = { hand: 0, cell: s.board.indexOf(null), gain: -Infinity };
  s.hand.forEach((kind, hand) => {
    s.board.forEach((tile, cell) => {
      if (tile !== null) return;
      const gain = previewPlacement(s.board, s.charms, kind, cell);
      if (gain > best.gain) best = { hand, cell, gain };
    });
  });
  return best;
}

function cardValue(s: RunState, hand: number): number {
  let best = -Infinity;
  s.board.forEach((tile, cell) => {
    if (tile === null) best = Math.max(best, previewPlacement(s.board, s.charms, s.hand[hand], cell));
  });
  return best;
}

function greedyShop(s: RunState): RunState {
  // Prefer charms, then the priciest cards, while gold lasts.
  const order = s.shop
    .map((item, i) => ({ item, i }))
    .sort((a, b) => Number(b.item.type === 'charm') - Number(a.item.type === 'charm') || b.item.cost - a.item.cost);
  for (const { i } of order) if (canBuy(s, i)) s = buyItem(s, i);
  return s;
}

const greedy: Bot = {
  name: 'greedy',
  play(s) {
    while (s.phase === 'placing') {
      // Discard the weakest card when the hand looks poor.
      if (s.discardsLeft > 0 && s.hand.length > 1) {
        const values = s.hand.map((_, i) => cardValue(s, i));
        const worst = values.indexOf(Math.min(...values));
        if (values[worst] <= 0 || values[worst] < Math.max(...values) / 4) {
          s = discardCard(s, worst);
          continue;
        }
      }
      const move = bestMove(s);
      s = placeCard(s, move.hand, move.cell);
    }
    if (s.phase === 'result') s = leaveShop(greedyShop(openShop(s)));
    return s;
  },
};

const random: Bot = {
  name: 'random',
  play(s) {
    let i = s.rng;
    while (s.phase === 'placing') {
      const empties = s.board.flatMap((t, c) => (t === null ? [c] : []));
      i = (i * 1103515245 + 12345) >>> 0;
      s = placeCard(s, i % s.hand.length, empties[i % empties.length]);
    }
    if (s.phase === 'result') s = leaveShop(openShop(s));
    return s;
  },
};

function simulate(bot: Bot, runs: number) {
  const reached = Array(SEASON_COUNT + 1).fill(0);
  const ratios: number[][] = Array.from({ length: SEASON_COUNT }, () => []);
  for (let seed = 1; seed <= runs; seed++) {
    let s = newRun(seed * 7919);
    while (s.phase !== 'won' && s.phase !== 'lost') {
      const season = s.season;
      s = bot.play(s);
      if (s.lastResult && s.lastResult.season === season) ratios[season].push(s.lastResult.score.total / s.lastResult.target);
    }
    const cleared = s.phase === 'won' ? SEASON_COUNT : s.season;
    for (let k = 0; k <= cleared; k++) reached[k]++;
  }
  console.log(`\n${bot.name} bot, ${runs} runs: win rate ${((reached[SEASON_COUNT] / runs) * 100).toFixed(1)}%`);
  console.log('season  target  survive%  median score/target  p25/p50/p75 score');
  for (let k = 0; k < SEASON_COUNT; k++) {
    const r = ratios[k].sort((a, b) => a - b);
    const median = r.length ? r[Math.floor(r.length / 2)].toFixed(2) : '-';
    const survive = reached[k] ? ((reached[k + 1] / reached[k]) * 100).toFixed(0) : '-';
    const abs = r.map((x) => Math.round(x * SEASON_TARGETS[k]));
    const pct = (q: number) => (abs.length ? abs[Math.floor(abs.length * q)] : '-');
    console.log(`${String(k + 1).padStart(6)}  ${String(SEASON_TARGETS[k]).padStart(6)}  ${String(survive).padStart(8)}  ${String(median).padStart(19)}  ${pct(0.25)}/${pct(0.5)}/${pct(0.75)}`);
  }
}

// Optional: TARGETS="10,30,..." npm run sim  to try a different curve without editing content.ts.
if (process.env.TARGETS) SEASON_TARGETS.splice(0, SEASON_TARGETS.length, ...process.env.TARGETS.split(',').map(Number));

const runs = Number(process.argv[2] ?? 1000);
simulate(greedy, runs);
simulate(random, runs);
