import type { Stop } from '@tagalong/shared';
import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

// Runs against a real Postgres with the migrations applied: scripts/test-db.sh sets
// TEST_DATABASE_URL to a throwaway database. Skipped otherwise.
const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;
const { asUser, closeDb } = await import('./store.js');

const stop = (name: string, startTime: string, o: Partial<Stop> = {}): Stop => ({
  id: name,
  name,
  category: 'sight',
  icon: '📍',
  startTime,
  durationMin: 60,
  points: 20,
  status: 'upcoming',
  ...o,
});

describe('store', { skip: !url && 'needs TEST_DATABASE_URL (run scripts/test-db.sh)' }, () => {
  after(() => closeDb());

  it('saves quiz memories once, and forgets for real', async () => {
    await asUser('user_a', async (s) => {
      assert.equal(await s.addMemories([
        { kind: 'fact', text: 'Vegetarian', evidence: 'You said so in the quiz', source: 'quiz' },
        { kind: 'love', text: 'Loves sunsets', evidence: 'You said so in the quiz', source: 'quiz' },
      ]), 2);
      // Taking the quiz again doesn't duplicate anything.
      assert.equal(await s.addMemories([{ kind: 'fact', text: 'vegetarian', evidence: 'again', source: 'quiz' }]), 0);
      const all = await s.memories();
      assert.deepEqual(all.map((m) => m.text), ['Loves sunsets', 'Vegetarian'].sort());
      assert.equal(await s.forget(all[0].id), true);
      assert.equal((await s.memories()).length, 1);
    });
  });

  it('creates a multi-city trip with a city per day, and saves a day of stops', async () => {
    const trip = await asUser('user_a', (s) =>
      s.createTrip({
        destination: 'Rajasthan',
        startDate: '2026-10-20',
        preferences: { pace: 'balanced', diet: 'veg' },
        legs: [
          { city: 'Jaipur', country: 'in', timeZone: 'Asia/Kolkata', currency: 'INR', days: 2 },
          { city: 'Udaipur', country: 'in', timeZone: 'Asia/Kolkata', currency: 'INR', days: 1 },
        ],
      }),
    );
    assert.equal(trip.endDate, '2026-10-22');
    assert.deepEqual(trip.days.map((d) => `${d.dayNumber} ${d.date} ${d.city} ${d.planned}`), ['1 2026-10-20 Jaipur false', '2 2026-10-21 Jaipur false', '3 2026-10-22 Udaipur false']);

    const day = await asUser('user_a', (s) =>
      s.saveStops(trip.id, 1, [
        stop('Amber Fort', '09:30', { placeId: 'ovt:1', location: { lat: 26.98, lng: 75.85 }, status: 'now', cost: 200 }),
        stop('Sunset at Nahargarh', '17:10', { placeId: 'ovt:2', moment: 'sunset', hop: { mode: 'auto', minutes: 30, fareMin: 150, fareMax: 200 }, distanceKm: 9.5 }),
      ]),
    );
    assert.equal(day.planned, true);
    assert.equal(day.stops.length, 2);
    const [fort, sunset] = day.stops;
    assert.match(fort.id, /^[0-9a-f-]{36}$/);
    assert.deepEqual([fort.startTime, fort.status, fort.cost, fort.location], ['09:30', 'now', 200, { lat: 26.98, lng: 75.85 }]);
    assert.deepEqual([sunset.moment, sunset.hop?.fareMax, sunset.distanceKm], ['sunset', 200, 9.5]);

    // Saving again replaces the day (a re-plan or a check-in).
    const again = await asUser('user_a', (s) => s.saveStops(trip.id, 1, [{ ...fort, status: 'done' }]));
    assert.deepEqual(again.stops.map((x) => x.status), ['done']);
    assert.equal(again.stops[0].id, fort.id, 'a stop keeps its ID across saves');
    assert.deepEqual(await asUser('user_a', (s) => s.placesUsed(trip.id, 2)), ['ovt:1']);
    assert.equal((await asUser('user_a', (s) => s.currentTrip('2026-10-19')))?.id, trip.id);
  });

  it("keeps travelers apart: another user can't see or change the trip", async () => {
    const trip = await asUser('user_a', (s) => s.currentTrip('2026-10-19'));
    assert.ok(trip);
    assert.equal(await asUser('user_b', (s) => s.trip(trip.id)), undefined);
    assert.equal(await asUser('user_b', (s) => s.currentTrip('2026-10-19')), undefined);
    await assert.rejects(asUser('user_b', (s) => s.saveStops(trip.id, 1, [])), /day not found/);
    assert.deepEqual(await asUser('user_b', (s) => s.memories()), []);
  });

  it('adds up points', async () => {
    assert.equal(await asUser('user_a', (s) => s.addPoints(25)), 25);
    assert.equal(await asUser('user_a', (s) => s.addPoints(40)), 65);
    assert.equal(await asUser('user_b', (s) => s.points()), 0);
  });
});
