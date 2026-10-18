import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { PlaceDetails, PlacesProvider, RoutesProvider } from '../providers/types.js';
import type { ChatMessage, ChatRequest, ChatResponse, ToolCall } from '../sarvam.js';
import { planDay } from './planDay.js';

// A tiny fake Jaipur: two places, fixed routes.
const PLACES: Record<string, PlaceDetails> = {
  p_rawat: {
    placeId: 'p_rawat',
    name: 'Rawat Misthan Bhandar',
    location: { lat: 26.917, lng: 75.799 },
    types: ['restaurant'],
    regularHours: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ open: { day, hour: 6, minute: 0 }, close: { day, hour: 22, minute: 0 } })),
  },
  p_hawa: {
    placeId: 'p_hawa',
    name: 'Hawa Mahal',
    location: { lat: 26.924, lng: 75.826 },
    types: ['tourist_attraction'],
    regularHours: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ open: { day, hour: 9, minute: 0 }, close: { day, hour: 16, minute: 30 } })),
  },
};

const places: PlacesProvider = {
  async search({ text }) {
    return Object.values(PLACES).filter((p) => text.toLowerCase().includes(p.name.split(' ')[0].toLowerCase()) || text.includes('kachori') === (p.placeId === 'p_rawat'));
  },
  async details(id) {
    const p = PLACES[id];
    if (!p) throw new Error('not found');
    return p;
  },
};
const routes: RoutesProvider = { async route() { return { minutes: 15, km: 3.2 }; } };

let n = 0;
const call = (name: string, args: unknown): ToolCall => ({ id: `c${++n}`, type: 'function', function: { name, arguments: JSON.stringify(args) } });
const reply = (...tool_calls: ToolCall[]): ChatResponse => ({
  id: 'r',
  choices: [{ index: 0, finish_reason: 'tool_calls', message: { role: 'assistant', content: null, tool_calls } }],
  usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
});

/** A fake model that follows a script and records what it was told. */
function scripted(steps: ((seen: ChatMessage[]) => ChatResponse)[]) {
  const requests: ChatRequest[] = [];
  return {
    requests,
    chat: async (req: ChatRequest) => {
      requests.push(structuredClone(req));
      const step = steps[requests.length - 1];
      if (!step) throw new Error('script ran out');
      return step(req.messages);
    },
  };
}

const stop = (place_id: string, start_time: string, extra: Record<string, unknown> = {}) => ({
  place_id,
  category: place_id === 'p_rawat' ? 'food' : 'sight',
  icon: '📍',
  start_time,
  duration_min: 45,
  reason: 'A good stop for this traveler, trust me.',
  ...extra,
});

const input = { city: 'Jaipur', cityCenter: { lat: 26.91, lng: 75.79 }, date: '2026-10-19', rules: { notBefore: '08:00' } };

describe('planDay', () => {
  it('researches, gets rejected for a closed place, fixes it, and is accepted', async () => {
    const model = scripted([
      () => reply(call('search_places', { query: 'pyaaz kachori' }), call('search_places', { query: 'Hawa Mahal' })),
      () => reply(call('place_details', { place_id: 'p_rawat' }), call('place_details', { place_id: 'p_hawa' }), call('get_route', { from_place_id: 'p_rawat', to_place_id: 'p_hawa', mode: 'auto' })),
      // Hawa Mahal closes at 16:30: a 45-minute visit from 16:00 doesn't fit.
      () => reply(call('submit_plan', { stops: [stop('p_rawat', '15:00', { dish: 'Pyaaz kachori', cost_inr: 40 }), stop('p_hawa', '16:00', { hop_mode: 'auto', cost_inr: 200 })] })),
      // 13:00 + 45 min + 15 min ride: our scheduler starts Hawa Mahal at 14:00, not the hinted 13:50.
      () => reply(call('submit_plan', { stops: [stop('p_rawat', '13:00', { dish: 'Pyaaz kachori', cost_inr: 40 }), stop('p_hawa', '13:50', { hop_mode: 'auto', cost_inr: 200 })] })),
    ]);

    const result = await planDay(input, { chat: model.chat, places, routes });

    assert.equal(result.ok, true, result.error);
    assert.equal(result.stats.submits, 2);
    // The rejection reached the model as the submit_plan tool result, with a fix.
    const feedback = model.requests[3].messages.at(-1);
    assert.equal(feedback?.role, 'tool');
    assert.match(String(feedback && 'content' in feedback ? feedback.content : ''), /not open .* → Move it inside its opening hours/);
    // Names, clock times, travel time and fares come from our code and data, not the model.
    assert.equal(result.stops[0].name, 'Pyaaz kachori at Rawat Misthan Bhandar');
    assert.equal(result.stops[1].name, 'Hawa Mahal');
    assert.equal(result.stops[1].startTime, '14:00');
    assert.equal(result.stops[1].hop?.minutes, 15);
    assert.ok((result.stops[1].hop?.fareMaxInr ?? 0) > 0);
    assert.equal(result.stops[1].distanceKm, 3.2);
  });

  it('rejects places the model never looked up', async () => {
    const model = scripted([
      () => reply(call('submit_plan', { stops: [stop('p_invented', '10:00')] })),
      () => reply(call('submit_plan', { stops: [stop('p_invented', '10:00')] })),
    ]);
    const result = await planDay(input, { chat: model.chat, places, routes }, { maxSubmits: 2 });
    assert.equal(result.ok, false);
    assert.equal(result.issues[0].code, 'unverified_place');
  });

  it('moves a too-early stop to the remembered start time and opening hours', async () => {
    const model = scripted([
      () => reply(call('search_places', { query: 'Hawa Mahal' })),
      () => reply(call('submit_plan', { stops: [stop('p_hawa', '07:00')] })),
    ]);
    const result = await planDay(input, { chat: model.chat, places, routes }, { maxSubmits: 1 });
    assert.equal(result.ok, true, result.error);
    // Not before 08:00 (memory), and Hawa Mahal opens at 09:00.
    assert.equal(result.stops[0].startTime, '09:00');
  });

  it('rejects a visit that cannot fit in opening hours', async () => {
    const model = scripted([
      () => reply(call('search_places', { query: 'Hawa Mahal' })),
      () => reply(call('submit_plan', { stops: [stop('p_hawa', '16:15')] })),
    ]);
    const result = await planDay(input, { chat: model.chat, places, routes }, { maxSubmits: 1 });
    assert.deepEqual(result.issues.map((i) => i.code), ['closed']);
  });

  it('reports malformed submissions back to the model', async () => {
    const model = scripted([
      () => reply(call('submit_plan', { stops: [{ place_id: 'x' }] })),
      () => reply(call('search_places', { query: 'Hawa Mahal' })),
      () => reply(call('submit_plan', { stops: [stop('p_hawa', '10:00')] })),
    ]);
    const result = await planDay(input, { chat: model.chat, places, routes });
    assert.equal(result.ok, true, result.error);
    const firstFeedback = model.requests[1].messages.at(-1);
    assert.match(String(firstFeedback && 'content' in firstFeedback ? firstFeedback.content : ''), /accepted":false/);
  });

  it('nudges a model that answers in prose, then gives up', async () => {
    const prose = (): ChatResponse => ({ id: 'r', choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'Here is your plan!' } }] });
    const model = scripted([prose, prose, prose]);
    const result = await planDay(input, { chat: model.chat, places, routes });
    assert.equal(result.ok, false);
    assert.match(result.error ?? '', /stopped calling tools/);
  });

  it('caps research per turn and answers every tool call exactly once', async () => {
    const many = Array.from({ length: 14 }, () => call('search_places', { query: 'Hawa Mahal' }));
    const model = scripted([
      () => reply(...many, call('submit_plan', { stops: [stop('p_hawa', '10:00')] })),
    ]);
    const result = await planDay(input, { chat: model.chat, places, routes }, { maxToolsPerTurn: 10, maxSubmits: 1 });
    assert.equal(result.stats.tools.search_places, 10);
    assert.equal(result.ok, true, result.error);
  });

  it('forces submit_plan once the research budget is spent', async () => {
    const model = scripted([
      () => reply(call('search_places', { query: 'Hawa Mahal' }), call('search_places', { query: 'Hawa Mahal' })),
      () => reply(call('submit_plan', { stops: [stop('p_hawa', '10:00')] })),
    ]);
    await planDay(input, { chat: model.chat, places, routes }, { maxTools: 2 });
    assert.deepEqual(model.requests[1].tool_choice, { type: 'function', function: { name: 'submit_plan' } });
    const replies = model.requests[1].messages.filter((m) => m.role === 'tool').map((m) => ('tool_call_id' in m ? m.tool_call_id : ''));
    assert.equal(new Set(replies).size, replies.length, 'a tool call was answered twice');
  });

  it('answers tool errors instead of throwing', async () => {
    const model = scripted([
      () => reply(call('place_details', { place_id: 'p_hawa' }), call('get_route', { from_place_id: 'a', to_place_id: 'b', mode: 'auto' })),
      () => reply(call('search_places', { query: 'Hawa Mahal' })),
      () => reply(call('submit_plan', { stops: [stop('p_hawa', '10:00')] })),
    ]);
    const result = await planDay(input, { chat: model.chat, places, routes });
    assert.equal(result.ok, true);
    const toolReplies = model.requests[1].messages.filter((m) => m.role === 'tool').map((m) => ('content' in m ? m.content : ''));
    assert.match(String(toolReplies[0]), /search_places first/);
    assert.match(String(toolReplies[1]), /unknown place_id/);
  });
});
