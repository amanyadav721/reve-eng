import type { RouteMode, RoutesProvider } from './types.js';

// Our own routing: Valhalla on OpenStreetMap roads (infra/valhalla/docker-compose.yml).
// https://valhalla.github.io/valhalla/api/turn-by-turn/api-reference/

const COSTING: Record<RouteMode, string> = {
  walk: 'pedestrian',
  drive: 'auto',
  two_wheeler: 'motor_scooter',
  // Valhalla's "bus" follows bus-legal roads; real timetables need GTFS, which we don't load yet.
  transit: 'bus',
};

/**
 * Valhalla has no live traffic, and its free-flow speeds are optimistic for Indian old-city
 * streets. Pad road travel until we learn real times from check-ins.
 */
const TRAFFIC_FACTOR: Record<RouteMode, number> = { walk: 1, drive: 1.35, two_wheeler: 1.2, transit: 1.5 };

export function valhallaRoutes(baseUrl: string, fetchImpl: typeof fetch = fetch): RoutesProvider {
  return {
    async route({ from, to, mode }) {
      const res = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/route`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          locations: [
            { lat: from.lat, lon: from.lng },
            { lat: to.lat, lon: to.lng },
          ],
          costing: COSTING[mode],
          units: 'kilometers',
          directions_type: 'none',
        }),
      });
      // 400 means no route between the points (e.g. off the road network).
      if (res.status === 400) return null;
      if (!res.ok) throw new Error(`Valhalla ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const body = (await res.json()) as { trip?: { summary?: { time: number; length: number } } };
      const s = body.trip?.summary;
      if (!s) return null;
      return { minutes: Math.max(1, Math.round((s.time / 60) * TRAFFIC_FACTOR[mode])), km: Math.round(s.length * 10) / 10 };
    },
  };
}
