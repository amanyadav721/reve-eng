import type { Stop } from '@tagalong/shared';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { PlaceSummary } from '../providers/types.js';
import { fame, importance, lovedMatch, lovesOf, mealQuality } from './importance.js';

const at = { lat: 26.92, lng: 75.82 };
const place = (name: string, types: string[], o: Partial<PlaceSummary> = {}): PlaceSummary => ({ placeId: name, name, location: at, types, ...o });
const stop = (name: string): Stop => ({ id: name, name, category: 'sight', icon: '📍', startTime: '10:00', durationMin: 60, points: 0, status: 'upcoming' });

describe('importance', () => {
  // As our Jaipur data has them.
  const cityPalace = place('City Palace', ['attraction', 'castle', 'hotel', 'lodging'], { rank: 7.16 });
  const smallTemple = place('Shri Ganesh Mandir', ['place_of_worship'], { rank: 1.1 });

  it('ranks a headline sight over a minor stop', () => {
    assert.equal(fame(cityPalace), 2);
    assert.equal(fame(smallTemple), 0);
    assert.equal(fame(place('LMB', ['known for ghewar', 'restaurant'])), 1);
    assert.ok(importance(stop('City Palace'), cityPalace, []) > importance(stop('Shri Ganesh Mandir'), smallTemple, []));
  });

  it('counts what they love: an interest covers its kinds of places', () => {
    assert.equal(lovedMatch(cityPalace, ['history']), 'history');
    assert.equal(lovedMatch(smallTemple, ['spiritual']), 'spiritual');
    assert.equal(lovedMatch(smallTemple, ['beaches', 'nightlife']), undefined);
    assert.equal(lovedMatch(place('Sunset Point', ['viewpoint']), lovesOf([], [{ id: 'm', kind: 'love', text: 'Always wants a sunset spot', evidence: '', source: 'chat', sensitive: false, createdAt: '' }])), 'Always wants a sunset spot');
    // Skips and habits are not loves.
    assert.deepEqual(lovesOf(['forts'], [{ id: 'm', kind: 'skip', text: 'No beaches', evidence: '', source: 'chat', sensitive: false, createdAt: '' }]), ['forts']);
    assert.equal(importance(stop('Shri Ganesh Mandir'), smallTemple, ['temples']), 2);
  });

  it('prefers known-for places that fit the diet, then proper restaurants, over fast food', () => {
    const veg = (dish: string) => !/maas|chicken/i.test(dish);
    const lmb = place('Laxmi Mishthan Bhandar', ['known for rajasthani thali', 'restaurant', 'indian']);
    const restaurant = place('Shree Thal', ['restaurant', 'indian_restaurant']);
    const fastFood = place('Nonsense fast food', ['fast_food_restaurant', 'fast', 'food']);
    const meaty = place('Handi', ['known for laal maas', 'restaurant']);
    const q = (p: PlaceSummary) => mealQuality(p, veg, 'veg');
    assert.ok(q(lmb) > q(restaurant), 'known for a fitting dish beats a plain restaurant');
    assert.ok(q(restaurant) > q(fastFood), 'a restaurant beats fast food');
    assert.ok(q(restaurant) > q(meaty), "a restaurant beats one famous for a dish they can't eat");
  });
});
