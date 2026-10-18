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
    const out = schedule([st('a', '10:00', 60), st('b', '11:00', 30, 22)], {});
    assert.deepEqual(out.map((s) => s.startTime), ['10:00', '11:25']);
  });

  it('keeps a later hint, like a sunset spot', () => {
    const out = schedule([st('a', '10:00', 60), st('sunset', '17:20', 60, 30)], {});
    assert.equal(out[1].startTime, '17:20');
  });

  it('waits for opening time', () => {
    const out = schedule([st('a', '07:30', 30), st('museum', '08:00', 60, 10)], { p_museum: { hours: [{ open: '10:00', close: '17:00' }] } });
    assert.equal(out[1].startTime, '10:00');
  });

  it('respects the remembered start time', () => {
    assert.equal(schedule([st('a', '06:00', 60)], {}, { notBefore: '08:00' })[0].startTime, '08:00');
  });
});
