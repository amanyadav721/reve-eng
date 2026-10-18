import type { Memory, Stop, StopCategory, TransportMode, TripPreferences } from '@tagalong/shared';

import { hoursOn } from '../providers/hours.js';
import { similarity } from '../providers/text.js';
import type { LatLng, PlaceDetails, PlaceSummary, PlacesProvider, RouteMode, RoutesProvider, SearchProvider, WeatherProvider } from '../providers/types.js';
import { dietConflict } from './diet.js';
import { estimateFare } from './fare.js';
import type { ProposedStop } from './schema.js';
import { schedule } from './schedule.js';
import { validateDay, type DayRules, type Issue, type PlaceFacts } from './validate.js';

// One planning conversation. Runs the model's tool calls against real providers and keeps every
// fact it fetched, so the submitted plan can be checked against what was actually returned.

export interface Providers {
  places: PlacesProvider;
  routes: RoutesProvider;
  weather?: WeatherProvider;
  search?: SearchProvider;
}

export interface SessionInput {
  city: string;
  cityCenter: LatLng;
  date: string;
  rules: DayRules;
  memories: Memory[];
  /** Places used on earlier days of the trip. */
  avoidPlaceIds?: string[];
  diet?: TripPreferences['diet'];
}

const ROUTE_MODE: Record<string, RouteMode> = { walk: 'walk', auto: 'drive', cab: 'drive', scooter: 'two_wheeler', metro: 'transit', bus: 'transit' };
const POINTS: Record<StopCategory, number> = { food: 25, sight: 40, nature: 60, culture: 40, shopping: 30, transport: 0 };

export class PlannerSession {
  readonly found = new Map<string, PlaceSummary>();
  readonly details = new Map<string, PlaceDetails>();
  private readonly routes = new Map<string, { minutes: number; km: number } | null>();
  readonly toolCounts: Record<string, number> = {};
  // The model sees short IDs ("p7"). Long provider IDs ("ovt:48a6…", "ChIJ…") get garbled in generation.
  private readonly realOf = new Map<string, string>();
  private readonly aliasOf = new Map<string, string>();

  private alias(realId: string): string {
    let a = this.aliasOf.get(realId);
    if (!a) {
      a = `p${this.aliasOf.size + 1}`;
      this.aliasOf.set(realId, a);
      this.realOf.set(a, realId);
    }
    return a;
  }

  /** Accepts an alias or a real ID. */
  real(id: string): string {
    return this.realOf.get(id.trim()) ?? id.trim();
  }

  constructor(
    private readonly providers: Providers,
    readonly input: SessionInput,
  ) {}

  /** Runs one tool call. Always resolves to a JSON string for the model, errors included. */
  async run(name: string, rawArgs: string): Promise<string> {
    this.toolCounts[name] = (this.toolCounts[name] ?? 0) + 1;
    let args: Record<string, unknown>;
    try {
      args = rawArgs ? JSON.parse(rawArgs) : {};
    } catch {
      return json({ error: 'arguments were not valid JSON' });
    }
    try {
      switch (name) {
        case 'search_places':
          // No open_now: we plan future days, and hours are checked per day with place_details.
          return json(await this.searchPlaces(String(args.query ?? ''), args.near_place_id ? this.real(String(args.near_place_id)) : undefined));
        case 'place_details':
          return json(await this.placeDetails(this.real(String(args.place_id ?? ''))));
        case 'get_route':
          return json(await this.getRoute(this.real(String(args.from_place_id)), this.real(String(args.to_place_id)), String(args.mode) as TransportMode));
        case 'get_weather':
          return json(await this.getWeather());
        case 'web_search':
          return json(await this.webSearch(String(args.query ?? '')));
        case 'recall_memories':
          return json(this.recall(String(args.about ?? '')));
        default:
          return json({ error: `unknown tool ${name}` });
      }
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : String(err) });
    }
  }

  private async searchPlaces(query: string, nearPlaceId?: string) {
    if (!query) return { error: 'query is required' };
    const near = nearPlaceId ? this.locationOf(nearPlaceId) : undefined;
    const results = await this.providers.places.search({
      text: `${query}, ${this.input.city}`,
      center: near ?? this.input.cityCenter,
      radiusM: near ? 3000 : 15000,
      limit: 6,
    });
    const avoid = new Set(this.input.avoidPlaceIds ?? []);
    for (const r of results) this.found.set(r.placeId, r);
    return {
      places: results.map((r) => ({
        place_id: this.alias(r.placeId),
        name: r.name,
        rating: r.rating,
        ratings: r.ratingCount,
        price_level: r.priceLevel,
        types: r.types.slice(0, 3),
        area: r.address?.split(',').slice(0, 2).join(',').slice(0, 48),
        ...(avoid.has(r.placeId) ? { note: 'visited earlier this trip' } : {}),
      })),
    };
  }

  private async loadDetails(placeId: string): Promise<PlaceDetails> {
    const cached = this.details.get(placeId);
    if (cached) return cached;
    const d = await this.providers.places.details(placeId);
    this.details.set(placeId, d);
    this.found.set(placeId, d);
    return d;
  }

  private async placeDetails(placeId: string) {
    if (!this.found.has(placeId)) return { error: 'unknown place_id. Find places with search_places first.' };
    const d = await this.loadDetails(placeId);
    const hours = hoursOn(d, this.input.date);
    return {
      place_id: this.alias(d.placeId),
      name: d.name,
      status: d.businessStatus ?? 'OPERATIONAL',
      hours_on_day: hours === 'unknown' ? 'not listed' : hours.length ? hours.map((h) => `${h.open}–${h.close}`).join(', ') : 'closed that day',
      rating: d.rating,
      ratings: d.ratingCount,
      price_range_inr: d.priceRange,
      about: d.summary,
    };
  }

  private async route(from: string, to: string, mode: TransportMode) {
    const key = `${from}|${to}|${mode}`;
    if (!this.routes.has(key)) {
      const a = this.locationOf(from);
      const b = this.locationOf(to);
      if (!a || !b) return undefined;
      const routeMode = ROUTE_MODE[mode];
      if (!routeMode) return undefined;
      this.routes.set(key, await this.providers.routes.route({ from: a, to: b, mode: routeMode }));
    }
    return this.routes.get(key);
  }

  private async getRoute(from: string, to: string, mode: TransportMode) {
    const r = await this.route(from, to, mode);
    if (r === undefined) return { error: 'unknown place_id or mode. Use place_ids from search_places.' };
    if (r === null) return { error: `no ${mode} route found` };
    const fare = estimateFare(mode, r.km);
    return { minutes: r.minutes, km: r.km, fare_inr: fare.maxInr ? `${fare.minInr}–${fare.maxInr}` : '0' };
  }

  private async getWeather() {
    if (!this.providers.weather) return { unavailable: true };
    const hours = await this.providers.weather.hourly(this.input.cityCenter, this.input.date);
    if (!hours.length) return { unavailable: true, reason: 'forecast covers the next 48 hours only' };
    return { hourly: hours.filter((h) => h.hour >= 6 && h.hour <= 22) };
  }

  private async webSearch(query: string) {
    if (!this.providers.search) return { unavailable: true };
    return { results: await this.providers.search.search(query) };
  }

  private recall(about: string) {
    const words = about.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
    const hits = this.input.memories.filter((m) => words.some((w) => `${m.text} ${m.evidence}`.toLowerCase().includes(w)));
    return { memories: (hits.length ? hits : this.input.memories).map((m) => ({ kind: m.kind, text: m.text, evidence: m.evidence })) };
  }

  private locationOf(placeId: string): LatLng | undefined {
    return this.found.get(placeId)?.location;
  }

  /**
   * Turns the model's proposal into real stops using only fetched data, then checks it.
   * Names, hours, travel times and fares come from providers, never from the model.
   */
  async review(proposal: ProposedStop[]): Promise<{ stops: Stop[]; issues: Issue[] }> {
    const issues: Issue[] = [];
    const facts: Record<string, PlaceFacts> = {};
    const stops: Stop[] = [];
    const avoid = new Set(this.input.avoidPlaceIds ?? []);
    const seen = new Set<string>();

    for (const [i, proposed] of proposal.entries()) {
      const id = `s${i + 1}`;
      const p = { ...proposed, place_id: this.real(proposed.place_id) };
      if (!this.found.has(p.place_id)) {
        issues.push({ code: 'unverified_place', stopId: id, message: `Stop ${i + 1}: place_id "${proposed.place_id}" was not returned by search_places.` });
        continue;
      }
      const twin = stops.find((st) => st.placeId !== p.place_id && st.location && this.found.get(p.place_id) && near(st.location, this.found.get(p.place_id)!.location, 1500) && similarity(st.name.split(' at ').pop()!, this.found.get(p.place_id)!.name) >= 0.6);
      if (seen.has(p.place_id) || twin) issues.push({ code: 'repeated_place', stopId: id, message: `Stop ${i + 1} repeats a place already in the plan${twin ? ` ("${twin.name}")` : ''}.` });
      if (avoid.has(p.place_id)) issues.push({ code: 'repeated_place', stopId: id, message: `Stop ${i + 1} was already visited earlier this trip.` });
      seen.add(p.place_id);

      if (p.category === 'food' && !p.dish?.trim()) {
        const knownFor = this.found.get(p.place_id)?.types.find((t) => t.startsWith('known for '))?.slice('known for '.length);
        if (knownFor) p.dish = knownFor;
        else issues.push({ code: 'missing_dish', stopId: id, message: `Stop ${i + 1} is a food stop without a dish.` });
      }
      if (p.category === 'food') {
        const conflict = dietConflict(this.input.diet, p.dish ?? '');
        if (conflict) issues.push({ code: 'diet_mismatch', stopId: id, message: `Stop ${i + 1} (${p.dish ?? 'food'}) ${conflict}, but the traveler's diet is ${this.input.diet}.` });
      }

      const d = await this.loadDetails(p.place_id);
      facts[p.place_id] = { hours: hoursOn(d, this.input.date), shut: d.businessStatus === 'CLOSED_PERMANENTLY' || d.businessStatus === 'CLOSED_TEMPORARILY' };

      const prev = stops[stops.length - 1];
      let hop: Stop['hop'];
      let distanceKm: number | undefined;
      if (prev?.placeId) {
        const mode = (p.hop_mode ?? 'auto') as TransportMode;
        const r = await this.route(prev.placeId, p.place_id, mode);
        if (r) {
          const fare = estimateFare(mode, r.km);
          hop = { mode, minutes: r.minutes, ...(fare.maxInr ? { fareMinInr: fare.minInr, fareMaxInr: fare.maxInr } : {}) };
          distanceKm = r.km;
        } else {
          issues.push({ code: 'no_route', stopId: id, message: `No ${mode} route from the previous stop to stop ${i + 1}. Try another mode.` });
        }
      }

      stops.push({
        id,
        placeId: p.place_id,
        name: p.category === 'food' && p.dish ? `${p.dish} at ${d.name}` : d.name,
        location: d.location,
        category: p.category,
        icon: p.icon,
        startTime: p.start_time,
        durationMin: p.duration_min,
        costInr: p.cost_inr,
        distanceKm,
        hop,
        reason: p.reason,
        points: POINTS[p.category],
        status: 'upcoming',
      });
    }

    // Code decides the clock: travel times and opening hours set the real start times.
    const timed = schedule(stops, facts, { notBefore: this.input.rules.notBefore });
    stops.splice(0, stops.length, ...timed);
    issues.push(...validateDay(stops, facts, this.input.rules));
    // The product promise: Laddoo remembers, and shows it.
    if (this.input.memories.length && !stops.some((s) => s.reason?.includes('**'))) {
      issues.push({ code: 'memory_unused', message: 'No reason uses what we remember about the traveler.' });
    }
    return { stops, issues };
  }
}

const json = (v: unknown) => JSON.stringify(v);

function near(a: LatLng, b: LatLng, metres: number): boolean {
  const dLat = (b.lat - a.lat) * 111_320;
  const dLng = (b.lng - a.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLng) < metres;
}
