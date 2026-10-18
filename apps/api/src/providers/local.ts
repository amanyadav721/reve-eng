import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import OpeningHours from 'opening_hours';

import { similarity, tokens } from './text.js';
import type { HoursPeriod, LatLng, PlaceDetails, PlaceSummary, PlacesProvider } from './types.js';

// Our own places database: open data built by data/build-places.ts, searched in memory.
// One city is tens of thousands of rows, which fits comfortably; Supabase/Postgres replaces this
// file-backed version once we have many cities.

export interface PlaceRecord {
  id: string;
  name: string;
  altNames: string[];
  lat: number;
  lng: number;
  /** Category words from OSM tags and Overture's taxonomy: "restaurant", "fort", "bazaar"… */
  kinds: string[];
  /** Curated: dishes or experiences this place is famous for. */
  knownFor?: string[];
  address?: string;
  status: 'open' | 'closed_temporarily' | 'closed_permanently';
  osm?: { openingHours?: string; fee?: string; wikidata?: string };
  overture?: { id: string; confidence: number };
  /** Popularity proxy (Wikidata link, attraction tags, curated, both sources agree, confidence). */
  rank: number;
}

interface Indexed extends PlaceRecord {
  nameTokens: Set<string>;
  kindTokens: Set<string>;
}

const DEFAULT_DIR = new URL('../../data/places/', import.meta.url).pathname;

export class LocalPlaces implements PlacesProvider {
  private readonly places: Indexed[] = [];
  private readonly byId = new Map<string, Indexed>();

  constructor(records: PlaceRecord[]) {
    for (const r of records) {
      const p: Indexed = {
        ...r,
        nameTokens: new Set([r.name, ...r.altNames].flatMap(tokens)),
        kindTokens: new Set([...r.kinds, ...(r.knownFor ?? [])].flatMap(tokens)),
      };
      this.places.push(p);
      this.byId.set(p.id, p);
    }
  }

  static fromDir(dir = DEFAULT_DIR): LocalPlaces | undefined {
    if (!existsSync(dir)) return undefined;
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    if (!files.length) return undefined;
    const all = files.flatMap((f) => (JSON.parse(readFileSync(join(dir, f), 'utf8')) as { places: PlaceRecord[] }).places);
    return new LocalPlaces(all);
  }

  get size(): number {
    return this.places.length;
  }

  async search({ text, center, radiusM, limit = 8 }: Parameters<PlacesProvider['search']>[0]): Promise<PlaceSummary[]> {
    const q = tokens(text);
    if (!q.length) return [];
    const phrase = q.join(' ');
    const scored: { p: Indexed; score: number }[] = [];

    for (const p of this.places) {
      // Never suggest a place that has shut for good.
      if (p.status === 'closed_permanently') continue;
      const d = metres(center, p);
      if (d > radiusM * 1.5) continue;

      // Name: best of fuzzy whole-name match and word overlap.
      const nameHits = q.filter((w) => p.nameTokens.has(w)).length / q.length;
      const fuzzy = Math.max(similarity(phrase, p.name), ...p.altNames.map((n) => similarity(phrase, n)));
      const name = Math.max(nameHits, fuzzy);
      // Kind: query words found in categories or "known for" ("kachori", "rooftop", "cafe").
      const kind = q.filter((w) => p.kindTokens.has(w)).length / q.length;
      if (name < 0.34 && kind < 0.5) continue;

      const score = 3 * name + 2 * kind + 0.25 * p.rank - 0.6 * (d / radiusM) - (p.status === 'closed_temporarily' ? 2 : 0);
      scored.push({ p, score });
    }

    // Open data has duplicates, some pinned hundreds of metres off ("Hawa Mahal" vs "Hawa Mahal jaipur").
    // Keep the best of each cluster: near-identical names within 1.5 km, similar names within 250 m.
    const kept: Indexed[] = [];
    for (const { p } of scored.sort((a, b) => b.score - a.score)) {
      const dup = kept.some((k) => {
        const d = metres(k, p);
        const sim = similarity(k.name, p.name);
        return (d < 1500 && (sim >= 0.7 || containsName(k.name, p.name))) || (d < 250 && sim >= 0.45);
      });
      if (!dup) kept.push(p);
      if (kept.length >= limit) break;
    }
    return kept.map(summary);
  }

  async details(placeId: string): Promise<PlaceDetails> {
    const p = this.byId.get(placeId);
    if (!p) throw new Error(`unknown place ${placeId}`);
    return {
      ...summary(p),
      regularHours: p.osm?.openingHours ? weeklyPeriods(p.osm.openingHours, p) : undefined,
      businessStatus: p.status === 'open' ? 'OPERATIONAL' : p.status === 'closed_temporarily' ? 'CLOSED_TEMPORARILY' : 'CLOSED_PERMANENTLY',
      summary: [p.knownFor?.length ? `Known for ${p.knownFor.join(', ')}.` : '', p.osm?.fee ? `Fee: ${p.osm.fee}.` : '', `Kinds: ${p.kinds.slice(0, 5).join(', ')}.`]
        .filter(Boolean)
        .join(' '),
    };
  }
}

function containsName(a: string, b: string): boolean {
  const x = tokens(a).join(' ');
  const y = tokens(b).join(' ');
  return !!x && !!y && (x.includes(y) || y.includes(x));
}

function summary(p: PlaceRecord): PlaceSummary {
  return { placeId: p.id, name: p.name, address: p.address, location: { lat: p.lat, lng: p.lng }, types: [...(p.knownFor ?? []).map((k) => `known for ${k}`), ...p.kinds].slice(0, 6) };
}

/**
 * Turns an OSM opening_hours string ("Mo-Sa 09:00-17:00; Su off") into Google-style weekly periods,
 * by evaluating it over a reference week. Holidays aren't modelled. Unparseable strings give undefined
 * ("not listed") rather than a guess.
 */
export function weeklyPeriods(value: string, at: LatLng): HoursPeriod[] | undefined {
  let oh: OpeningHours;
  try {
    oh = new OpeningHours(value, { lat: at.lat, lon: at.lng, address: { country_code: 'in', state: '' } }, 0); // mode 0: opening_hours time ranges
  } catch {
    return undefined;
  }
  // Reference week, local time, starting on a Sunday (day 0) with no DST change in India.
  const start = new Date(2026, 0, 4, 0, 0, 0);
  const end = new Date(2026, 0, 11, 0, 0, 0);
  const intervals = oh.getOpenIntervals(start, end);
  if (!intervals.length) return [];
  const point = (d: Date) => ({ day: d.getDay(), hour: d.getHours(), minute: d.getMinutes() });
  const periods: HoursPeriod[] = [];
  for (const [from, to, unknown] of intervals) {
    if (unknown) continue;
    // A period that runs the whole week is 24/7.
    if (from.getTime() === start.getTime() && to.getTime() === end.getTime()) return [{ open: { day: 0, hour: 0, minute: 0 } }];
    periods.push({ open: point(from), close: point(to) });
  }
  return periods;
}

function metres(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
