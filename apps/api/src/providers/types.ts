// Interfaces for the outside world. Planner code only talks to these, so tests and evals can
// swap in fakes, and providers (Google, Ola Maps, …) can change without touching the planner.

export interface LatLng {
  lat: number;
  lng: number;
}

export interface PlaceSummary {
  placeId: string;
  name: string;
  address?: string;
  location: LatLng;
  rating?: number;
  ratingCount?: number;
  /** 0 (free) to 4 (very expensive). */
  priceLevel?: number;
  types: string[];
}

/** Google's opening-hours points: day 0 is Sunday. */
export interface HoursPoint {
  day: number;
  hour: number;
  minute: number;
  date?: { year: number; month: number; day: number };
}

export interface HoursPeriod {
  open: HoursPoint;
  /** Missing close on a single period means open 24/7. */
  close?: HoursPoint;
}

export interface PlaceDetails extends PlaceSummary {
  regularHours?: HoursPeriod[];
  /** The next 7 days, including holidays and special closures. Preferred when it covers the date. */
  currentHours?: HoursPeriod[];
  businessStatus?: 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY';
  summary?: string;
  priceRange?: { minInr?: number; maxInr?: number };
}

export interface PlacesProvider {
  search(q: { text: string; center: LatLng; radiusM: number; openNow?: boolean; limit?: number }): Promise<PlaceSummary[]>;
  details(placeId: string): Promise<PlaceDetails>;
}

export type RouteMode = 'walk' | 'drive' | 'two_wheeler' | 'transit';

export interface RoutesProvider {
  route(q: { from: LatLng; to: LatLng; mode: RouteMode; departAt?: Date }): Promise<{ minutes: number; km: number } | null>;
}

export interface HourlyWeather {
  hour: number;
  tempC: number;
  rainChance: number;
  summary: string;
}

export interface WeatherProvider {
  hourly(at: LatLng, date: string): Promise<HourlyWeather[]>;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchProvider {
  search(query: string): Promise<SearchResult[]>;
}
