import type { Memory, Stop, TripPreferences } from '@tagalong/shared';

import { countryProfile } from '../places/countries.js';
import type { LatLng } from '../providers/types.js';
import { momentLabel, momentStarts, requiredMoments, sunTime } from './moments.js';
import { planDay, type PlanDayDeps } from './planDay.js';
import { PlannerSession } from './session.js';
import { isLunch, toMin, type DayRules, type Issue } from './validate.js';

// Real-time re-planning: something changed, so re-plan the rest of today from where the traveler is.
// Late, skip, tired and hungry are handled in code (fast enough to feel instant). Rain and bored
// need judgement about what to swap in, so they go to the AI.

export type ReplanTrigger = 'late' | 'skip' | 'tired' | 'hungry' | 'rain' | 'bored';

export interface ReplanInput {
  city: string;
  cityCenter: LatLng;
  date: string;
  country?: string;
  timeZone?: string;
  prefs?: Partial<TripPreferences>;
  memories?: Memory[];
  rules?: DayRules;
  /** Today's plan as the app has it, with statuses. Done stops never change. */
  stops: Stop[];
  /** Local "HH:mm" now. */
  now: string;
  /** Where the traveler is now. */
  location: LatLng;
  trigger: ReplanTrigger;
  /** For skip: which stop (default: the current one). */
  stopId?: string;
  /** What the traveler said, e.g. "something light", "kids are tired". */
  note?: string;
  /** For hungry: the place they picked from the options. */
  choice?: string;
}

export interface ReplanResult {
  ok: boolean;
  /** The whole day: done stops, then the new rest of the day (first one is "now"). */
  stops: Stop[];
  /** Laddoo's one-line summary for the traveler. */
  message: string;
  changes: string[];
  /** Hungry: up to 3 nearby options; the first is in the plan. */
  options?: Stop[];
  issues: Issue[];
  usedAI: boolean;
  ms: number;
}

const CODE_TRIGGERS: ReplanTrigger[] = ['late', 'skip', 'tired', 'hungry'];

export async function replanDay(input: ReplanInput, deps: PlanDayDeps): Promise<ReplanResult> {
  const started = Date.now();
  const done = input.stops.filter((s) => s.status === 'done');
  const rest = input.stops.filter((s) => s.status === 'now' || s.status === 'upcoming').map((s) => ({ ...s, status: 'upcoming' as const }));
  const userSkipped = input.stops.filter((s) => s.status === 'skipped');

  if (!CODE_TRIGGERS.includes(input.trigger)) return replanWithAI(input, deps, { done, rest, userSkipped, started });

  const session = sessionFor(input, deps, done);
  await session.adopt(rest);

  let next: Stop[] = rest;
  let options: Stop[] | undefined;
  const changes: string[] = [];
  let opener: string;
  const skipped: Stop[] = [];

  switch (input.trigger) {
    case 'late':
      opener = `No rush. I've re-timed the rest of your day from ${input.now}.`;
      break;

    case 'skip': {
      const target = rest.find((s) => s.id === input.stopId) ?? rest[0];
      if (target) {
        next = rest.filter((s) => s !== target);
        skipped.push({ ...target, status: 'skipped' });
        changes.push(`Skipped ${target.name}.`);
      }
      opener = target ? `Skipped ${shortName(target)}.` : 'Nothing left to skip today.';
      break;
    }

    case 'tired': {
      const foodLeft = rest.filter((s) => s.category === 'food').length;
      const candidates = rest.filter((s) => !s.moment && !(s.category === 'food' && foodLeft <= 1));
      const victim = candidates.sort((a, b) => b.durationMin + (b.hop?.minutes ?? 0) - (a.durationMin + (a.hop?.minutes ?? 0)))[0];
      if (victim) {
        next = rest.filter((s) => s !== victim);
        skipped.push({ ...victim, status: 'skipped' });
        changes.push(`Dropped ${victim.name} to give you a breather.`);
        opener = `Take it easy. I dropped ${shortName(victim)} so the rest of the day is lighter.`;
      } else if (!rest.some((s) => !s.moment)) {
        opener = 'Take it easy. Nothing else is planned, so rest up.';
      } else {
        // Nothing sensible to drop: shorten what's left instead.
        next = rest.map((s) => (s.moment ? s : { ...s, durationMin: Math.max(20, Math.round((s.durationMin * 0.75) / 5) * 5) }));
        opener = 'Take it easy. I shortened the rest of your stops.';
      }
      break;
    }

    case 'hungry': {
      const inPlan = new Set(input.stops.map((s) => s.placeId).filter((x): x is string => !!x));
      options = await session.foodOptions(input.location, toMin(input.now), 3, inPlan);
      const pick = options.find((o) => o.placeId === input.choice) ?? options[0];
      if (!pick) {
        opener = "I couldn't find anything open close by. Want me to look a bit further?";
        break;
      }
      const meal: Stop = { ...pick, id: `food-now-${Date.now()}`, startTime: input.now };
      next = [meal, ...rest];
      // They asked to eat: repairs may drop other things for it, never the meal itself.
      session.input.keepIds = [meal.id];
      changes.push(`Added ${meal.name}.`);
      opener = `${shortName(meal)} is close by and open now.`;
      break;
    }

    default:
      opener = '';
  }

  // A moment the traveler skipped is no longer required today, and a skipped lunch isn't put back.
  const skippedMoments = new Set([...userSkipped, ...skipped].map((s) => s.moment));
  session.input.mustHave = session.input.mustHave?.filter((m) => !skippedMoments.has(m));
  if ([...userSkipped, ...skipped].some((s) => isLunch(s))) session.input.lunchDone = true;

  // Old start times would act as "not before" hints; the rest of the day may now start earlier.
  const settled = await session.settle(next.map((s) => ({ ...s, startTime: input.now })));
  // What settle let go (a sunset out of reach, a palace closed by then) shows as skipped.
  const lost = settled.letGo.map((s) => ({ ...s, startTime: rest.find((r) => r.id === s.id)?.startTime ?? s.startTime }));
  const sorry = lost.filter((s) => s.moment).map((s) => `Sorry, we can't make the ${momentLabel(s.moment!)} at ${shortName(s)} in time today.`);

  changes.push(...settled.repairs);
  changes.push(...diff(rest, settled.stops, [...skipped, ...lost], changes));
  const stops = assemble(done, [...userSkipped, ...skipped, ...lost], settled.stops);
  const blocking = settled.issues.filter((i) => i.code !== 'memory_unused');

  return {
    ok: blocking.length === 0,
    stops,
    message: [opener, ...sorry, ...headline(settled.repairs)].filter(Boolean).join(' '),
    changes: [...new Set(changes)],
    options,
    issues: blocking,
    usedAI: false,
    ms: Date.now() - started,
  };
}

/** Rain or boredom: the AI re-plans the rest of today around what changed. */
async function replanWithAI(
  input: ReplanInput,
  deps: PlanDayDeps,
  ctx: { done: Stop[]; rest: Stop[]; userSkipped: Stop[]; started: number },
): Promise<ReplanResult> {
  const instruction =
    input.trigger === 'rain'
      ? `It's raining now${input.note ? ` (${input.note})` : ''}. Swap outdoor stops (beaches, viewpoints, gardens, ghats, open-air markets, walks) for indoor ones nearby: museums, palace interiors, cafés, covered markets, temples. Keep indoor stops that still work. There's no sunset or sunrise to see in the rain, so skip those.`
      : `The traveler is bored with the plan${input.note ? ` ("${input.note}")` : ''}. Suggest something more fun nearby for the next few hours, based on what they love. Plan stops back to back from now: every hour until the last stop should have something to do. Keep meals and loved moments.`;

  const result = await planDay(
    {
      city: input.city,
      cityCenter: input.cityCenter,
      date: input.date,
      country: input.country,
      timeZone: input.timeZone,
      prefs: input.prefs,
      memories: input.memories,
      rules: input.rules,
      // Don't bring back what they already skipped today.
      avoidPlaceIds: ctx.userSkipped.map((s) => s.placeId).filter((x): x is string => !!x),
      replan: { origin: input.location, now: input.now, instruction, done: ctx.done, remaining: ctx.rest, indoors: input.trigger === 'rain', dropMoments: input.trigger === 'rain' ? ['sunset', 'sunrise'] : undefined },
    },
    deps,
  );

  const stops = assemble(ctx.done, ctx.userSkipped, result.stops);
  // Repairs about stops they already finished (the model re-adding one) aren't news to the traveler.
  const doneNames = ctx.done.map((s) => s.name);
  const repairs = result.repairs.filter((r) => !doneNames.some((n) => r.includes(n)));
  const changes = [...repairs, ...diff(ctx.rest, result.stops, [], repairs)];
  const opener = input.trigger === 'rain' ? "Rain's here, so I moved you indoors." : 'Here is something more fun for the next few hours.';
  return {
    ok: result.ok,
    stops,
    message: result.ok ? opener : `${opener} I couldn't make every part work, so check the plan.`,
    changes,
    issues: result.issues,
    usedAI: true,
    ms: Date.now() - ctx.started,
  };
}

function sessionFor(input: ReplanInput, deps: PlanDayDeps, done: Stop[]): PlannerSession {
  const country = countryProfile(input.country);
  const timeZone = input.timeZone ?? 'Asia/Kolkata';
  const starts = momentStarts(sunTime(input.date, input.cityCenter, 'sunrise', timeZone), sunTime(input.date, input.cityCenter, 'sunset', timeZone));
  const nowMin = toMin(input.now);
  const doneMoments = new Set(done.map((s) => s.moment).filter(Boolean));
  const mustHave = requiredMoments(input.memories ?? [], input.prefs?.interests, input.city).filter(
    (m) => starts[m] !== undefined && !doneMoments.has(m) && starts[m]! + 15 >= nowMin,
  );
  return new PlannerSession(deps, {
    city: input.city,
    cityCenter: input.cityCenter,
    date: input.date,
    rules: { pace: input.prefs?.pace, budgetPerDay: input.prefs?.budgetPerDay, ...input.rules, notBefore: input.now, currency: input.prefs?.currency ?? country.currency },
    memories: input.memories ?? [],
    interests: input.prefs?.interests,
    spice: input.prefs?.spice,
    avoidPlaceIds: done.map((s) => s.placeId).filter((x): x is string => !!x),
    diet: input.prefs?.diet,
    country: country.code,
    currency: input.prefs?.currency ?? country.currency,
    modes: country.modes,
    momentStarts: starts,
    mustHave,
    origin: input.location,
    partial: true,
    lunchDone: done.some((s) => isLunch(s)) || nowMin > 14 * 60 + 30,
  });
}

/** Done stops, then the new rest of the day (first one "now") with skipped stops crossed out in time order. */
function assemble(done: Stop[], skipped: Stop[], rest: Stop[]): Stop[] {
  const later = [
    ...skipped.map((s) => ({ ...s, status: 'skipped' as const })),
    ...rest.map((s, i) => ({ ...s, status: i === 0 ? ('now' as const) : ('upcoming' as const) })),
  ].sort((a, b) => toMin(a.startTime) - toMin(b.startTime));
  return [...done, ...later];
}

/** What changed for the traveler, in words: dropped stops and big time shifts not already explained. */
function diff(before: Stop[], after: Stop[], skipped: Stop[], explained: string[]): string[] {
  const out: string[] = [];
  const key = (s: Stop) => s.placeId ?? s.id;
  const afterByKey = new Map(after.map((s) => [key(s), s]));
  const skippedKeys = new Set(skipped.map(key));
  for (const b of before) {
    const a = afterByKey.get(key(b));
    if (!a) {
      if (!skippedKeys.has(key(b)) && !explained.some((e) => e.includes(b.name))) out.push(`Dropped ${b.name}.`);
    } else if (Math.abs(toMin(a.startTime) - toMin(b.startTime)) >= 10) {
      out.push(`${shortName(a)} now at ${a.startTime} (was ${b.startTime}).`);
    }
  }
  const beforeKeys = new Set(before.map(key));
  for (const a of after) if (!beforeKeys.has(key(a)) && !explained.some((e) => e.includes(a.name))) out.push(`Added ${a.name}.`);
  return out;
}

/** The repair worth saying out loud, e.g. keeping a loved moment. */
function headline(repairs: string[]): string[] {
  const moment = repairs.find((r) => /^Dropped .* in time for/.test(r));
  if (moment) return [moment.replace(/^Dropped /, 'I dropped ').replace(/ so you make it in time for (.+)\.$/, (_m, what) => ` to keep your ${what}.`)];
  const late = repairs.find((r) => /ends by/.test(r));
  if (late) return [late.replace(/^Dropped /, 'I dropped ')];
  return [];
}

const shortName = (s: Stop) => s.name.split(' at ').pop()!;
