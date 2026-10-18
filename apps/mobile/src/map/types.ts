import type { Stop } from '@tagalong/shared';
import type { StyleProp, ViewStyle } from 'react-native';

export interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** The screen showing a TripMap must display MAP_ATTRIBUTION (OpenStreetMap's licence requires it). */
export interface TripMapProps {
  stops: Stop[];
  selectedId?: string;
  onSelect?: (stopId: string) => void;
  /** Space taken by overlays, so fitting the stops keeps them visible. */
  padding?: Padding;
  /** Change it to re-fit the camera to all stops ("recenter"). */
  fitKey?: number;
  style?: StyleProp<ViewStyle>;
}

type LngLat = [number, number];

const lngLat = (s: Stop): LngLat | undefined => (s.location ? [s.location.lng, s.location.lat] : undefined);

/** The day's path, split at the current stop: walked (solid) and ahead (dashed). Straight lines until we run our own router. */
export function routeLines(stops: Stop[]): { walked: GeoJSON.Feature<GeoJSON.LineString>; ahead: GeoJSON.Feature<GeoJSON.LineString> } {
  const placed = stops.filter((s) => s.location && s.status !== 'skipped');
  const nowIndex = placed.findIndex((s) => s.status === 'now');
  const split = nowIndex === -1 ? placed.length - 1 : nowIndex;
  const line = (list: Stop[]): GeoJSON.Feature<GeoJSON.LineString> => ({
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: list.map((s) => lngLat(s)!) },
  });
  return { walked: line(placed.slice(0, split + 1)), ahead: line(nowIndex === -1 ? [] : placed.slice(split)) };
}

export function boundsOf(stops: Stop[]): [number, number, number, number] | undefined {
  const pts = stops.map(lngLat).filter(Boolean) as LngLat[];
  if (!pts.length) return undefined;
  const lngs = pts.map((p) => p[0]);
  const lats = pts.map((p) => p[1]);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}

export const ROUTE_COLORS = { walked: '#6E5142', ahead: '#B8482A' };

/** Zoom used when the user picks a stop. */
export const FOCUS_ZOOM = 15;
