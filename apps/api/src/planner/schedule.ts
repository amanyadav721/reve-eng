import type { Stop } from '@tagalong/shared';

import type { Moment } from './moments.js';
import { toMin, type PlaceFacts } from './validate.js';

// Code sets the clock. The model's start_time is a "not before" hint; real start times come from
// travel time and opening hours, and stops for a moment (sunset, sunrise, aarti) are pinned to it.
// Models are poor at this arithmetic.

const fmt = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const ceil5 = (min: number) => Math.ceil(min / 5) * 5;

export interface ScheduleOptions {
  notBefore?: string;
  /** Start time (minutes after midnight) for each moment on this date and place. */
  momentStarts?: Partial<Record<Moment, number>>;
}

export interface Missed {
  stopId: string;
  moment: Moment;
  /** When the stop should start, and the earliest the traveler can get there. */
  due: string;
  earliest: string;
}

/** Arriving this late still catches the moment. */
const GRACE_MIN = 15;

export function schedule(stops: Stop[], facts: Record<string, PlaceFacts>, opts: ScheduleOptions = {}): { stops: Stop[]; missed: Missed[] } {
  let prevEnd: number | undefined;
  const missed: Missed[] = [];
  const out = stops.map((s) => {
    if (s.status === 'skipped') return s;
    const hint = toMin(s.startTime);
    const earliest = prevEnd === undefined ? Math.max(hint, opts.notBefore ? toMin(opts.notBefore) : 0) : prevEnd + (s.hop?.minutes ?? 0);
    const pinned = s.moment ? opts.momentStarts?.[s.moment] : undefined;

    let start: number;
    if (pinned !== undefined) {
      // A moment waits for no one: start at its time, or report that the day can't make it.
      start = Math.max(ceil5(earliest), pinned - (pinned % 5));
      if (earliest > pinned + GRACE_MIN) missed.push({ stopId: s.id, moment: s.moment!, due: fmt(pinned), earliest: fmt(ceil5(earliest)) });
    } else {
      start = ceil5(Math.max(hint, earliest));
      // Arriving before opening: wait for it, if that window still fits the visit.
      const hours = s.placeId ? facts[s.placeId]?.hours : undefined;
      if (Array.isArray(hours) && hours.length) {
        const fits = hours.find((h) => Math.max(start, toMin(h.open)) + s.durationMin <= toMin(h.close));
        if (fits) start = Math.max(start, toMin(fits.open));
      }
    }

    prevEnd = start + s.durationMin;
    return { ...s, startTime: fmt(start) };
  });
  return { stops: out, missed };
}
