import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { CityArea } from '../places/ensureCity.js';
import type { ChatResponse } from '../sarvam.js';
import { fitDays, outlineTrip, type OutlineDraft } from './outline.js';

const answer = (draft: OutlineDraft) => async (): Promise<ChatResponse> => ({
  id: 'r',
  choices: [
    {
      index: 0,
      finish_reason: 'tool_calls',
      message: { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'propose_outline', arguments: JSON.stringify(draft) } }] },
    },
  ],
});

const KNOWN: Record<string, Pick<CityArea, 'country' | 'currency' | 'timeZone'>> = {
  'tokyo, japan': { country: 'jp', currency: 'JPY', timeZone: 'Asia/Tokyo' },
  'kyoto, japan': { country: 'jp', currency: 'JPY', timeZone: 'Asia/Tokyo' },
  'osaka, japan': { country: 'jp', currency: 'JPY', timeZone: 'Asia/Tokyo' },
};
const geocode = async (name: string): Promise<CityArea | undefined> => {
  const k = KNOWN[name.toLowerCase()];
  if (!k) return undefined;
  const key = name.split(',')[0].toLowerCase();
  return { key, name, bbox: [0, 0, 1, 1], center: { lat: 0.5, lng: 0.5 }, ...k };
};

describe('outlineTrip', () => {
  it('splits a country into verified base cities with dates', async () => {
    const chat = answer({
      kind: 'multi_city',
      question: '',
      legs: [
        { city: 'Tokyo', country: 'Japan', days: 3, why: 'Start big.' },
        { city: 'Kyoto', country: 'Japan', days: 3, why: 'Temples.' },
        { city: 'Atlantis', country: 'Japan', days: 1, why: 'Made up.' },
        { city: 'Osaka', country: 'Japan', days: 2, why: 'Street food.' },
      ],
    });
    const o = await outlineTrip({ destination: 'Japan', days: 7, startDate: '2026-11-01' }, { chat, geocode });
    if (o.kind === 'unclear') return assert.fail(`expected a route, got: ${o.question}`);
    assert.equal(o.kind, 'multi_city');
    assert.deepEqual(o.dropped, ['Atlantis']);
    assert.deepEqual(o.legs.map((l) => l.key), ['tokyo', 'kyoto', 'osaka']);
    assert.equal(o.legs.reduce((a, l) => a + l.days, 0), 7);
    assert.equal(o.legs[0].startDate, '2026-11-01');
    assert.equal(o.legs.at(-1)!.endDate, '2026-11-07');
    assert.equal(o.legs[0].currency, 'JPY');
  });

  it('asks a question when the destination is vague', async () => {
    const chat = answer({ kind: 'unclear', legs: [], question: 'Beaches or mountains this December?' });
    const o = await outlineTrip({ destination: 'somewhere warm', days: 5 }, { chat, geocode });
    assert.deepEqual(o, { kind: 'unclear', question: 'Beaches or mountains this December?' });
  });

  it('asks when none of the cities exist', async () => {
    const chat = answer({ kind: 'city', question: '', legs: [{ city: 'Atlantis', country: 'Japan', days: 3, why: 'x' }] });
    const o = await outlineTrip({ destination: 'Atlantis', days: 3 }, { chat, geocode });
    assert.equal(o.kind, 'unclear');
  });
});

describe('fitDays', () => {
  it('makes legs add up to the trip length, at least a day each', () => {
    const legs = [{ days: 4 }, { days: 4 }, { days: 4 }];
    fitDays(legs, 5);
    assert.equal(legs.reduce((a, l) => a + l.days, 0), 5);
    assert.ok(legs.every((l) => l.days >= 1));
  });
  it('drops legs when there are more legs than days', () => {
    const legs = [{ days: 1 }, { days: 1 }, { days: 1 }];
    fitDays(legs, 2);
    assert.equal(legs.length, 2);
  });
});
