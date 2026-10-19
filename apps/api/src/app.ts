import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { Stop } from '@tagalong/shared';
import { z } from 'zod';

import { requireUser, type AuthVars } from './auth.js';
import { env } from './env.js';
import { cityArea } from './places/ensureCity.js';
import { resolveCity } from './places/resolve.js';
import { plannerDeps } from './planner/deps.js';
import { estimateFare } from './planner/fare.js';
import { outlineTrip } from './planner/outline.js';
import { planDay } from './planner/planDay.js';
import { replanDay } from './planner/replan.js';
import { travel } from './routes/travel.js';
import { hhmm, latLng, memory, stop, tripPreferences } from './schemas.js';
import { chat } from './sarvam.js';

const planDayBody = z.object({
  preferences: tripPreferences,
  dayNumber: z.number().int().min(1).max(30).default(1),
  /** Until memories load from Supabase, the app sends them. */
  memories: z.array(memory).max(100).default([]),
  avoidPlaceIds: z.array(z.string()).max(100).default([]),
  notBefore: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  stayNear: z.string().max(200).optional(),
});

const replanBody = z.object({
  preferences: tripPreferences,
  dayNumber: z.number().int().min(1).max(30).default(1),
  memories: z.array(memory).max(100).default([]),
  /** Today's plan with statuses: done stops stay as they are. */
  stops: z.array(stop).min(1).max(30),
  now: hhmm,
  location: latLng,
  trigger: z.enum(['late', 'skip', 'tired', 'hungry', 'rain', 'bored']),
  stopId: z.string().max(100).optional(),
  note: z.string().max(300).optional(),
  choice: z.string().max(200).optional(),
});

const outlineBody = z.object({
  /** Whatever the traveler typed: "Miami", "Japan", "Rajasthan for a week", "somewhere warm". */
  destination: z.string().min(1).max(200),
  days: z.number().int().min(1).max(60),
  startDate: z.iso.date().optional(),
  preferences: tripPreferences.partial().optional(),
  memories: z.array(memory).max(100).default([]),
});

const fareQuery = z.object({
  mode: z.enum(['walk', 'auto', 'cab', 'metro', 'bus', 'train', 'scooter']),
  km: z.coerce.number().min(0).max(500),
  country: z.string().regex(/^[a-z]{2}$/).default('in'),
});

export const app = new Hono<AuthVars>();

if (env.NODE_ENV !== 'test') app.use(logger());

// The web build of the app calls us from another origin. Phones don't need CORS.
app.use(
  '*',
  cors({
    origin: env.CORS_ORIGINS.split(',').map((o) => o.trim()),
    allowHeaders: ['authorization', 'content-type'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    maxAge: 600,
  }),
);

app.get('/health', (c) =>
  c.json({
    ok: true,
    configured: {
      clerk: !!env.CLERK_SECRET_KEY,
      sarvam: !!env.SARVAM_API_KEY,
      database: !!env.DATABASE_URL,
      googleMaps: !!env.GOOGLE_MAPS_API_KEY,
    },
  }),
);

const v1 = new Hono<AuthVars>();
v1.use(requireUser);

v1.get('/me', (c) => c.json({ userId: c.get('userId') }));

v1.get('/fare', (c) => {
  const q = fareQuery.safeParse(c.req.query());
  if (!q.success) return c.json({ error: 'bad_request', issues: q.error.issues }, 400);
  const fare = estimateFare(q.data.mode, q.data.km, q.data.country);
  return fare ? c.json(fare) : c.json({ error: 'no_fare_model', mode: q.data.mode, country: q.data.country }, 404);
});

// Step one of any trip: where is it? Returns base cities with days, or a question when it's vague.
v1.post('/trips/outline', async (c) => {
  const body = outlineBody.safeParse(await c.req.json().catch(() => undefined));
  if (!body.success) return c.json({ error: 'bad_request', issues: body.error.issues }, 400);
  if (!env.SARVAM_API_KEY) return c.json({ error: 'not_configured', missing: ['SARVAM_API_KEY'] }, 503);
  const { destination, days, startDate, preferences, memories } = body.data;
  const outline = await outlineTrip({ destination, days, startDate, prefs: preferences, memories }, { chat, geocode: (name) => cityArea(name) });
  return c.json(outline);
});

// Plans one day. The app calls it once per day of the trip, passing places already used.
v1.post('/trips/plan-day', async (c) => {
  const body = planDayBody.safeParse(await c.req.json().catch(() => undefined));
  if (!body.success) return c.json({ error: 'bad_request', issues: body.error.issues }, 400);
  const deps = plannerDeps();
  if ('missing' in deps) return c.json({ error: 'not_configured', missing: deps.missing }, 503);

  const { preferences: prefs, dayNumber, memories, avoidPlaceIds, notBefore, stayNear } = body.data;
  const totalDays = Math.round((Date.parse(prefs.endDate) - Date.parse(prefs.startDate)) / 86_400_000) + 1;
  if (dayNumber > totalDays) return c.json({ error: 'bad_request', message: `the trip has ${totalDays} days` }, 400);
  const date = new Date(Date.parse(prefs.startDate) + (dayNumber - 1) * 86_400_000).toISOString().slice(0, 10);

  const place = await resolveCity(prefs.city, deps);
  if (!place) return c.json({ error: 'unknown_city', city: prefs.city }, 422);
  const { center, area } = place;
  const currency = prefs.currency ?? area?.currency ?? 'INR';

  const result = await planDay(
    { city: prefs.city, cityCenter: center, date, dayNumber, totalDays, prefs: { ...prefs, currency }, rules: { notBefore }, memories, avoidPlaceIds, stayNear, country: area?.country, timeZone: area?.timeZone },
    deps,
  );
  return c.json({ date, dayNumber, currency, country: area?.country, timeZone: area?.timeZone, ...result }, result.ok ? 200 : 422);
});

/** Something changed mid-day (late, rain, hungry, tired, skip, bored): re-plan the rest of today. */
v1.post('/trips/replan', async (c) => {
  const body = replanBody.safeParse(await c.req.json().catch(() => undefined));
  if (!body.success) return c.json({ error: 'bad_request', issues: body.error.issues }, 400);
  const deps = plannerDeps();
  if ('missing' in deps) return c.json({ error: 'not_configured', missing: deps.missing }, 503);

  const { preferences: prefs, dayNumber, memories, ...change } = body.data;
  const date = new Date(Date.parse(prefs.startDate) + (dayNumber - 1) * 86_400_000).toISOString().slice(0, 10);
  const place = await resolveCity(prefs.city, deps);
  if (!place) return c.json({ error: 'unknown_city', city: prefs.city }, 422);
  const { center, area } = place;
  const currency = prefs.currency ?? area?.currency ?? 'INR';

  const result = await replanDay(
    { city: prefs.city, cityCenter: center, date, prefs: { ...prefs, currency }, memories, country: area?.country, timeZone: area?.timeZone, ...change, stops: change.stops as unknown as Stop[] },
    deps,
  );
  return c.json({ date, dayNumber, currency, ...result });
});

v1.route('/', travel);

app.route('/v1', v1);

app.notFound((c) => c.json({ error: 'not_found' }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'internal' }, 500);
});
