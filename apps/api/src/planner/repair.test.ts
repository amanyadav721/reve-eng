import type { Stop } from '@tagalong/shared';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { repairDay, type RepairContext } from './repair.js';
import { schedule } from './schedule.js';

const st = (id: string, startTime: string, durationMin: number, o: Partial<Stop> = {}): Stop => ({
  id, placeId: `p_${id}`, name: id, category: 'sight', icon: '📍', startTime, durationMin, points: 0, status: 'upcoming',
  hop: { mode: 'auto', minutes: 20 }, ...o,
});

const ctx = (o: Partial<RepairContext> = {}): RepairContext => ({
  pace: 'balanced',
  minFoodStops: 1,
  notAfter: '22:00',
  // Sunset spots start at 17:10 on this pretend day.
  schedule: (list) => schedule(list, {}, { notBefore: '08:00', momentStarts: { sunset: 17 * 60 + 10 } }),
  relink: async () => {},
  findLunch: async () => undefined,
  ...o,
});

const names = (stops: Stop[]) => stops.map((s) => s.name);

describe('repairDay', () => {
  it('drops the far-flung stop when there are too many for the pace', async () => {
    const day = [st('a', '08:00', 60), st('lunch', '12:30', 45, { category: 'food' }), st('b', '10:00', 60), st('far', '14:00', 60, { hop: { mode: 'cab', minutes: 70 } }), st('c', '15:30', 30), st('d', '16:30', 30)];
    const r = await repairDay(day, ctx());
    assert.deepEqual(names(r.stops), ['a', 'lunch', 'b', 'c', 'd']);
    assert.match(r.repairs[0], /Dropped far: too many stops/);
  });

  it('drops an earlier stop so a loved sunset is reached in time, never the sunset itself', async () => {
    const day = [st('fort', '08:00', 180), st('lunch', '12:30', 60, { category: 'food' }), st('museum', '14:00', 150), st('sunset', '17:00', 60, { moment: 'sunset' })];
    // fort 08:00–11:00, lunch 12:30–13:30, museum 13:50–16:20, sunset needs 17:10: fits. Make the museum longer.
    day[2].durationMin = 200;
    const r = await repairDay(day, ctx());
    assert.ok(names(r.stops).includes('sunset'));
    assert.ok(!names(r.stops).includes('museum'), names(r.stops).join(','));
    assert.deepEqual(r.missed, []);
  });

  it('drops the last ordinary stop when the day runs past 22:00', async () => {
    const day = [st('a', '09:00', 120), st('lunch', '12:30', 60, { category: 'food' }), st('b', '15:00', 120), st('late-show', '20:30', 120)];
    const r = await repairDay(day, ctx());
    assert.deepEqual(names(r.stops), ['a', 'lunch', 'b']);
    assert.match(r.repairs.join(' '), /ends by 22:00/);
  });

  it('adds lunch near midday when the day has none', async () => {
    const day = [st('fort', '09:00', 150), st('palace', '12:30', 90), st('bazaar', '15:00', 90)];
    const lunch = st('thali', '12:30', 45, { category: 'food', name: 'vegetarian thali at LMB' });
    let insertedAt = -1;
    const r = await repairDay(day, ctx({ findLunch: async (_s, at) => ((insertedAt = at), lunch) }));
    assert.equal(insertedAt, 1);
    assert.deepEqual(names(r.stops), ['fort', 'vegetarian thali at LMB', 'palace', 'bazaar']);
    assert.match(r.repairs.join(' '), /Added lunch/);
  });

  // The headline sight matters more than a minor stop, whatever its ride or length.
  const famous = (...ids: string[]) => (s: Stop) => (ids.includes(s.id) ? 2 : 0);

  it('too many stops: drops a minor stop, not the far-off headline sight', async () => {
    const day = [st('a', '08:00', 60), st('lunch', '12:30', 45, { category: 'food' }), st('b', '10:00', 60), st('City Palace', '14:00', 60, { hop: { mode: 'cab', minutes: 70 } }), st('c', '15:30', 30), st('d', '16:30', 30, { hop: { mode: 'auto', minutes: 25 } })];
    const r = await repairDay(day, ctx({ importance: famous('City Palace', 'a', 'b', 'c') }));
    assert.deepEqual(names(r.stops), ['a', 'lunch', 'b', 'City Palace', 'c']);
    assert.match(r.repairs[0], /Dropped d: too many stops/);
  });

  it('missed sunset: drops a minor stop before it, not the long famous one', async () => {
    // City Palace 10:00–13:00, lunch, souvenirs 14:40–17:10: the 17:10 sunset is out of reach.
    // The old rule dropped the stop costing the most time, City Palace.
    const day = [st('City Palace', '10:00', 180), st('lunch', '12:30', 60, { category: 'food' }), st('souvenirs', '14:00', 150), st('sunset', '17:00', 60, { moment: 'sunset' })];
    const r = await repairDay(day, ctx({ importance: famous('City Palace') }));
    assert.deepEqual(names(r.stops), ['City Palace', 'lunch', 'sunset']);
    assert.deepEqual(r.missed, []);
  });

  it('day too late: drops the minor stop, even when the famous one is last', async () => {
    // b runs 14:00–18:00, so Chokhi Dhani (4 hours) would end at 22:20.
    const day = [st('a', '09:00', 120), st('lunch', '12:30', 60, { category: 'food' }), st('b', '14:00', 240), st('Chokhi Dhani', '17:00', 240)];
    const r = await repairDay(day, ctx({ pace: undefined, importance: famous('Chokhi Dhani', 'a') }));
    assert.deepEqual(names(r.stops), ['a', 'lunch', 'Chokhi Dhani']);
    assert.match(r.repairs.join(' '), /Dropped b so the day ends by 22:00/);
  });

  it('never drops the only meal the traveler needs, even to end on time', async () => {
    const day = [st('a', '09:00', 60), st('dinner', '21:30', 90, { category: 'food' })];
    const r = await repairDay(day, ctx({ pace: undefined }));
    assert.ok(names(r.stops).includes('dinner'));
  });
});
