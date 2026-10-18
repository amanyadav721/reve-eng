import type { Stop, TripPreferences } from '@tagalong/shared';

import type { Missed } from './schedule.js';
import { dayEnd, isLunch, MAX_STOPS, missingLunch, toMin } from './validate.js';

// Code fixes the mechanical problems itself instead of sending them back to the model, which is
// slow and often fails to converge: too many stops, a loved moment we can't reach, a day that runs
// past 22:00, or no lunch. It never drops a loved moment, and never drops a meal the traveler needs.

export interface RepairContext {
  pace?: TripPreferences['pace'];
  minFoodStops: number;
  /** Re-planning after lunch already happened: never insert another. */
  lunchDone?: boolean;
  /** Re-planning from the traveler's position: lunch may go first. */
  lunchAtStart?: boolean;
  /** When the day must end, "HH:mm". */
  notAfter: string;
  /** Re-times the day; returns any loved moment the day can't reach. */
  schedule: (stops: Stop[]) => { stops: Stop[]; missed: Missed[] };
  /** Recomputes travel into each stop after the order changed. */
  relink: (stops: Stop[]) => Promise<void>;
  /** A lunch stop near the given position, from places already found (or a quick search). */
  findLunch: (stops: Stop[], insertAt: number) => Promise<Stop | undefined>;
}

export interface RepairResult {
  stops: Stop[];
  missed: Missed[];
  /** What code changed, in words ("Dropped Albert Hall to make the sunset in time"). */
  repairs: string[];
}

const MAX_REPAIRS = 8;

export async function repairDay(input: Stop[], ctx: RepairContext): Promise<RepairResult> {
  let stops = input;
  const repairs: string[] = [];
  let timed = ctx.schedule(stops);

  const retime = async () => {
    await ctx.relink(stops);
    timed = ctx.schedule(stops);
    stops = timed.stops;
  };
  stops = timed.stops;

  for (let n = 0; n < MAX_REPAIRS; n++) {
    const places = stops.filter((s) => s.category !== 'transport');

    // 1. Too many stops for the pace: drop the one with the longest ride in (the geography outlier).
    const max = ctx.pace ? MAX_STOPS[ctx.pace] : undefined;
    if (max && places.length > max) {
      const victim = pick(droppable(stops, ctx), (s) => s.hop?.minutes ?? 0);
      if (victim) {
        stops = stops.filter((s) => s !== victim);
        repairs.push(`Dropped ${victim.name}: too many stops for a ${ctx.pace} day.`);
        await retime();
        continue;
      }
    }

    // 2. A loved moment we can't reach: drop the earlier stop that costs the most time.
    const late = timed.missed[0];
    if (late) {
      const at = stops.findIndex((s) => s.id === late.stopId);
      const victim = pick(
        droppable(stops, ctx).filter((s) => stops.indexOf(s) < at),
        (s) => s.durationMin + (s.hop?.minutes ?? 0),
      );
      if (victim) {
        stops = stops.filter((s) => s !== victim);
        repairs.push(`Dropped ${victim.name} so you make it in time for ${late.moment.replace('_', ' ')}.`);
        await retime();
        continue;
      }
    }

    // 3. The day runs too late: drop the last ordinary stop.
    if (dayEnd(stops) > toMin(ctx.notAfter)) {
      const victim = droppable(stops, ctx).at(-1);
      if (victim) {
        stops = stops.filter((s) => s !== victim);
        repairs.push(`Dropped ${victim.name} so the day ends by ${ctx.notAfter}.`);
        await retime();
        continue;
      }
    }

    // 4. No lunch: add one near wherever the traveler is around midday.
    if (!ctx.lunchDone && missingLunch(stops)) {
      const found = stops.findIndex((s) => toMin(s.startTime) >= 12 * 60 - 15);
      const insertAt = found === -1 ? stops.length : Math.max(ctx.lunchAtStart ? 0 : 1, found);
      const lunch = await ctx.findLunch(stops, insertAt);
      if (lunch) {
        stops = [...stops.slice(0, insertAt), lunch, ...stops.slice(insertAt)];
        repairs.push(`Added lunch: ${lunch.name}.`);
        await retime();
        continue;
      }
    }
    break;
  }
  return { stops, missed: timed.missed, repairs };
}

/** Stops code may remove: never a loved moment, never the only lunch, never a needed meal. */
function droppable(stops: Stop[], ctx: RepairContext): Stop[] {
  const food = stops.filter((s) => s.category === 'food').length;
  const lunches = stops.filter((s) => isLunch(s)).length;
  return stops.filter((s, i) => {
    if (i === 0 && stops.length <= 2) return false;
    if (s.moment) return false;
    if (s.category === 'food' && food <= ctx.minFoodStops) return false;
    if (isLunch(s) && lunches <= 1) return false;
    return true;
  });
}

function pick<T>(items: T[], score: (t: T) => number): T | undefined {
  return items.reduce<T | undefined>((best, t) => (best === undefined || score(t) > score(best) ? t : best), undefined);
}
