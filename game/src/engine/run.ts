import {
  CARD_COST,
  CELL_COUNT,
  CHARMS,
  DISCARDS_PER_SEASON,
  HAND_SIZE,
  MAX_CHARMS,
  PLACEMENTS_PER_SEASON,
  RARITY_WEIGHT,
  SEASON_COUNT,
  SEASON_TARGETS,
  STARTING_DECK,
  TILES,
  type CharmId,
  type Rarity,
  type TileKind,
} from './content';
import { Rng } from './rng';
import { scoreBoard, type ScoreBreakdown } from './scoring';

export type Phase = 'placing' | 'result' | 'shop' | 'won' | 'lost';

export type ShopItem =
  | { type: 'card'; kind: TileKind; cost: number; sold: boolean }
  | { type: 'charm'; id: CharmId; cost: number; sold: boolean };

export interface SeasonResult {
  season: number;
  target: number;
  score: ScoreBreakdown;
  passed: boolean;
  goldEarned: number;
}

export interface RunState {
  rng: number;
  /** Zero-based season index. */
  season: number;
  phase: Phase;
  board: Array<TileKind | null>;
  hand: TileKind[];
  drawPile: TileKind[];
  discardPile: TileKind[];
  placementsLeft: number;
  discardsLeft: number;
  charms: CharmId[];
  gold: number;
  shop: ShopItem[];
  rerollCost: number;
  lastResult: SeasonResult | null;
}

export const STARTING_GOLD = 2;
const BASE_REROLL_COST = 1;

export function seasonTarget(season: number): number {
  return SEASON_TARGETS[Math.min(season, SEASON_TARGETS.length - 1)];
}

export function deckCards(state: RunState): TileKind[] {
  return [...state.hand, ...state.drawPile, ...state.discardPile];
}

export function newRun(seed: number): RunState {
  const rng = new Rng(seed);
  const state: RunState = {
    rng: 0,
    season: 0,
    phase: 'placing',
    board: Array(CELL_COUNT).fill(null),
    hand: [],
    drawPile: rng.shuffle(STARTING_DECK),
    discardPile: [],
    placementsLeft: PLACEMENTS_PER_SEASON,
    discardsLeft: DISCARDS_PER_SEASON,
    charms: [],
    gold: STARTING_GOLD,
    shop: [],
    rerollCost: BASE_REROLL_COST,
    lastResult: null,
  };
  fillHand(state, rng);
  state.rng = rng.state;
  return state;
}

function drawOne(state: RunState, rng: Rng): void {
  if (state.drawPile.length === 0) {
    if (state.discardPile.length === 0) return;
    state.drawPile = rng.shuffle(state.discardPile);
    state.discardPile = [];
  }
  state.hand.push(state.drawPile.pop()!);
}

function fillHand(state: RunState, rng: Rng): void {
  while (state.hand.length < HAND_SIZE) {
    const before = state.hand.length;
    drawOne(state, rng);
    if (state.hand.length === before) return;
  }
}

/** Runs `fn` on a copy of the state with a live RNG, then stores the RNG state back. */
function transition(state: RunState, fn: (draft: RunState, rng: Rng) => void): RunState {
  const draft = structuredClone(state);
  const rng = new Rng(draft.rng);
  fn(draft, rng);
  draft.rng = rng.state;
  return draft;
}

function requirePhase(state: RunState, phase: Phase): void {
  if (state.phase !== phase) throw new Error(`Expected phase ${phase}, got ${state.phase}`);
}

export function placeCard(state: RunState, handIndex: number, cell: number): RunState {
  requirePhase(state, 'placing');
  if (handIndex < 0 || handIndex >= state.hand.length) throw new Error('No such card in hand');
  if (cell < 0 || cell >= CELL_COUNT || state.board[cell] !== null) throw new Error('Cell is not empty');
  return transition(state, (s, rng) => {
    const [kind] = s.hand.splice(handIndex, 1);
    s.board[cell] = kind;
    s.discardPile.push(kind);
    s.placementsLeft--;
    if (s.placementsLeft === 0) {
      endSeason(s);
    } else {
      fillHand(s, rng);
    }
  });
}

export function discardCard(state: RunState, handIndex: number): RunState {
  requirePhase(state, 'placing');
  if (state.discardsLeft <= 0) throw new Error('No discards left');
  if (handIndex < 0 || handIndex >= state.hand.length) throw new Error('No such card in hand');
  return transition(state, (s, rng) => {
    const [kind] = s.hand.splice(handIndex, 1);
    s.discardPile.push(kind);
    s.discardsLeft--;
    fillHand(s, rng);
  });
}

export function goldForResult(total: number, target: number, charms: readonly CharmId[]): number {
  const excess = Math.max(0, total - target);
  const surplusBonus = Math.min(4, Math.floor((excess / target) * 4));
  return 3 + surplusBonus + (charms.includes('luckyCoin') ? 2 : 0);
}

function endSeason(s: RunState): void {
  const target = seasonTarget(s.season);
  const score = scoreBoard(s.board, s.charms);
  const passed = score.total >= target;
  const goldEarned = passed ? goldForResult(score.total, target, s.charms) : 0;
  s.gold += goldEarned;
  s.lastResult = { season: s.season, target, score, passed, goldEarned };
  if (!passed) s.phase = 'lost';
  else if (s.season === SEASON_COUNT - 1) s.phase = 'won';
  else s.phase = 'result';
}

function rollShop(s: RunState, rng: Rng): void {
  const rarities = Object.entries(RARITY_WEIGHT) as Array<[Rarity, number]>;
  const cards: ShopItem[] = [];
  for (let i = 0; i < 3; i++) {
    const rarity = rng.weighted(rarities);
    const pool = Object.values(TILES).filter((t) => t.rarity === rarity);
    const tile = pool[rng.int(pool.length)];
    cards.push({ type: 'card', kind: tile.kind, cost: CARD_COST[rarity], sold: false });
  }
  const charmPool = rng.shuffle(
    (Object.keys(CHARMS) as CharmId[]).filter((id) => !s.charms.includes(id)),
  );
  const charms: ShopItem[] = charmPool
    .slice(0, 2)
    .map((id) => ({ type: 'charm', id, cost: CHARMS[id].cost, sold: false }));
  s.shop = [...cards, ...charms];
}

export function openShop(state: RunState): RunState {
  requirePhase(state, 'result');
  return transition(state, (s, rng) => {
    s.phase = 'shop';
    s.rerollCost = BASE_REROLL_COST;
    rollShop(s, rng);
  });
}

export function canBuy(state: RunState, index: number): boolean {
  const item = state.shop[index];
  if (state.phase !== 'shop' || !item || item.sold || state.gold < item.cost) return false;
  if (item.type === 'charm' && state.charms.length >= MAX_CHARMS) return false;
  return true;
}

export function buyItem(state: RunState, index: number): RunState {
  if (!canBuy(state, index)) throw new Error('Cannot buy that item');
  return transition(state, (s) => {
    const item = s.shop[index];
    s.gold -= item.cost;
    item.sold = true;
    if (item.type === 'card') s.discardPile.push(item.kind);
    else s.charms.push(item.id);
  });
}

export function rerollShop(state: RunState): RunState {
  requirePhase(state, 'shop');
  if (state.gold < state.rerollCost) throw new Error('Not enough gold');
  return transition(state, (s, rng) => {
    s.gold -= s.rerollCost;
    s.rerollCost++;
    rollShop(s, rng);
  });
}

export function sellCharm(state: RunState, charmIndex: number): RunState {
  requirePhase(state, 'shop');
  if (!state.charms[charmIndex]) throw new Error('No such charm');
  return transition(state, (s) => {
    const [id] = s.charms.splice(charmIndex, 1);
    s.gold += Math.floor(CHARMS[id].cost / 2);
  });
}

export function leaveShop(state: RunState): RunState {
  requirePhase(state, 'shop');
  return transition(state, (s, rng) => {
    s.season++;
    s.phase = 'placing';
    s.placementsLeft = PLACEMENTS_PER_SEASON;
    s.discardsLeft = DISCARDS_PER_SEASON;
    s.shop = [];
    fillHand(s, rng);
  });
}
