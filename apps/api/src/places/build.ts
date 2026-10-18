// Builds our own places database for a city from open data, so the planner can run without Google.
//
//   npm run data:places -w api -- jaipur        (any city: npm run data:places -w api -- "Kochi")
//
// The API also calls buildCityPlaces() on demand the first time someone plans a trip to a new city.
//
// Sources:
//   - Overture Maps places (CDLA-Permissive-2.0): broad coverage, categories, open/closed status.
//   - OpenStreetMap via Overpass (ODbL): opening hours, entry fees, Wikidata links, bazaars.
//   - data/curated/<city>.json: what famous eateries are known for (draft, to be verified).
// Output: apps/api/data/places/<city>.json (generated, not committed). Opening hours are never invented:
// places without OSM hours come out as "not listed".

import { DuckDBInstance } from '@duckdb/node-api';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { PlaceRecord } from '../providers/local.js';
import { sameBusiness, similarity } from '../providers/text.js';

const OVERTURE_RELEASE = '2026-09-23.1';
export const DATA_DIR = new URL('../../data/', import.meta.url).pathname;

export type BBox = [west: number, south: number, east: number, north: number];

// ─── Overture ────────────────────────────────────────────────────────────────

interface OvertureRow {
  id: string;
  name: string;
  basic_category: string | null;
  primary_cat: string | null;
  hierarchy: string[] | null;
  alternates: string[] | null;
  confidence: number;
  status: string | null;
  address: string | null;
  lng: number;
  lat: number;
}

async function overture([W, S, E, N]: BBox): Promise<OvertureRow[]> {
  const db = await DuckDBInstance.create(':memory:');
  const c = await db.connect();
  await c.run("INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial; SET s3_region='us-west-2';");
  const sql = `
    SELECT id, names.primary AS name, basic_category, taxonomy.primary AS primary_cat,
           taxonomy.hierarchy AS hierarchy, taxonomy.alternates AS alternates,
           confidence, operating_status AS status, addresses[1].freeform AS address,
           ST_X(geometry) AS lng, ST_Y(geometry) AS lat
    FROM read_parquet('s3://overturemaps-us-west-2/release/${OVERTURE_RELEASE}/theme=places/type=place/*', hive_partitioning=1)
    WHERE bbox.xmin >= ${W} AND bbox.xmax <= ${E} AND bbox.ymin >= ${S} AND bbox.ymax <= ${N}
      AND confidence >= 0.4 AND names.primary IS NOT NULL`;
  const r = await c.runAndReadAll(sql);
  return r.getRowObjectsJson().map((o) => ({
    id: String(o.id),
    name: String(o.name),
    basic_category: (o.basic_category as string) ?? null,
    primary_cat: (o.primary_cat as string) ?? null,
    hierarchy: (o.hierarchy as string[]) ?? null,
    alternates: (o.alternates as string[]) ?? null,
    confidence: Number(o.confidence),
    status: (o.status as string) ?? null,
    address: (o.address as string) ?? null,
    lng: Number(o.lng),
    lat: Number(o.lat),
  }));
}

// ─── OpenStreetMap ───────────────────────────────────────────────────────────

interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags: Record<string, string>;
}

const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];

async function osm([W, S, E, N]: BBox): Promise<OsmElement[]> {
  const b = `${S},${W},${N},${E}`;
  const q = `[out:json][timeout:240];
(
  nwr["name"]["tourism"](${b});
  nwr["name"]["historic"](${b});
  nwr["name"]["amenity"~"^(restaurant|cafe|fast_food|food_court|ice_cream|bar|pub|marketplace|place_of_worship|theatre|cinema|arts_centre)$"](${b});
  nwr["name"]["shop"~"^(confectionery|bakery|pastry|deli|clothes|fabric|jewelry|gift|craft|art|books|mall|department_store|tea|spices|bag|shoes|antiques)$"](${b});
  nwr["name"]["leisure"~"^(park|garden|water_park)$"](${b});
  way["highway"]["name"~"[Bb]aza+r"](${b});
);
out center tags;`;
  // Public Overpass servers rate-limit (429) and time out (504) when busy: retry with backoff.
  for (let attempt = 1; attempt <= 4; attempt++) {
    for (const url of OVERPASS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'Tagalong-dev/0.1 (one-time city import)' },
          body: new URLSearchParams({ data: q }),
          signal: AbortSignal.timeout(280_000),
        });
        if (res.ok) return ((await res.json()) as { elements: OsmElement[] }).elements;
        console.warn(`  Overpass ${new URL(url).host} → ${res.status}`);
      } catch (err) {
        console.warn(`  Overpass ${new URL(url).host} → ${err instanceof Error ? err.message : err}`);
      }
    }
    const wait = attempt * 20;
    console.warn(`  retrying in ${wait}s (attempt ${attempt + 1} of 4)`);
    await new Promise((r) => setTimeout(r, wait * 1000));
  }
  throw new Error('All Overpass mirrors failed after retries');
}

// ─── Merge ───────────────────────────────────────────────────────────────────

const metres = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

const OSM_KIND_KEYS = ['tourism', 'historic', 'amenity', 'shop', 'leisure', 'cuisine', 'building', 'religion'];

function osmKinds(t: Record<string, string>): string[] {
  const kinds = OSM_KIND_KEYS.flatMap((k) => (t[k] ? t[k].split(';').map((v) => v.trim()) : []));
  if (t.highway && /baza+r/i.test(t.name ?? '')) kinds.push('bazaar', 'market', 'shopping street');
  if (t.amenity === 'marketplace') kinds.push('bazaar');
  return kinds.filter((k) => k && k !== 'yes');
}

function rankOf(p: Omit<PlaceRecord, 'rank'>): number {
  let r = 0;
  if (p.osm?.wikidata) r += 3;
  if (p.kinds.some((k) => ['attraction', 'museum', 'viewpoint', 'fort', 'palace', 'castle', 'monument'].includes(k))) r += 2;
  if (p.knownFor?.length) r += 2;
  if (p.osm?.openingHours) r += 0.5;
  if (p.osm && p.overture) r += 1;
  r += (p.overture?.confidence ?? 0.5) * 1.5;
  return Math.round(r * 100) / 100;
}

/** Builds data/places/<key>.json for a city and returns its records. */
export async function buildCityPlaces(key: string, name: string, bbox: BBox, log: (msg: string) => void = console.log): Promise<PlaceRecord[]> {
  const cityKey = key.toLowerCase();
  log(`Building places for ${name} (bbox ${bbox.join(', ')})…`);
  const [ov, os] = await Promise.all([overture(bbox), osm(bbox)]);
  log(`Overture: ${ov.length} places. OpenStreetMap: ${os.length} elements.`);

  const records: Omit<PlaceRecord, 'rank'>[] = [];
  const used = new Set<string>();

  // Grid index over Overture rows for the proximity match.
  const cell = (lat: number, lng: number) => `${Math.floor(lat / 0.002)}:${Math.floor(lng / 0.002)}`;
  const grid = new Map<string, OvertureRow[]>();
  for (const r of ov) {
    const k = cell(r.lat, r.lng);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k)!.push(r);
  }
  const near = (lat: number, lng: number) => {
    const out: OvertureRow[] = [];
    const [ci, cj] = cell(lat, lng).split(':').map(Number);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) out.push(...(grid.get(`${ci + i}:${cj + j}`) ?? []));
    return out;
  };

  for (const el of os) {
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    const name = el.tags['name:en'] ?? el.tags.name;
    if (lat === undefined || lng === undefined || !name) continue;
    const here = { lat, lng };
    const match = near(lat, lng)
      .filter((r) => !used.has(r.id) && metres(here, r) < 150)
      .map((r) => ({ r, s: similarity(name, r.name) }))
      .filter((x) => x.s >= 0.45)
      .sort((a, b) => b.s - a.s)[0]?.r;
    if (match) used.add(match.id);
    const altNames = [el.tags.name, el.tags['name:en'], el.tags['alt_name'], el.tags['old_name'], match?.name].filter((n): n is string => !!n && n !== name);
    records.push({
      id: `osm:${el.type[0]}${el.id}`,
      name,
      altNames: [...new Set(altNames)],
      lat,
      lng,
      kinds: [...new Set([...osmKinds(el.tags), ...(match ? overtureKinds(match) : [])])],
      address: match?.address ?? undefined,
      status: match?.status === 'permanently_closed' ? 'closed_permanently' : match?.status === 'temporarily_closed' ? 'closed_temporarily' : 'open',
      osm: {
        openingHours: el.tags.opening_hours,
        fee: el.tags.fee ?? el.tags.charge,
        wikidata: el.tags.wikidata,
      },
      overture: match ? { id: match.id, confidence: match.confidence } : undefined,
    });
  }

  for (const r of ov) {
    if (used.has(r.id)) continue;
    records.push({
      id: `ovt:${r.id}`,
      name: r.name,
      altNames: [],
      lat: r.lat,
      lng: r.lng,
      kinds: overtureKinds(r),
      address: r.address ?? undefined,
      status: r.status === 'permanently_closed' ? 'closed_permanently' : r.status === 'temporarily_closed' ? 'closed_temporarily' : 'open',
      overture: { id: r.id, confidence: r.confidence },
    });
  }

  // Curated "known for" layer.
  const curatedFile = join(DATA_DIR, 'curated', `${cityKey}.json`);
  let curatedHits = 0;
  if (existsSync(curatedFile)) {
    const curated = JSON.parse(readFileSync(curatedFile, 'utf8')) as { places: { name: string; aka?: string[]; knownFor: string[] }[] };
    for (const c of curated.places) {
      const names = [c.name, ...(c.aka ?? [])];
      const hits = records.filter((r) => [r.name, ...r.altNames].some((n) => names.some((cn) => sameBusiness(cn, n))));
      for (const h of hits) h.knownFor = [...new Set([...(h.knownFor ?? []), ...c.knownFor])];
      if (hits.length) curatedHits++;
      else log(`  curated: no match for "${c.name}"`);
    }
  }

  const out = records.map((r) => ({ ...r, rank: rankOf(r) })).sort((a, b) => b.rank - a.rank);
  const dir = join(DATA_DIR, 'places');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${cityKey}.json`);
  writeFileSync(file, JSON.stringify({ city: name, bbox, builtAt: new Date().toISOString(), sources: { overture: OVERTURE_RELEASE, osm: 'Overpass API' }, places: out }));

  const withHours = out.filter((r) => r.osm?.openingHours).length;
  log(`Wrote ${out.length} places to ${file}`);
  log(`  merged OSM+Overture: ${out.filter((r) => r.osm && r.overture).length}, with opening hours: ${withHours}, curated matches: ${curatedHits}`);
  return out;
}

function overtureKinds(r: OvertureRow): string[] {
  const parts = [r.basic_category, r.primary_cat, ...(r.hierarchy ?? []), ...(r.alternates ?? [])].filter(Boolean) as string[];
  return [...new Set(parts.flatMap((p) => [p, ...p.split('_')]).filter((p) => p.length > 2 && p !== 'and'))];
}

