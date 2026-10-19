import type { Memory, Stop, TripPreferences } from '@tagalong/shared';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';

import { env } from '../env.js';

// The traveler's trips, days and memories in Supabase Postgres. Every query runs inside a
// transaction as the `authenticated` role with the Clerk user ID as the JWT subject, so the same
// row-level security that guards the database from the app guards it from us too: a bug here can't
// read or write another traveler's rows.

type Sql = postgres.Sql;

let client: Sql | undefined;

export function dbConfigured(): boolean {
  return !!env.DATABASE_URL;
}

function sql(): Sql {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  // Prepared statements save a round trip per query (the database may be far away). Supabase's
  // transaction pooler (port 6543) can't keep them; its session pooler and direct connections can.
  const transactionPooler = new URL(env.DATABASE_URL).port === '6543';
  client ??= postgres(env.DATABASE_URL, { prepare: !transactionPooler, max: 5, idle_timeout: 60, onnotice: () => {} });
  return client;
}

/** Runs `fn` as this traveler, under row-level security. */
export async function asUser<T>(userId: string, fn: (store: Store) => Promise<T>): Promise<T> {
  return sql().begin(async (tx) => {
    const q = tx as unknown as Sql;
    // Same as SET LOCAL ROLE plus the JWT claims, in one round trip (the database may be far away).
    await q`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: 'authenticated' })}, true), set_config('role', 'authenticated', true)`;
    return fn(new Store(q));
  }) as Promise<T>;
}

export async function closeDb(): Promise<void> {
  await client?.end({ timeout: 5 });
  client = undefined;
}

export interface NewMemory {
  kind: Memory['kind'];
  text: string;
  evidence: string;
  source: Memory['source'];
  icon?: string;
  sensitive?: boolean;
}

export interface Leg {
  city: string;
  country?: string;
  timeZone?: string;
  currency?: string;
  days: number;
  why?: string;
}

export interface TripDayInfo {
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
  days: TripDayInfo[];
}

export interface Day extends TripDayInfo {
  tripId: string;
  stops: Stop[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export class Store {
  constructor(private readonly q: Sql) {}

  private json(value: unknown) {
    return this.q.json(value as postgres.JSONValue);
  }

  // ── Memories ────────────────────────────────────────────────────────────────

  async memories(): Promise<Memory[]> {
    const rows = await this.q`
      select id, kind, text, evidence, source, icon, sensitive, created_at
      from public.memories order by created_at, text`;
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      text: r.text,
      evidence: r.evidence,
      source: r.source,
      ...(r.icon ? { icon: r.icon } : {}),
      sensitive: r.sensitive,
      createdAt: new Date(r.created_at).toISOString(),
    }));
  }

  /** Adds what's new; anything Laddoo already knows (same text) is left as it is. */
  async addMemories(list: NewMemory[]): Promise<number> {
    if (!list.length) return 0;
    // One row per text, even if the list repeats itself ("on conflict" can't touch a row twice).
    const unique = [...new Map(list.map((m) => [m.text.toLowerCase(), m])).values()];
    const rows = unique.map((m) => ({
      kind: m.kind,
      text: m.text,
      evidence: m.evidence,
      source: m.source,
      icon: m.icon ?? null,
      sensitive: !!m.sensitive,
      consented_at: m.sensitive ? new Date() : null,
    }));
    const added = await this.q`
      insert into public.memories ${this.q(rows, 'kind', 'text', 'evidence', 'source', 'icon', 'sensitive', 'consented_at')}
      on conflict (user_id, lower(text)) do nothing
      returning id`;
    return added.length;
  }

  /** Forget for real: the row is deleted. */
  async forget(id: string): Promise<boolean> {
    const rows = await this.q`delete from public.memories where id = ${id} returning id`;
    return rows.length > 0;
  }

  // ── Profile ─────────────────────────────────────────────────────────────────

  async points(): Promise<number> {
    const [row] = await this.q`select points from public.profiles`;
    return row?.points ?? 0;
  }

  async addPoints(n: number): Promise<number> {
    const [row] = await this.q`
      insert into public.profiles (points) values (${Math.max(0, n)})
      on conflict (user_id) do update set points = public.profiles.points + excluded.points
      returning points`;
    return row.points;
  }

  // ── Trips ───────────────────────────────────────────────────────────────────

  async createTrip(input: { destination: string; startDate: string; legs: Leg[]; preferences: Partial<TripPreferences> }): Promise<Trip> {
    const total = input.legs.reduce((n, l) => n + l.days, 0);
    const first = input.legs[0];
    const endDate = addDays(input.startDate, total - 1);
    const currency = first.currency ?? input.preferences.currency ?? 'INR';
    const [trip] = await this.q`
      insert into public.trips (city, destination, start_date, end_date, status, preferences, legs, currency, country, time_zone)
      values (${first.city}, ${input.destination}, ${input.startDate}, ${endDate}, 'planned',
              ${this.json(input.preferences)}, ${this.json(input.legs)},
              ${currency}, ${first.country ?? null}, ${first.timeZone ?? null})
      returning id`;
    const days = input.legs.flatMap((leg) => Array.from({ length: leg.days }, () => leg));
    const rows = days.map((leg, n) => ({
      trip_id: trip.id,
      day_number: n + 1,
      date: addDays(input.startDate, n),
      city: leg.city,
      country: leg.country ?? null,
      time_zone: leg.timeZone ?? null,
      currency: leg.currency ?? currency,
    }));
    await this.q`insert into public.trip_days ${this.q(rows, 'trip_id', 'day_number', 'date', 'city', 'country', 'time_zone', 'currency')}`;
    return (await this.trip(trip.id))!;
  }

  async trip(id: string): Promise<Trip | undefined> {
    // One round trip: the database may be on another continent.
    const [t] = await this.q`
      select t.id, coalesce(t.destination, t.city) as destination, t.start_date::text, t.end_date::text, t.currency, t.preferences, t.legs,
        coalesce((
          select json_agg(json_build_object(
            'dayNumber', d.day_number, 'date', d.date::text, 'city', coalesce(d.city, ''), 'country', d.country, 'timeZone', d.time_zone,
            'currency', coalesce(d.currency, t.currency), 'planned', d.planned_at is not null) order by d.day_number)
          from public.trip_days d where d.trip_id = t.id), '[]'::json) as days
      from public.trips t where t.id = ${id}`;
    if (!t) return undefined;
    return {
      id: t.id,
      destination: t.destination,
      startDate: t.start_date,
      endDate: t.end_date,
      currency: t.currency,
      preferences: t.preferences ?? {},
      legs: t.legs ?? [],
      days: (t.days as (TripDayInfo & { country: string | null; timeZone: string | null })[]).map(({ country, timeZone, ...d }) => ({
        ...d,
        ...(country ? { country } : {}),
        ...(timeZone ? { timeZone } : {}),
      })),
    };
  }

  /** The trip happening now or next; otherwise the most recent one. */
  async currentTrip(today: string): Promise<Trip | undefined> {
    const [upcoming] = await this.q`
      select id from public.trips where end_date >= ${today} order by start_date, created_at desc limit 1`;
    const [latest] = upcoming ? [upcoming] : await this.q`select id from public.trips order by created_at desc limit 1`;
    return latest ? this.trip(latest.id) : undefined;
  }

  async day(tripId: string, dayNumber: number): Promise<Day | undefined> {
    const [d] = await this.q`
      select d.day_number, d.date::text, coalesce(d.city, '') as city, d.country, d.time_zone, coalesce(d.currency, t.currency) as currency,
        d.planned_at is not null as planned,
        coalesce((select json_agg(s.* order by s.position) from public.stops s where s.day_id = d.id), '[]'::json) as stops
      from public.trip_days d join public.trips t on t.id = d.trip_id
      where d.trip_id = ${tripId} and d.day_number = ${dayNumber}`;
    if (!d) return undefined;
    return {
      tripId,
      dayNumber: d.day_number,
      date: d.date,
      city: d.city,
      ...(d.country ? { country: d.country } : {}),
      ...(d.time_zone ? { timeZone: d.time_zone } : {}),
      currency: d.currency,
      planned: d.planned,
      stops: (d.stops as postgres.Row[]).map(fromRow),
    };
  }

  /**
   * Replaces the day's stops (a new plan, a re-plan, or a check-in) and marks the day planned. Stops
   * keep their IDs across saves; new ones (from the planner) get one.
   */
  async saveStops(tripId: string, dayNumber: number, stops: Stop[]): Promise<Day> {
    const [d] = await this.q`
      update public.trip_days set planned_at = coalesce(planned_at, now())
      where trip_id = ${tripId} and day_number = ${dayNumber} returning id`;
    if (!d) throw new NotFound('day');
    await this.q`delete from public.stops where day_id = ${d.id}`;
    if (stops.length) {
      const rows = stops.map((s, i) => ({
        id: UUID.test(s.id) ? s.id : randomUUID(),
        day_id: d.id,
        position: i,
        place_id: s.placeId ?? null,
        name: s.name,
        category: s.category,
        icon: s.icon || '📍',
        start_time: s.startTime,
        duration_min: Math.max(1, Math.round(s.durationMin)),
        cost: s.cost === undefined ? null : Math.round(s.cost),
        hop: s.hop ? this.json(s.hop) : null,
        reason: s.reason ?? null,
        points: s.points ?? 0,
        status: s.status,
        location: s.location ? this.json(s.location) : null,
        moment: s.moment ?? null,
        distance_km: s.distanceKm ?? null,
        open_until: s.openUntil ?? null,
      }));
      await this.q`insert into public.stops ${this.q(rows as unknown as Record<string, unknown>[])}`;
    }
    return (await this.day(tripId, dayNumber))!;
  }

  /** Places already on other days of the trip, so a new day doesn't repeat them. */
  async placesUsed(tripId: string, exceptDay: number): Promise<string[]> {
    const rows = await this.q`
      select distinct s.place_id from public.stops s join public.trip_days d on d.id = s.day_id
      where d.trip_id = ${tripId} and d.day_number <> ${exceptDay} and s.place_id is not null`;
    return rows.map((r) => r.place_id);
  }
}

export class NotFound extends Error {
  constructor(what: string) {
    super(`${what} not found`);
  }
}

function fromRow(r: postgres.Row): Stop {
  return {
    id: r.id,
    ...(r.place_id ? { placeId: r.place_id } : {}),
    name: r.name,
    ...(r.location ? { location: r.location } : {}),
    category: r.category,
    icon: r.icon,
    startTime: String(r.start_time).slice(0, 5),
    durationMin: r.duration_min,
    ...(r.cost !== null ? { cost: r.cost } : {}),
    ...(r.open_until ? { openUntil: r.open_until } : {}),
    ...(r.distance_km !== null ? { distanceKm: r.distance_km } : {}),
    ...(r.hop ? { hop: r.hop } : {}),
    ...(r.reason ? { reason: r.reason } : {}),
    ...(r.moment ? { moment: r.moment } : {}),
    points: r.points,
    status: r.status,
  };
}
