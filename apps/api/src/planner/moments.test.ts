import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { momentStarts, requiredMoments, sunTime } from './moments.js';

const love = (text: string, kind: 'love' | 'skip' = 'love') => ({ id: text, kind, text, evidence: '', source: 'chat' as const, sensitive: false, createdAt: '' });

describe('moments', () => {
  it('reads loved moments from memories and interests, never from skips', () => {
    assert.deepEqual(requiredMoments([love('Always wants a sunset spot')], [], 'Jaipur'), ['sunset']);
    assert.deepEqual(requiredMoments([], ['sunrises', 'food'], 'Goa'), ['sunrise']);
    assert.deepEqual(requiredMoments([love('No sunrise starts, ever', 'skip')], [], 'Goa'), []);
  });

  it('only asks for the Ganga aarti on the Ganges', () => {
    assert.deepEqual(requiredMoments([love('Wants to see Ganga aarti every time')], [], 'Varanasi'), ['evening_aarti']);
    assert.deepEqual(requiredMoments([love('Wants to see Ganga aarti every time')], [], 'Udaipur'), []);
  });

  it('knows the local sunset and when to start for it', () => {
    const set = sunTime('2026-10-20', { lat: 26.9124, lng: 75.7873 }, 'sunset', 'Asia/Kolkata');
    assert.match(set!, /^17:5\d$/);
    const miami = sunTime('2026-12-10', { lat: 25.77, lng: -80.19 }, 'sunset', 'America/New_York');
    assert.match(miami!, /^17:3\d$/);
    assert.deepEqual(momentStarts('06:30', '17:53'), { sunrise: 370, sunset: 1033, evening_aarti: 1103 });
  });
});
