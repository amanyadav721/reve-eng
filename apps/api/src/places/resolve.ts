import { cityCenter, plannerDeps } from '../planner/deps.js';
import { LocalPlaces } from '../providers/local.js';
import { cityArea, ensureCity } from './ensureCity.js';

export type ReadyDeps = Exclude<ReturnType<typeof plannerDeps>, { missing: string[] }>;

/** Our own database learns a new city the first time someone plans a trip there (about a minute). */
export async function resolveCity(city: string, deps: ReadyDeps) {
  const area = deps.places instanceof LocalPlaces ? await ensureCity(city, deps.places) : await cityArea(city);
  const center = area?.center ?? (await cityCenter(city, deps.places));
  return center ? { center, area } : undefined;
}

