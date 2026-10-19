import { formatMoneyRange, type Memory, type TransportMode, type TripPreferences } from '@tagalong/shared';

import { momentLabel, sunTime, type Moment } from './moments.js';
import type { DayRules } from './validate.js';

const PACE = { chill: '2–3 stops', balanced: '4–5 stops', packed: '6–7 stops' } as const;
const DIET: Record<NonNullable<TripPreferences['diet']>, string> = {
  veg: 'vegetarian (no meat, fish or eggs)',
  egg: 'vegetarian but eats eggs (no meat or fish)',
  nonveg: 'eats everything',
  jain: 'Jain (vegetarian, no eggs, no onion, garlic or root vegetables)',
  vegan: 'vegan (no dairy, meat, fish or eggs)',
};

export interface PromptInput {
  city: string;
  date: string;
  dayNumber: number;
  totalDays: number;
  prefs: Partial<TripPreferences>;
  rules: DayRules;
  memories: Memory[];
  stayNear?: string;
  cityCenter?: { lat: number; lng: number };
  currency: string;
  timeZone: string;
  /** Modes that exist in this country, with local names ("auto-rickshaw", "Uber/Lyft"). */
  modes: { mode: TransportMode; name?: string }[];
  /** Moments they love, which the day must include. */
  mustHave?: Moment[];
  /** Minimum food stops today. */
  foodStops?: number;
  /** Re-planning the rest of today. */
  replan?: { now: string; instruction: string; done: string[]; remaining: string[]; lunchDone: boolean };
}

export function systemPrompt(): string {
  return [
    'You are Laddoo, the trip planner inside Tagalong: a warm, well-traveled local friend who knows exactly what to do next.',
    'You plan ONE day at a time as an ordered list of stops with times.',
    '',
    'Hard rules. Our checker rejects plans that break them:',
    '1. Every stop must be a place returned by search_places in this conversation. Never invent places, opening hours, prices or travel times.',
    '2. Call place_details for every place before scheduling it, and only schedule it inside its hours for that day. "not listed" hours are fine for ghats, viewpoints and street stalls.',
    '3. Call get_route for consecutive stops with the mode you plan to use. Our code sets the exact clock times from those routes and opening hours; your start_time is the earliest each stop should begin.',
    '4. Respect the pace, the budget, the start time and everything the traveler skips.',
    '5. If the day runs through midday (starts before 12:30 and ends after 14:00), include a lunch stop between 11:30 and 15:00.',
    '',
    'What makes a great Tagalong day:',
    '- Food is a hero. For food stops, name the specific famous local dish and pick the place best known for it. Use web_search to find what the city is famous for.',
    '- Sensible geography: cluster nearby stops, avoid zig-zagging across the city.',
    '- Right time for each place: sunsets at sunset, markets when they are lively, heavy sights before the midday heat.',
    '- Practical transport, using only the modes listed for this city: walk under ~1 km, the cheapest ride for short hops, cabs for long or hilly rides, metro or rail where it exists.',
    '- If get_weather shows heat over 35°C or rain over 50%, put indoor or shaded stops in those hours.',
    '- reason: one or two short sentences, specific and a little cheeky. When a memory applies, use it ("You loved the mirchi vada in Jodhpur, so…"). Wrap the remembered detail in **double asterisks**.',
    '- That example is not this traveler\'s memory. Cite only what is listed under "What Laddoo remembers" and "Loves:"; never make up a dish, trip or place they loved.',
    '',
    'Before calling submit_plan, check:',
    '- Lunch: a food stop with a named local dish between 12:00 and 14:30 if the day runs through midday.',
    '- Loves: every "Must include" moment is in the plan, tagged with timed_for. Sunset and aarti stops go at the end of the day; sunrise at the start.',
    '- Memory: at least one reason mentions what you remember about them, in **double asterisks**.',
    '- Money: entry fees + food + ride fares (from get_route) fit the budget.',
    '- Time: the whole day, including travel, ends by 21:30.',
    '',
    'Work efficiently: search, check details and routes, then call submit_plan. If submit_plan replies with issues, fix exactly those and submit again.',
  ].join('\n');
}

export function requestPrompt(p: PromptInput): string {
  const weekday = new Date(`${p.date}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'long', timeZone: 'UTC' });
  const lines = [
    p.replan
      ? `Re-plan the REST of today in ${p.city} (${weekday}, ${p.date}), starting now at ${p.replan.now} from where the traveler is. ${p.replan.instruction}`
      : `Plan day ${p.dayNumber} of ${p.totalDays} in ${p.city}: ${weekday}, ${p.date}.`,
    p.replan?.done.length ? `Already done today (don't repeat): ${p.replan.done.join('; ')}.` : undefined,
    p.replan?.remaining.length ? `Still planned (keep what still works, replace the rest): ${p.replan.remaining.join('; ')}.` : undefined,
    p.replan?.lunchDone ? 'They have had lunch.' : undefined,
    p.replan ? 'Use near_place_id with places near them. The first stop should be close.' : undefined,
    p.replan
      ? `Fill the time from ${p.replan.now} on: leave no stretch longer than 2 hours with nothing planned (rides count as planned). If a stop is pinned later, like a sunset, add places before it.`
      : undefined,
    p.stayNear ? `Staying near: ${p.stayNear}. Start and end the day near there.` : undefined,
    p.cityCenter ? `Sunrise ${sunTime(p.date, p.cityCenter, 'sunrise', p.timeZone) ?? 'unknown'}, sunset ${sunTime(p.date, p.cityCenter, 'sunset', p.timeZone) ?? 'unknown'} (local time).` : undefined,
    p.mustHave?.length
      ? `Must include (they love it): ${p.mustHave.map((m) => `a stop for ${momentLabel(m)} with timed_for "${m}"`).join('; ')}. Plan the rest of the day around it.`
      : undefined,
    p.foodStops ? `Food: at least ${p.foodStops} food stop${p.foodStops > 1 ? 's' : ''} today, each with a named dish.` : undefined,
    `Getting around here: ${p.modes.map((m) => (m.name ? `${m.mode} (${m.name})` : m.mode)).join(', ')}. Prices are in ${p.currency}.`,
    p.prefs.group ? `Traveling: ${p.prefs.group}.` : undefined,
    `Pace: ${p.rules.pace ?? p.prefs.pace ?? 'balanced'} (${PACE[p.rules.pace ?? p.prefs.pace ?? 'balanced']}, not counting rides).`,
    p.rules.budgetPerDay ? `Budget: ${formatMoneyRange(p.rules.budgetPerDay, undefined, p.currency)} per person for the day, including entry fees, food and rides.` : undefined,
    p.rules.notBefore ? `Start no earlier than ${p.rules.notBefore}. Finish by 21:30.` : 'Finish by 21:30.',
    p.prefs.diet ? `Diet: ${DIET[p.prefs.diet]}.` : undefined,
    p.prefs.spice ? `Spice: ${p.prefs.spice}.` : undefined,
    p.prefs.interests?.length ? `Loves: ${p.prefs.interests.join(', ')}.` : undefined,
    p.prefs.language && p.prefs.language !== 'en' ? `Write each reason in ${p.prefs.language}.` : undefined,
    '',
    p.memories.length ? 'What Laddoo remembers about this traveler:' : undefined,
    ...p.memories.map((m) => `- [${m.kind}] ${m.text} (${m.evidence})`),
  ];
  return lines.filter((l) => l !== undefined).join('\n');
}
