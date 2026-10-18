import type { Memory, TripPreferences } from '@tagalong/shared';
import { getTimes } from 'suncalc';

// "Moments" are things that happen at a set time of day: sunrise, sunset, the evening Ganga aarti.
// The model tags a stop with the moment it's for; our code pins it to the real clock time for that
// date and place, and makes sure the moments the traveler loves are in the plan.

export type Moment = 'sunrise' | 'sunset' | 'evening_aarti';

export const MOMENTS: readonly Moment[] = ['sunrise', 'sunset', 'evening_aarti'];

const LABEL: Record<Moment, string> = { sunrise: 'sunrise', sunset: 'sunset', evening_aarti: 'the evening aarti' };
export const momentLabel = (m: Moment) => LABEL[m];

/** Local "HH:mm" of sunrise or sunset in the city's timezone, or undefined near the poles. */
export function sunTime(date: string, at: { lat: number; lng: number }, which: 'sunrise' | 'sunset', timeZone: string): string | undefined {
  // Noon UTC on the date is the same calendar day almost everywhere people travel.
  const t = getTimes(new Date(`${date}T12:00:00Z`), at.lat, at.lng)[which];
  if (!t || Number.isNaN(t.getTime())) return undefined;
  return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(t);
}

/**
 * When a stop for each moment should start, in minutes after midnight. Sunset spots start a little
 * before sunset for the golden hour; sunrise a little before first light. The evening Ganga aarti
 * (Varanasi, Rishikesh, Haridwar) begins after dusk, about half an hour after sunset.
 */
export function momentStarts(sunrise?: string, sunset?: string): Partial<Record<Moment, number>> {
  const min = (t?: string) => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : undefined);
  const rise = min(sunrise);
  const set = min(sunset);
  return {
    ...(rise !== undefined ? { sunrise: rise - 20 } : {}),
    ...(set !== undefined ? { sunset: set - 40, evening_aarti: set + 30 } : {}),
  };
}

const LOVES: [RegExp, Moment][] = [
  [/\bsunrises?\b/i, 'sunrise'],
  [/\bsunsets?\b/i, 'sunset'],
  [/\baarti\b/i, 'evening_aarti'],
];

/**
 * Moments the traveler must get, from what they love (memories of kind love/habit/fact, and quiz
 * interests). Things they skip never count.
 */
export function requiredMoments(memories: Memory[], interests: TripPreferences['interests'] = [], city = ''): Moment[] {
  const text = [...memories.filter((m) => m.kind !== 'skip').map((m) => m.text), ...interests].join(' • ');
  const found = LOVES.filter(([re]) => re.test(text)).map(([, m]) => m);
  // The Ganga aarti only happens on the Ganges.
  const onGanga = /varanasi|rishikesh|haridwar|banaras|kashi|prayagraj|allahabad/i.test(city);
  return [...new Set(found)].filter((m) => m !== 'evening_aarti' || onGanga);
}
