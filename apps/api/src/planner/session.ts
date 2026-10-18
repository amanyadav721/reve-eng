import { formatMoneyRange, type Memory, type Stop, type StopCategory, type TransportMode, type TripPreferences } from '@tagalong/shared';

import { hoursOn } from '../providers/hours.js';
import { similarity } from '../providers/text.js';
import type { LatLng, PlaceDetails, PlaceSummary, PlacesProvider, RouteMode, RoutesProvider, SearchProvider, WeatherProvider } from '../providers/types.js';
import { dietConflict } from './diet.js';
import { estimateFare } from './fare.js';
import type { ProposedStop } from './schema.js';
import { momentLabel, type Moment } from './moments.js';
import { repairDay } from './repair.js';
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
  /** ISO 3166 alpha-2, lowercase. Decides fares and which transport modes exist. */
  country: string;
  currency: string;
  modes: TransportMode[];
  /** Start time of each moment today, minutes after midnight. */
  momentStarts?: Partial<Record<Moment, number>>;
  /** Moments the traveler loves, which the plan must include. */
  mustHave?: Moment[];
  /** Re-planning: the traveler's current position, where the rest of the day starts. */
  origin?: LatLng;
  /** Re-planning the rest of a day: whole-day rules (start time, length, stop counts) don't apply. */
  partial?: boolean;
  /** Re-planning: lunch already happened (or it's past lunchtime). */
  lunchDone?: boolean;
}

/** Stand-in place id for "where the traveler is now". */
export const HERE = '__here__';

const ROUTE_MODE: Record<string, RouteMode> = { walk: 'walk', auto: 'drive', cab: 'drive', scooter: 'two_wheeler', metro: 'transit', bus: 'transit', train: 'transit' };
const POINTS: Record<StopCategory, number> = { food: 25, sight: 40, nature: 60, culture: 40, shopping: 30, transport: 0 };

export class PlannerSession {
  readonly found = new Map<string, PlaceSummary>();
  readonly details = new Map<string, PlaceDetails>();
  private readonly routes = new Map<string, { minutes: number; km: number; estimated?: boolean } | null>();
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
  ) {
    if (input.origin) this.found.set(HERE, { placeId: HERE, name: 'where you are', location: input.origin, types: [] });
  }

  /** Loads the places of an existing plan, so it can be re-timed and checked without the model. */
  async adopt(stops: Stop[]): Promise<void> {
    for (const s of stops) if (s.placeId && s.placeId !== HERE) await this.loadDetails(s.placeId);
  }

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
    if (!this.input.modes.includes(mode)) return { error: `"${mode}" isn't available here. Use one of: ${this.input.modes.join(', ')}.` };
    const r = await this.route(from, to, mode);
    if (r === undefined) return { error: 'unknown place_id or mode. Use place_ids from search_places.' };
    if (r === null) return { error: `no ${mode} route found` };
    const fare = estimateFare(mode, r.km, this.input.country);
    return {
      minutes: r.minutes,
      km: r.km,
      fare: fare ? (fare.max ? formatMoneyRange(fare.min, fare.max, this.input.currency) : 'free') : 'unknown',
      ...(r.estimated ? { approximate: 'no road data here yet: estimated from distance' } : {}),
    };
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
  async review(proposal: ProposedStop[]): Promise<{ stops: Stop[]; issues: Issue[]; repairs: string[] }> {
    const issues: Issue[] = [];
    const facts: Record<string, PlaceFacts> = {};
    const avoid = new Set(this.input.avoidPlaceIds ?? []);
    const repairs: string[] = [];
    let stops: Stop[] = [];

    // ── 1. Build stops from real data ───────────────────────────────────────
    for (const [i, proposed] of proposal.entries()) {
      const id = `s${i + 1}`;
      const p = { ...proposed, place_id: this.real(proposed.place_id) };
      const place = this.found.get(p.place_id);
      if (!place) {
        issues.push({ code: 'unverified_place', stopId: id, message: `Stop ${i + 1}: place_id "${proposed.place_id}" was not returned by search_places.` });
        continue;
      }
      // Duplicates (the same place, or two records of it) and repeats from earlier days: code drops them.
      const twin = stops.find((st) => st.placeId === p.place_id || (st.location && near(st.location, place.location, 1500) && similarity(st.name.split(' at ').pop()!, place.name) >= 0.6));
      if (twin || avoid.has(p.place_id)) {
        repairs.push(twin ? `Dropped a repeat of ${twin.name}.` : `Dropped ${place.name}: already visited earlier this trip.`);
        continue;
      }

      if (p.category === 'food' && !p.dish?.trim()) {
        const knownFor = place.types.find((t) => t.startsWith('known for '))?.slice('known for '.length);
        if (knownFor) p.dish = knownFor;
        else issues.push({ code: 'missing_dish', stopId: id, message: `Stop ${i + 1} is a food stop without a dish.` });
      }
      if (p.category === 'food') {
        const conflict = dietConflict(this.input.diet, p.dish ?? '');
        if (conflict) issues.push({ code: 'diet_mismatch', stopId: id, message: `Stop ${i + 1} (${p.dish ?? 'food'}) ${conflict}, but the traveler's diet is ${this.input.diet}.` });
      }
      const mode = (p.hop_mode ?? defaultMode(this.input.modes)) as TransportMode;
      if (stops.length && !this.input.modes.includes(mode)) {
        issues.push({ code: 'mode_unavailable', stopId: id, message: `Stop ${i + 1}: "${mode}" isn't available here (use ${this.input.modes.join(', ')}).` });
      }

      const d = await this.loadDetails(p.place_id);
      facts[p.place_id] = this.factsOf(d);
      stops.push({
        id,
        placeId: p.place_id,
        name: p.category === 'food' && p.dish ? `${p.dish} at ${d.name}` : d.name,
        location: d.location,
        category: p.category,
        icon: p.icon,
        startTime: p.start_time,
        durationMin: p.duration_min,
        cost: p.cost,
        // The mode is kept on the hop; relink fills in minutes and fares.
        ...(stops.length ? { hop: { mode, minutes: 0 } } : {}),
        reason: p.reason,
        // Only moments the traveler loves are pinned (and can fail); other tags are just a theme.
        ...(p.timed_for && p.timed_for !== 'none' && this.input.mustHave?.includes(p.timed_for) ? { moment: p.timed_for } : {}),
        points: POINTS[p.category],
        status: 'upcoming',
      });
    }
    return this.settle(stops, issues, repairs, facts);
  }

  /**
   * Code decides the clock, repairs what it can, and validates what's left. Used for new plans and
   * for re-planning the rest of a day.
   */
  async settle(input: Stop[], issues: Issue[] = [], repairs: string[] = [], facts: Record<string, PlaceFacts> = {}): Promise<{ stops: Stop[]; issues: Issue[]; repairs: string[] }> {
    let stops = input;
    for (const s of stops) if (s.placeId && !facts[s.placeId]) facts[s.placeId] = this.factsOf(await this.loadDetails(s.placeId));
    await this.relink(stops, issues);

    // ── 2. Code decides the clock, and repairs what it can ──────────────────
    const partial = this.input.partial;
    const repaired = await repairDay(stops, {
      pace: partial ? undefined : this.input.rules.pace,
      minFoodStops: partial ? 0 : (this.input.rules.minFoodStops ?? 1),
      lunchDone: this.input.lunchDone,
      lunchAtStart: !!this.input.origin,
      notAfter: this.input.rules.notAfter ?? '22:00',
      schedule: (list) => schedule(list, facts, { notBefore: this.input.rules.notBefore, momentStarts: this.input.momentStarts }),
      relink: (list) => this.relink(list),
      findLunch: (list, at) => this.findLunch(list, at, facts),
    });
    stops = repaired.stops;
    repairs.push(...repaired.repairs);

    // ── 3. Validate what's left ─────────────────────────────────────────────
    for (const m of repaired.missed) {
      issues.push({ code: 'missed_moment', stopId: m.stopId, message: `The ${momentLabel(m.moment)} stop must start by ${m.due}, but the earlier stops only get there at ${m.earliest}.` });
    }
    for (const want of this.input.mustHave ?? []) {
      if (!stops.some((st) => st.moment === want)) {
        const at = this.input.momentStarts?.[want];
        issues.push({ code: 'missing_moment', message: `They love ${momentLabel(want)}, but no stop is tagged timed_for "${want}"${at !== undefined ? ` (it starts around ${String(Math.floor(at / 60)).padStart(2, '0')}:${String(at % 60).padStart(2, '0')})` : ''}.` });
      }
    }
    issues.push(...validateDay(stops, facts, partial ? { ...this.input.rules, pace: undefined, minFoodStops: undefined, budgetPerDay: undefined, lunchDone: this.input.lunchDone } : this.input.rules));
    // The product promise: Laddoo remembers, and shows it.
    if (!partial && this.input.memories.length && !stops.some((s) => s.reason?.includes('**'))) {
      issues.push({ code: 'memory_unused', message: 'No reason uses what we remember about the traveler.' });
    }
    return { stops, issues, repairs };
  }

  private factsOf(d: PlaceDetails): PlaceFacts {
    return { hours: hoursOn(d, this.input.date), shut: d.businessStatus === 'CLOSED_PERMANENTLY' || d.businessStatus === 'CLOSED_TEMPORARILY' };
  }

  /** Fills in travel into each stop from the one before it, after the order changed. */
  private async relink(stops: Stop[], issues?: Issue[]): Promise<void> {
    for (const [i, st] of stops.entries()) {
      const prev = i === 0 && this.input.origin ? this.found.get(HERE) : stops[i - 1];
      if (!prev?.placeId || !st.placeId) {
        delete st.hop;
        delete st.distanceKm;
        continue;
      }
      const mode = st.hop?.mode ?? defaultMode(this.input.modes);
      const r = await this.route(prev.placeId, st.placeId, mode);
      if (!r) {
        issues?.push({ code: 'no_route', stopId: st.id, message: `No ${mode} route to "${st.name}". Try another mode.` });
        st.hop = { mode, minutes: 0 };
        continue;
      }
      const fare = estimateFare(mode, r.km, this.input.country);
      st.hop = { mode, minutes: r.minutes, ...(fare?.max ? { fareMin: fare.min, fareMax: fare.max } : {}), ...(r.estimated ? { estimated: true } : {}) };
      st.distanceKm = r.km;
    }
  }

  /**
   * Eateries near a point that are open at `atMin` (minutes after midnight) and fit the diet, best first:
   * places known for a dish, then proper restaurants, then distance. Used for "I'm hungry".
   */
  async foodOptions(anchor: LatLng, atMin: number, limit = 3, exclude: Set<string> = new Set()): Promise<Stop[]> {
    const eatery = (p: PlaceSummary) => p.types.some((t) => /restaurant|cafe|food|thali|dhaba|bakery|eatery|known for|diner|bistro|canteen|sweets|confectionery/i.test(t));
    for (const q of ['restaurant', 'cafe', 'street food']) {
      const results = await this.providers.places.search({ text: `${q}, ${this.input.city}`, center: anchor, radiusM: 1500, limit: 8 });
      for (const r of results) this.found.set(r.placeId, r);
    }
    const nearby = [...this.found.values()]
      .filter((p) => p.placeId !== HERE && !exclude.has(p.placeId) && eatery(p) && near(p.location, anchor, 1800))
      .sort((a, b) => dist(a.location, anchor) - dist(b.location, anchor))
      .slice(0, 12);

    const scored: { stop: Stop; score: number }[] = [];
    for (const place of nearby) {
      const d = await this.loadDetails(place.placeId);
      const f = this.factsOf(d);
      if (f.shut) continue;
      const open = f.hours === 'unknown' ? undefined : f.hours.some((h) => atMin >= toMinutes(h.open) && atMin + 40 <= toMinutes(h.close));
      if (open === false) continue;
      const knownFor = place.types.find((t) => t.startsWith('known for '))?.slice('known for '.length);
      const fits = knownFor && !dietConflict(this.input.diet, knownFor);
      const dish = fits ? knownFor! : mealFor(atMin, this.input.country, this.input.diet);
      const score = (fits ? 3 : 0) + (open ? 1 : 0) + (/restaurant|thali|cafe/i.test(place.types.join(' ')) ? 0.5 : 0) - dist(place.location, anchor) / 1000;
      scored.push({
        score,
        stop: {
          id: `food-${place.placeId}`,
          placeId: place.placeId,
          name: `${dish} at ${d.name}`,
          location: d.location,
          category: 'food',
          icon: '🍽️',
          startTime: '00:00',
          durationMin: 40,
          hop: { mode: 'walk', minutes: 0 },
          reason: fits ? `${d.name} is known for ${knownFor}, and it's close by.` : `Close by and open now, so you can eat without a detour.`,
          points: POINTS.food,
          status: 'upcoming',
        },
      });
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((x) => x.stop);
  }

  /** A lunch near the stop before `at`: an eatery the model already found, or a quick search. */
  private async findLunch(stops: Stop[], at: number, facts: Record<string, PlaceFacts>): Promise<Stop | undefined> {
    const anchor = (at === 0 && this.input.origin) || (stops[at - 1] ?? stops[at])?.location;
    if (!anchor) return undefined;
    const used = new Set(stops.map((s) => s.placeId));
    const eatery = (p: PlaceSummary) => p.types.some((t) => /restaurant|cafe|food|thali|dhaba|bakery|eatery|known for|diner|bistro|canteen/i.test(t));
    let candidates = [...this.found.values()].filter((p) => !used.has(p.placeId) && eatery(p) && near(p.location, anchor, 2500));
    if (!candidates.length) {
      const results = await this.providers.places.search({ text: `restaurant, ${this.input.city}`, center: anchor, radiusM: 2000, limit: 8 });
      for (const r of results) this.found.set(r.placeId, r);
      candidates = results.filter((p) => !used.has(p.placeId));
    }
    const byDistance = candidates.sort((a, b) => dist(a.location, anchor) - dist(b.location, anchor));
    for (const place of byDistance.slice(0, 4)) {
      const d = await this.loadDetails(place.placeId);
      const f = this.factsOf(d);
      if (f.shut) continue;
      const knownFor = place.types.find((t) => t.startsWith('known for '))?.slice('known for '.length);
      const dish = knownFor && !dietConflict(this.input.diet, knownFor) ? knownFor : defaultLunch(this.input.country, this.input.diet);
      facts[place.placeId] = f;
      return {
        id: `lunch-${place.placeId}`,
        placeId: place.placeId,
        name: `${dish} at ${d.name}`,
        location: d.location,
        category: 'food',
        icon: '🍽️',
        startTime: '12:30',
        durationMin: 45,
        hop: { mode: defaultMode(this.input.modes), minutes: 0 },
        reason: `Lunch break close to where you'll be, so the afternoon doesn't run on an empty stomach.`,
        points: POINTS.food,
        status: 'upcoming',
      };
    }
    return undefined;
  }
}

const json = (v: unknown) => JSON.stringify(v);

function near(a: LatLng, b: LatLng, metres: number): boolean {
  const dLat = (b.lat - a.lat) * 111_320;
  const dLng = (b.lng - a.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLng) < metres;
}

/** The usual short-hop ride: auto where it exists, otherwise a cab. */
function defaultMode(modes: TransportMode[]): TransportMode {
  return modes.includes('auto') ? 'auto' : modes.includes('cab') ? 'cab' : modes[0];
}

function dist(a: LatLng, b: LatLng): number {
  return Math.hypot((b.lat - a.lat) * 111_320, (b.lng - a.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180));
}

function defaultLunch(country: string, diet: TripPreferences['diet']): string {
  const veg = diet === 'veg' || diet === 'egg' || diet === 'jain' || diet === 'vegan';
  if (country === 'in') return diet === 'jain' ? 'Jain thali' : diet === 'vegan' ? 'vegan thali (no ghee or curd)' : veg ? 'vegetarian thali' : 'thali';
  return diet === 'vegan' ? 'vegan lunch' : veg ? 'vegetarian lunch' : 'lunch';
}

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** A sensible dish for the time of day when we don't know what a place is famous for. */
function mealFor(atMin: number, country: string, diet: TripPreferences['diet']): string {
  const veg = diet === 'veg' || diet === 'egg' || diet === 'jain' || diet === 'vegan';
  if (atMin < 11 * 60) return country === 'in' ? (diet === 'jain' ? 'Jain breakfast' : 'poha and chai') : 'breakfast';
  if (atMin < 15 * 60 + 30) return defaultLunch(country, diet);
  if (atMin < 18 * 60 + 30) return country === 'in' ? (diet === 'vegan' ? 'chaat (no curd)' : diet === 'jain' ? 'Jain snacks' : 'chaat and chai') : 'a snack';
  return country === 'in' ? defaultLunch(country, diet) : veg ? 'vegetarian dinner' : 'dinner';
}
