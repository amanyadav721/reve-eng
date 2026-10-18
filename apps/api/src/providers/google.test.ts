import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { GoogleError, googlePlaces, googleRoutes } from './google.js';

type Captured = { url: string; init: RequestInit };

function fakeFetch(body: unknown, status = 200) {
  const calls: Captured[] = [];
  const impl = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { impl, calls };
}

const header = (c: Captured, name: string) => (c.init.headers as Record<string, string>)[name];

describe('googlePlaces', () => {
  it('sends a Text Search request with a field mask and location bias, and maps the result', async () => {
    const f = fakeFetch({
      places: [
        {
          id: 'ChIJ_rawat',
          displayName: { text: 'Rawat Misthan Bhandar', languageCode: 'en' },
          formattedAddress: 'Station Rd, Jaipur',
          location: { latitude: 26.917, longitude: 75.799 },
          rating: 4.3,
          userRatingCount: 51234,
          priceLevel: 'PRICE_LEVEL_INEXPENSIVE',
          types: ['restaurant', 'food'],
        },
      ],
    });
    const [p] = await googlePlaces('KEY', f.impl).search({ text: 'pyaaz kachori, Jaipur', center: { lat: 26.9, lng: 75.8 }, radiusM: 15000 });

    const c = f.calls[0];
    assert.equal(c.url, 'https://places.googleapis.com/v1/places:searchText');
    assert.equal(c.init.method, 'POST');
    assert.equal(header(c, 'x-goog-api-key'), 'KEY');
    assert.match(header(c, 'x-goog-fieldmask'), /places\.id,places\.displayName/);
    const body = JSON.parse(String(c.init.body));
    assert.equal(body.textQuery, 'pyaaz kachori, Jaipur');
    assert.deepEqual(body.locationBias.circle.center, { latitude: 26.9, longitude: 75.8 });
    assert.equal(body.regionCode, 'IN');
    assert.equal('openNow' in body, false);

    assert.deepEqual(p, {
      placeId: 'ChIJ_rawat',
      name: 'Rawat Misthan Bhandar',
      address: 'Station Rd, Jaipur',
      location: { lat: 26.917, lng: 75.799 },
      rating: 4.3,
      ratingCount: 51234,
      priceLevel: 1,
      types: ['restaurant', 'food'],
    });
  });

  it('reads opening hours, status and price range from Place Details', async () => {
    const f = fakeFetch({
      id: 'ChIJ_hawa',
      displayName: { text: 'Hawa Mahal' },
      location: { latitude: 26.92, longitude: 75.83 },
      regularOpeningHours: { periods: [{ open: { day: 1, hour: 9, minute: 0 }, close: { day: 1, hour: 16, minute: 30 } }] },
      businessStatus: 'OPERATIONAL',
      priceRange: { startPrice: { currencyCode: 'INR', units: '50' }, endPrice: { currencyCode: 'INR', units: '200' } },
      editorialSummary: { text: 'Pink sandstone palace.' },
    });
    const d = await googlePlaces('KEY', f.impl).details('ChIJ_hawa');
    assert.match(f.calls[0].url, /\/v1\/places\/ChIJ_hawa\?languageCode=en&regionCode=IN$/);
    assert.match(header(f.calls[0], 'x-goog-fieldmask'), /regularOpeningHours,currentOpeningHours/);
    assert.equal(d.regularHours?.[0].close?.hour, 16);
    assert.deepEqual(d.priceRange, { minInr: 50, maxInr: 200 });
    assert.equal(d.summary, 'Pink sandstone palace.');
  });

  it('throws GoogleError with the status on failure', async () => {
    const f = fakeFetch({ error: { message: 'API key not valid' } }, 403);
    await assert.rejects(googlePlaces('BAD', f.impl).details('x'), (e: unknown) => e instanceof GoogleError && e.status === 403);
  });
});

describe('googleRoutes', () => {
  it('asks for traffic-aware driving and converts seconds and metres', async () => {
    const f = fakeFetch({ routes: [{ duration: '754s', distanceMeters: 3249 }] });
    const r = await googleRoutes('KEY', f.impl).route({ from: { lat: 1, lng: 2 }, to: { lat: 3, lng: 4 }, mode: 'drive' });
    const body = JSON.parse(String(f.calls[0].init.body));
    assert.equal(body.travelMode, 'DRIVE');
    assert.equal(body.routingPreference, 'TRAFFIC_AWARE');
    assert.equal(header(f.calls[0], 'x-goog-fieldmask'), 'routes.duration,routes.distanceMeters');
    assert.deepEqual(r, { minutes: 13, km: 3.2 });
  });

  it('omits traffic preference for walking and returns null when there is no route', async () => {
    const f = fakeFetch({});
    const r = await googleRoutes('KEY', f.impl).route({ from: { lat: 1, lng: 2 }, to: { lat: 3, lng: 4 }, mode: 'walk' });
    const body = JSON.parse(String(f.calls[0].init.body));
    assert.equal(body.travelMode, 'WALK');
    assert.equal('routingPreference' in body, false);
    assert.equal(r, null);
  });
});
