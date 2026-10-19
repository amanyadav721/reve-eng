import { formatMoneyRange, type Memory, type Stop, type StopCategory, type TransportMode, type TripPreferences } from '@tagalong/shared';

import { hoursOn } from '../providers/hours.js';
import { similarity } from '../providers/text.js';
import type { LatLng, PlaceDetails, PlaceSummary, PlacesProvider, RouteMode, RoutesProvider, SearchProvider, WeatherProvider } from '../providers/types.js';
import { dietConflict } from './diet.js';
import { estimateFare } from './fare.js';
import { fame, importance, knownFor, lovedMatch, lovesOf, mealQuality } from './importance.js';
import type { ProposedStop } from './schema.js';
import { momentLabel, type Moment } from './moments.js';
import { inventedClaims, knownAbout, withoutInventedClaims } from './reasons.js';
import { repairDay } from './repair.js';
import { schedule } from './schedule.js';
import { dayEnd, validateDay, type DayRules, type Issue, type PlaceFacts } from './validate.js';

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
  /** Quiz interests ("history", "street food"): what they love, besides memories. */
  interests?: string[];
  spice?: TripPreferences['spice'];
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
  /** Re-planning in the rain: outdoor stops don't work. */
  indoors?: boolean;
  /** Re-planning with the AI: flag long stretches with nothing to do. */
  fillGaps?: boolean;
  /** Re-planning: stops the traveler just asked for, which repairs must not drop. */
  keepIds?: string[];
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
  /** Words from what the traveler told us, which reasons may cite. */
  private readonly known: Set<string>;
  private readonly loves: string[];
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
    this.known = knownAbout(input.memories, { interests: input.interests, spice: input.spice });
    this.loves = lovesOf(input.interests, input.memories);
  }

  /**
   * Drops the sentences of each reason that claim a love we don't know about. Used when the model
   * already had a chance to fix them and that's all that's left. False when a reason would be left
   * empty, or the day would lose its only remembered detail.
   */
  scrubReasons(stops: Stop[]): boolean {
    const fixed = stops.map((s) => (s.reason && inventedClaims(s.reason, this.known).length ? withoutInventedClaims(s.reason, this.known) : s.reason));
    if (fixed.some((r, i) => r === undefined && stops[i].reason)) return false;
    if (!this.input.partial && this.input.memories.length && !fixed.some((r) => r?.includes('**'))) return false;
    stops.forEach((s, i) => (s.reason = fixed[i]));
    return true;
  }

  /** How much a stop matters to this traveler: famous sights and things they love rank high. */
  importance(s: Stop): number {
    const place = s.placeId ? (this.details.get(s.placeId) ?? this.found.get(s.placeId)) : undefined;
    return importance(s, place, this.loves);
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
      const invented = inventedClaims(p.reason, this.known);
      if (invented.length) {
        issues.push({
          code: 'invented_preference',
          stopId: id,
          message: `Stop ${i + 1}'s reason claims the traveler loves ${invented.map((c) => `"${c}"`).join(' and ')}, but they never told us that.`,
        });
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
  async settle(
    input: Stop[],
    issues: Issue[] = [],
    repairs: string[] = [],
    facts: Record<string, PlaceFacts> = {},
  ): Promise<{ stops: Stop[]; issues: Issue[]; repairs: string[]; letGo: Stop[] }> {
    let stops = input;
    for (const s of stops) if (s.placeId && !facts[s.placeId]) facts[s.placeId] = this.factsOf(await this.loadDetails(s.placeId));
    await this.relink(stops, issues);

    // ── 2. Code decides the clock, and repairs what it can ──────────────────
    const partial = this.input.partial;
    const repair = (list: Stop[]) => repairDay(list, {
      pace: partial ? undefined : this.input.rules.pace,
      minFoodStops: partial ? 0 : (this.input.rules.minFoodStops ?? 1),
      lunchDone: this.input.lunchDone,
      lunchAtStart: !!this.input.origin,
      activeFrom: partial ? this.input.rules.notBefore : undefined,
      keep: new Set(this.input.keepIds),
      notAfter: this.input.rules.notAfter ?? '22:00',
      schedule: (list) => schedule(list, facts, { notBefore: this.input.rules.notBefore, momentStarts: this.input.momentStarts }),
      relink: (list) => this.relink(list),
      findLunch: (list, at) => this.findLunch(list, at, facts),
      importance: (s) => this.importance(s),
    });
    let repaired = await repair(stops);

    // Re-planning mid-day, some things are out of reach now. Let them go rather than send the
    // traveler to a sunset after dark or a palace after closing. Repairs already tried dropping
    // other stops, so what's still missed can't be saved.
    const letGo: Stop[] = [];
    for (let n = 0; partial && n < 4; n++) {
      const missed = repaired.missed[0];
      const moment = missed && repaired.stops.find((s) => s.id === missed.stopId);
      const shut = moment ? undefined : repaired.stops.find((s) => !s.moment && !this.input.keepIds?.includes(s.id) && closedOnArrival(s, facts));
      const victim = moment ?? shut;
      if (!victim) break;
      letGo.push(victim);
      if (victim.moment) {
        this.input.mustHave = this.input.mustHave?.filter((m) => m !== victim.moment);
        repairs.push(`Let go of ${victim.name}: we can't get there in time for the ${momentLabel(victim.moment)}.`);
      } else {
        const close = closingTime(victim, facts);
        repairs.push(`Took off ${victim.name}: it ${close ? `closes at ${close}` : 'is closed'} before you'd get there.`);
      }
      const remaining = stops.filter((s) => !letGo.some((l) => l.id === s.id));
      await this.relink(remaining);
      repaired = await repair(remaining);
    }
    stops = repaired.stops;
    repairs.push(...repaired.repairs);
    // Re-planning with the AI: hours with nothing to do get a good place nearby, from code.
    if (this.input.fillGaps) stops = await this.fillGaps(stops, facts, repairs);

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
    if (this.input.fillGaps) {
      for (const g of this.longGaps(stops)) {
        const st = stops[g.at];
        const after = g.at > 0 ? `"${stops[g.at - 1].name}"` : 'where they are now';
        issues.push({
          code: 'long_gap',
          stopId: st.id,
          message: `Nothing planned for ${Math.round((g.to - g.from) / 30) / 2} hours, from ${fmt(g.from)} to ${fmt(g.to)}, before "${st.name}". Add a stop near ${after} that starts around ${fmt(g.from)} and ends by ${fmt(g.to)}.`,
        });
      }
    }
    if (this.input.indoors) {
      for (const s of stops) {
        if (this.isOutdoors(s)) issues.push({ code: 'outdoors_in_rain', stopId: s.id, message: `"${s.name}" is outdoors, and it's raining.` });
      }
    }
    issues.push(...validateDay(stops, facts, partial ? { ...this.input.rules, pace: undefined, minFoodStops: undefined, budgetPerDay: undefined, lunchDone: this.input.lunchDone, activeFrom: this.input.rules.notBefore } : this.input.rules));
    // The product promise: Laddoo remembers, and shows it.
    if (!partial && this.input.memories.length && !stops.some((s) => s.reason?.includes('**'))) {
      const quotable = this.input.memories.slice(0, 4).map((m) => `"${m.text}"`).join(', ');
      issues.push({ code: 'memory_unused', message: `No reason uses what we remember about the traveler. Use one of these: ${quotable}.` });
    }
    return { stops, issues, repairs, letGo };
  }

  /** Viewpoints, parks, gardens, beaches, ghats, lakes: no fun in the rain. Food and covered places pass. */
  private isOutdoors(s: Stop): boolean {
    if (s.category === 'food') return false;
    const types = (s.placeId && (this.details.get(s.placeId)?.types ?? this.found.get(s.placeId)?.types)) || [];
    return s.category === 'nature' || OUTDOORS.test([s.name, ...types].join(' '));
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
    const eatery = (p: PlaceSummary) => isEatery(p) || p.types.some((t) => /sweets|confectionery/i.test(t));
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
      const score = mealQuality(place, (dish) => !dietConflict(this.input.diet, dish), this.input.diet) + (open ? 1 : 0) - dist(place.location, anchor) / 1000;
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

  /**
   * A lunch near the stop before `at`, from eateries the model already found plus a quick search:
   * a place known for a dish that fits the diet first, then a proper restaurant, never the nearest
   * fast-food counter just because it's closest.
   */
  private async findLunch(stops: Stop[], at: number, facts: Record<string, PlaceFacts>): Promise<Stop | undefined> {
    const anchor = (at === 0 && this.input.origin) || (stops[at - 1] ?? stops[at])?.location;
    if (!anchor) return undefined;
    const used = new Set([...stops.map((s) => s.placeId), ...(this.input.avoidPlaceIds ?? [])]);
    const fits = (dish: string) => !dietConflict(this.input.diet, dish);
    const quality = (p: PlaceSummary) => mealQuality(p, fits, this.input.diet) - dist(p.location, anchor) / 1000;
    const pool = () => [...this.found.values()].filter((p) => p.placeId !== HERE && !used.has(p.placeId) && isEatery(p) && near(p.location, anchor, 2500));
    // Nothing good in what the model found: look around for a proper lunch.
    if (!pool().some((p) => quality(p) >= 1)) {
      for (const q of ['restaurant', 'thali']) {
        const results = await this.providers.places.search({ text: `${q}, ${this.input.city}`, center: anchor, radiusM: 2000, limit: 8 });
        for (const r of results) if (!this.found.has(r.placeId)) this.found.set(r.placeId, r);
      }
    }
    const best = pool().sort((a, b) => quality(b) - quality(a));
    for (const place of best.slice(0, 6)) {
      const d = await this.loadDetails(place.placeId);
      const f = this.factsOf(d);
      if (f.shut) continue;
      // Open for a 45-minute lunch somewhere between 12:00 and 15:00, when hours are listed.
      if (f.hours !== 'unknown' && !f.hours.some((h) => Math.max(toMinutes(h.open), 12 * 60) + 45 <= Math.min(toMinutes(h.close), 15 * 60))) continue;
      const famousFor = knownFor(place);
      const dish = famousFor && fits(famousFor) ? famousFor : defaultLunch(this.input.country, this.input.diet);
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
        reason:
          famousFor && fits(famousFor)
            ? `${d.name} is known for its ${famousFor}, and it's close to where you'll be at lunchtime.`
            : `A proper sit-down lunch close to where you'll be, so the afternoon doesn't run on an empty stomach.`,
        points: POINTS.food,
        status: 'upcoming',
      };
    }
    return undefined;
  }

  /** Free stretches longer than MAX_GAP_MIN before a stop, counting from "now" and the ride there. */
  private longGaps(stops: Stop[]): { at: number; from: number; to: number }[] {
    const out: { at: number; from: number; to: number }[] = [];
    let free = this.input.rules.notBefore ? toMinutes(this.input.rules.notBefore) : undefined;
    for (const [at, st] of stops.entries()) {
      const leave = toMinutes(st.startTime) - (st.hop?.minutes ?? 0);
      if (free !== undefined && leave - free > MAX_GAP_MIN) out.push({ at, from: free, to: leave });
      free = toMinutes(st.startTime) + st.durationMin;
    }
    return out;
  }

  /**
   * Fills long empty stretches with a good place near where the traveler will be: something they
   * love or a famous sight, open then, not already done today. Only keeps an addition that leaves
   * every loved moment reachable and the day ending on time.
   */
  private async fillGaps(input: Stop[], facts: Record<string, PlaceFacts>, repairs: string[]): Promise<Stop[]> {
    let stops = input;
    const timed = (list: Stop[]) => schedule(list, facts, { notBefore: this.input.rules.notBefore, momentStarts: this.input.momentStarts });
    const notAfter = toMinutes(this.input.rules.notAfter ?? '22:00');
    const tried = new Set<string>();
    for (let n = 0; n < 3; n++) {
      const gap = this.longGaps(stops)[0];
      if (!gap) break;
      const anchor = gap.at > 0 ? stops[gap.at - 1] : undefined;
      const from = anchor?.location ?? this.input.origin;
      if (!from) break;
      const missedBefore = timed(stops).missed.length;
      let added: Stop[] | undefined;
      for (const place of await this.fillCandidates(from, stops, tried)) {
        tried.add(place.placeId);
        const d = await this.loadDetails(place.placeId);
        const f = this.factsOf(d);
        if (f.shut) continue;
        facts[place.placeId] = f;
        // Most of the gap, leaving room for the rides either side.
        const durationMin = Math.max(45, Math.min(120, Math.round((gap.to - gap.from - 45) / 5) * 5));
        const stop = this.fillStop(d, fmt(gap.from), durationMin, anchor);
        const list = [...stops.slice(0, gap.at), stop, ...stops.slice(gap.at)];
        await this.relink(list);
        const t = timed(list);
        const placed = t.stops.find((s) => s.id === stop.id)!;
        const gapsBefore = this.longGaps(stops).length;
        if (closedOnArrival(placed, facts) || t.missed.length > missedBefore || dayEnd(t.stops) > Math.max(notAfter, dayEnd(stops)) || this.longGaps(t.stops).length > gapsBefore) continue;
        added = t.stops;
        repairs.push(`Added ${d.name} to fill the free time from ${fmt(gap.from)}.`);
        break;
      }
      if (!added) {
        await this.relink(stops);
        break;
      }
      stops = added;
    }
    return stops;
  }

  /** Places to fill a gap with, best first: loved and famous, close by, indoors when it rains. */
  private async fillCandidates(at: LatLng, stops: Stop[], tried: Set<string>): Promise<PlaceSummary[]> {
    const queries = [...(this.input.interests ?? []).filter((i) => !FOOD_INTEREST.test(i)).slice(0, 3), 'attraction', 'museum', 'market'];
    for (const q of queries) {
      const results = await this.providers.places.search({ text: `${q}, ${this.input.city}`, center: at, radiusM: 3000, limit: 8 });
      for (const r of results) if (!this.found.has(r.placeId)) this.found.set(r.placeId, r);
    }
    const used = new Set([...stops.map((s) => s.placeId), ...(this.input.avoidPlaceIds ?? [])]);
    const score = (p: PlaceSummary) => 2 * fame(p) + (lovedMatch(p, this.loves) ? 2 : 0) - dist(p.location, at) / 1000;
    return [...this.found.values()]
      .filter((p) => p.placeId !== HERE && !used.has(p.placeId) && !tried.has(p.placeId) && !isEatery(p) && !justLodging(p) && near(p.location, at, 3500))
      .filter((p) => !this.input.indoors || !OUTDOORS.test([p.name, ...p.types].join(' ')))
      .sort((a, b) => score(b) - score(a))
      .slice(0, 5);
  }

  private fillStop(d: PlaceDetails, startTime: string, durationMin: number, after: Stop | undefined): Stop {
    const kinds = [d.name, ...d.types].join(' ');
    const category: StopCategory = /museum|gallery|temple|mandir|church|mosque|ghat|ashram|haveli|cultural/i.test(kinds)
      ? 'culture'
      : /market|bazaar|mall|shopping|handicraft/i.test(kinds)
        ? 'shopping'
        : /park|garden|lake|beach|nature|waterfall/i.test(kinds)
          ? 'nature'
          : 'sight';
    const love = lovedMatch(d, (this.input.interests ?? []).filter((i) => !FOOD_INTEREST.test(i)));
    const why = knownFor(d) ? `${d.name} is known for ${knownFor(d)}` : fame(d) === 2 ? `${d.name} is one of ${this.input.city}'s best-known sights` : `${d.name} is close by`;
    return {
      id: `fill-${d.placeId}`,
      placeId: d.placeId,
      name: d.name,
      location: d.location,
      category,
      icon: { culture: '🏛️', shopping: '🛍️', nature: '🌿', sight: '📍' }[category as 'culture' | 'shopping' | 'nature' | 'sight'],
      startTime,
      durationMin,
      hop: { mode: defaultMode(this.input.modes), minutes: 0 },
      reason: `${why}${love ? `, and you said you love ${love}` : ''}. A good way to spend the free time${after ? ` after ${shortName(after)}` : ''}.`,
      points: POINTS[category],
      status: 'upcoming',
    };
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

/** Re-planning: longer than this with nothing to do feels like a broken plan. */
const MAX_GAP_MIN = 150;

function isEatery(p: PlaceSummary): boolean {
  return p.types.some((t) => /restaurant|cafe|food|thali|dhaba|bakery|eatery|known for|diner|bistro|canteen/i.test(t));
}

/** Food interests are about meals, not places to fill an afternoon with. */
const FOOD_INTEREST = /food|eat|cuisine|caf|dish|seafood/i;
/** Hotels and guest houses, unless they are also the sight (City Palace is partly a hotel). */
function justLodging(p: PlaceSummary): boolean {
  const kinds = p.types.join(' ');
  return /\b(hotel|lodging|hostel|guest_?house|resort)\b/i.test(kinds) && !/attraction|castle|palace|fort|museum|monument|historic|temple/i.test(kinds);
}

const fmt = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const shortName = (s: Stop) => s.name.split(' at ').pop()!;

const OUTDOORS = /\b(view ?point|viewpoint|sunset point|park|garden|beach|ghat|lake|trail|hike|zoo|stepwell|baori|open[- ]air|nature reserve|waterfall)\b/i;

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Scheduled where no opening interval holds the whole visit (the scheduler already waited for opening). */
function closedOnArrival(s: Stop, facts: Record<string, PlaceFacts>): boolean {
  const f = s.placeId ? facts[s.placeId] : undefined;
  if (!f) return false;
  if (f.shut) return true;
  if (f.hours === 'unknown') return false;
  const start = toMinutes(s.startTime);
  return !f.hours.some((h) => start >= toMinutes(h.open) && start + s.durationMin <= toMinutes(h.close));
}

function closingTime(s: Stop, facts: Record<string, PlaceFacts>): string | undefined {
  const hours = s.placeId ? facts[s.placeId]?.hours : undefined;
  return Array.isArray(hours) && hours.length ? hours.at(-1)!.close : undefined;
}

/** A sensible dish for the time of day when we don't know what a place is famous for. */
function mealFor(atMin: number, country: string, diet: TripPreferences['diet']): string {
  const veg = diet === 'veg' || diet === 'egg' || diet === 'jain' || diet === 'vegan';
  if (atMin < 11 * 60) return country === 'in' ? (diet === 'jain' ? 'Jain breakfast' : 'poha and chai') : 'breakfast';
  if (atMin < 15 * 60 + 30) return defaultLunch(country, diet);
  if (atMin < 18 * 60 + 30) return country === 'in' ? (diet === 'vegan' ? 'chaat (no curd)' : diet === 'jain' ? 'Jain snacks' : 'chaat and chai') : 'a snack';
  return country === 'in' ? defaultLunch(country, diet) : veg ? 'vegetarian dinner' : 'dinner';
}
