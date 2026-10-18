import { z } from 'zod';

// What the model submits. Deliberately thin: the model picks places, times and the order.
// Names, opening hours, travel times and fares are filled in by our code from real data.

export const proposedStop = z.object({
  place_id: z.string().describe('A place_id returned by search_places in this conversation.'),
  category: z.enum(['food', 'sight', 'nature', 'culture', 'shopping']),
  icon: z.string().max(8).describe('One emoji for the stop.'),
  start_time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .describe('Earliest you want this stop to start, local 24-hour HH:mm (e.g. sunset spots). We compute exact times from travel and opening hours.'),
  duration_min: z.number().int().min(10).max(360),
  cost_inr: z.number().int().min(0).max(20000).optional().describe('Per person: entry fee, or what the dish/meal costs.'),
  hop_mode: z
    .enum(['walk', 'auto', 'cab', 'metro', 'bus', 'scooter'])
    .optional()
    .describe('How to get here from the previous stop. Omit for the first stop.'),
  dish: z.string().optional().describe('Required for food stops: the specific dish to eat here, e.g. "pyaaz kachori".'),
  reason: z.string().min(10).max(320).describe("One or two short sentences in Laddoo's voice. Mention a memory when one applies."),
});

export const submitPlanArgs = z.object({
  stops: z.array(proposedStop).min(1).max(9),
});

export type ProposedStop = z.infer<typeof proposedStop>;
export type SubmitPlanArgs = z.infer<typeof submitPlanArgs>;

export function jsonSchemaOf(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  return rest;
}
