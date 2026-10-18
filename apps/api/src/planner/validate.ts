import type { Stop, TripPreferences } from '@tagalong/shared';

// The AI proposes, real data verifies, code decides.
// validateDay() is the "code decides" part: it rejects plans the model got wrong, and its
// messages are sent back to the model so it can fix them.

export interface OpenInterval {
  /** "HH:mm", local time. close may be "24:00". */
  open: string;
  close: string;
}

export interface PlaceFacts {
  /**
   * Opening intervals for the day being planned. Empty means closed all day. 'unknown' means
   * Google lists no hours (ghats, viewpoints, street stalls); those pass, and the app says
   * "hours not listed".
   */
  hours: OpenInterval[] | 'unknown';
  /** Permanently or temporarily closed. */
  shut?: boolean;
}

export type IssueCode =
  | 'unverified_place'
  | 'unknown_hours'
  | 'closed'
  | 'out_of_order'
  | 'not_enough_travel_time'
  | 'over_budget'
  | 'too_many_stops'
  | 'too_early'
  | 'no_lunch'
  | 'repeated_place'
  | 'no_route'
  | 'diet_mismatch'
  | 'memory_unused'
  | 'too_few_stops'
  | 'missing_dish'
  | 'too_late';

export interface Issue {
  code: IssueCode;
  stopId?: string;
  message: string;
}

export interface DayRules {
  pace?: TripPreferences['pace'];
  budgetPerDayInr?: number;
  /** Earliest start the traveler accepts, "HH:mm". From memory ("Nothing before 8 AM"). */
  notBefore?: string;
  /** When the day should be over. Default 22:00. */
  notAfter?: string;
}

const MAX_STOPS = { chill: 3, balanced: 5, packed: 7 } as const;
const MIN_STOPS = { chill: 2, balanced: 3, packed: 5 } as const;
// A day needs a food stop if it runs through midday: starts before 12:30 and ends after 14:00.
const LUNCH = { from: toMin('12:00'), to: toMin('15:00'), dayStartsBefore: toMin('12:30'), dayEndsAfter: toMin('14:00') };

export function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function validateDay(stops: Stop[], places: Record<string, PlaceFacts>, rules: DayRules = {}): Issue[] {
  const issues: Issue[] = [];
  const active = stops.filter((s) => s.status !== 'skipped');

  for (const [i, s] of active.entries()) {
    const start = toMin(s.startTime);
    const end = start + s.durationMin;

    if (!s.placeId) {
      issues.push({ code: 'unverified_place', stopId: s.id, message: `"${s.name}" has no place_id. Look it up with search_places before using it.` });
    } else if (!places[s.placeId]) {
      issues.push({ code: 'unknown_hours', stopId: s.id, message: `No opening hours loaded for "${s.name}". Call place_details first.` });
    } else {
      const { hours, shut } = places[s.placeId];
      const fits = hours === 'unknown' || hours.some((h) => start >= toMin(h.open) && end <= toMin(h.close));
      if (shut) {
        issues.push({ code: 'closed', stopId: s.id, message: `"${s.name}" is closed (temporarily or permanently). Pick another place.` });
      } else if (!fits) {
        const when = hours.length ? hours.map((h) => `${h.open}–${h.close}`).join(', ') : 'closed all day';
        issues.push({ code: 'closed', stopId: s.id, message: `"${s.name}" is not open ${s.startTime}–${fmt(end)} (hours: ${when}).` });
      }
    }

    const prev = active[i - 1];
    if (prev) {
      const prevEnd = toMin(prev.startTime) + prev.durationMin;
      if (start < toMin(prev.startTime)) {
        issues.push({ code: 'out_of_order', stopId: s.id, message: `"${s.name}" starts before "${prev.name}". Stops must be in time order.` });
      } else if (start - prevEnd < (s.hop?.minutes ?? 0)) {
        issues.push({
          code: 'not_enough_travel_time',
          stopId: s.id,
          message: `Only ${start - prevEnd} min between "${prev.name}" and "${s.name}", but the trip takes ${s.hop?.minutes} min.`,
        });
      }
    }

    if (rules.notBefore && i === 0 && start < toMin(rules.notBefore)) {
      issues.push({ code: 'too_early', stopId: s.id, message: `The day starts at ${s.startTime}, but this traveler doesn't start before ${rules.notBefore}.` });
    }
  }

  if (rules.budgetPerDayInr !== undefined) {
    // Fares are ranges; budget against the middle of the range.
    const fare = (s: Stop) => (s.hop?.fareMinInr !== undefined && s.hop.fareMaxInr !== undefined ? Math.round((s.hop.fareMinInr + s.hop.fareMaxInr) / 2) : (s.hop?.fareMaxInr ?? 0));
    const spend = active.reduce((sum, s) => sum + (s.costInr ?? 0) + fare(s), 0);
    if (spend > rules.budgetPerDayInr) {
      const sum = (pick: (s: Stop) => number) => active.reduce((t, s) => t + pick(s), 0);
      const entries = sum((s) => (s.category === 'food' ? 0 : (s.costInr ?? 0)));
      const food = sum((s) => (s.category === 'food' ? (s.costInr ?? 0) : 0));
      const rides = sum(fare);
      issues.push({
        code: 'over_budget',
        message: `The day costs about ₹${spend} (entries ₹${entries}, food ₹${food}, rides ₹${rides}), over the ₹${rules.budgetPerDayInr} budget.`,
      });
    }
  }

  if (rules.pace) {
    const places = active.filter((s) => s.category !== 'transport').length;
    if (places > MAX_STOPS[rules.pace]) {
      issues.push({ code: 'too_many_stops', message: `${places} stops is too many for a ${rules.pace} day (max ${MAX_STOPS[rules.pace]}).` });
    } else if (places < MIN_STOPS[rules.pace]) {
      issues.push({ code: 'too_few_stops', message: `${places} stops is too few for a ${rules.pace} day (at least ${MIN_STOPS[rules.pace]}).` });
    }
  }

  if (active.length && lastEnd(active) > toMin(rules.notAfter ?? '22:00')) {
    issues.push({ code: 'too_late', message: `The day ends at ${fmt(lastEnd(active))}, after ${rules.notAfter ?? '22:00'}.` });
  }

  const spansLunch = active.length > 0 && toMin(active[0].startTime) < LUNCH.dayStartsBefore && lastEnd(active) > LUNCH.dayEndsAfter;
  const hasLunch = active.some((s) => s.category === 'food' && toMin(s.startTime) >= LUNCH.from - 30 && toMin(s.startTime) <= LUNCH.to);
  if (spansLunch && !hasLunch) {
    issues.push({ code: 'no_lunch', message: 'The day runs through lunch but has no food stop between 11:30 and 15:00.' });
  }

  return issues;
}

function lastEnd(stops: Stop[]): number {
  const last = stops[stops.length - 1];
  return toMin(last.startTime) + last.durationMin;
}

function fmt(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}
