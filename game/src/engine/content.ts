export const GRID_SIZE = 5;
export const CELL_COUNT = GRID_SIZE * GRID_SIZE;

export type TileKind =
  | 'farm'
  | 'house'
  | 'park'
  | 'market'
  | 'well'
  | 'bakery'
  | 'orchard'
  | 'tavern'
  | 'mill'
  | 'fountain';

export type Rarity = 'common' | 'uncommon' | 'rare';

export interface TileDef {
  kind: TileKind;
  name: string;
  icon: string;
  rarity: Rarity;
  rule: string;
}

export const TILES: Record<TileKind, TileDef> = {
  farm: { kind: 'farm', name: 'Farm', icon: '🌾', rarity: 'common', rule: '+2 coins, +1 per neighbouring Farm. Doubled next to a Well.' },
  house: { kind: 'house', name: 'House', icon: '🏠', rarity: 'common', rule: '+1 coin. +1 joy next to a Park or Fountain.' },
  park: { kind: 'park', name: 'Park', icon: '🌳', rarity: 'common', rule: '+1 joy, +1 per neighbouring House.' },
  market: { kind: 'market', name: 'Market', icon: '🧺', rarity: 'uncommon', rule: '+2 coins per neighbouring House.' },
  well: { kind: 'well', name: 'Well', icon: '🪣', rarity: 'uncommon', rule: 'Neighbouring Farms and Orchards make double coins.' },
  bakery: { kind: 'bakery', name: 'Bakery', icon: '🥖', rarity: 'uncommon', rule: '+3 coins per neighbouring Farm or Mill.' },
  orchard: { kind: 'orchard', name: 'Orchard', icon: '🍎', rarity: 'uncommon', rule: '+3 coins. +2 joy if no building is next to it.' },
  tavern: { kind: 'tavern', name: 'Tavern', icon: '🍺', rarity: 'rare', rule: '+1 joy per neighbouring House or Market.' },
  mill: { kind: 'mill', name: 'Mill', icon: '🌀', rarity: 'rare', rule: '+2 coins per Farm in its row and column.' },
  fountain: { kind: 'fountain', name: 'Fountain', icon: '⛲', rarity: 'rare', rule: '+1 joy, +1 per neighbouring tile.' },
};

/** Tiles that count as "buildings" for the Orchard rule. */
export const BUILDINGS: ReadonlySet<TileKind> = new Set(['house', 'market', 'bakery', 'tavern', 'mill']);

export const CARD_COST: Record<Rarity, number> = { common: 2, uncommon: 3, rare: 5 };
export const RARITY_WEIGHT: Record<Rarity, number> = { common: 45, uncommon: 38, rare: 17 };

export type CharmId =
  | 'harvestMoon'
  | 'bigFamilies'
  | 'greenThumb'
  | 'guildCharter'
  | 'festival'
  | 'fullHouse'
  | 'openFields'
  | 'luckyCoin';

export interface CharmDef {
  id: CharmId;
  name: string;
  icon: string;
  cost: number;
  rule: string;
}

export const CHARMS: Record<CharmId, CharmDef> = {
  harvestMoon: { id: 'harvestMoon', name: 'Harvest Moon', icon: '🌕', cost: 5, rule: 'Farms make +2 coins.' },
  bigFamilies: { id: 'bigFamilies', name: 'Big Families', icon: '👨‍👩‍👧', cost: 5, rule: 'Houses make +2 coins.' },
  greenThumb: { id: 'greenThumb', name: 'Green Thumb', icon: '🪴', cost: 5, rule: 'Parks make +2 joy.' },
  guildCharter: { id: 'guildCharter', name: 'Guild Charter', icon: '📜', cost: 6, rule: 'Markets and Bakeries make +4 coins.' },
  festival: { id: 'festival', name: 'Festival Lanterns', icon: '🏮', cost: 7, rule: 'Joy ×1.5 (rounded down).' },
  fullHouse: { id: 'fullHouse', name: 'Full House', icon: '🏘️', cost: 5, rule: '+1 joy for every 2 Houses.' },
  openFields: { id: 'openFields', name: 'Open Fields', icon: '🌄', cost: 4, rule: '+1 coin per empty plot.' },
  luckyCoin: { id: 'luckyCoin', name: 'Lucky Coin', icon: '🪙', cost: 4, rule: '+2 gold after each season.' },
};

export const MAX_CHARMS = 3;
export const HAND_SIZE = 5;
export const PLACEMENTS_PER_SEASON = 3;
export const DISCARDS_PER_SEASON = 2;
export const SEASON_COUNT = 8;

/** Score needed to survive each season. Tuned with scripts/simulate.ts. */
export const SEASON_TARGETS = [6, 45, 200, 500, 1100, 1850, 2900, 4100];

export const STARTING_DECK: TileKind[] = [
  'farm', 'farm', 'farm',
  'house', 'house', 'house',
  'park', 'park', 'park',
  'market', 'well', 'bakery',
];

export const SEASON_NAMES = ['Early Spring', 'Late Spring', 'Early Summer', 'Late Summer', 'Early Autumn', 'Late Autumn', 'Early Winter', 'Late Winter'];
