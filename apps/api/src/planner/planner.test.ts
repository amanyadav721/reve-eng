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
      stop({ id: 'a', startTime: '07:00', cost: 600 }),
      stop({ id: 'b', startTime: '08:30', cost: 600, hop: { mode: 'auto', minutes: 10, fareMax: 120 } }),
      stop({ id: 'c', startTime: '10:00', cost: 600 }),
      stop({ id: 'd', startTime: '11:15' }),
    ];
    const codes = validateDay(day, open('a', 'b', 'c', 'd'), { budgetPerDay: 1500, pace: 'chill', notBefore: '08:00' }).map((i) => i.code);
    assert.deepEqual(codes.sort(), ['over_budget', 'too_early', 'too_many_stops']);
  });

  it('wants the day to start in the morning', () => {
    const day = [stop({ id: 'sunset', startTime: '18:50' })];
    assert.ok(validateDay(day, open('sunset'), { pace: 'balanced' }).some((i) => i.code === 'starts_late'));
    assert.ok(!validateDay([stop({ id: 'late-brunch', startTime: '12:00' })], open('late-brunch'), { pace: 'chill' }).some((i) => i.code === 'starts_late'));
  });

  it('wants a full day and enough food stops', () => {
    const short = [stop({ id: 'a', startTime: '07:00', durationMin: 90 }), stop({ id: 'b', startTime: '09:00' })];
    const codes = validateDay(short, open('a', 'b'), { pace: 'chill', minFoodStops: 1 }).map((i) => i.code);
    assert.ok(codes.includes('day_too_short') && codes.includes('too_few_food_stops'), codes.join(','));
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
    assert.deepEqual(estimateFare('walk', 3), { min: 0, max: 0 });
  });

  it('gives a range that grows with distance', () => {
    const near = estimateFare('auto', 2)!;
    const far = estimateFare('auto', 10)!;
    assert.ok(near.min < near.max);
    assert.ok(far.min > near.max);
  });

  it('prices a cab above an auto for the same trip', () => {
    assert.ok(estimateFare('cab', 9)!.min > estimateFare('auto', 9)!.min);
  });

  it('caps metro fares', () => {
    assert.equal(estimateFare('metro', 80)!.max, 60);
  });

  it('prices rides in the local currency, and has no autos in the US', () => {
    const miami = estimateFare('cab', 8, 'us')!;
    assert.ok(miami.min >= 10 && miami.max <= 30, JSON.stringify(miami));
    assert.equal(estimateFare('auto', 3, 'us'), undefined);
    assert.equal(estimateFare('metro', 5, 'us')!.max, 2.5);
    assert.equal(estimateFare('cab', 5, 'xx'), undefined, 'no fare model: no made-up number');
  });

  it('rejects bad distances', () => {
    assert.throws(() => estimateFare('auto', -1));
  });
});
