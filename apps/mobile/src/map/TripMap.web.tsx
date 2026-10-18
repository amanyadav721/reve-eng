import 'maplibre-gl/dist/maplibre-gl.css';

import { Map as MapLibreMap, Marker, setWorkerUrl, type GeoJSONSource, type StyleSpecification } from 'maplibre-gl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { View } from 'react-native';

import { MapPin } from './MapPin';
import { goldenHourStyle } from './style';
import { boundsOf, FOCUS_ZOOM, ROUTE_COLORS, routeLines, type TripMapProps } from './types';

// The tile worker is copied to public/ by scripts/copy-map-worker.mjs.
setWorkerUrl('/maplibre-gl-worker.mjs');

// Web: MapLibre GL JS. Pins are the same React Native components as on phones, rendered into
// MapLibre's marker elements through portals.

export function TripMap({ stops, selectedId, onSelect, padding, fitKey, style }: TripMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [markerEls, setMarkerEls] = useState<Record<string, HTMLElement>>({});
  const bounds = useMemo(() => boundsOf(stops), [stops]);
  const lines = useMemo(() => routeLines(stops), [stops]);
  const placeKey = stops.map((s) => `${s.id}@${s.location?.lat},${s.location?.lng}`).join('|');

  // Create the map once.
  useEffect(() => {
    if (!container.current) return;
    const map = new MapLibreMap({
      container: container.current,
      // Same style object as native; maplibre-gl pins its own copy of the style-spec types.
      style: goldenHourStyle as unknown as StyleSpecification,
      bounds: bounds ?? undefined,
      fitBoundsOptions: { padding: padding ?? 40 },
      // Attribution is shown by the screen (MAP_ATTRIBUTION), where overlays can't cover it.
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    map.on('load', () => {
      map.addSource('route-walked', { type: 'geojson', data: lines.walked });
      map.addSource('route-ahead', { type: 'geojson', data: lines.ahead });
      map.addLayer({ id: 'route-walked-line', type: 'line', source: 'route-walked', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ROUTE_COLORS.walked, 'line-width': 3.5, 'line-opacity': 0.55 } });
      map.addLayer({ id: 'route-ahead-line', type: 'line', source: 'route-ahead', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ROUTE_COLORS.ahead, 'line-width': 3.5, 'line-dasharray': [1.5, 1.8] } });
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One marker element per stop; React renders the pin into it.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers: Marker[] = [];
    const els: Record<string, HTMLElement> = {};
    for (const s of stops) {
      if (!s.location) continue;
      const el = document.createElement('div');
      markers.push(new Marker({ element: el, anchor: 'bottom' }).setLngLat([s.location.lng, s.location.lat]).addTo(map));
      els[s.id] = el;
    }
    setMarkerEls(els);
    return () => markers.forEach((m) => m.remove());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeKey]);

  // Keep the route line in step with check-ins.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      (map.getSource('route-walked') as GeoJSONSource | undefined)?.setData(lines.walked);
      (map.getSource('route-ahead') as GeoJSONSource | undefined)?.setData(lines.ahead);
    };
    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);
  }, [lines]);

  // Recenter on request.
  useEffect(() => {
    if (fitKey === undefined || !bounds) return;
    mapRef.current?.fitBounds(bounds, { padding: padding ?? 40, duration: 600 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  // Fly to a stop when the user picks one (not on first render, which shows the whole day).
  const firstSelect = useRef(true);
  useEffect(() => {
    if (firstSelect.current) {
      firstSelect.current = false;
      return;
    }
    const s = stops.find((x) => x.id === selectedId);
    const map = mapRef.current;
    if (s?.location && map) map.easeTo({ center: [s.location.lng, s.location.lat], zoom: Math.max(map.getZoom(), FOCUS_ZOOM), padding: padding ?? undefined, duration: 600 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return (
    <View style={[{ flex: 1 }, style]}>
      <div ref={container} style={{ position: 'absolute', inset: 0 }} />
      {stops.map((s, i) => {
        const el = markerEls[s.id];
        return el ? createPortal(<MapPin stop={s} index={i} selected={s.id === selectedId} onPress={() => onSelect?.(s.id)} />, el, s.id) : null;
      })}
    </View>
  );
}
