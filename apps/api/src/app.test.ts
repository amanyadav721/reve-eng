import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

process.env.NODE_ENV = 'development';
process.env.ALLOW_DEV_AUTH = '1';
const { app } = await import('./app.js');

const dev = { authorization: 'Dev user_test123' };

describe('api', () => {
  it('reports health and which keys are configured', async () => {
    const res = await app.request('/health');
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(typeof body.configured.sarvam, 'boolean');
  });

  it('rejects requests without a user', async () => {
    const res = await app.request('/v1/me');
    assert.ok(res.status === 401 || res.status === 503);
  });

  it('accepts a dev user in development', async () => {
    const res = await app.request('/v1/me', { headers: dev });
    assert.deepEqual(await res.json(), { userId: 'user_test123' });
  });

  it('estimates fares', async () => {
    const res = await app.request('/v1/fare?mode=auto&km=4', { headers: dev });
    const body = await res.json();
    assert.ok(body.minInr > 0 && body.maxInr > body.minInr);
  });

  it('validates plan requests', async () => {
    const res = await app.request('/v1/trips/plan-day', { method: 'POST', headers: { ...dev, 'content-type': 'application/json' }, body: JSON.stringify({ preferences: { city: '' } }) });
    assert.equal(res.status, 400);
  });

  it('says which keys are missing instead of planning without them', async () => {
    const preferences = { city: 'Jaipur', startDate: '2026-10-19', endDate: '2026-10-20' };
    const res = await app.request('/v1/trips/plan-day', { method: 'POST', headers: { ...dev, 'content-type': 'application/json' }, body: JSON.stringify({ preferences }) });
    if (res.status === 503) assert.ok((await res.json()).missing.length > 0);
    else assert.notEqual(res.status, 400);
  });
});
