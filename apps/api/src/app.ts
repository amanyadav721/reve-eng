import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { z } from 'zod';

import { requireUser, type AuthVars } from './auth.js';
import { env } from './env.js';
import { cityCenter, plannerDeps } from './planner/deps.js';
import { estimateFare } from './planner/fare.js';
import { planDay } from './planner/planDay.js';

const tripPreferences = z.object({
  city: z.string().min(1),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  arrival: z.object({ mode: z.enum(['flight', 'train', 'bus', 'cab', 'auto', 'walk', 'metro', 'scooter']), time: z.string().regex(/^\d{2}:\d{2}$/) }).optional(),
  group: z.enum(['solo', 'partner', 'friends', 'family', 'parents']).optional(),
  budgetPerDayInr: z.number().int().positive().optional(),
  pace: z.enum(['chill', 'balanced', 'packed']).optional(),
  interests: z.array(z.string()).max(12).optional(),
  diet: z.enum(['veg', 'nonveg', 'egg', 'jain', 'vegan']).optional(),
  spice: z.enum(['mild', 'medium', 'hot']).optional(),
  language: z.string().optional(),
});

const memory = z.object({
  id: z.string(),
  kind: z.enum(['fact', 'habit', 'love', 'skip', 'person', 'promise']),
  text: z.string().max(300),
  evidence: z.string().max(300),
  source: z.enum(['quiz', 'chat', 'checkins', 'edits']),
  icon: z.string().optional(),
  sensitive: z.boolean(),
  createdAt: z.string(),
});

const planDayBody = z.object({
  preferences: tripPreferences,
  dayNumber: z.number().int().min(1).max(30).default(1),
  /** Until memories load from Supabase, the app sends them. */
  memories: z.array(memory).max(100).default([]),
  avoidPlaceIds: z.array(z.string()).max(100).default([]),
  notBefore: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  stayNear: z.string().max(200).optional(),
});

const fareQuery = z.object({
  mode: z.enum(['walk', 'auto', 'cab', 'metro', 'bus', 'train', 'scooter']),
  km: z.coerce.number().min(0).max(500),
});

export const app = new Hono<AuthVars>();

if (env.NODE_ENV !== 'test') app.use(logger());

app.get('/health', (c) =>
  c.json({
    ok: true,
    configured: {
      clerk: !!env.CLERK_SECRET_KEY,
      sarvam: !!env.SARVAM_API_KEY,
      supabase: !!(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
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
  return c.json(estimateFare(q.data.mode, q.data.km));
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

  const center = await cityCenter(prefs.city, deps.places);
  if (!center) return c.json({ error: 'unknown_city', city: prefs.city }, 422);

  const result = await planDay({ city: prefs.city, cityCenter: center, date, dayNumber, totalDays, prefs, rules: { notBefore }, memories, avoidPlaceIds, stayNear }, deps);
  return c.json({ date, dayNumber, ...result }, result.ok ? 200 : 422);
});

app.route('/v1', v1);

app.notFound((c) => c.json({ error: 'not_found' }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'internal' }, 500);
});
