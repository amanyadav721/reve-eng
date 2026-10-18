import type { Stop } from '@tagalong/shared';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { estimateFare } from './fare.js';
import { validateDay, type PlaceFacts } from './validate.js';

const stop = (over: Partial<Stop> & Pick<Stop, 'id' | 'startTime'>): Stop => ({
  name: over.id,
  category: 'sight',
  icon: '📍',
  durationMin: 60,
  points: 10,
  status: 'upcoming',
  placeId: `p_${over.id}`,
  ...over,
});

const allDay: PlaceFacts = { hours: [{ open: '06:00', close: '23:00' }] };
const open = (...ids: string[]) => Object.fromEntries(ids.map((id) => [`p_${id}`, allDay]));

describe('validateDay', () => {
  it('accepts a feasible day', () => {
    const day = [
      stop({ id: 'fort', startTime: '10:00', durationMin: 120 }),
      stop({ id: 'lunch', category: 'food', startTime: '12:30', durationMin: 45, hop: { mode: 'auto', minutes: 20 } }),
    ];
    assert.deepEqual(validateDay(day, open('fort', 'lunch')), []);
  });

  it('flags stops without a place_id', () => {
    const issues = validateDay([stop({ id: 'cafe', startTime: '09:00', placeId: undefined })], {});
    assert.equal(issues[0].code, 'unverified_place');
  });

  it('flags a place visited outside its opening hours', () => {
    const issues = validateDay([stop({ id: 'museum', startTime: '17:30', durationMin: 60 })], { p_museum: { hours: [{ open: '10:00', close: '18:00' }] } });
    assert.equal(issues[0].code, 'closed');
    assert.match(issues[0].message, /10:00–18:00/);
  });

  it('flags a place closed all day', () => {
    const issues = validateDay([stop({ id: 'museum', startTime: '11:00' })], { p_museum: { hours: [] } });
    assert.match(issues[0].message, /closed all day/);
  });

  it('lets places with no listed hours through, but never shut ones', () => {
    const day = [stop({ id: 'ghat', startTime: '06:00' })];
    assert.deepEqual(validateDay(day, { p_ghat: { hours: 'unknown' } }), []);
    assert.equal(validateDay(day, { p_ghat: { hours: 'unknown', shut: true } })[0].code, 'closed');
  });

  it('flags too little travel time between stops', () => {
    const day = [stop({ id: 'a', startTime: '10:00', durationMin: 60 }), stop({ id: 'b', startTime: '11:10', hop: { mode: 'cab', minutes: 35 } })];
    assert.equal(validateDay(day, open('a', 'b'))[0].code, 'not_enough_travel_time');
  });

  it('respects remembered rules: budget, pace and start time', () => {
    const day = [
      stop({ id: 'a', startTime: '07:00', costInr: 600 }),
      stop({ id: 'b', startTime: '08:30', costInr: 600, hop: { mode: 'auto', minutes: 10, fareMaxInr: 120 } }),
      stop({ id: 'c', startTime: '10:00', costInr: 600 }),
      stop({ id: 'd', startTime: '11:15' }),
    ];
    const codes = validateDay(day, open('a', 'b', 'c', 'd'), { budgetPerDayInr: 1500, pace: 'chill', notBefore: '08:00' }).map((i) => i.code);
    assert.deepEqual(codes.sort(), ['over_budget', 'too_early', 'too_many_stops']);
  });

  it('wants a food stop when the day runs through lunch', () => {
    const day = [stop({ id: 'a', startTime: '11:00', durationMin: 120 }), stop({ id: 'b', startTime: '13:30', durationMin: 90 })];
    assert.ok(validateDay(day, open('a', 'b')).some((i) => i.code === 'no_lunch'));
  });

  it('ignores skipped stops', () => {
    const day = [stop({ id: 'a', startTime: '10:00' }), stop({ id: 'gone', startTime: '10:15', status: 'skipped', placeId: undefined })];
    assert.deepEqual(validateDay(day, open('a')), []);
  });
});

describe('estimateFare', () => {
  it('is free to walk', () => {
    assert.deepEqual(estimateFare('walk', 3), { minInr: 0, maxInr: 0 });
  });

  it('gives a range that grows with distance', () => {
    const near = estimateFare('auto', 2);
    const far = estimateFare('auto', 10);
    assert.ok(near.minInr < near.maxInr);
    assert.ok(far.minInr > near.maxInr);
  });

  it('prices a cab above an auto for the same trip', () => {
    assert.ok(estimateFare('cab', 9).minInr > estimateFare('auto', 9).minInr);
  });

  it('caps metro fares', () => {
    assert.equal(estimateFare('metro', 80).maxInr, 60);
  });

  it('rejects bad distances', () => {
    assert.throws(() => estimateFare('auto', -1));
  });
});
