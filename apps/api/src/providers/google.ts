import type { HoursPeriod, LatLng, PlaceDetails, PlaceSummary, PlacesProvider, RouteMode, RoutesProvider } from './types.js';

// Google Places API (New) and Routes API.
// https://developers.google.com/maps/documentation/places/web-service/text-search
// https://developers.google.com/maps/documentation/routes/compute_route_directions
// Field masks decide the billing SKU, so ask only for what the planner uses.

const PLACES = 'https://places.googleapis.com/v1';
const ROUTES = 'https://routes.googleapis.com/directions/v2:computeRoutes';

const SEARCH_FIELDS = ['id', 'displayName', 'formattedAddress', 'location', 'rating', 'userRatingCount', 'priceLevel', 'types'].map((f) => `places.${f}`).join(',');
const DETAIL_FIELDS = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'rating',
  'userRatingCount',
  'priceLevel',
  'priceRange',
  'types',
  'regularOpeningHours',
  'currentOpeningHours',
  'businessStatus',
  'editorialSummary',
].join(',');

const PRICE_LEVEL: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

export class GoogleError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`Google ${status}: ${body.slice(0, 300)}`);
  }
}

interface GPlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  priceRange?: { startPrice?: { units?: string }; endPrice?: { units?: string } };
  types?: string[];
  regularOpeningHours?: { periods?: HoursPeriod[] };
  currentOpeningHours?: { periods?: HoursPeriod[] };
  businessStatus?: PlaceDetails['businessStatus'];
  editorialSummary?: { text: string };
}

function summary(p: GPlace): PlaceSummary {
  return {
    placeId: p.id,
    name: p.displayName?.text ?? p.id,
    address: p.formattedAddress,
    location: { lat: p.location?.latitude ?? 0, lng: p.location?.longitude ?? 0 },
    rating: p.rating,
    ratingCount: p.userRatingCount,
    priceLevel: p.priceLevel ? PRICE_LEVEL[p.priceLevel] : undefined,
    types: p.types ?? [],
  };
}

export function googlePlaces(apiKey: string, fetchImpl: typeof fetch = fetch): PlacesProvider {
  const headers = (mask: string) => ({ 'content-type': 'application/json', 'x-goog-api-key': apiKey, 'x-goog-fieldmask': mask });

  return {
    async search({ text, center, radiusM, openNow, limit = 8 }) {
      const res = await fetchImpl(`${PLACES}/places:searchText`, {
        method: 'POST',
        headers: headers(SEARCH_FIELDS),
        body: JSON.stringify({
          textQuery: text,
          pageSize: limit,
          languageCode: 'en',
          regionCode: 'IN',
          openNow: openNow || undefined,
          locationBias: { circle: { center: { latitude: center.lat, longitude: center.lng }, radius: Math.min(radiusM, 50000) } },
        }),
      });
      if (!res.ok) throw new GoogleError(res.status, await res.text());
      const body = (await res.json()) as { places?: GPlace[] };
      return (body.places ?? []).map(summary);
    },

    async details(placeId) {
      const res = await fetchImpl(`${PLACES}/places/${encodeURIComponent(placeId)}?languageCode=en&regionCode=IN`, { headers: headers(DETAIL_FIELDS) });
      if (!res.ok) throw new GoogleError(res.status, await res.text());
      const p = (await res.json()) as GPlace;
      const units = (x?: { units?: string }) => (x?.units ? Number(x.units) : undefined);
      return {
        ...summary(p),
        regularHours: p.regularOpeningHours?.periods,
        currentHours: p.currentOpeningHours?.periods,
        businessStatus: p.businessStatus,
        summary: p.editorialSummary?.text,
        priceRange: p.priceRange ? { minInr: units(p.priceRange.startPrice), maxInr: units(p.priceRange.endPrice) } : undefined,
      };
    },
  };
}

const TRAVEL_MODE: Record<RouteMode, string> = { walk: 'WALK', drive: 'DRIVE', two_wheeler: 'TWO_WHEELER', transit: 'TRANSIT' };

export function googleRoutes(apiKey: string, fetchImpl: typeof fetch = fetch): RoutesProvider {
  const waypoint = (p: LatLng) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });

  return {
    async route({ from, to, mode, departAt }) {
      const traffic = mode === 'drive' || mode === 'two_wheeler';
      // Google rejects departure times in the past.
      const future = departAt && departAt.getTime() > Date.now() + 60_000 ? departAt.toISOString() : undefined;
      const res = await fetchImpl(ROUTES, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey, 'x-goog-fieldmask': 'routes.duration,routes.distanceMeters' },
        body: JSON.stringify({
          origin: waypoint(from),
          destination: waypoint(to),
          travelMode: TRAVEL_MODE[mode],
          routingPreference: traffic ? 'TRAFFIC_AWARE' : undefined,
          departureTime: future,
          languageCode: 'en',
          regionCode: 'IN',
          units: 'METRIC',
        }),
      });
      if (!res.ok) throw new GoogleError(res.status, await res.text());
      const body = (await res.json()) as { routes?: { duration?: string; distanceMeters?: number }[] };
      const r = body.routes?.[0];
      if (!r?.duration) return null;
      return { minutes: Math.max(1, Math.round(Number.parseInt(r.duration, 10) / 60)), km: Math.round((r.distanceMeters ?? 0) / 100) / 10 };
    },
  };
}
