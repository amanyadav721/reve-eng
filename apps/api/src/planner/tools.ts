import type { ToolDefinition } from '../sarvam.js';
import { jsonSchemaOf, submitPlanArgs } from './schema.js';

// The tools the planner model may call. Every place fact in a plan comes from these, never from
// the model's own knowledge. Implementations live in session.ts.

const fn = (name: string, description: string, properties: Record<string, unknown>, required: string[]): ToolDefinition => ({
  type: 'function',
  function: { name, description, parameters: { type: 'object', properties, required, additionalProperties: false } },
});

export const plannerTools: ToolDefinition[] = [
  fn(
    'search_places',
    'Find real places in the city. Use for sights, a restaurant famous for a specific dish, cafés, markets, viewpoints. Returns place_id, name, rating and price level.',
    {
      query: { type: 'string', description: 'What to look for, e.g. "pyaaz kachori" or "rooftop cafe sunset view". The city is added for you.' },
      near_place_id: { type: 'string', description: 'Bias results to within ~3 km of this place.' },
    },
    ['query'],
  ),
  fn(
    'place_details',
    "Opening hours on the day being planned, open/closed status, entry price range and a short description. Call before scheduling any place.",
    { place_id: { type: 'string' } },
    ['place_id'],
  ),
  fn(
    'get_route',
    'Travel time, distance and fare range (local currency) between two places, for a mode available in this city. Use it for consecutive stops.',
    {
      from_place_id: { type: 'string' },
      to_place_id: { type: 'string' },
      mode: { type: 'string', enum: ['walk', 'auto', 'cab', 'metro', 'bus', 'train', 'scooter'] },
    },
    ['from_place_id', 'to_place_id', 'mode'],
  ),
  fn('get_weather', 'Hourly forecast for the day being planned: temperature and rain chance.', {}, []),
  fn(
    'web_search',
    'Search the web for what locals recommend: the famous dishes of the city, which shop is known for a dish, what is on this week.',
    { query: { type: 'string' } },
    ['query'],
  ),
  fn(
    'recall_memories',
    'Look up what we know about the traveler or their companions that is relevant, e.g. "food", "what they liked in Jodhpur", "Priya".',
    { about: { type: 'string' } },
    ['about'],
  ),
  {
    type: 'function',
    function: {
      name: 'submit_plan',
      description:
        'Submit the finished day. Our checker verifies places, opening hours, travel times, budget and pace. If it replies with issues, fix exactly those and submit again.',
      parameters: jsonSchemaOf(submitPlanArgs),
    },
  },
];
