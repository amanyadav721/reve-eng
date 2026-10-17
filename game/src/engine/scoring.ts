import { BUILDINGS, CELL_COUNT, GRID_SIZE, type CharmId, type TileKind } from './content';

export type Board = ReadonlyArray<TileKind | null>;

export interface CellYield {
  coins: number;
  joy: number;
}

export interface ScoreBreakdown {
  cells: CellYield[];
  /** Coins and joy from charms that are not tied to a single cell. */
  bonusCoins: number;
  bonusJoy: number;
  coins: number;
  /** Includes the village's base joy of 1. */
  joy: number;
  total: number;
}

export function neighbours(index: number): number[] {
  const row = Math.floor(index / GRID_SIZE);
  const col = index % GRID_SIZE;
  const out: number[] = [];
  if (row > 0) out.push(index - GRID_SIZE);
  if (row < GRID_SIZE - 1) out.push(index + GRID_SIZE);
  if (col > 0) out.push(index - 1);
  if (col < GRID_SIZE - 1) out.push(index + 1);
  return out;
}

function countAdjacent(board: Board, index: number, kinds: TileKind[]): number {
  return neighbours(index).filter((n) => {
    const t = board[n];
    return t !== null && kinds.includes(t);
  }).length;
}

function farmsInLine(board: Board, index: number): number {
  const row = Math.floor(index / GRID_SIZE);
  const col = index % GRID_SIZE;
  let count = 0;
  for (let i = 0; i < GRID_SIZE; i++) {
    if (board[row * GRID_SIZE + i] === 'farm') count++;
    if (board[i * GRID_SIZE + col] === 'farm') count++;
  }
  return count;
}

export function cellYield(board: Board, index: number, charms: readonly CharmId[]): CellYield {
  const tile = board[index];
  const has = (c: CharmId) => charms.includes(c);
  const nextToWell = () => countAdjacent(board, index, ['well']) > 0;
  switch (tile) {
    case null:
      return { coins: 0, joy: 0 };
    case 'farm': {
      let coins = 2 + countAdjacent(board, index, ['farm']) + (has('harvestMoon') ? 2 : 0);
      if (nextToWell()) coins *= 2;
      return { coins, joy: 0 };
    }
    case 'orchard': {
      let coins = 3;
      if (nextToWell()) coins *= 2;
      const touchesBuilding = neighbours(index).some((n) => {
        const t = board[n];
        return t !== null && BUILDINGS.has(t);
      });
      return { coins, joy: touchesBuilding ? 0 : 2 };
    }
    case 'house':
      return {
        coins: 1 + (has('bigFamilies') ? 2 : 0),
        joy: countAdjacent(board, index, ['park', 'fountain']) > 0 ? 1 : 0,
      };
    case 'park':
      return { coins: 0, joy: 1 + countAdjacent(board, index, ['house']) + (has('greenThumb') ? 2 : 0) };
    case 'market':
      return { coins: 2 * countAdjacent(board, index, ['house']) + (has('guildCharter') ? 4 : 0), joy: 0 };
    case 'well':
      return { coins: 0, joy: 0 };
    case 'bakery':
      return { coins: 3 * countAdjacent(board, index, ['farm', 'mill']) + (has('guildCharter') ? 4 : 0), joy: 0 };
    case 'tavern':
      return { coins: 0, joy: countAdjacent(board, index, ['house', 'market']) };
    case 'mill':
      return { coins: 2 * farmsInLine(board, index), joy: 0 };
    case 'fountain':
      return { coins: 0, joy: 1 + neighbours(index).filter((n) => board[n] !== null).length };
  }
}

export function scoreBoard(board: Board, charms: readonly CharmId[]): ScoreBreakdown {
  if (board.length !== CELL_COUNT) throw new Error(`Board must have ${CELL_COUNT} cells`);
  const cells = board.map((_, i) => cellYield(board, i, charms));
  let bonusCoins = 0;
  let bonusJoy = 0;
  if (charms.includes('openFields')) bonusCoins += board.filter((t) => t === null).length;
  if (charms.includes('fullHouse')) bonusJoy += Math.floor(board.filter((t) => t === 'house').length / 2);

  const coins = cells.reduce((s, c) => s + c.coins, 0) + bonusCoins;
  let joy = 1 + cells.reduce((s, c) => s + c.joy, 0) + bonusJoy;
  if (charms.includes('festival')) joy = Math.floor(joy * 1.5);
  return { cells, bonusCoins, bonusJoy, coins, joy, total: coins * joy };
}

/** Score change if `kind` were placed on an empty `index`. */
export function previewPlacement(board: Board, charms: readonly CharmId[], kind: TileKind, index: number): number {
  if (board[index] !== null) throw new Error('Cell is occupied');
  const next = board.slice();
  next[index] = kind;
  return scoreBoard(next, charms).total - scoreBoard(board, charms).total;
}
