import type { Stop } from '@tagalong/shared';

import { toMin, type PlaceFacts } from './validate.js';

// Code sets the clock. The model's start_time is a "not before" hint (e.g. sunset at 17:30); real
// start times come from travel time and opening hours. Models are poor at this arithmetic.

const fmt = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const ceil5 = (min: number) => Math.ceil(min / 5) * 5;

export function schedule(stops: Stop[], facts: Record<string, PlaceFacts>, opts: { notBefore?: string } = {}): Stop[] {
  let prevEnd: number | undefined;
  return stops.map((s) => {
    if (s.status === 'skipped') return s;
    const hint = toMin(s.startTime);
    const earliest = prevEnd === undefined ? Math.max(hint, opts.notBefore ? toMin(opts.notBefore) : 0) : prevEnd + (s.hop?.minutes ?? 0);
    let start = ceil5(Math.max(hint, earliest));

    // Arriving before opening: wait for it, if that window still fits the visit.
    const hours = s.placeId ? facts[s.placeId]?.hours : undefined;
    if (Array.isArray(hours) && hours.length) {
      const fits = hours.find((h) => Math.max(start, toMin(h.open)) + s.durationMin <= toMin(h.close));
      if (fits) start = Math.max(start, toMin(fits.open));
    }

    prevEnd = start + s.durationMin;
    return { ...s, startTime: fmt(start) };
  });
}
