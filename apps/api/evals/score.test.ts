import type { Stop } from '@tagalong/shared';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { PlanDayResult } from '../src/planner/planDay.js';
import type { Scenario } from './scenarios.js';
import { score } from './score.js';

const stats = { turns: 5, submits: 1, tools: {}, promptTokens: 0, completionTokens: 0, ms: 0 };
const repairs: string[] = [];
const st = (o: Partial<Stop>): Stop => ({ id: 's', placeId: 'p', name: 'Place', category: 'sight', icon: '📍', startTime: '10:00', durationMin: 60, points: 10, status: 'upcoming', ...o });

const scenario: Scenario = {
  id: 't',
  city: 'Jaipur',
  dayOffset: 1,
  prefs: {},
  memories: [{ kind: 'skip', text: 'No animal rides' }],
  expect: { mustNotMention: [/elephant ride/i], minFoodStops: 1, stopBetween: { from: '17:00', to: '18:30', label: 'sunset' }, maxWalkMin: 10 },
};

describe('score', () => {
  it('passes a plan that meets every expectation', () => {
    const r: PlanDayResult = {
      ok: true,
      issues: [],
      repairs,
      stats,
      stops: [
        st({ name: 'Pyaaz kachori at Rawat', category: 'food', startTime: '12:30', reason: 'You loved **mirchi vada**.' }),
        st({ name: 'Nahargarh', category: 'nature', startTime: '17:40', hop: { mode: 'walk', minutes: 8 } }),
      ],
    };
    const s = score(scenario, r);
    assert.equal(s.ok, true, JSON.stringify(s.checks.filter((c) => !c.pass)));
  });

  it('catches skipped things, missing dishes, long walks and unused memories', () => {
    const r: PlanDayResult = {
      ok: true,
      issues: [],
      repairs,
      stats,
      stops: [st({ name: 'Rawat', category: 'food' }), st({ name: 'Amber Fort elephant ride', startTime: '11:00', hop: { mode: 'walk', minutes: 25 } })],
    };
    const failed = score(scenario, r).checks.filter((c) => !c.pass).map((c) => c.name);
    assert.deepEqual(failed.sort(), ['avoids elephant ride (heuristic)', 'food stops name a dish', 'has a sunset stop (17:00–18:30)', 'no walk over 10 min', 'uses a memory in a reason'].sort());
  });
});
