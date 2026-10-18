import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import tzlookup from '@photostructure/tz-lookup';

import type { LocalPlaces, PlaceRecord } from '../providers/local.js';
import type { LatLng } from '../providers/types.js';
import { buildCityPlaces, DATA_DIR, type BBox } from './build.js';
import { CITIES } from './cities.js';
import { countryProfile } from './countries.js';

// Any city in the world, on demand: the first trip to a city we haven't seen builds its places
// database from open data (about a minute), then every later trip there is instant.

export interface CityArea {
  key: string;
  name: string;
  bbox: BBox;
  center: LatLng;
  /** ISO 3166 alpha-2, lowercase ("in", "us"). */
  country: string;
  /** ISO 4217 ("INR", "USD"). */
  currency: string;
  /** IANA zone ("Asia/Kolkata", "America/New_York"). */
  timeZone: string;
}

function area(key: string, name: string, bbox: BBox, country: string, point?: LatLng): CityArea {
  const c = point ?? center(bbox);
  return { key, name, bbox, center: c, country, currency: countryProfile(country).currency, timeZone: tzlookup(c.lat, c.lng) };
}

export const cityKey = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const center = ([w, s, e, n]: BBox): LatLng => ({ lat: (s + n) / 2, lng: (w + e) / 2 });

/**
 * Keeps automatic areas sane: big enough for a city and its sights, small enough to import quickly.
 * Centred on the city's own point: boundaries can include far-off islands (Tokyo's reach the Pacific).
 */
function clampBox(b: BBox, c: LatLng = center(b)): BBox {
  const half = (span: number) => Math.min(0.3, Math.max(0.06, span / 2 + 0.03));
  const dLat = half(b[3] - b[1]);
  const dLng = half(b[2] - b[0]);
  return [c.lng - dLng, c.lat - dLat, c.lng + dLng, c.lat + dLat].map((x) => Math.round(x * 1000) / 1000) as BBox;
}

const areas = new Map<string, CityArea>();

// Nominatim's usage policy: at most one request per second.
let nextSlot = 0;
async function politely<T>(fn: () => Promise<T>): Promise<T> {
  const wait = Math.max(0, nextSlot - Date.now());
  nextSlot = Math.max(Date.now(), nextSlot) + 1100;
  if (wait) await new Promise((r) => setTimeout(r, wait));
  return fn();
}

/** Finds a city's area: our hand-checked list first, then OpenStreetMap's geocoder (Nominatim), cached. */
export async function cityArea(name: string, fetchImpl: typeof fetch = fetch): Promise<CityArea | undefined> {
  const key = cityKey(name);
  const known = CITIES[key];
  if (known) return area(key, known.name, known.bbox, known.country);
  const cached = areas.get(key);
  if (cached) return cached;

  // Anywhere in the world. "Miami" finds Miami, Florida; add a region to disambiguate ("Paris, Texas").
  const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({ q: name, format: 'jsonv2', limit: '1', addressdetails: '1' })}`;
  const res = await politely(() => fetchImpl(url, { headers: { 'user-agent': 'Tagalong/0.1 (city lookup, once per city)' } }));
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const [hit] = (await res.json()) as { lat: string; lon: string; boundingbox: [string, string, string, string]; display_name: string; address?: { country_code?: string } }[];
  if (!hit) return undefined;
  const [s, n, w, e] = hit.boundingbox.map(Number);
  const point = { lat: Number(hit.lat), lng: Number(hit.lon) };
  // A box around the city point, sized by the boundary but never centred on its far edges.
  const half = (span: number) => Math.min(span / 2, 0.6);
  const bbox = clampBox([point.lng - half(e - w), point.lat - half(n - s), point.lng + half(e - w), point.lat + half(n - s)], point);
  const found = area(key, name.trim(), bbox, hit.address?.country_code ?? 'in', point);
  areas.set(key, found);
  return found;
}

const building = new Map<string, Promise<CityArea | undefined>>();

/**
 * Makes sure our places database covers a city, building it if needed, and loads it into `places`.
 * Concurrent calls for the same city share one build.
 */
export async function ensureCity(name: string, places: LocalPlaces, log: (m: string) => void = () => {}): Promise<CityArea | undefined> {
  const key = cityKey(name);
  const inFlight = building.get(key);
  if (inFlight) return inFlight;

  const job = (async () => {
    const area = await cityArea(name);
    if (!area) return undefined;
    if (places.hasCity(area.key)) return area;

    const file = join(DATA_DIR, 'places', `${area.key}.json`);
    const records = existsSync(file)
      ? (JSON.parse(readFileSync(file, 'utf8')) as { places: PlaceRecord[] }).places
      : await buildCityPlaces(area.key, area.name, area.bbox, log);
    places.addCity(area.key, records);
    return area;
  })();

  building.set(key, job);
  try {
    return await job;
  } finally {
    building.delete(key);
  }
}
