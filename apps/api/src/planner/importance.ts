import type { Memory, Stop, TripPreferences } from '@tagalong/shared';

import { normalizeName } from '../providers/text.js';
import type { PlaceSummary } from '../providers/types.js';

// How much a stop matters to this traveler, so code knows what to drop first and what to add.
// A city's headline sight (City Palace) and the things they love stay; minor stops go first.

/** What the traveler loves, in their words: quiz interests and the loves Laddoo remembers. */
export function lovesOf(interests: string[] = [], memories: Memory[] = []): string[] {
  return [...interests, ...memories.filter((m) => m.kind === 'love').map((m) => m.text)];
}

/** Lowercase, accent-free, singular words: "Cafés" → "cafe", "forts" → "fort". */
export function words(s: string): string[] {
  return normalizeName(s)
    .split(' ')
    .filter((w) => w.length > 2)
    .map(singular);
}

function singular(w: string): string {
  if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && /(ch|sh|x)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

// An interest names a family of places: someone who loves history wants forts, palaces and museums.
const FAMILIES: [RegExp, string[]][] = [
  [/histor|heritage|architect/, ['fort', 'palace', 'mahal', 'museum', 'monument', 'historic', 'heritage', 'castle', 'archaeological', 'memorial', 'haveli', 'stepwell', 'baori', 'observatory', 'mantar', 'tomb', 'ruin']],
  [/\bfort/, ['fort', 'garh', 'castle', 'fortress']],
  [/palace/, ['palace', 'mahal', 'castle', 'haveli']],
  [/\bart\b|museum|culture/, ['museum', 'gallery', 'art', 'craft', 'cultural', 'theatre', 'haveli']],
  [/spiritual|temple|relig|pilgrim/, ['temple', 'mandir', 'ghat', 'ashram', 'church', 'mosque', 'masjid', 'gurudwara', 'shrine', 'religious', 'worship', 'aarti', 'cathedral', 'math']],
  [/market|shop|bazaar|lanes/, ['market', 'bazaar', 'shopping', 'mall', 'handicraft', 'craft', 'boutique']],
  [/lake|water/, ['lake', 'ghat', 'sagar', 'talab', 'waterfront', 'river']],
  [/garden|nature|park|outdoor/, ['garden', 'park', 'bagh', 'nature', 'lake', 'waterfall', 'viewpoint', 'forest', 'trail']],
  [/beach|sea/, ['beach', 'coast', 'shore']],
  [/caf/, ['cafe', 'coffee', 'bakery']],
  [/food|eat|cuisine|dish/, ['food', 'restaurant', 'eatery', 'dhaba', 'chaat', 'thali', 'sweet']],
  [/photo|view|sunset|sunrise/, ['viewpoint', 'view', 'sunset', 'point', 'fort', 'palace', 'ghat', 'lake']],
  [/night|party|bar/, ['bar', 'pub', 'club', 'lounge', 'nightlife', 'brewery']],
  [/adventure|thrill/, ['rafting', 'adventure', 'bungee', 'zipline', 'trek', 'camp', 'paragliding']],
  [/yoga|wellness|meditat/, ['yoga', 'ashram', 'meditation', 'spa', 'wellness', 'retreat']],
];

/** The interest or memory a place matches, if any ("history" for City Palace). */
export function lovedMatch(place: { name: string; types?: string[] }, loves: string[]): string | undefined {
  const have = new Set(words([place.name, ...(place.types ?? [])].join(' ')));
  for (const love of loves) {
    const own = words(love).filter((w) => !GENERIC.has(w));
    const family = FAMILIES.filter(([re]) => re.test(love.toLowerCase())).flatMap(([, ws]) => ws);
    if ([...own, ...family].some((w) => have.has(w))) return love;
  }
  return undefined;
}

// Words in a memory that say nothing about the kind of place ("Always wants a spot").
const GENERIC = new Set(['always', 'love', 'loved', 'loves', 'like', 'want', 'wants', 'spot', 'place', 'good', 'great', 'every', 'trip', 'time', 'the', 'and', 'with', 'from', 'after', 'get', 'got']);

/** 2 for a headline sight, 1 for a known or well-liked place, 0 for a minor one. */
export function fame(place: Pick<PlaceSummary, 'rank' | 'ratingCount' | 'types'> | undefined): number {
  if (!place) return 0;
  if ((place.rank ?? 0) >= 4 || (place.ratingCount ?? 0) >= 5000) return 2;
  if ((place.rank ?? 0) >= 2.5 || (place.ratingCount ?? 0) >= 800 || knownFor(place)) return 1;
  return 0;
}

export function knownFor(place: Pick<PlaceSummary, 'types'>): string | undefined {
  return place.types.find((t) => t.startsWith('known for '))?.slice('known for '.length);
}

/** How much a stop matters: fame plus 2 when it's something they love. Lowest goes first. */
export function importance(stop: Stop, place: PlaceSummary | undefined, loves: string[]): number {
  return fame(place) + (lovedMatch({ name: stop.name, types: place?.types }, loves) ? 2 : 0);
}

/** Eateries that make a poor sit-down meal: fast food, sweet shops, bars, groceries. */
const POOR_MEAL = /fast_food|fast food|burger|pizza|candy|ice_cream|ice cream|dessert_shop|juice|bar\b|pub\b|lounge|liquor|grocery|store\b|supermarket|tea_room|coffee_shop|bakery/i;
const PROPER_MEAL = /restaurant|thali|dhaba|bhojanalaya|diner|bistro|canteen|eatery/i;

/**
 * How good a place is for a meal for this traveler, before distance: places known for a dish that
 * fits the diet first, then proper restaurants. Fast food and sweet shops sink.
 */
export function mealQuality(place: PlaceSummary, fits: (dish: string) => boolean, diet?: TripPreferences['diet']): number {
  const kinds = place.types.filter((t) => !t.startsWith('known for ')).join(' ');
  const dish = knownFor(place);
  const veg = diet === 'veg' || diet === 'egg' || diet === 'jain' || diet === 'vegan';
  let q = 0;
  if (dish) q += fits(dish) ? 3 : -1;
  if (PROPER_MEAL.test(kinds) || PROPER_MEAL.test(place.name)) q += 1.5;
  else if (/cafe/i.test(kinds)) q += 0.5;
  if (POOR_MEAL.test(kinds) || /fast food|burger|pizza/i.test(place.name)) q -= 2;
  if (veg && /vegetarian|pure veg|bhojanalaya|thali/i.test(`${kinds} ${place.name}`)) q += 1;
  if (veg && /meat|steak|seafood|non[ -]?veg|barbecue|kebab/i.test(`${kinds} ${place.name}`)) q -= 3;
  q += Math.min(place.rank ?? 0, 6) / 3 + (place.ratingCount ? Math.min(Math.log10(place.ratingCount), 4) / 2 : 0);
  return q;
}
