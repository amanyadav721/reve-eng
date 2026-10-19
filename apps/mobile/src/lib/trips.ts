import type { Memory, MemoryKind, Stop, TripPreferences } from '@tagalong/shared';

// What the API sends back for trips, days and memories (apps/api/src/routes/travel.ts).

export interface Leg {
  city: string;
  country?: string;
  timeZone?: string;
  currency?: string;
  days: number;
  why?: string;
}

export interface DayInfo {
  dayNumber: number;
  date: string;
  city: string;
  country?: string;
  timeZone?: string;
  currency: string;
  planned: boolean;
}

export interface Trip {
  id: string;
  destination: string;
  startDate: string;
  endDate: string;
  currency: string;
  preferences: Partial<TripPreferences>;
  legs: Leg[];
  days: DayInfo[];
}

export interface Day extends DayInfo {
  tripId: string;
  stops: Stop[];
}

export type ReplanTrigger = 'late' | 'skip' | 'tired' | 'hungry' | 'rain' | 'bored';

export interface ReplanReply {
  ok: boolean;
  message: string;
  changes: string[];
  options?: Stop[];
  usedAI: boolean;
  day: Day;
}

export interface NewMemory {
  kind: MemoryKind;
  text: string;
  evidence: string;
  source: Memory['source'];
  icon?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** The phone's local date, "YYYY-MM-DD". */
export function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The phone's local time, "HH:mm". */
export function localTime(d = new Date()): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return localDate(d);
}

/** Which day of the trip to show: today's, else the first (before the trip) or the last (after). */
export function dayToShow(trip: Trip, today = localDate()): DayInfo {
  return trip.days.find((d) => d.date === today) ?? (today < trip.startDate ? trip.days[0] : trip.days[trip.days.length - 1]);
}
