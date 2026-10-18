import { Camera, GeoJSONSource, Layer, Map, Marker } from '@maplibre/maplibre-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { MapPin } from './MapPin';
import { goldenHourStyle } from './style';
import { boundsOf, FOCUS_ZOOM, ROUTE_COLORS, routeLines, type TripMapProps } from './types';

// iOS and Android: MapLibre Native. Needs a development build (not Expo Go).
// The web version lives in TripMap.web.tsx.

export function TripMap({ stops, selectedId, onSelect, padding, fitKey, style }: TripMapProps) {
  const bounds = useMemo(() => boundsOf(stops), [stops]);
  const lines = useMemo(() => routeLines(stops), [stops]);

  // Show the whole day first; zoom to a stop only when the user picks one.
  const [focus, setFocus] = useState(false);
  const firstSelect = useRef(true);
  useEffect(() => {
    if (firstSelect.current) {
      firstSelect.current = false;
      return;
    }
    setFocus(true);
  }, [selectedId]);
  useEffect(() => setFocus(false), [fitKey]);

  const selected = stops.find((s) => s.id === selectedId);

  return (
    <View style={[{ flex: 1 }, style]}>
      {/* Attribution is shown by the screen (MAP_ATTRIBUTION), where overlays can't cover it. */}
      <Map style={{ flex: 1 }} mapStyle={goldenHourStyle} logo={false} attribution={false}>
        {focus && selected?.location ? (
          <Camera center={[selected.location.lng, selected.location.lat]} zoom={FOCUS_ZOOM} padding={padding} duration={600} />
        ) : bounds ? (
          <Camera bounds={bounds} padding={padding} duration={600} />
        ) : null}

        <GeoJSONSource id="route-walked" data={lines.walked}>
          <Layer id="route-walked-line" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': ROUTE_COLORS.walked, 'line-width': 3.5, 'line-opacity': 0.55 }} />
        </GeoJSONSource>
        <GeoJSONSource id="route-ahead" data={lines.ahead}>
          <Layer
            id="route-ahead-line"
            type="line"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{ 'line-color': ROUTE_COLORS.ahead, 'line-width': 3.5, 'line-dasharray': [1.5, 1.8] }}
          />
        </GeoJSONSource>

        {stops.map((s, i) =>
          s.location ? (
            <Marker key={s.id} id={s.id} lngLat={[s.location.lng, s.location.lat]} anchor="bottom">
              <MapPin stop={s} index={i} selected={s.id === selectedId} onPress={() => onSelect?.(s.id)} />
            </Marker>
          ) : null,
        )}
      </Map>
    </View>
  );
}
