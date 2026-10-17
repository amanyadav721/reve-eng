import { describe, expect, it } from 'vitest';
import { CELL_COUNT, type CharmId, type TileKind } from './content';
import { neighbours, previewPlacement, scoreBoard } from './scoring';

/** Builds a board from a map of "row,col" to tile. */
function board(tiles: Record<string, TileKind>): Array<TileKind | null> {
  const b: Array<TileKind | null> = Array(CELL_COUNT).fill(null);
  for (const [key, kind] of Object.entries(tiles)) {
    const [r, c] = key.split(',').map(Number);
    b[r * 5 + c] = kind;
  }
  return b;
}

const at = (r: number, c: number) => r * 5 + c;
const score = (tiles: Record<string, TileKind>, charms: CharmId[] = []) => scoreBoard(board(tiles), charms);

describe('neighbours', () => {
  it('handles corners, edges and centre', () => {
    expect(neighbours(at(0, 0)).sort((a, b) => a - b)).toEqual([at(0, 1), at(1, 0)]);
    expect(neighbours(at(0, 2))).toHaveLength(3);
    expect(neighbours(at(2, 2))).toHaveLength(4);
    expect(neighbours(at(4, 4)).sort((a, b) => a - b)).toEqual([at(3, 4), at(4, 3)]);
  });
});

describe('scoreBoard', () => {
  it('scores an empty village as zero with base joy 1', () => {
    const s = score({});
    expect(s).toMatchObject({ coins: 0, joy: 1, total: 0 });
  });

  it('farms grow with neighbouring farms', () => {
    // Three farms in a row: 3 + 4 + 3.
    expect(score({ '0,0': 'farm', '0,1': 'farm', '0,2': 'farm' }).coins).toBe(10);
  });

  it('a well doubles adjacent farms and orchards only', () => {
    const s = score({ '1,1': 'well', '1,2': 'farm', '0,1': 'orchard', '3,3': 'farm' });
    expect(s.cells[at(1, 2)].coins).toBe(4);
    expect(s.cells[at(0, 1)].coins).toBe(6);
    expect(s.cells[at(3, 3)].coins).toBe(2);
  });

  it('houses and parks reward each other with joy', () => {
    const s = score({ '2,2': 'park', '2,1': 'house', '2,3': 'house' });
    expect(s.cells[at(2, 2)].joy).toBe(3);
    expect(s.cells[at(2, 1)].joy).toBe(1);
    expect(s.joy).toBe(1 + 3 + 1 + 1);
    expect(s.coins).toBe(2);
    expect(s.total).toBe(12);
  });

  it('markets pay per neighbouring house', () => {
    expect(score({ '1,1': 'market', '0,1': 'house', '1,0': 'house' }).cells[at(1, 1)].coins).toBe(4);
  });

  it('bakeries pay per neighbouring farm or mill', () => {
    expect(score({ '1,1': 'bakery', '0,1': 'farm', '1,2': 'mill' }).cells[at(1, 1)].coins).toBe(6);
  });

  it('orchards lose their joy next to a building but not next to nature', () => {
    expect(score({ '0,0': 'orchard', '0,1': 'farm' }).cells[0].joy).toBe(2);
    expect(score({ '0,0': 'orchard', '0,1': 'house' }).cells[0].joy).toBe(0);
  });

  it('mills count farms across their whole row and column', () => {
    const s = score({ '2,2': 'mill', '2,0': 'farm', '2,4': 'farm', '0,2': 'farm', '4,4': 'farm' });
    expect(s.cells[at(2, 2)].coins).toBe(6);
  });

  it('taverns and fountains make joy from neighbours', () => {
    const s = score({ '1,1': 'tavern', '0,1': 'house', '1,0': 'market', '3,3': 'fountain', '3,4': 'farm' });
    expect(s.cells[at(1, 1)].joy).toBe(2);
    expect(s.cells[at(3, 3)].joy).toBe(2);
  });

  it('applies charms', () => {
    const tiles: Record<string, TileKind> = { '0,0': 'farm', '4,4': 'house', '4,3': 'house' };
    expect(score(tiles, ['harvestMoon']).cells[0].coins).toBe(4);
    expect(score(tiles, ['bigFamilies']).cells[at(4, 4)].coins).toBe(3);
    expect(score(tiles, ['openFields']).bonusCoins).toBe(22);
    expect(score(tiles, ['fullHouse']).joy).toBe(2);
    // Joy 4 (base 1, park 2, house 1) becomes 6 with Festival.
    const park = { '2,2': 'park', '2,1': 'house' } as Record<string, TileKind>;
    expect(score(park, []).joy).toBe(1 + 2 + 1);
    expect(score(park, ['festival']).joy).toBe(6);
  });

  it('total is coins times joy', () => {
    const s = score({ '0,0': 'farm', '1,0': 'park', '1,1': 'house' });
    expect(s.total).toBe(s.coins * s.joy);
  });
});

describe('previewPlacement', () => {
  it('returns the change in total score', () => {
    const b = board({ '0,0': 'farm' });
    // Farm alone = 2 coins × 1 joy. Adding a neighbouring farm: 3 + 3 = 6.
    expect(previewPlacement(b, [], 'farm', at(0, 1))).toBe(4);
  });

  it('rejects occupied cells', () => {
    expect(() => previewPlacement(board({ '0,0': 'farm' }), [], 'farm', 0)).toThrow();
  });
});
