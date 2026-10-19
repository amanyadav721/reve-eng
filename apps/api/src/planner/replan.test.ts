import type { Memory, Stop } from '@tagalong/shared';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { PlaceDetails, PlacesProvider, RoutesProvider } from '../providers/types.js';
import type { ChatRequest, ChatResponse, ToolCall } from '../sarvam.js';
import { replanDay, type ReplanInput } from './replan.js';
import { toMin } from './validate.js';

// A small fake Jaipur. Sunset there on 19 Oct 2026 is about 17:50, so sunset spots start near 17:10.
const daily = (open: number, close: number) =>
  [0, 1, 2, 3, 4, 5, 6].map((day) => ({ open: { day, hour: Math.floor(open), minute: (open % 1) * 60 }, close: { day, hour: Math.floor(close), minute: (close % 1) * 60 } }));

const PLACES: Record<string, PlaceDetails> = {
  p_fort: { placeId: 'p_fort', name: 'Amber Fort', location: { lat: 26.985, lng: 75.851 }, types: ['fort'], regularHours: daily(8, 17.5) },
  p_palace: { placeId: 'p_palace', name: 'City Palace', location: { lat: 26.926, lng: 75.824 }, types: ['palace'], regularHours: daily(9.5, 17) },
  p_museum: { placeId: 'p_museum', name: 'Albert Hall Museum', location: { lat: 26.912, lng: 75.82 }, types: ['museum'], regularHours: daily(10, 17) },
  p_nahargarh: { placeId: 'p_nahargarh', name: 'Nahargarh Fort', location: { lat: 26.937, lng: 75.815 }, types: ['viewpoint'], regularHours: daily(10, 21.5) },
  // Eateries around the traveler, near MI Road.
  p_lmb: { placeId: 'p_lmb', name: 'LMB', location: { lat: 26.9205, lng: 75.8235 }, types: ['restaurant', 'known for ghewar'], regularHours: daily(8, 23) },
  p_rawat: { placeId: 'p_rawat', name: 'Rawat Misthan Bhandar', location: { lat: 26.917, lng: 75.8205 }, types: ['restaurant', 'known for pyaaz kachori'], regularHours: daily(6, 22) },
  p_cafe: { placeId: 'p_cafe', name: 'Tapri', location: { lat: 26.919, lng: 75.822 }, types: ['cafe'], regularHours: daily(7, 23) },
  p_closed: { placeId: 'p_closed', name: 'Night Dhaba', location: { lat: 26.9195, lng: 75.8225 }, types: ['restaurant'], regularHours: daily(19, 23.5) },
};
const EATERIES = ['p_lmb', 'p_rawat', 'p_cafe', 'p_closed'];

const places: PlacesProvider = {
  async search({ text }) {
    if (/restaurant|cafe|street food/.test(text)) return EATERIES.map((id) => PLACES[id]);
    return Object.values(PLACES).filter((p) => p.name.toLowerCase().split(' ').some((w) => w.length > 3 && text.toLowerCase().includes(w)));
  },
  async details(id) {
    const p = PLACES[id];
    if (!p) throw new Error('not found');
    return p;
  },
};
const routes: RoutesProvider = { async route() { return { minutes: 15, km: 3 }; } };
const noAI = async (): Promise<ChatResponse> => {
  throw new Error('the code triggers must not call the model');
};

const st = (placeId: string, startTime: string, durationMin: number, o: Partial<Stop> = {}): Stop => ({
  id: placeId,
  placeId,
  name: PLACES[placeId].name,
  location: PLACES[placeId].location,
  category: 'sight',
  icon: '📍',
  startTime,
  durationMin,
  points: 10,
  status: 'upcoming',
  hop: { mode: 'auto', minutes: 15 },
  ...o,
});

const lovesSunsets: Memory = { id: 'm1', kind: 'love', text: 'Loves sunsets', evidence: 'quiz', source: 'quiz', sensitive: false, createdAt: '2026-10-01' };

/** Fort done, lunch done, then the afternoon still to come, ending with a loved sunset. */
const afternoon = (): Stop[] => [
  st('p_fort', '09:00', 120, { status: 'done' }),
  st('p_lmb', '12:00', 45, { category: 'food', name: 'Ghewar at LMB', status: 'done' }),
  st('p_palace', '13:15', 90, { status: 'now' }),
  st('p_museum', '15:00', 120),
  st('p_nahargarh', '17:10', 60, { moment: 'sunset', category: 'nature' }),
];

const base = (o: Partial<ReplanInput>): ReplanInput => ({
  city: 'Jaipur',
  cityCenter: { lat: 26.91, lng: 75.79 },
  date: '2026-10-19',
  memories: [lovesSunsets],
  stops: afternoon(),
  now: '13:30',
  location: PLACES.p_palace.location!,
  trigger: 'late',
  ...o,
});

const names = (stops: Stop[]) => stops.map((s) => `${s.name}:${s.status}`);
const rest = (stops: Stop[]) => stops.filter((s) => s.status === 'now' || s.status === 'upcoming');

describe('replanDay', () => {
  it('late: re-times the rest of the day from now and never touches done stops', async () => {
    const stops = afternoon();
    stops[3].durationMin = 60;
    const r = await replanDay(base({ trigger: 'late', now: '13:30', stops }), { places, routes, chat: noAI });
    assert.equal(r.ok, true, JSON.stringify(r.issues));
    assert.equal(r.usedAI, false);
    assert.deepEqual(r.stops.slice(0, 2), afternoon().slice(0, 2));
    const [palace, museum, sunset] = rest(r.stops);
    assert.equal(palace.status, 'now');
    // Now plus the 15-minute ride from where they are.
    assert.equal(palace.startTime, '13:45');
    assert.ok(toMin(museum.startTime) > toMin('15:00'), museum.startTime);
    assert.equal(sunset.moment, 'sunset');
    assert.match(r.message, /re-timed the rest of your day from 13:30/);
    assert.ok(r.changes.some((c) => /Albert Hall Museum now at/.test(c)), r.changes.join(' | '));
  });

  it('late: drops a stop to keep a loved sunset, and says so', async () => {
    // From 14:30, palace then a 2-hour museum would miss the sunset (and the museum's closing time).
    const r = await replanDay(base({ trigger: 'late', now: '14:30' }), { places, routes, chat: noAI });
    assert.equal(r.ok, true, JSON.stringify(r.issues));
    assert.deepEqual(rest(r.stops).map((s) => s.name), ['City Palace', 'Nahargarh Fort']);
    assert.equal(rest(r.stops)[1].startTime, '17:10');
    assert.match(r.message, /I dropped Albert Hall Museum to keep your sunset/);
  });

  it('skip: marks the chosen stop skipped and moves everything after it up', async () => {
    const r = await replanDay(base({ trigger: 'skip', stopId: 'p_palace', now: '13:20' }), { places, routes, chat: noAI });
    assert.equal(r.ok, true, JSON.stringify(r.issues));
    assert.deepEqual(names(r.stops), ['Amber Fort:done', 'Ghewar at LMB:done', 'City Palace:skipped', 'Albert Hall Museum:now', 'Nahargarh Fort:upcoming']);
    assert.ok(toMin(rest(r.stops)[0].startTime) < toMin('15:00'));
    assert.match(r.message, /Skipped City Palace/);
  });

  it('skip: defaults to the current stop', async () => {
    const r = await replanDay(base({ trigger: 'skip', now: '13:20' }), { places, routes, chat: noAI });
    assert.equal(r.stops.find((s) => s.status === 'skipped')?.name, 'City Palace');
  });

  it('tired: drops the most tiring stop, never the sunset or the only meal left', async () => {
    const r = await replanDay(base({ trigger: 'tired', now: '13:20' }), { places, routes, chat: noAI });
    assert.equal(r.ok, true, JSON.stringify(r.issues));
    assert.deepEqual(names(rest(r.stops)), ['City Palace:now', 'Nahargarh Fort:upcoming']);
    assert.equal(r.stops.find((s) => s.status === 'skipped')?.name, 'Albert Hall Museum');
    assert.match(r.message, /Take it easy/);
  });

  it('tired: with only a meal and a sunset left, shortens instead of dropping', async () => {
    const stops = [st('p_fort', '09:00', 120, { status: 'done' }), st('p_rawat', '16:00', 60, { category: 'food', name: 'Kachori at Rawat', status: 'now' }), st('p_nahargarh', '17:10', 60, { moment: 'sunset', category: 'nature' })];
    const r = await replanDay(base({ trigger: 'tired', stops, now: '15:50' }), { places, routes, chat: noAI });
    assert.deepEqual(names(rest(r.stops)), ['Kachori at Rawat:now', 'Nahargarh Fort:upcoming']);
    assert.equal(rest(r.stops)[0].durationMin, 45);
    assert.equal(rest(r.stops)[1].durationMin, 60);
  });

  it('hungry: puts the best open eatery nearby first and offers others', async () => {
    const stops = [st('p_fort', '09:00', 120, { status: 'done' }), st('p_palace', '13:00', 90, { status: 'now' }), st('p_nahargarh', '17:10', 60, { moment: 'sunset', category: 'nature' })];
    const at = { lat: 26.919, lng: 75.8215 };
    const r = await replanDay(base({ trigger: 'hungry', stops, now: '11:30', location: at }), { places, routes, chat: noAI });
    assert.equal(r.ok, true, JSON.stringify(r.issues));
    const ids = r.options?.map((o) => o.placeId) ?? [];
    // Known-for places first; the dhaba that opens at 19:00 isn't offered.
    assert.equal(ids.length, 3);
    assert.ok(!ids.includes('p_closed'));
    assert.ok(['p_lmb', 'p_rawat'].includes(ids[0]!));
    const meal = rest(r.stops)[0];
    assert.equal(meal.placeId, ids[0]);
    assert.equal(meal.status, 'now');
    assert.ok(toMin(meal.startTime) >= toMin('11:30'));
    assert.equal(rest(r.stops)[1].name, 'City Palace');
  });

  it('hungry: uses the place the traveler picked', async () => {
    const stops = [st('p_fort', '09:00', 120, { status: 'done' }), st('p_palace', '13:00', 90, { status: 'now' })];
    const at = { lat: 26.919, lng: 75.8215 };
    const r = await replanDay(base({ trigger: 'hungry', stops, now: '11:30', location: at, memories: [], choice: 'p_cafe' }), { places, routes, chat: noAI });
    assert.equal(rest(r.stops)[0].placeId, 'p_cafe');
  });

  it('late: lets go of a sunset that can no longer be reached, instead of keeping it for after dark', async () => {
    const r = await replanDay(base({ trigger: 'late', now: '18:00' }), { places, routes, chat: noAI });
    assert.equal(r.ok, true, JSON.stringify(r.issues));
    assert.equal(r.stops.find((s) => s.moment === 'sunset')?.status, 'skipped');
    assert.match(r.message, /Sorry, we can't make the sunset/);
    // City Palace and the museum close at 17:00: off the plan, and the traveler is told why.
    assert.deepEqual(rest(r.stops), []);
    assert.ok(r.changes.includes('Took off City Palace: it closes at 17:00 before you\'d get there.'), r.changes.join(' | '));
    // Not listed twice.
    assert.equal(r.changes.filter((c) => c.includes('Nahargarh')).length, 1, r.changes.join(' | '));
  });

  it('hungry: never drops the meal they asked for; the sunset gives way if it must', async () => {
    // At 16:40 a 40-minute meal plus the ride means missing the 17:10 sunset start.
    const stops = [st('p_fort', '09:00', 120, { status: 'done' }), st('p_nahargarh', '17:10', 60, { moment: 'sunset', category: 'nature', status: 'now' })];
    const r = await replanDay(base({ trigger: 'hungry', stops, now: '16:40', location: { lat: 26.919, lng: 75.8215 } }), { places, routes, chat: noAI });
    assert.equal(rest(r.stops)[0].category, 'food');
    assert.equal(r.stops.find((s) => s.moment === 'sunset')?.status, 'skipped');
    assert.ok(!r.changes.some((c) => /Dropped .* at (LMB|Rawat|Tapri)/.test(c)), r.changes.join(' | '));
  });

  it('skip: skipping the sunset itself is fine, not a missing moment', async () => {
    const r = await replanDay(base({ trigger: 'skip', stopId: 'p_nahargarh', now: '13:20' }), { places, routes, chat: noAI });
    assert.equal(r.ok, true, JSON.stringify(r.issues));
  });

  it('keeps skipped stops in time order among the rest of the day', async () => {
    const r = await replanDay(base({ trigger: 'tired', now: '13:20' }), { places, routes, chat: noAI });
    const times = r.stops.slice(2).map((s) => toMin(s.startTime));
    assert.deepEqual(times, [...times].sort((a, b) => a - b));
  });

  it('rain: asks the AI to re-plan the rest of today indoors, from here and now', async () => {
    let n = 0;
    const call = (name: string, args: unknown): ToolCall => ({ id: `c${++n}`, type: 'function', function: { name, arguments: JSON.stringify(args) } });
    const reply = (...tool_calls: ToolCall[]): ChatResponse => ({
      id: 'r',
      choices: [{ index: 0, finish_reason: 'tool_calls', message: { role: 'assistant', content: null, tool_calls } }],
      usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
    });
    const requests: ChatRequest[] = [];
    const script = [
      () => reply(call('search_places', { query: 'museum' })),
      () =>
        reply(
          call('submit_plan', {
            stops: [{ place_id: 'p1', category: 'culture', icon: '🏛️', start_time: '13:45', duration_min: 90, dish: '', timed_for: 'none', reason: 'Indoors, dry, and full of miniature paintings.' }],
          }),
        ),
    ];
    const chat = async (req: ChatRequest) => {
      requests.push(structuredClone(req));
      return script[requests.length - 1]();
    };

    const r = await replanDay(base({ trigger: 'rain', now: '13:30', memories: [] }), { places, routes, chat });

    assert.equal(r.usedAI, true);
    assert.equal(r.ok, true, JSON.stringify(r.issues));
    const prompt = requests[0].messages.map((m) => ('content' in m ? String(m.content) : '')).join('\n');
    assert.match(prompt, /Re-plan the REST of today/);
    assert.match(prompt, /raining/);
    assert.match(prompt, /Amber Fort/);
    assert.deepEqual(names(r.stops), ['Amber Fort:done', 'Ghewar at LMB:done', 'Albert Hall Museum:now']);
    assert.ok(r.changes.includes('Dropped City Palace.'));
  });

  it('rain: sends an outdoor viewpoint back to the AI, and drops the sunset requirement', async () => {
    let n = 0;
    const call = (name: string, args: unknown): ToolCall => ({ id: `r${++n}`, type: 'function', function: { name, arguments: JSON.stringify(args) } });
    const reply = (...tool_calls: ToolCall[]): ChatResponse => ({
      id: 'r',
      choices: [{ index: 0, finish_reason: 'tool_calls', message: { role: 'assistant', content: null, tool_calls } }],
      usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
    });
    const sight = (place_id: string) => ({ place_id, category: 'sight', icon: '📍', start_time: '13:45', duration_min: 90, dish: '', timed_for: 'none', reason: 'A good stop for this traveler, trust me.' });
    const requests: ChatRequest[] = [];
    const script = [
      () => reply(call('search_places', { query: 'Nahargarh' }), call('search_places', { query: 'museum' })),
      () => reply(call('submit_plan', { stops: [sight('p1')] })),
      () => reply(call('submit_plan', { stops: [sight('p2')] })),
    ];
    const chat = async (req: ChatRequest) => {
      requests.push(structuredClone(req));
      return script[requests.length - 1]();
    };

    // They love sunsets, but there's none to see in the rain: no missing-moment complaint.
    const r = await replanDay(base({ trigger: 'rain', now: '13:30' }), { places, routes, chat });

    assert.equal(r.ok, true, JSON.stringify(r.issues));
    const feedback = requests[2].messages.at(-1);
    assert.match(String(feedback && 'content' in feedback ? feedback.content : ''), /outdoors, and it's raining\. → Replace it with an indoor place/);
    assert.deepEqual(rest(r.stops).map((s) => s.name), ['Albert Hall Museum']);
  });

  it('skip: skipping lunch does not put another lunch back', async () => {
    const stops = [st('p_fort', '09:00', 120, { status: 'done' }), st('p_rawat', '12:30', 45, { category: 'food', name: 'Kachori at Rawat', status: 'now' }), st('p_palace', '14:00', 90)];
    const r = await replanDay(base({ trigger: 'skip', stops, now: '12:30', memories: [] }), { places, routes, chat: noAI });
    assert.deepEqual(names(rest(r.stops)), ['City Palace:now']);
  });

  const scriptedAI = (steps: ((call: (name: string, args: unknown) => ToolCall) => ChatResponse)[]) => {
    let n = 0;
    const call = (name: string, args: unknown): ToolCall => ({ id: `b${++n}`, type: 'function', function: { name, arguments: JSON.stringify(args) } });
    const requests: ChatRequest[] = [];
    const chat = async (req: ChatRequest) => {
      requests.push(structuredClone(req));
      const step = steps[requests.length - 1];
      if (!step) throw new Error('script ran out');
      return step(call);
    };
    return { requests, chat };
  };
  const reply = (...tool_calls: ToolCall[]): ChatResponse => ({
    id: 'r',
    choices: [{ index: 0, finish_reason: 'tool_calls', message: { role: 'assistant', content: null, tool_calls } }],
    usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
  });
  const sight = (place_id: string, start_time: string, timed_for = 'none') => ({ place_id, category: 'sight', icon: '📍', start_time, duration_min: 90, dish: '', timed_for, reason: 'A good stop for this traveler, trust me.' });
  const lastToolReply = (req: ChatRequest) => {
    const m = req.messages.at(-1);
    return String(m && 'content' in m ? m.content : '');
  };

  it('bored: asks the AI to fill the time, and code fills an empty afternoon with a good place nearby', async () => {
    const ai = scriptedAI([
      (call) => reply(call('search_places', { query: 'Nahargarh' }), call('search_places', { query: 'museum' })),
      // Only the sunset, at 17:10: nearly four hours of nothing from 13:20.
      (call) => reply(call('submit_plan', { stops: [sight('p1', '17:10', 'sunset')] })),
    ]);
    const r = await replanDay(base({ trigger: 'bored', now: '13:20' }), { places, routes, chat: ai.chat });
    assert.equal(r.ok, true, JSON.stringify(r.issues));
    assert.equal(ai.requests.length, 2, 'accepted on the first submission');
    const prompt = ai.requests[0].messages.map((m) => ('content' in m ? String(m.content) : '')).join('\n');
    assert.match(prompt, /Fill the time from 13:20 on/);
    assert.match(prompt, /every hour until the last stop should have something to do/);
    const [museum, sunset] = rest(r.stops);
    assert.equal(museum.name, 'Albert Hall Museum');
    // Now, plus the ride from where they are.
    assert.equal(museum.startTime, '13:35');
    assert.ok(museum.durationMin >= 90, String(museum.durationMin));
    assert.equal(sunset.moment, 'sunset');
    assert.ok(r.changes.some((c) => /Added Albert Hall Museum to fill the free time from 13:20/.test(c)), r.changes.join(' | '));
  });

  it('bored: when code has nothing to fill a gap with, the AI is told exactly when it is', async () => {
    // Only the sunset spot exists in this town.
    const onlyNahargarh: PlacesProvider = { search: async () => [PLACES.p_nahargarh], details: places.details };
    const ai = scriptedAI([
      (call) => reply(call('search_places', { query: 'Nahargarh' })),
      (call) => reply(call('submit_plan', { stops: [sight('p1', '17:10', 'sunset')] })),
      (call) => reply(call('submit_plan', { stops: [sight('p1', '17:10', 'sunset')] })),
    ]);
    const r = await replanDay(base({ trigger: 'bored', now: '13:20' }), { places: onlyNahargarh, routes, chat: ai.chat }).catch(() => undefined);
    assert.equal(r, undefined, 'the AI is asked again');
    const feedback = lastToolReply(ai.requests[2]);
    assert.match(feedback, /Nothing planned for 3\.5 hours, from 13:20 to 16:55, before \\"Nahargarh Fort\\"/);
    assert.match(feedback, /Add a stop near where they are now that starts around 13:20 and ends by 16:55/);
    assert.match(feedback, /search_places with near_place_id/);
  });

  it('bored: code never fills a gap with a place that would cost the loved sunset', async () => {
    // A famous night bazaar that only opens at 16:00: two hours there would run past the 17:10 sunset.
    const bazaar: PlaceDetails = { placeId: 'p_bazaar', name: 'Night Bazaar', location: { lat: 26.925, lng: 75.82 }, types: ['market'], rank: 6, regularHours: daily(16, 23) };
    const withBazaar: PlacesProvider = { search: async () => [PLACES.p_nahargarh, bazaar], details: async (id) => (id === 'p_bazaar' ? bazaar : places.details(id)) };
    const ai = scriptedAI([
      (call) => reply(call('search_places', { query: 'Nahargarh' })),
      (call) => reply(call('submit_plan', { stops: [sight('p1', '17:10', 'sunset')] })),
    ]);
    await replanDay(base({ trigger: 'bored', now: '13:20' }), { places: withBazaar, routes, chat: ai.chat }).catch(() => undefined);
    assert.match(lastToolReply(ai.requests[2]), /long|Nothing planned for 3\.5 hours/);
  });
});
