import type { StyleSpecification } from '@maplibre/maplibre-react-native';

import { palette } from '@/theme/colors';

// "Golden hour" map style on OpenStreetMap vector tiles (OpenMapTiles schema) from OpenFreeMap:
// free, no API key, no request limits, and self-hostable later from the same data.
// Muted on purpose: warm paper land, soft water, quiet roads, so the trip's pins are what you see.
// OpenStreetMap data requires the attribution shown on the map.

export const MAP_ATTRIBUTION = '© OpenStreetMap contributors · OpenFreeMap';

const LAND = '#F6E6D2';
const LAND_URBAN = '#F2DCC4';
const GREEN = '#D3E2B6';
const GREEN_DEEP = '#C2D6A2';
const WATER = '#BFD0E2';
const ROAD = '#FFF8EE';
const ROAD_CASING = '#E7CDAE';
const ROAD_MAJOR = '#FFFDF8';
const ROAD_MAJOR_CASING = '#DDBE9A';
const LABEL = palette.cocoa;
const HALO = '#FBEFE2';

const FONT = ['Noto Sans Regular'];
const FONT_BOLD = ['Noto Sans Bold'];

const zoomWidth = (pairs: [number, number][]) => ['interpolate', ['exponential', 1.5], ['zoom'], ...pairs.flat()] as unknown as number;

export const goldenHourStyle: StyleSpecification = {
  version: 8,
  name: 'Tagalong Golden hour',
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    osm: { type: 'vector', url: 'https://tiles.openfreemap.org/planet', attribution: MAP_ATTRIBUTION },
  },
  layers: [
    { id: 'land', type: 'background', paint: { 'background-color': LAND } },
    {
      id: 'urban',
      type: 'fill',
      source: 'osm',
      'source-layer': 'landuse',
      filter: ['in', ['get', 'class'], ['literal', ['residential', 'suburb', 'neighbourhood', 'commercial', 'retail']]],
      paint: { 'fill-color': LAND_URBAN, 'fill-opacity': 0.7 },
    },
    {
      id: 'green',
      type: 'fill',
      source: 'osm',
      'source-layer': 'landcover',
      filter: ['in', ['get', 'class'], ['literal', ['grass', 'wood', 'farmland', 'scrub']]],
      paint: { 'fill-color': ['match', ['get', 'class'], 'wood', GREEN_DEEP, GREEN], 'fill-opacity': 0.8 },
    },
    { id: 'park', type: 'fill', source: 'osm', 'source-layer': 'park', paint: { 'fill-color': GREEN, 'fill-opacity': 0.9 } },
    { id: 'water', type: 'fill', source: 'osm', 'source-layer': 'water', paint: { 'fill-color': WATER } },
    {
      id: 'waterway',
      type: 'line',
      source: 'osm',
      'source-layer': 'waterway',
      paint: { 'line-color': WATER, 'line-width': zoomWidth([[10, 0.6], [16, 3]]) },
    },
    {
      id: 'building',
      type: 'fill',
      source: 'osm',
      'source-layer': 'building',
      minzoom: 14,
      paint: { 'fill-color': '#EDD3B6', 'fill-outline-color': '#E2C4A3', 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 15.5, 0.9] },
    },

    // Roads: casing first, then fill, minor to major.
    {
      id: 'road-minor-casing',
      type: 'line',
      source: 'osm',
      'source-layer': 'transportation',
      minzoom: 13,
      filter: ['in', ['get', 'class'], ['literal', ['minor', 'service', 'track']]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ROAD_CASING, 'line-width': zoomWidth([[13, 1.5], [18, 14]]) },
    },
    {
      id: 'road-minor',
      type: 'line',
      source: 'osm',
      'source-layer': 'transportation',
      minzoom: 13,
      filter: ['in', ['get', 'class'], ['literal', ['minor', 'service', 'track']]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ROAD, 'line-width': zoomWidth([[13, 0.8], [18, 11]]) },
    },
    {
      id: 'path',
      type: 'line',
      source: 'osm',
      'source-layer': 'transportation',
      minzoom: 15,
      filter: ['==', ['get', 'class'], 'path'],
      paint: { 'line-color': '#D9B994', 'line-width': 1.2, 'line-dasharray': [2, 2] },
    },
    {
      id: 'road-mid-casing',
      type: 'line',
      source: 'osm',
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['secondary', 'tertiary']]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ROAD_CASING, 'line-width': zoomWidth([[9, 0.8], [18, 20]]) },
    },
    {
      id: 'road-mid',
      type: 'line',
      source: 'osm',
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['secondary', 'tertiary']]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ROAD, 'line-width': zoomWidth([[9, 0.4], [18, 16]]) },
    },
    {
      id: 'road-major-casing',
      type: 'line',
      source: 'osm',
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary']]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ROAD_MAJOR_CASING, 'line-width': zoomWidth([[6, 0.8], [18, 26]]) },
    },
    {
      id: 'road-major',
      type: 'line',
      source: 'osm',
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary']]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ROAD_MAJOR, 'line-width': zoomWidth([[6, 0.5], [18, 21]]) },
    },
    {
      id: 'rail',
      type: 'line',
      source: 'osm',
      'source-layer': 'transportation',
      minzoom: 11,
      filter: ['==', ['get', 'class'], 'rail'],
      paint: { 'line-color': '#CDB497', 'line-width': 1.4, 'line-dasharray': [3, 3] },
    },

    // Labels: few and quiet.
    {
      id: 'water-name',
      type: 'symbol',
      source: 'osm',
      'source-layer': 'water_name',
      layout: { 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']], 'text-font': FONT, 'text-size': 12 },
      paint: { 'text-color': '#6F87A6', 'text-halo-color': HALO, 'text-halo-width': 1.2 },
    },
    {
      id: 'road-name',
      type: 'symbol',
      source: 'osm',
      'source-layer': 'transportation_name',
      minzoom: 14,
      layout: {
        'symbol-placement': 'line',
        'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
        'text-font': FONT,
        'text-size': ['interpolate', ['linear'], ['zoom'], 14, 10, 18, 13],
      },
      paint: { 'text-color': '#9C7F6B', 'text-halo-color': HALO, 'text-halo-width': 1.4 },
    },
    {
      id: 'place-small',
      type: 'symbol',
      source: 'osm',
      'source-layer': 'place',
      minzoom: 12,
      filter: ['in', ['get', 'class'], ['literal', ['suburb', 'neighbourhood', 'quarter', 'village', 'hamlet']]],
      layout: {
        'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
        'text-font': FONT,
        'text-size': ['interpolate', ['linear'], ['zoom'], 12, 11, 16, 14],
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.08,
      },
      paint: { 'text-color': '#A88B76', 'text-halo-color': HALO, 'text-halo-width': 1.4 },
    },
    {
      id: 'place-city',
      type: 'symbol',
      source: 'osm',
      'source-layer': 'place',
      maxzoom: 13,
      filter: ['in', ['get', 'class'], ['literal', ['city', 'town']]],
      layout: { 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']], 'text-font': FONT_BOLD, 'text-size': ['interpolate', ['linear'], ['zoom'], 6, 12, 12, 18] },
      paint: { 'text-color': LABEL, 'text-halo-color': HALO, 'text-halo-width': 1.6 },
    },
  ],
};
