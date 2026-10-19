import { z } from 'zod';

// Request shapes shared by the routes.

export const tripPreferences = z.object({
  city: z.string().min(1),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  arrival: z.object({ mode: z.enum(['flight', 'train', 'bus', 'cab', 'auto', 'walk', 'metro', 'scooter']), time: z.string().regex(/^\d{2}:\d{2}$/) }).optional(),
  group: z.enum(['solo', 'partner', 'friends', 'family', 'parents']).optional(),
  budgetPerDay: z.number().int().positive().optional(),
  pace: z.enum(['chill', 'balanced', 'packed']).optional(),
  interests: z.array(z.string()).max(12).optional(),
  diet: z.enum(['veg', 'nonveg', 'egg', 'jain', 'vegan']).optional(),
  spice: z.enum(['mild', 'medium', 'hot']).optional(),
  language: z.string().optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  /** When they like to start the day, "HH:mm". */
  dayStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

export const memory = z.object({
  id: z.string(),
  kind: z.enum(['fact', 'habit', 'love', 'skip', 'person', 'promise']),
  text: z.string().max(300),
  evidence: z.string().max(300),
  source: z.enum(['quiz', 'chat', 'checkins', 'edits']),
  icon: z.string().optional(),
  sensitive: z.boolean(),
  createdAt: z.string(),
});

export const hhmm = z.string().regex(/^\d{2}:\d{2}$/);
export const latLng = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

/** A stop as the app has it. Extra fields (hop, reason, points…) pass through untouched. */
export const stop = z.looseObject({
  id: z.string().max(100),
  placeId: z.string().max(200).optional(),
  name: z.string().max(200),
  location: latLng.optional(),
  category: z.enum(['food', 'sight', 'transport', 'nature', 'culture', 'shopping']),
  icon: z.string().max(20).default(''),
  points: z.number().int().min(0).default(0),
  startTime: hhmm,
  durationMin: z.number().int().min(0).max(24 * 60),
  moment: z.enum(['sunrise', 'sunset', 'evening_aarti']).optional(),
  status: z.enum(['done', 'now', 'upcoming', 'skipped']),
});

