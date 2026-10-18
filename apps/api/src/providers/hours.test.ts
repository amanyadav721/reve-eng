import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { hoursOn } from './hours.js';
import type { HoursPeriod } from './types.js';

// 2026-10-18 is a Sunday (day 0); 2026-10-19 is a Monday.
const p = (day: number, open: string, closeDay: number, close: string): HoursPeriod => {
  const [oh, om] = open.split(':').map(Number);
  const [ch, cm] = close.split(':').map(Number);
  return { open: { day, hour: oh, minute: om }, close: { day: closeDay, hour: ch, minute: cm } };
};

describe('hoursOn', () => {
  it('reads regular weekly hours for the weekday', () => {
    const museum = { regularHours: [p(1, '10:00', 1, '17:00'), p(0, '09:00', 0, '18:00')] };
    assert.deepEqual(hoursOn(museum, '2026-10-19'), [{ open: '10:00', close: '17:00' }]);
    assert.deepEqual(hoursOn(museum, '2026-10-18'), [{ open: '09:00', close: '18:00' }]);
  });

  it('returns no intervals on a weekly closed day', () => {
    const museum = { regularHours: [p(2, '10:00', 2, '17:00')] };
    assert.deepEqual(hoursOn(museum, '2026-10-19'), []);
  });

  it('splits overnight hours across midnight', () => {
    const bar = { regularHours: [p(0, '19:00', 1, '02:00')] };
    assert.deepEqual(hoursOn(bar, '2026-10-18'), [{ open: '19:00', close: '24:00' }]);
    assert.deepEqual(hoursOn(bar, '2026-10-19'), [{ open: '00:00', close: '02:00' }]);
  });

  it('treats a single period with no close as open 24/7', () => {
    assert.deepEqual(hoursOn({ regularHours: [{ open: { day: 0, hour: 0, minute: 0 } }] }, '2026-10-21'), [{ open: '00:00', close: '24:00' }]);
  });

  it('prefers dated current hours, so holiday closures win', () => {
    const date = (day: number) => ({ year: 2026, month: 10, day });
    const fort = {
      regularHours: [p(1, '08:00', 1, '17:30')],
      currentHours: [
        { open: { day: 0, hour: 8, minute: 0, date: date(18) }, close: { day: 0, hour: 17, minute: 30, date: date(18) } },
        // nothing on Monday the 19th (Diwali closure), open again Tuesday
        { open: { day: 2, hour: 8, minute: 0, date: date(20) }, close: { day: 2, hour: 17, minute: 30, date: date(20) } },
      ],
    };
    assert.deepEqual(hoursOn(fort, '2026-10-19'), []);
    assert.deepEqual(hoursOn(fort, '2026-10-20'), [{ open: '08:00', close: '17:30' }]);
  });

  it('falls back to weekly hours outside the 7-day window', () => {
    const fort = {
      regularHours: [p(1, '08:00', 1, '17:30')],
      currentHours: [{ open: { day: 0, hour: 8, minute: 0, date: { year: 2026, month: 10, day: 18 } }, close: { day: 0, hour: 17, minute: 30, date: { year: 2026, month: 10, day: 18 } } }],
    };
    assert.deepEqual(hoursOn(fort, '2026-11-02'), [{ open: '08:00', close: '17:30' }]);
  });

  it("says 'unknown' when Google lists no hours", () => {
    assert.equal(hoursOn({}, '2026-10-19'), 'unknown');
  });
});
