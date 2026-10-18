import { env } from './env.js';

// Thin client for Sarvam's OpenAI-compatible chat completions.
// Docs: https://docs.sarvam.ai/api-reference/chat/chat-completions-v1

const BASE_URL = 'https://api.sarvam.ai/v1';

export type ChatModel = 'sarvam-105b' | 'sarvam-105b-conversations';

export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ToolDefinition {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface ChatRequest {
  model: ChatModel;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
  response_format?: { type: 'json_schema'; json_schema: { name: string; schema: Record<string, unknown>; strict?: boolean } } | { type: 'json_object' };
  /** The docs disagree on the default, so always set it. */
  reasoning_effort: 'low' | 'high' | 'max';
  temperature?: number;
  max_tokens?: number;
}

export interface ChatResponse {
  id: string;
  choices: { index: number; finish_reason: string; message: { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] } }[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export class SarvamError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`Sarvam ${status}: ${body.slice(0, 300)}`);
  }
}

const RETRYABLE = new Set([429, 500, 502, 503, 504]);

export async function chat(req: ChatRequest, { attempts = 3 } = {}): Promise<ChatResponse> {
  if (!env.SARVAM_API_KEY) throw new Error('SARVAM_API_KEY is not set');

  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // Sarvam documents both header styles; send the same key in each.
        authorization: `Bearer ${env.SARVAM_API_KEY}`,
        'api-subscription-key': env.SARVAM_API_KEY,
      },
      body: JSON.stringify(req),
    });

    if (res.ok) return (await res.json()) as ChatResponse;

    const body = await res.text();
    if (!RETRYABLE.has(res.status) || attempt >= attempts) throw new SarvamError(res.status, body);
    // Exponential backoff with jitter: ~0.5s, ~1s, ~2s.
    await new Promise((r) => setTimeout(r, 2 ** (attempt - 1) * 500 + Math.random() * 250));
  }
}
