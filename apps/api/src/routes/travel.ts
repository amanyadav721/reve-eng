import type { Stop } from '@tagalong/shared';
import { Hono } from 'hono';
import { z } from 'zod';

import type { AuthVars } from '../auth.js';
import { asUser, dbConfigured, NotFound, type Day, type Leg, type Store } from '../db/store.js';
import { env } from '../env.js';
import { cityArea } from '../places/ensureCity.js';
import { resolveCity } from '../places/resolve.js';
import { plannerDeps } from '../planner/deps.js';
import { outlineTrip } from '../planner/outline.js';
import { planDay } from '../planner/planDay.js';
import { replanDay } from '../planner/replan.js';
import { chat } from '../sarvam.js';
import { hhmm, latLng, stop, tripPreferences } from '../schemas.js';

// The app's trips, days and memories, stored in Supabase for the signed-in traveler. The planner
// reads memories from here, so Laddoo remembers across devices and trips.

const isoDate = z.iso.date();

const newMemory = z.object({
  kind: z.enum(['fact', 'habit', 'love', 'skip', 'person', 'promise']),
  text: z.string().min(1).max(300),
  evidence: z.string().min(1).max(300),
  source: z.enum(['quiz', 'chat', 'checkins', 'edits']),
  icon: z.string().max(20).optional(),
  sensitive: z.boolean().optional(),
});

const newTrip = z.object({
  /** Whatever the traveler typed: "Jaipur", "Rajasthan", "Japan", "somewhere warm". */
  destination: z.string().min(1).max(200),
  startDate: isoDate,
  days: z.number().int().min(1).max(30),
  preferences: tripPreferences.omit({ city: true, startDate: true, endDate: true }).partial().default({}),
});

const replanRequest = z.object({
  trigger: z.enum(['late', 'skip', 'tired', 'hungry', 'rain', 'bored']),
  now: hhmm,
  location: latLng,
  stopId: z.string().max(100).optional(),
  note: z.string().max(300).optional(),
  choice: z.string().max(200).optional(),
});

const dayParams = z.object({ id: z.uuid(), n: z.coerce.number().int().min(1).max(60) });

export const travel = new Hono<AuthVars>();

travel.use(async (c, next) => {
  if (!dbConfigured()) return c.json({ error: 'not_configured', missing: ['DATABASE_URL'] }, 503);
  return next();
});

travel.onError((err, c) => {
  if (err instanceof NotFound) return c.json({ error: 'not_found', message: err.message }, 404);
  console.error(err);
  return c.json({ error: 'internal' }, 500);
});

const as = <T>(c: { get: (k: 'userId') => string }, fn: (s: Store) => Promise<T>) => asUser(c.get('userId'), fn);

// ── Memories ──────────────────────────────────────────────────────────────────

travel.get('/memories', async (c) => c.json({ memories: await as(c, (s) => s.memories()) }));

travel.post('/memories', async (c) => {
  const body = z.object({ memories: z.array(newMemory).min(1).max(50) }).safeParse(await c.req.json().catch(() => undefined));
  if (!body.success) return c.json({ error: 'bad_request', issues: body.error.issues }, 400);
  const result = await as(c, async (s) => ({ added: await s.addMemories(body.data.memories), memories: await s.memories() }));
  return c.json(result);
});

travel.delete('/memories/:id', async (c) => {
  const id = z.uuid().safeParse(c.req.param('id'));
  if (!id.success) return c.json({ error: 'bad_request' }, 400);
  const gone = await as(c, (s) => s.forget(id.data));
  return gone ? c.json({ ok: true }) : c.json({ error: 'not_found' }, 404);
});

// ── Trips ─────────────────────────────────────────────────────────────────────

/** From the quiz: work out the route (one city or several), then save the trip with a city per day. */
travel.post('/trips', async (c) => {
  const body = newTrip.safeParse(await c.req.json().catch(() => undefined));
  if (!body.success) return c.json({ error: 'bad_request', issues: body.error.issues }, 400);
  if (!env.SARVAM_API_KEY) return c.json({ error: 'not_configured', missing: ['SARVAM_API_KEY'] }, 503);
  const { destination, startDate, days, preferences } = body.data;

  const memories = await as(c, (s) => s.memories());
  const outline = await outlineTrip({ destination, days, startDate, prefs: preferences, memories }, { chat, geocode: (name) => cityArea(name) });
  if (outline.kind === 'unclear') return c.json({ question: outline.question });
  if (!outline.legs.length) return c.json({ question: `I couldn't find "${destination}" on the map. Which city or country do you mean?` });

  const legs: Leg[] = outline.legs.map((l) => ({ city: l.name, country: l.country, timeZone: l.timeZone, currency: l.currency, days: l.days, why: l.why }));
  const trip = await as(c, (s) => s.createTrip({ destination, startDate, legs, preferences: { ...preferences, currency: preferences.currency ?? legs[0].currency } }));
  return c.json({ trip, dropped: outline.dropped }, 201);
});

/**
 * The trip happening now or next, the day to show (today's; else the first or last), and the
 * traveler's points, in one request. `today` is the phone's local date.
 */
travel.get('/trips/current', async (c) => {
  const today = isoDate.safeParse(c.req.query('today'));
  if (!today.success) return c.json({ error: 'bad_request', message: 'today=YYYY-MM-DD' }, 400);
  return c.json(
    await as(c, async (s) => {
      const trip = await s.currentTrip(today.data);
      const show = trip && (trip.days.find((d) => d.date === today.data) ?? (today.data < trip.startDate ? trip.days[0] : trip.days.at(-1)));
      const day = trip && show ? await s.day(trip.id, show.dayNumber) : undefined;
      return { trip: trip ?? null, day: day ?? null, points: await s.points() };
    }),
  );
});

travel.get('/trips/:id/days/:n', async (c) => {
  const p = dayParams.safeParse(c.req.param());
  if (!p.success) return c.json({ error: 'bad_request' }, 400);
  const day = await as(c, (s) => s.day(p.data.id, p.data.n));
  return day ? c.json({ day }) : c.json({ error: 'not_found' }, 404);
});

/** Plans the day with the AI and saves it. Takes 20–90 seconds. */
travel.post('/trips/:id/days/:n/plan', async (c) => {
  const p = dayParams.safeParse(c.req.param());
  if (!p.success) return c.json({ error: 'bad_request' }, 400);
  const deps = plannerDeps();
  if ('missing' in deps) return c.json({ error: 'not_configured', missing: deps.missing }, 503);

  const ctx = await as(c, async (s) => {
    const trip = await s.trip(p.data.id);
    const day = trip && (await s.day(p.data.id, p.data.n));
    return trip && day ? { trip, day, memories: await s.memories(), used: await s.placesUsed(trip.id, day.dayNumber) } : undefined;
  });
  if (!ctx) return c.json({ error: 'not_found' }, 404);
  const { trip, day, memories, used } = ctx;

  const place = await resolveCity(day.city, deps);
  if (!place) return c.json({ error: 'unknown_city', city: day.city }, 422);
  const prefs = { ...trip.preferences, city: day.city, startDate: trip.startDate, endDate: trip.endDate, currency: day.currency };
  const result = await planDay(
    {
      city: day.city,
      cityCenter: place.center,
      date: day.date,
      dayNumber: day.dayNumber,
      totalDays: trip.days.length,
      prefs,
      rules: { notBefore: trip.preferences.dayStart },
      memories,
      avoidPlaceIds: used,
      country: place.area?.country ?? day.country,
      timeZone: place.area?.timeZone ?? day.timeZone,
    },
    deps,
  );
  if (!result.stops.length) return c.json({ error: 'plan_failed', message: result.error ?? "Laddoo couldn't plan this day.", issues: result.issues }, 502);

  const stops: Stop[] = result.stops.map((s, i) => ({ ...s, status: i === 0 ? 'now' : 'upcoming' }));
  const saved = await as(c, (s) => s.saveStops(trip.id, day.dayNumber, stops));
  return c.json({ day: saved, ok: result.ok, issues: result.issues, repairs: result.repairs });
});

/**
 * Saves the day as the app has it (after a check-in or an edit). Points for stops that just became
 * "done" are added here, from the stored plan, not from the request.
 */
travel.put('/trips/:id/days/:n/stops', async (c) => {
  const p = dayParams.safeParse(c.req.param());
  const body = z.object({ stops: z.array(stop).max(30) }).safeParse(await c.req.json().catch(() => undefined));
  if (!p.success || !body.success) return c.json({ error: 'bad_request', issues: body.error?.issues }, 400);
  return c.json(
    await as(c, async (s) => {
      const before = await s.day(p.data.id, p.data.n);
      if (!before) throw new NotFound('day');
      const day = await s.saveStops(p.data.id, p.data.n, body.data.stops as unknown as Stop[]);
      const earned = newlyDone(before, day);
      return { day, earned, points: earned ? await s.addPoints(earned) : await s.points() };
    }),
  );
});

/** Something changed mid-day: re-plan the rest of today from where the traveler is, and save it. */
travel.post('/trips/:id/days/:n/replan', async (c) => {
  const p = dayParams.safeParse(c.req.param());
  const body = replanRequest.safeParse(await c.req.json().catch(() => undefined));
  if (!p.success || !body.success) return c.json({ error: 'bad_request', issues: body.error?.issues }, 400);
  const deps = plannerDeps();
  if ('missing' in deps) return c.json({ error: 'not_configured', missing: deps.missing }, 503);

  const ctx = await as(c, async (s) => {
    const trip = await s.trip(p.data.id);
    const day = trip && (await s.day(p.data.id, p.data.n));
    return trip && day ? { trip, day, memories: await s.memories() } : undefined;
  });
  if (!ctx?.day.stops.length) return c.json({ error: 'not_found' }, 404);
  const { trip, day, memories } = ctx;

  const place = await resolveCity(day.city, deps);
  if (!place) return c.json({ error: 'unknown_city', city: day.city }, 422);
  const result = await replanDay(
    {
      city: day.city,
      cityCenter: place.center,
      date: day.date,
      country: place.area?.country ?? day.country,
      timeZone: place.area?.timeZone ?? day.timeZone,
      prefs: { ...trip.preferences, currency: day.currency },
      memories,
      stops: day.stops,
      ...body.data,
    },
    deps,
  );
  const saved = await as(c, (s) => s.saveStops(trip.id, day.dayNumber, result.stops));
  return c.json({ ...result, stops: saved.stops, day: saved });
});

function newlyDone(before: Day, after: Day): number {
  const wasDone = new Set(before.stops.filter((s) => s.status === 'done').map((s) => s.placeId ?? s.name));
  return after.stops.filter((s) => s.status === 'done' && !wasDone.has(s.placeId ?? s.name)).reduce((n, s) => n + (before.stops.find((b) => (b.placeId ?? b.name) === (s.placeId ?? s.name))?.points ?? 0), 0);
}

