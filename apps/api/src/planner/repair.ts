import type { Stop, TripPreferences } from '@tagalong/shared';

import type { Missed } from './schedule.js';
import { dayEnd, isLunch, MAX_STOPS, missingLunch, toMin } from './validate.js';

// Code fixes the mechanical problems itself instead of sending them back to the model, which is
// slow and often fails to converge: too many stops, a loved moment we can't reach, a day that runs
// past 22:00, or no lunch. It never drops a loved moment, a meal the traveler needs, or a stop they
// just asked for. When it must drop something, minor stops go first: a city's headline sight and
// the things the traveler loves stay.

export interface RepairContext {
  pace?: TripPreferences['pace'];
  minFoodStops: number;
  /** Re-planning after lunch already happened: never insert another. */
  lunchDone?: boolean;
  /** Re-planning: the traveler's day carries on from this time, "HH:mm". */
  activeFrom?: string;
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
  /** Stop ids the traveler asked for just now (the meal when they're hungry): never dropped. */
  keep?: Set<string>;
  /** How much a stop matters (famous, loved). The least important is dropped first. */
  importance?: (s: Stop) => number;
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
  // Re-time from the original "not before" hints, so a dropped stop frees time for the ones after it.
  const hints = new Map(input.map((s) => [s.id, s.startTime]));
  const hinted = (list: Stop[]) => list.map((s) => (hints.has(s.id) ? { ...s, startTime: hints.get(s.id)! } : s));
  let timed = ctx.schedule(hinted(stops));

  const retime = async () => {
    await ctx.relink(stops);
    timed = ctx.schedule(hinted(stops));
    stops = timed.stops;
  };
  stops = timed.stops;

  for (let n = 0; n < MAX_REPAIRS; n++) {
    const places = stops.filter((s) => s.category !== 'transport');

    // 1. Too many stops for the pace: drop the least important, then the longest ride in (the geography outlier).
    const max = ctx.pace ? MAX_STOPS[ctx.pace] : undefined;
    if (max && places.length > max) {
      const victim = pick(leastImportant(droppable(stops, ctx), ctx), (s) => s.hop?.minutes ?? 0);
      if (victim) {
        stops = stops.filter((s) => s !== victim);
        repairs.push(`Dropped ${victim.name}: too many stops for a ${ctx.pace} day.`);
        await retime();
        continue;
      }
    }

    // 2. A loved moment we can't reach: drop the least important earlier stop, the one costing the most time.
    const late = timed.missed[0];
    if (late) {
      const at = stops.findIndex((s) => s.id === late.stopId);
      const victim = pick(
        leastImportant(droppable(stops, ctx).filter((s) => stops.indexOf(s) < at), ctx),
        (s) => s.durationMin + (s.hop?.minutes ?? 0),
      );
      if (victim) {
        stops = stops.filter((s) => s !== victim);
        repairs.push(`Dropped ${victim.name} so you make it in time for ${late.moment.replace('_', ' ')}.`);
        await retime();
        continue;
      }
    }

    // 3. The day runs too late: drop the least important stop whose removal ends the day sooner, latest first.
    if (dayEnd(stops) > toMin(ctx.notAfter)) {
      const end = dayEnd(stops);
      const helps = (v: Stop) => dayEnd(ctx.schedule(hinted(stops.filter((s) => s !== v))).stops) < end;
      const candidates = byImportance(droppable(stops, ctx).reverse(), ctx);
      const victim = candidates.find(helps) ?? candidates[0];
      if (victim) {
        stops = stops.filter((s) => s !== victim);
        repairs.push(`Dropped ${victim.name} so the day ends by ${ctx.notAfter}.`);
        await retime();
        continue;
      }
    }

    // 4. No lunch: add one near wherever the traveler is around midday.
    if (!ctx.lunchDone && missingLunch(stops, ctx.activeFrom)) {
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
    if (ctx.keep?.has(s.id)) return false;
    if (s.category === 'food' && food <= ctx.minFoodStops) return false;
    if (isLunch(s) && lunches <= 1) return false;
    return true;
  });
}

/** Least important first; a stable sort keeps the given order among equals. */
function byImportance(stops: Stop[], ctx: RepairContext): Stop[] {
  if (!ctx.importance) return stops;
  const score = new Map(stops.map((s) => [s, ctx.importance!(s)]));
  return [...stops].sort((a, b) => score.get(a)! - score.get(b)!);
}

/** The droppable stops that matter least, in day order. All of them when importance is unknown. */
function leastImportant(stops: Stop[], ctx: RepairContext): Stop[] {
  if (!ctx.importance || !stops.length) return stops;
  const score = new Map(stops.map((s) => [s, ctx.importance!(s)]));
  const low = Math.min(...score.values());
  return stops.filter((s) => score.get(s) === low);
}

function pick<T>(items: T[], score: (t: T) => number): T | undefined {
  return items.reduce<T | undefined>((best, t) => (best === undefined || score(t) > score(best) ? t : best), undefined);
}
