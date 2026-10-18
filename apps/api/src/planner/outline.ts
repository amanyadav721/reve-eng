import type { Memory, TripPreferences } from '@tagalong/shared';
import { z } from 'zod';

import type { CityArea } from '../places/ensureCity.js';
import type { ChatRequest, ChatResponse } from '../sarvam.js';
import { jsonSchemaOf } from './schema.js';

// Step one of any trip: turn whatever the traveler typed ("Miami", "Japan for 10 days", "Rajasthan",
// "somewhere warm in December") into a route of real cities with days in each.
// The model proposes; the geocoder confirms each city exists; code makes the days add up.

const leg = z.object({
  city: z.string().min(1).describe('One city or town to base the traveler in, e.g. "Kyoto". Not a region or country.'),
  country: z.string().describe('The country it is in, e.g. "Japan".'),
  days: z.number().int().min(1).max(30),
  why: z.string().max(200).describe('One short sentence on why this stop, in Laddoo\'s voice.'),
});

export const outlineSchema = z.object({
  kind: z.enum(['city', 'multi_city', 'unclear']).describe('"city": one place. "multi_city": a country or region split into bases. "unclear": too vague to plan; ask a question.'),
  legs: z.array(leg).max(12).describe('In travel order. Empty when unclear.'),
  question: z.string().max(240).describe('When unclear: one friendly question to pin down the destination. Otherwise "".'),
});

export type OutlineDraft = z.infer<typeof outlineSchema>;

export interface OutlineInput {
  destination: string;
  days: number;
  startDate?: string;
  prefs?: Partial<TripPreferences>;
  memories?: Memory[];
}

export interface OutlineLeg extends CityArea {
  days: number;
  why: string;
  startDate?: string;
  endDate?: string;
}

export type Outline =
  | { kind: 'unclear'; question: string }
  | { kind: 'city' | 'multi_city'; legs: OutlineLeg[]; dropped: string[] };

export interface OutlineDeps {
  chat: (req: ChatRequest) => Promise<ChatResponse>;
  /** Finds a real city, e.g. cityArea() from ensureCity.ts. */
  geocode: (name: string) => Promise<CityArea | undefined>;
}

const SYSTEM = [
  'You are Laddoo, the trip planner inside Tagalong. Turn a traveler\'s destination into a route of base cities.',
  '- One city or a small place: kind "city", one leg with all the days.',
  '- A country, state or region: kind "multi_city". Pick 1 base per 2–4 days, in a sensible travel order with short hops between them. Fewer, longer stays beat rushing.',
  '- A neighbourhood or landmark ("South Beach", "Taj Mahal"): use the city it is in.',
  '- Too vague to choose ("somewhere nice"): kind "unclear" with one short question. Use what you know about the traveler to make the question specific.',
  'Only real cities and towns. Days across legs must add up to the total.',
].join('\n');

export async function outlineTrip(input: OutlineInput, deps: OutlineDeps): Promise<Outline> {
  const memories = (input.memories ?? []).map((m) => `- ${m.text}`).join('\n');
  const request: ChatRequest = {
    model: 'sarvam-105b',
    reasoning_effort: 'low',
    temperature: 0.3,
    // Reasoning tokens count against this cap. Starter allows 4,096.
    max_tokens: 4096,
    messages: [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: [
          `Destination: ${input.destination}`,
          `Total days: ${input.days}${input.startDate ? `, starting ${input.startDate}` : ''}`,
          input.prefs?.interests?.length ? `Loves: ${input.prefs.interests.join(', ')}` : '',
          input.prefs?.pace ? `Pace: ${input.prefs.pace}` : '',
          memories ? `What we remember:\n${memories}` : '',
          'Answer by calling propose_outline.',
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ],
    // A forced tool call: models stay short and on-format here, where JSON mode made them over-think.
    tools: [{ type: 'function', function: { name: 'propose_outline', description: 'The route of base cities for this trip.', parameters: jsonSchemaOf(outlineSchema) } }],
    tool_choice: { type: 'function', function: { name: 'propose_outline' } },
  };

  let draft: OutlineDraft | undefined;
  let problem = '';
  // Reasoning length varies run to run; if the big model keeps over-thinking, the fast
  // conversational model answers this simple question reliably.
  const models: ChatRequest['model'][] = ['sarvam-105b', 'sarvam-105b', 'sarvam-105b-conversations'];
  for (let attempt = 0; attempt < models.length && !draft; attempt++) {
    const choice = (await deps.chat({ ...request, model: models[attempt] })).choices[0];
    const raw = choice?.message.tool_calls?.[0]?.function.arguments ?? choice?.message.content ?? '';
    const parsed = outlineSchema.safeParse(safeJson(raw));
    if (parsed.success) draft = parsed.data;
    else problem = choice?.finish_reason === 'length' ? 'ran out of tokens' : (parsed.error.issues[0]?.message ?? 'invalid');
  }
  if (!draft) throw new Error(`outline: no valid outline from the model (${problem})`);
  if (draft.kind === 'unclear' || !draft.legs.length) {
    return { kind: 'unclear', question: draft.question || `Where in ${input.destination} would you like to go?` };
  }

  // Code decides: every city must exist, and days must add up.
  const legs: OutlineLeg[] = [];
  const dropped: string[] = [];
  for (const l of draft.legs) {
    const area = await deps.geocode(`${l.city}, ${l.country}`);
    if (!area) {
      dropped.push(l.city);
      continue;
    }
    // Two legs in the same city: merge them.
    const same = legs.find((x) => x.key === area.key);
    if (same) same.days += l.days;
    else legs.push({ ...area, name: l.city, days: l.days, why: l.why });
  }
  if (!legs.length) return { kind: 'unclear', question: `I couldn't find ${draft.legs.map((l) => l.city).join(', ')} on the map. Which city do you mean?` };

  fitDays(legs, input.days);
  if (input.startDate) assignDates(legs, input.startDate);
  return { kind: legs.length > 1 ? 'multi_city' : 'city', legs, dropped };
}

/** Scale leg lengths so they sum to the trip length, keeping at least one day each. */
export function fitDays(legs: { days: number }[], total: number): void {
  const keep = legs.slice(0, Math.max(1, total));
  legs.splice(keep.length);
  let sum = legs.reduce((a, l) => a + l.days, 0);
  for (const l of legs) l.days = Math.max(1, Math.round((l.days * total) / sum));
  sum = legs.reduce((a, l) => a + l.days, 0);
  // Fix rounding on the longest legs.
  const byLength = [...legs].sort((a, b) => b.days - a.days);
  for (let i = 0; sum !== total; i = (i + 1) % byLength.length) {
    const l = byLength[i];
    if (sum > total && l.days > 1) {
      l.days--;
      sum--;
    } else if (sum < total) {
      l.days++;
      sum++;
    }
  }
}

function assignDates(legs: OutlineLeg[], startDate: string): void {
  let t = Date.parse(`${startDate}T00:00:00Z`);
  for (const l of legs) {
    l.startDate = new Date(t).toISOString().slice(0, 10);
    t += l.days * 86_400_000;
    l.endDate = new Date(t - 86_400_000).toISOString().slice(0, 10);
  }
}

function safeJson(s: string): unknown {
  try {
    // Some models wrap JSON in a code fence.
    return JSON.parse(s.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    return undefined;
  }
}
