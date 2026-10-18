import type { LatLng, RouteMode, RoutesProvider } from './types.js';

// When our routing server has no roads for a region yet (or finds no path), estimate from distance
// instead of failing. Estimates are marked, shown with "~", and replaced by real routes once the
// region's roads are loaded.

/** Road distance is longer than straight-line distance; these are typical city detour ratios. */
const DETOUR: Record<RouteMode, number> = { walk: 1.25, drive: 1.4, two_wheeler: 1.35, transit: 1.45 };
/** Average door-to-door city speeds in km/h, including traffic. */
const SPEED: Record<RouteMode, number> = { walk: 4.6, drive: 22, two_wheeler: 24, transit: 17 };
/** Fixed overhead in minutes: waiting for a ride, walking to the station. */
const OVERHEAD: Record<RouteMode, number> = { walk: 0, drive: 5, two_wheeler: 4, transit: 10 };

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function estimateRoute(from: LatLng, to: LatLng, mode: RouteMode): { minutes: number; km: number; estimated: true } {
  const km = haversineKm(from, to) * DETOUR[mode];
  const minutes = Math.max(1, Math.round((km / SPEED[mode]) * 60 + OVERHEAD[mode]));
  return { minutes, km: Math.round(km * 10) / 10, estimated: true };
}

/** Tries the real router first; falls back to an estimate when it has no answer. */
export function withEstimates(primary: RoutesProvider, onFallback?: (reason: string) => void): RoutesProvider {
  return {
    async route(q) {
      try {
        const r = await primary.route(q);
        if (r) return r;
        onFallback?.('no route');
      } catch (err) {
        onFallback?.(err instanceof Error ? err.message : String(err));
      }
      return estimateRoute(q.from, q.to, q.mode);
    },
  };
}
