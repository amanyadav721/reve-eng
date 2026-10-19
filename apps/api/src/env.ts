import { z } from 'zod';

// Every key is optional so the server boots without accounts set up.
// Routes that need a missing key answer 503 and say which one.
const schema = z.object({
  PORT: z.coerce.number().default(8787),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),
  /** PEM public key from the Clerk dashboard. Lets us verify tokens without a network call. */
  CLERK_JWT_KEY: z.string().optional(),
  /** Local development only: accept "Authorization: Dev <user id>" when Clerk isn't set up yet. */
  ALLOW_DEV_AUTH: z.enum(['0', '1']).default('0'),
  SARVAM_API_KEY: z.string().optional(),
  /** Postgres connection string for the Supabase database (Settings → Database). Server-only. */
  DATABASE_URL: z.string().optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  /** Where places come from: our own open-data database ("local") or Google. Default: google if keyed, else local. */
  PLACES_PROVIDER: z.enum(['local', 'google']).optional(),
  /** Where routes come from: our own Valhalla server or Google. Default: google if keyed, else valhalla. */
  ROUTES_PROVIDER: z.enum(['valhalla', 'google']).optional(),
  VALHALLA_URL: z.string().url().default('http://localhost:8002'),
  /** Web app origins allowed to call the API, comma-separated. */
  CORS_ORIGINS: z.string().default('http://localhost:8081,http://localhost:19006'),
  TAVILY_API_KEY: z.string().optional(),
  OPENWEATHER_API_KEY: z.string().optional(),
});

// Blank lines in .env ("SUPABASE_URL=") mean "not set", not an empty value.
const present = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined && v.trim() !== ''));

export const env = schema.parse(present);

export type Env = typeof env;

export function missing(...keys: (keyof Env)[]): string[] {
  return keys.filter((k) => !env[k]);
}
