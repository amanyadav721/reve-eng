// Domain types shared by the app and the API. Keep this file free of runtime dependencies.

export type StopCategory = 'food' | 'sight' | 'transport' | 'nature' | 'culture' | 'shopping';

export type TransportMode = 'walk' | 'auto' | 'cab' | 'metro' | 'bus' | 'train' | 'scooter';

export type StopStatus = 'done' | 'now' | 'upcoming' | 'skipped';

/**
 * How to get from the previous stop to this one. Fares are always a range, never exact, in the
 * trip's currency. `estimated` means no road data yet: minutes come from distance, not a route.
 */
export interface Hop {
  mode: TransportMode;
  minutes: number;
  fareMin?: number;
  fareMax?: number;
  estimated?: boolean;
  tip?: string;
}

export interface Stop {
  id: string;
  /** Place ID from our places source. Every stop the AI proposes must carry one, so it can be verified. */
  placeId?: string;
  name: string;
  location?: { lat: number; lng: number };
  category: StopCategory;
  icon: string;
  /** Local time, 24-hour "HH:mm". */
  startTime: string;
  durationMin: number;
  cost?: number;
  openUntil?: string;
  distanceKm?: number;
  hop?: Hop;
  /** Why Laddoo picked this, usually grounded in a memory. */
  reason?: string;
  /** A stop for a moment at a set time; its start is pinned to that time for the date and place. */
  moment?: 'sunrise' | 'sunset' | 'evening_aarti';
  points: number;
  status: StopStatus;
}

export interface TripDay {
  id: string;
  tripId: string;
  dayNumber: number;
  date: string;
  city: string;
  /** ISO 4217 code ("INR", "USD"). Every amount in the day is in this currency. */
  currency: string;
  stops: Stop[];
}

export interface Dish {
  id: string;
  name: string;
  city: string;
  place: string;
  emoji: string;
  points: number;
  tasted: boolean;
}

export type MemoryKind = 'fact' | 'habit' | 'love' | 'skip' | 'person' | 'promise';

export type MemorySource = 'quiz' | 'chat' | 'checkins' | 'edits';

export interface Memory {
  id: string;
  kind: MemoryKind;
  text: string;
  /** Where it came from, in words the user understands ("You skipped laal maas twice"). */
  evidence: string;
  source: MemorySource;
  icon?: string;
  /** Health, religion, money or other people. Saved only after the user agrees. */
  sensitive: boolean;
  createdAt: string;
}

export interface TripSummary {
  id: string;
  city: string;
  startDate: string;
  endDate: string;
  stamps: number;
  status: 'planned' | 'active' | 'past';
}

/** Answers from the pre-trip quiz. Everything except destination and dates is optional. */
export interface TripPreferences {
  city: string;
  startDate: string;
  endDate: string;
  arrival?: { mode: TransportMode | 'flight'; time: string };
  group?: 'solo' | 'partner' | 'friends' | 'family' | 'parents';
  /** Per person per day, excluding stay, in `currency`. */
  budgetPerDay?: number;
  /** ISO 4217 code. Defaults to the destination's currency. */
  currency?: string;
  pace?: 'chill' | 'balanced' | 'packed';
  interests?: string[];
  diet?: 'veg' | 'nonveg' | 'egg' | 'jain' | 'vegan';
  spice?: 'mild' | 'medium' | 'hot';
  language?: string;
}

/** "₹40", "₹60–80", "$12–18", "€9". Whole units; no decimals for travel prices. */
export function formatMoneyRange(min: number | undefined, max: number | undefined, currency = 'INR'): string | undefined {
  if (min === undefined) return undefined;
  const whole = Number.isInteger(min) && (max === undefined || Number.isInteger(max));
  const fmt = new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en', { style: 'currency', currency, minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 });
  if (max === undefined || max === min) return fmt.format(min);
  // "₹60–80": the symbol once, at the front.
  const lo = fmt.format(min);
  const hi = fmt.formatToParts(max).filter((p) => p.type !== 'currency' && p.type !== 'literal').map((p) => p.value).join('');
  return `${lo}–${hi}`;
}

/** "13:45" → "1:45 PM" */
export function formatTime12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}
