import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import type { Memory } from '@tagalong/shared';

import { cityCenter, plannerDeps } from '../src/planner/deps.js';
import { planDay, type PlanDayDeps, type PlanDayResult } from '../src/planner/planDay.js';
import { scenarios, type Scenario } from './scenarios.js';
import { score, type Score } from './score.js';

// Usage: npm run eval -w api -- [--only id,id] [--limit 3] [--concurrency 2] [--verbose]
// Uses real Sarvam and Google calls, so it costs money. Sarvam Starter allows 40 requests/min.

const { values: args } = parseArgs({
  options: {
    only: { type: 'string' },
    limit: { type: 'string' },
    concurrency: { type: 'string', default: '2' },
    verbose: { type: 'boolean', default: false },
  },
});

const configured = plannerDeps();
if ('missing' in configured) {
  console.error(`Missing keys in apps/api/.env: ${configured.missing.join(', ')}`);
  process.exit(2);
}
const deps: PlanDayDeps = configured;

let picked = args.only ? scenarios.filter((s) => args.only!.split(',').includes(s.id)) : scenarios;
if (args.limit) picked = picked.slice(0, Number(args.limit));
if (!picked.length) {
  console.error('No scenarios matched.');
  process.exit(2);
}

const isoDate = (offset: number) => new Date(Date.now() + offset * 86_400_000 + 5.5 * 3_600_000).toISOString().slice(0, 10);

async function runOne(s: Scenario): Promise<{ scenario: Scenario; date: string; result: PlanDayResult; score: Score }> {
  const date = isoDate(s.dayOffset);
  const center = await cityCenter(s.city, deps.places);
  if (!center) throw new Error(`unknown city ${s.city}`);
  const memories: Memory[] = s.memories.map((m, i) => ({ id: `m${i}`, kind: m.kind, text: m.text, evidence: m.evidence ?? 'From earlier trips', source: 'chat', sensitive: false, createdAt: date }));
  const result = await planDay(
    { city: s.city, cityCenter: center, date, prefs: { ...s.prefs, city: s.city, startDate: date, endDate: date }, rules: { notBefore: s.notBefore }, memories, stayNear: s.stayNear },
    deps,
    {
      onEvent: args.verbose
        ? (e) => console.log(`  [${s.id}] ${e.type === 'tool' ? `${e.name} ${e.args.slice(0, 90)}` : `submit #${e.attempt}: ${e.issues.length ? e.issues.map((i) => i.code).join(', ') : 'accepted'}`}`)
        : undefined,
    },
  ).catch((err: unknown): PlanDayResult => ({
    ok: false,
    stops: [],
    issues: [],
    error: err instanceof Error ? err.message : String(err),
    stats: { turns: 0, submits: 0, tools: {}, promptTokens: 0, completionTokens: 0, ms: 0 },
  }));
  return { scenario: s, date, result, score: score(s, result) };
}

async function pool<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
        process.stdout.write('.');
      }
    }),
  );
  process.stdout.write('\n');
  return out;
}

console.log(`Planning ${picked.length} scenario(s)…`);
const runs = await pool(picked, Number(args.concurrency), runOne);

// ─── Report ───
const pad = (s: string | number, n: number) => String(s).padEnd(n);
console.log('');
console.log(pad('scenario', 28), pad('valid', 6), pad('checks', 8), pad('submits', 8), pad('tools', 6), pad('tokens', 9), 'time');
for (const r of runs) {
  const st = r.result.stats;
  const tools = Object.values(st.tools).reduce((a, b) => a + b, 0);
  console.log(
    pad(r.scenario.id, 28),
    pad(r.result.ok ? 'yes' : 'NO', 6),
    pad(`${r.score.passed}/${r.score.total}`, 8),
    pad(st.submits, 8),
    pad(tools, 6),
    pad(st.promptTokens + st.completionTokens, 9),
    `${Math.round(st.ms / 1000)}s`,
  );
  for (const c of r.score.checks.filter((c) => !c.pass)) console.log(`    ✗ ${c.name}${c.detail ? `: ${c.detail.slice(0, 160)}` : ''}`);
}

const valid = runs.filter((r) => r.result.ok).length;
const allChecks = runs.filter((r) => r.score.ok).length;
const prompt = runs.reduce((a, r) => a + r.result.stats.promptTokens, 0);
const completion = runs.reduce((a, r) => a + r.result.stats.completionTokens, 0);
// sarvam-105b: ₹15 per 1M input tokens, ₹60 per 1M output tokens (ignores cached-input discount).
const llmInr = (prompt * 15 + completion * 60) / 1e6;
const toolTotals = runs.reduce<Record<string, number>>((acc, r) => {
  for (const [k, v] of Object.entries(r.result.stats.tools)) acc[k] = (acc[k] ?? 0) + v;
  return acc;
}, {});

console.log('');
console.log(`Valid plans:      ${valid}/${runs.length}`);
console.log(`All checks pass:  ${allChecks}/${runs.length}`);
console.log(`LLM tokens:       ${prompt.toLocaleString('en-IN')} in, ${completion.toLocaleString('en-IN')} out (≈ ₹${llmInr.toFixed(2)}, ₹${(llmInr / runs.length).toFixed(2)} per day)`);
console.log(`Tool calls:       ${Object.entries(toolTotals).map(([k, v]) => `${k} ${v}`).join(', ')}`);

const dir = join(dirname(fileURLToPath(import.meta.url)), 'results');
mkdirSync(dir, { recursive: true });
const file = join(dir, `${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`);
writeFileSync(file, JSON.stringify(runs.map((r) => ({ id: r.scenario.id, date: r.date, score: r.score, result: r.result })), null, 2));
console.log(`Full results:     ${file}`);
