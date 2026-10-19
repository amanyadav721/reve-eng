import type { Stop } from '@tagalong/shared';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { PlaceDetails, PlacesProvider, RoutesProvider } from '../providers/types.js';
import { PlannerSession, type SessionInput } from './session.js';

// Code adds lunch when the model forgets it. It should pick a good lunch, not the nearest counter.
const daily = (open: number, close: number) => [0, 1, 2, 3, 4, 5, 6].map((day) => ({ open: { day, hour: open, minute: 0 }, close: { day, hour: close, minute: 0 } }));

const fort: PlaceDetails = { placeId: 'fort', name: 'Amber Fort', location: { lat: 26.985, lng: 75.851 }, types: ['fort'], regularHours: daily(8, 18) };
const palace: PlaceDetails = { placeId: 'palace', name: 'City Palace', location: { lat: 26.926, lng: 75.824 }, types: ['palace'], regularHours: daily(9, 17) };
// Eateries near Amber Fort, nearest first.
const fastFood: PlaceDetails = { placeId: 'nonsense', name: 'Nonsense fast food', location: { lat: 26.9852, lng: 75.8512 }, types: ['fast_food_restaurant', 'fast', 'food'], regularHours: daily(10, 23) };
const sweets: PlaceDetails = { placeId: 'sweets', name: 'Amer Sweets', location: { lat: 26.986, lng: 75.852 }, types: ['candy_store', 'food'], regularHours: daily(8, 22) };
const meaty: PlaceDetails = { placeId: 'handi', name: 'Handi', location: { lat: 26.988, lng: 75.853 }, types: ['known for laal maas', 'restaurant'], regularHours: daily(11, 23) };
const thali: PlaceDetails = { placeId: 'lmb', name: 'Laxmi Mishthan Bhandar', location: { lat: 26.99, lng: 75.856 }, types: ['known for rajasthani thali', 'restaurant'], regularHours: daily(8, 23) };
const plain: PlaceDetails = { placeId: 'plain', name: 'Shree Bhojanalaya', location: { lat: 26.989, lng: 75.854 }, types: ['restaurant', 'indian_restaurant'], regularHours: daily(11, 22) };
const dinnerOnly: PlaceDetails = { placeId: 'dinner', name: 'Spice Court', location: { lat: 26.9855, lng: 75.8515 }, types: ['known for dal baati', 'restaurant'], regularHours: daily(18, 23) };

function session(all: PlaceDetails[], diet: SessionInput['diet']) {
  const byId = new Map(all.map((p) => [p.placeId, p]));
  const places: PlacesProvider = { search: async ({ text }) => (/restaurant|thali/.test(text) ? all.filter((p) => p.types.some((t) => /food|restaurant/.test(t))) : []), details: async (id) => byId.get(id)! };
  const routes: RoutesProvider = { route: async () => ({ minutes: 15, km: 3 }) };
  return new PlannerSession({ places, routes }, { city: 'Jaipur', cityCenter: { lat: 26.91, lng: 75.79 }, date: '2026-10-19', rules: { notBefore: '09:00' }, memories: [], diet, country: 'in', currency: 'INR', modes: ['walk', 'auto', 'cab'] });
}

const visit = (p: PlaceDetails, startTime: string, durationMin: number): Stop => ({ id: p.placeId, placeId: p.placeId, name: p.name, location: p.location, category: 'sight', icon: '📍', startTime, durationMin, points: 0, status: 'upcoming' });
const day = () => [visit(fort, '09:00', 180), visit(palace, '14:00', 90)];
const lunchOf = (stops: Stop[]) => stops.find((s) => s.category === 'food');

describe('lunch added by code', () => {
  it('picks the place known for a dish that fits the diet over the nearest fast food', async () => {
    const r = await session([fort, palace, fastFood, sweets, meaty, plain, thali], 'veg').settle(day());
    assert.equal(lunchOf(r.stops)?.name, 'rajasthani thali at Laxmi Mishthan Bhandar');
    assert.match(lunchOf(r.stops)?.reason ?? '', /known for its rajasthani thali/);
  });

  it("with nothing famous that fits, picks a proper restaurant, not one famous for meat they can't eat", async () => {
    const r = await session([fort, palace, fastFood, sweets, meaty, plain], 'veg').settle(day());
    assert.equal(lunchOf(r.stops)?.name, 'vegetarian thali at Shree Bhojanalaya');
  });

  it('skips a place that is closed at lunchtime', async () => {
    const r = await session([fort, palace, fastFood, dinnerOnly, plain], 'nonveg').settle(day());
    assert.equal(lunchOf(r.stops)?.placeId, 'plain');
  });
});
