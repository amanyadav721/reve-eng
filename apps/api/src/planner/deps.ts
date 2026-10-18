import { env, missing } from '../env.js';
import { openWeather, tavily } from '../providers/extras.js';
import { googlePlaces, googleRoutes } from '../providers/google.js';
import { LocalPlaces } from '../providers/local.js';
import type { LatLng, PlacesProvider, RoutesProvider } from '../providers/types.js';
import { valhallaRoutes } from '../providers/valhalla.js';
import { chat } from '../sarvam.js';
import type { PlanDayDeps } from './planDay.js';

let localPlaces: LocalPlaces | undefined | null = null;

/** Our own places database, loaded once from data/places (build it with `npm run data:places -w api -- jaipur`). */
function ownPlaces(): LocalPlaces | undefined {
  if (localPlaces === null) localPlaces = LocalPlaces.fromDir();
  return localPlaces;
}

export function placesProvider(): PlacesProvider | { missing: string[] } {
  const choice = env.PLACES_PROVIDER ?? (env.GOOGLE_MAPS_API_KEY ? 'google' : 'local');
  if (choice === 'google') return env.GOOGLE_MAPS_API_KEY ? googlePlaces(env.GOOGLE_MAPS_API_KEY) : { missing: ['GOOGLE_MAPS_API_KEY'] };
  return ownPlaces() ?? { missing: ['places data (run: npm run data:places -w api -- jaipur)'] };
}

export function routesProvider(): RoutesProvider {
  const choice = env.ROUTES_PROVIDER ?? (env.GOOGLE_MAPS_API_KEY ? 'google' : 'valhalla');
  return choice === 'google' && env.GOOGLE_MAPS_API_KEY ? googleRoutes(env.GOOGLE_MAPS_API_KEY) : valhallaRoutes(env.VALHALLA_URL);
}

/** Real providers from env. Returns what's missing instead when the essentials aren't set. */
export function plannerDeps(): PlanDayDeps | { missing: string[] } {
  const needs = missing('SARVAM_API_KEY');
  const places = placesProvider();
  if ('missing' in places) needs.push(...places.missing);
  if (needs.length || 'missing' in places) return { missing: needs };
  return {
    chat,
    places,
    routes: routesProvider(),
    weather: env.OPENWEATHER_API_KEY ? openWeather(env.OPENWEATHER_API_KEY) : undefined,
    search: env.TAVILY_API_KEY ? tavily(env.TAVILY_API_KEY) : undefined,
  };
}

// Launch cities, so we don't spend a search call finding the city itself.
const CITY_CENTERS: Record<string, LatLng> = {
  jaipur: { lat: 26.9124, lng: 75.7873 },
  goa: { lat: 15.4909, lng: 73.8278 },
  varanasi: { lat: 25.3176, lng: 82.9739 },
  udaipur: { lat: 24.5854, lng: 73.7125 },
  rishikesh: { lat: 30.0869, lng: 78.2676 },
};

const INDIA = { lat: 22.5, lng: 79 };

export async function cityCenter(city: string, places: PlacesProvider): Promise<LatLng | undefined> {
  const known = CITY_CENTERS[city.trim().toLowerCase()];
  if (known) return known;
  const [hit] = await places.search({ text: `${city}, India`, center: INDIA, radiusM: 50000, limit: 1 });
  return hit?.location;
}
