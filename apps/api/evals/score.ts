import type { Stop } from '@tagalong/shared';

import { dietConflict } from '../src/planner/diet.js';
import type { PlanDayResult } from '../src/planner/planDay.js';
import type { Scenario } from './scenarios.js';

// Scores one planned day. "valid" comes from our validator (hard rules); the rest are checks the
// validator can't do deterministically, so some are keyword heuristics and labelled as such.

export interface Check {
  name: string;
  pass: boolean;
  detail?: string;
}

export interface Score {
  id: string;
  ok: boolean;
  checks: Check[];
  passed: number;
  total: number;
}

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

export function score(s: Scenario, r: PlanDayResult): Score {
  const checks: Check[] = [];
  const stops = r.stops;

  checks.push({ name: 'valid plan', pass: r.ok, detail: r.ok ? undefined : r.error ?? r.issues.map((i) => i.message).join(' | ') });
  checks.push({ name: 'every stop is a real place', pass: stops.length > 0 && stops.every((st) => !!st.placeId) });

  if (s.expect.minFoodStops) {
    const n = stops.filter((st) => st.category === 'food').length;
    checks.push({ name: `≥ ${s.expect.minFoodStops} food stop(s)`, pass: n >= s.expect.minFoodStops, detail: `${n}` });
  }

  const food = stops.filter((st) => st.category === 'food');
  checks.push({ name: 'food stops name a dish', pass: food.length === 0 || food.every((st) => / at /.test(st.name)), detail: food.map((f) => f.name).join('; ') });

  const dietHit = food.find((st) => dietConflict(s.prefs.diet, st.name));
  checks.push({ name: `food fits the diet (${s.prefs.diet ?? 'any'})`, pass: !dietHit, detail: dietHit?.name });

  // Names only: a reason saying "away from crowded Baga" isn't a visit to Baga.
  for (const re of s.expect.mustNotMention ?? []) {
    const hit = stops.find((st) => re.test(st.name));
    checks.push({ name: `avoids ${re.source} (heuristic)`, pass: !hit, detail: hit?.name });
  }

  if (s.expect.stopBetween) {
    const { from, to, label } = s.expect.stopBetween;
    const hit = stops.find((st) => toMin(st.startTime) >= toMin(from) && toMin(st.startTime) <= toMin(to));
    checks.push({ name: `has a ${label} stop (${from}–${to})`, pass: !!hit, detail: hit?.name });
  }

  if (s.expect.maxWalkMin !== undefined) {
    const long = stops.find((st) => st.hop?.mode === 'walk' && st.hop.minutes > s.expect.maxWalkMin!);
    checks.push({ name: `no walk over ${s.expect.maxWalkMin} min`, pass: !long, detail: long ? `${long.hop?.minutes} min to ${long.name}` : undefined });
  }

  if (s.memories.length) {
    const used = stops.some((st) => st.reason?.includes('**'));
    checks.push({ name: 'uses a memory in a reason', pass: used });
  }

  const passed = checks.filter((c) => c.pass).length;
  return { id: s.id, ok: passed === checks.length, checks, passed, total: checks.length };
}
