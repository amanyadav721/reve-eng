import type { Stop } from '@tagalong/shared';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { schedule } from './schedule.js';

const st = (id: string, startTime: string, durationMin: number, hopMin?: number): Stop => ({
  id, placeId: `p_${id}`, name: id, category: 'sight', icon: '📍', startTime, durationMin, points: 0, status: 'upcoming',
  ...(hopMin !== undefined ? { hop: { mode: 'auto', minutes: hopMin } } : {}),
});

describe('schedule', () => {
  it('pushes stops back so travel time fits', () => {
    const { stops: out } = schedule([st('a', '10:00', 60), st('b', '11:00', 30, 22)], {});
    assert.deepEqual(out.map((s) => s.startTime), ['10:00', '11:25']);
  });

  it('keeps a later hint, like a sunset spot', () => {
    const { stops: out } = schedule([st('a', '10:00', 60), st('sunset', '17:20', 60, 30)], {});
    assert.equal(out[1].startTime, '17:20');
  });

  it('waits for opening time', () => {
    const { stops: out } = schedule([st('a', '07:30', 30), st('museum', '08:00', 60, 10)], { p_museum: { hours: [{ open: '10:00', close: '17:00' }] } });
    assert.equal(out[1].startTime, '10:00');
  });

  it('pins a sunset stop to the sunset, whatever time the model wrote', () => {
    const sunset = { ...st('view', '16:00', 60, 20), moment: 'sunset' as const };
    const { stops, missed } = schedule([st('a', '10:00', 60), sunset], {}, { momentStarts: { sunset: 17 * 60 + 13 } });
    assert.equal(stops[1].startTime, '17:10');
    assert.deepEqual(missed, []);
  });

  it('reports a moment the day cannot reach in time', () => {
    const sunset = { ...st('view', '17:00', 60, 90), moment: 'sunset' as const };
    const { missed } = schedule([st('a', '15:00', 120), sunset], {}, { momentStarts: { sunset: 17 * 60 + 10 } });
    assert.deepEqual(missed, [{ stopId: 'view', moment: 'sunset', due: '17:10', earliest: '18:30' }]);
  });

  it('respects the remembered start time', () => {
    assert.equal(schedule([st('a', '06:00', 60)], {}, { notBefore: '08:00' }).stops[0].startTime, '08:00');
  });
});
