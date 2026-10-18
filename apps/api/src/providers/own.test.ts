import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { hoursOn } from './hours.js';
import { LocalPlaces, weeklyPeriods, type PlaceRecord } from './local.js';
import { sameBusiness } from './text.js';
import { valhallaRoutes } from './valhalla.js';

const rec = (o: Partial<PlaceRecord> & Pick<PlaceRecord, 'id' | 'name' | 'lat' | 'lng'>): PlaceRecord => ({ altNames: [], kinds: [], status: 'open', rank: 1, ...o });
const center = { lat: 26.92, lng: 75.82 };

const places = new LocalPlaces([
  rec({ id: 'osm:hawa', name: 'Hawa Mahal', lat: 26.9239, lng: 75.8267, kinds: ['attraction', 'palace'], rank: 8, osm: { openingHours: 'Mo-Su 09:00-16:30' } }),
  rec({ id: 'ovt:hawa-dup', name: 'Hawa Mahal Jaipur', lat: 26.929, lng: 75.828, rank: 3 }),
  rec({ id: 'osm:rawat', name: 'Rawat Mishthan Bhandar', lat: 26.9242, lng: 75.8218, kinds: ['restaurant'], knownFor: ['pyaaz kachori'], rank: 5 }),
  rec({ id: 'ovt:bhagat', name: 'Bhagat Mishtan Bhandar', lat: 26.91, lng: 75.8, kinds: ['restaurant'], rank: 2 }),
  rec({ id: 'ovt:shut', name: 'Old Kachori House', lat: 26.92, lng: 75.82, kinds: ['restaurant'], status: 'closed_permanently', rank: 9 }),
  rec({ id: 'ovt:far', name: 'Hawa Mahal Udaipur', lat: 24.58, lng: 73.71, rank: 9 }),
]);

describe('LocalPlaces', () => {
  it('finds places by name, collapsing nearby duplicates', async () => {
    const r = await places.search({ text: 'Hawa Mahal, Jaipur', center, radiusM: 15000 });
    assert.equal(r[0].placeId, 'osm:hawa');
    assert.ok(!r.some((p) => p.placeId === 'ovt:hawa-dup'), 'duplicate pin should collapse');
    assert.ok(!r.some((p) => p.placeId === 'ovt:far'), 'other cities are out of range');
  });

  it('finds a dish through what a place is known for', async () => {
    const [top] = await places.search({ text: 'pyaaz kachori', center, radiusM: 15000 });
    assert.equal(top.placeId, 'osm:rawat');
  });

  it('never returns permanently closed places', async () => {
    const r = await places.search({ text: 'kachori', center, radiusM: 15000 });
    assert.equal(r[0].placeId, 'osm:rawat');
    assert.ok(!r.some((p) => p.placeId === 'ovt:shut'));
  });

  it('turns OSM opening hours into hours for a date', async () => {
    const d = await places.details('osm:hawa');
    assert.deepEqual(hoursOn(d, '2026-10-20'), [{ open: '09:00', close: '16:30' }]);
    assert.equal(hoursOn(await places.details('osm:rawat'), '2026-10-20'), 'unknown');
  });
});

describe('weeklyPeriods', () => {
  it('handles closed days, 24/7 and nonsense', () => {
    const p = weeklyPeriods('Mo-Sa 10:00-18:00; Su off', center)!;
    assert.equal(p.length, 6);
    assert.ok(!p.some((x) => x.open.day === 0));
    assert.deepEqual(weeklyPeriods('24/7', center), [{ open: { day: 0, hour: 0, minute: 0 } }]);
    assert.equal(weeklyPeriods('ask the owner', center), undefined);
  });
});

describe('sameBusiness', () => {
  it('needs the distinctive word, not just "Mishthan Bhandar"', () => {
    assert.ok(sameBusiness('Rawat Mishthan Bhandar', 'Rawat Misthan Bhandar'));
    assert.ok(!sameBusiness('Rawat Mishthan Bhandar', 'Bhagat Mishtan Bhandar'));
  });
});

describe('valhallaRoutes', () => {
  it('maps modes to Valhalla costing and pads road time for traffic', async () => {
    const calls: { body: Record<string, unknown> }[] = [];
    const fetchImpl = (async (_url: string | URL, init?: RequestInit) => {
      calls.push({ body: JSON.parse(String(init?.body)) });
      return new Response(JSON.stringify({ trip: { summary: { time: 600, length: 3.24 } } }), { status: 200 });
    }) as typeof fetch;
    const v = valhallaRoutes('http://valhalla:8002', fetchImpl);
    const a = { lat: 26.92, lng: 75.82 };
    const b = { lat: 26.93, lng: 75.83 };
    assert.deepEqual(await v.route({ from: a, to: b, mode: 'walk' }), { minutes: 10, km: 3.2 });
    assert.deepEqual(await v.route({ from: a, to: b, mode: 'drive' }), { minutes: 14, km: 3.2 });
    assert.equal(calls[0].body.costing, 'pedestrian');
    assert.equal(calls[1].body.costing, 'auto');
  });

  it('returns null when there is no route', async () => {
    const v = valhallaRoutes('http://valhalla:8002', (async () => new Response('{"error":"No path"}', { status: 400 })) as typeof fetch);
    assert.equal(await v.route({ from: center, to: center, mode: 'drive' }), null);
  });
});
