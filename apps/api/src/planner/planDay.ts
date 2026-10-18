import type { Memory, Stop, TripPreferences } from '@tagalong/shared';

import type { LatLng } from '../providers/types.js';
import type { ChatMessage, ChatRequest, ChatResponse } from '../sarvam.js';
import { requestPrompt, systemPrompt } from './prompt.js';
import { submitPlanArgs } from './schema.js';
import { PlannerSession, type Providers } from './session.js';
import { plannerTools } from './tools.js';
import type { DayRules, Issue } from './validate.js';

// The planning loop: the model calls tools, then submit_plan. Our code turns the submission into
// stops from real data and validates it. Rejections go back to the model as the tool result.

export interface PlanDayInput {
  city: string;
  cityCenter: LatLng;
  date: string;
  dayNumber?: number;
  totalDays?: number;
  prefs?: Partial<TripPreferences>;
  rules?: DayRules;
  memories?: Memory[];
  avoidPlaceIds?: string[];
  stayNear?: string;
}

export interface PlanDayDeps extends Providers {
  chat: (req: ChatRequest) => Promise<ChatResponse>;
}

export interface PlanDayOptions {
  /** Model round trips before giving up. */
  maxTurns?: number;
  /** submit_plan attempts before giving up. */
  maxSubmits?: number;
  /** Cap per response. Sarvam Starter allows 4,096; Pro allows 16,384. */
  maxTokens?: number;
  /** Research budget: tool calls run per model turn, and in total, before we ask for the plan. */
  maxToolsPerTurn?: number;
  maxTools?: number;
  onEvent?: (e: { type: 'tool'; name: string; args: string } | { type: 'submit'; attempt: number; issues: Issue[] }) => void;
}

export interface PlanDayResult {
  ok: boolean;
  stops: Stop[];
  /** Issues left on the final submission (empty when ok). */
  issues: Issue[];
  error?: string;
  stats: { turns: number; submits: number; tools: Record<string, number>; promptTokens: number; completionTokens: number; ms: number };
}

export async function planDay(input: PlanDayInput, deps: PlanDayDeps, opts: PlanDayOptions = {}): Promise<PlanDayResult> {
  const { maxTurns = 30, maxSubmits = 4, maxTokens = 4096, maxToolsPerTurn = 10, maxTools = 70, onEvent } = opts;
  const started = Date.now();
  const rules: DayRules = { pace: input.prefs?.pace, budgetPerDayInr: input.prefs?.budgetPerDayInr, ...input.rules };
  const session = new PlannerSession(deps, {
    city: input.city,
    cityCenter: input.cityCenter,
    date: input.date,
    rules,
    memories: input.memories ?? [],
    avoidPlaceIds: input.avoidPlaceIds,
    diet: input.prefs?.diet,
  });

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt() },
    {
      role: 'user',
      content: requestPrompt({
        city: input.city,
        date: input.date,
        dayNumber: input.dayNumber ?? 1,
        totalDays: input.totalDays ?? 1,
        prefs: input.prefs ?? {},
        rules,
        memories: input.memories ?? [],
        stayNear: input.stayNear,
        cityCenter: input.cityCenter,
      }),
    },
  ];

  const stats = { turns: 0, submits: 0, tools: session.toolCounts, promptTokens: 0, completionTokens: 0, ms: 0 };
  let last: { stops: Stop[]; issues: Issue[] } = { stops: [], issues: [] };
  let nudges = 0;
  let toolsRun = 0;
  const done = (ok: boolean, error?: string): PlanDayResult => ({ ok, stops: last.stops, issues: ok ? [] : last.issues, error, stats: { ...stats, ms: Date.now() - started } });

  while (stats.turns < maxTurns) {
    stats.turns++;
    // Out of research budget or nearly out of turns: the only move left is to submit.
    const mustSubmit = toolsRun >= maxTools || stats.turns >= maxTurns - 2;
    const res = await deps.chat({
      model: 'sarvam-105b',
      messages,
      tools: plannerTools,
      tool_choice: mustSubmit ? { type: 'function', function: { name: 'submit_plan' } } : 'required',
      reasoning_effort: 'low',
      temperature: 0.4,
      max_tokens: maxTokens,
    });
    stats.promptTokens += res.usage?.prompt_tokens ?? 0;
    stats.completionTokens += res.usage?.completion_tokens ?? 0;

    const msg = res.choices[0]?.message;
    if (!msg) return done(false, 'empty response from the model');
    messages.push({ role: 'assistant', content: msg.content ?? null, tool_calls: msg.tool_calls });

    if (!msg.tool_calls?.length) {
      if (++nudges > 2) return done(false, 'the model stopped calling tools');
      messages.push({ role: 'user', content: 'Use the tools to research, then call submit_plan with the finished day.' });
      continue;
    }

    // Run this turn's research calls together, within the budget; refuse the rest.
    const research = msg.tool_calls.filter((c) => c.function.name !== 'submit_plan');
    const allowed = research.slice(0, Math.max(0, Math.min(maxToolsPerTurn, maxTools - toolsRun)));
    toolsRun += allowed.length;
    const results = await Promise.all(
      allowed.map((c) => {
        onEvent?.({ type: 'tool', name: c.function.name, args: c.function.arguments });
        return session.run(c.function.name, c.function.arguments);
      }),
    );
    const outOfBudget = toolsRun >= maxTools;
    for (const c of research) {
      const i = allowed.indexOf(c);
      const content =
        i >= 0
          ? results[i]
          : JSON.stringify({ skipped: outOfBudget ? 'research budget used up: call submit_plan now with what you have' : `at most ${maxToolsPerTurn} tool calls per turn; ask again for what you still need` });
      messages.push({ role: 'tool', tool_call_id: c.id, content });
    }

    for (const call of msg.tool_calls) {
      if (call.function.name !== 'submit_plan') continue;

      stats.submits++;
      session.toolCounts.submit_plan = (session.toolCounts.submit_plan ?? 0) + 1;
      const parsed = submitPlanArgs.safeParse(safeJson(call.function.arguments));
      if (!parsed.success) {
        const issues: Issue[] = parsed.error.issues.slice(0, 8).map((i) => ({ code: 'unverified_place', message: `${i.path.join('.')}: ${i.message}` }));
        last = { stops: [], issues };
        onEvent?.({ type: 'submit', attempt: stats.submits, issues });
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ accepted: false, issues: issues.map((i) => i.message) }) });
      } else {
        last = await session.review(parsed.data.stops);
        onEvent?.({ type: 'submit', attempt: stats.submits, issues: last.issues });
        if (!last.issues.length) return done(true);
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify({
            accepted: false,
            issues: last.issues.map((i) => `${i.message} → ${FIX[i.code]}`),
            // The clock our code computed, so the model can see where travel pushed things.
            schedule: last.stops.map((st, n) => `${n + 1}. ${st.startTime}–${endOf(st)} ${st.name}${st.hop ? ` (after ${st.hop.minutes} min ${st.hop.mode})` : ''}`),
            hint: 'Fix exactly these, keep everything else, and call submit_plan again. Prefer nearby places over long rides.',
          }),
        });
      }
      if (stats.submits >= maxSubmits) return done(false, `still invalid after ${maxSubmits} submissions`);
      // Research calls are already answered above. Answer any extra submit_plan calls in the same
      // message so every tool call has exactly one reply.
      for (const extra of msg.tool_calls.filter((c) => c.function.name === 'submit_plan' && c !== call)) {
        messages.push({ role: 'tool', tool_call_id: extra.id, content: JSON.stringify({ skipped: 'one submit_plan per turn' }) });
      }
      break;
    }
  }
  return done(false, `ran out of turns (${maxTurns})`);
}

const FIX: Record<Issue['code'], string> = {
  unverified_place: 'Use only place_ids returned by search_places (like "p3").',
  unknown_hours: 'Call place_details for it first.',
  closed: 'Move it inside its opening hours, or replace it with another place.',
  out_of_order: 'Put stops in time order.',
  not_enough_travel_time: 'Start the next stop later by at least the travel minutes, or pick a closer place.',
  over_budget: 'Swap a paid stop for a free one, choose cheaper food, or ride an auto instead of a cab.',
  too_many_stops: 'Drop the least important stop (never the lunch stop).',
  too_early: 'Start the first stop later.',
  no_lunch: "Add a food stop (category 'food' with a named dish) starting between 12:00 and 14:30, and shift later stops.",
  repeated_place: 'Use a different place.',
  no_route: "Try mode 'cab' or 'walk', or pick another place.",
  diet_mismatch: 'Pick a dish that fits the diet (and a place known for it). Never relabel a meat dish as vegetarian.',
  too_few_stops: 'Add stops until the day matches the pace, filling the afternoon and evening.',
  missing_dish: 'Set dish to the specific dish to eat there.',
  too_late: 'Drop or shorten a stop so the day ends by 22:00.',
  memory_unused: 'Rewrite one or two reasons to use a specific memory, wrapping the remembered detail in **double asterisks**.',
};

function endOf(st: Stop): string {
  const [h, m] = st.startTime.split(':').map(Number);
  const end = h * 60 + m + st.durationMin;
  return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}
