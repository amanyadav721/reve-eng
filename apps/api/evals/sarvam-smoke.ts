// Quick check that Sarvam accepts our key and request shape: tools, tool_choice=required,
// and a tool result round trip. Usage: npx tsx --env-file=.env evals/sarvam-smoke.ts
import { chat, type ChatMessage } from '../src/sarvam.js';
import { plannerTools } from '../src/planner/tools.js';

const messages: ChatMessage[] = [
  { role: 'system', content: 'You plan trips. Use the tools.' },
  { role: 'user', content: 'Find a famous pyaaz kachori shop in Jaipur.' },
];
const t0 = Date.now();
const first = await chat({ model: 'sarvam-105b', messages, tools: plannerTools, tool_choice: 'required', reasoning_effort: 'low', max_tokens: 1024 });
const msg = first.choices[0].message;
console.log('1st call ms:', Date.now() - t0, '| finish:', first.choices[0].finish_reason, '| usage:', JSON.stringify(first.usage));
console.log('tool calls:', JSON.stringify(msg.tool_calls?.map((c) => ({ name: c.function.name, args: c.function.arguments }))));
if (!msg.tool_calls?.length) process.exit(1);

messages.push({ role: 'assistant', content: msg.content ?? null, tool_calls: msg.tool_calls });
for (const c of msg.tool_calls) {
  messages.push({ role: 'tool', tool_call_id: c.id, content: JSON.stringify({ places: [{ place_id: 'p_rawat', name: 'Rawat Misthan Bhandar', rating: 4.3 }] }) });
}
const t1 = Date.now();
const second = await chat({ model: 'sarvam-105b', messages, tools: plannerTools, tool_choice: 'auto', reasoning_effort: 'low', max_tokens: 1024 });
const m2 = second.choices[0].message;
console.log('2nd call ms:', Date.now() - t1, '| finish:', second.choices[0].finish_reason);
console.log('next:', m2.tool_calls?.length ? JSON.stringify(m2.tool_calls.map((c) => c.function.name)) : (m2.content ?? '').slice(0, 200));
