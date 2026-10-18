import type { Memory, TripPreferences } from '@tagalong/shared';

// Real trips for the 5 launch cities. Each one is planned end to end with the real model and real
// Google data, then scored. Grow this to 30–50 before trusting the planner with users.

export interface Scenario {
  id: string;
  city: string;
  /** Days from today, so dates stay in Google's 7-day window for live hours (and weather, when ≤ 2). */
  dayOffset: number;
  prefs: Omit<TripPreferences, 'city' | 'startDate' | 'endDate'>;
  notBefore?: string;
  stayNear?: string;
  memories: { kind: Memory['kind']; text: string; evidence?: string }[];
  expect: {
    /** Patterns that must not appear in any stop name or reason (things the traveler skips). */
    mustNotMention?: RegExp[];
    minFoodStops?: number;
    /** A stop that starts in this window, e.g. sunset or Ganga aarti. Local HH:mm. */
    stopBetween?: { from: string; to: string; label: string };
    maxWalkMin?: number;
  };
}

export const scenarios: Scenario[] = [
  // ─── Jaipur ───
  {
    id: 'jaipur-solo-veg',
    city: 'Jaipur',
    dayOffset: 2,
    prefs: { group: 'solo', pace: 'balanced', budgetPerDayInr: 1500, diet: 'egg', spice: 'medium', interests: ['history', 'street food', 'photography'] },
    notBefore: '08:00',
    memories: [
      { kind: 'love', text: 'Always wants a sunset spot', evidence: 'Every past trip' },
      { kind: 'skip', text: 'No animal rides (elephant or camel)', evidence: 'Said so in chat' },
      { kind: 'love', text: 'Loved the mirchi vada in Jodhpur', evidence: 'Jodhpur, Mar 2026' },
    ],
    expect: { mustNotMention: [/elephant ride/i, /camel ride/i], minFoodStops: 1, stopBetween: { from: '16:45', to: '18:45', label: 'sunset' } },
  },
  {
    id: 'jaipur-family-kids',
    city: 'Jaipur',
    dayOffset: 3,
    prefs: { group: 'family', pace: 'chill', budgetPerDayInr: 3000, diet: 'nonveg', interests: ['history', 'shopping'] },
    notBefore: '09:30',
    memories: [{ kind: 'habit', text: 'Kids (6 and 9) get cranky after long walks', evidence: 'Goa trip' }],
    expect: { minFoodStops: 1, maxWalkMin: 15 },
  },
  {
    id: 'jaipur-friends-food',
    city: 'Jaipur',
    dayOffset: 4,
    prefs: { group: 'friends', pace: 'packed', budgetPerDayInr: 1000, diet: 'nonveg', spice: 'hot', interests: ['street food', 'markets'] },
    memories: [],
    expect: { minFoodStops: 3 },
  },
  // ─── Goa ───
  {
    id: 'goa-couple-seafood',
    city: 'Goa',
    dayOffset: 2,
    prefs: { group: 'partner', pace: 'balanced', budgetPerDayInr: 4000, diet: 'nonveg', interests: ['beaches', 'seafood', 'sunsets'] },
    notBefore: '10:00',
    stayNear: 'Candolim',
    memories: [{ kind: 'skip', text: 'Hates crowded party beaches like Baga', evidence: 'Dec 2025 trip' }],
    expect: { mustNotMention: [/\bbaga\b/i], minFoodStops: 1, stopBetween: { from: '17:00', to: '18:45', label: 'sunset' } },
  },
  {
    id: 'goa-solo-culture-veg',
    city: 'Goa',
    dayOffset: 3,
    prefs: { group: 'solo', pace: 'chill', budgetPerDayInr: 1500, diet: 'veg', interests: ['culture', 'architecture', 'cafés'] },
    memories: [{ kind: 'love', text: 'Likes quiet old neighborhoods more than beaches', evidence: 'Quiz' }],
    expect: { minFoodStops: 1, mustNotMention: [/fish thali/i, /prawn/i, /chicken/i] },
  },
  {
    id: 'goa-friends-packed',
    city: 'Goa',
    dayOffset: 5,
    prefs: { group: 'friends', pace: 'packed', budgetPerDayInr: 2500, diet: 'nonveg', interests: ['beaches', 'forts', 'nightlife'] },
    memories: [{ kind: 'fact', text: 'They rent scooters everywhere', evidence: 'Every trip' }],
    expect: { minFoodStops: 2 },
  },
  // ─── Varanasi ───
  {
    id: 'varanasi-solo-sunrise',
    city: 'Varanasi',
    dayOffset: 2,
    prefs: { group: 'solo', pace: 'balanced', budgetPerDayInr: 1200, diet: 'veg', interests: ['spiritual', 'photography', 'street food'] },
    notBefore: '05:30',
    memories: [{ kind: 'love', text: 'Wants to see Ganga aarti every time', evidence: 'Rishikesh trip' }],
    expect: { minFoodStops: 2, stopBetween: { from: '18:00', to: '19:30', label: 'evening aarti' } },
  },
  {
    id: 'varanasi-parents-jain',
    city: 'Varanasi',
    dayOffset: 3,
    prefs: { group: 'parents', pace: 'chill', budgetPerDayInr: 2000, diet: 'jain', interests: ['temples', 'spiritual'] },
    notBefore: '07:00',
    memories: [{ kind: 'person', text: 'Mom uses a walking stick; keep walks short', evidence: 'You told me' }],
    expect: { maxWalkMin: 10, minFoodStops: 1, mustNotMention: [/\bonion\b/i, /\bgarlic\b/i] },
  },
  {
    id: 'varanasi-food-crawl',
    city: 'Varanasi',
    dayOffset: 4,
    prefs: { group: 'friends', pace: 'packed', budgetPerDayInr: 1500, diet: 'nonveg', interests: ['street food', 'old city lanes'] },
    memories: [],
    expect: { minFoodStops: 3 },
  },
  // ─── Udaipur ───
  {
    id: 'udaipur-couple-lakes',
    city: 'Udaipur',
    dayOffset: 2,
    prefs: { group: 'partner', pace: 'balanced', budgetPerDayInr: 3500, diet: 'egg', interests: ['lakes', 'palaces', 'sunsets'] },
    notBefore: '08:30',
    memories: [{ kind: 'love', text: 'Rooftop dinners with a view', evidence: 'Jaipur trip' }],
    expect: { minFoodStops: 1, stopBetween: { from: '17:00', to: '18:45', label: 'sunset' } },
  },
  {
    id: 'udaipur-solo-no-boats',
    city: 'Udaipur',
    dayOffset: 3,
    prefs: { group: 'solo', pace: 'chill', budgetPerDayInr: 1500, diet: 'veg', interests: ['photography', 'art', 'cafés'] },
    notBefore: '09:00',
    memories: [{ kind: 'skip', text: 'Gets seasick, no boat rides', evidence: 'Goa trip' }],
    expect: { mustNotMention: [/boat ride/i, /boating/i], minFoodStops: 1 },
  },
  {
    id: 'udaipur-family-veg',
    city: 'Udaipur',
    dayOffset: 5,
    prefs: { group: 'family', pace: 'balanced', budgetPerDayInr: 2500, diet: 'veg', interests: ['palaces', 'gardens'] },
    memories: [],
    expect: { minFoodStops: 1 },
  },
  // ─── Rishikesh ───
  {
    id: 'rishikesh-solo-adventure',
    city: 'Rishikesh',
    dayOffset: 2,
    prefs: { group: 'solo', pace: 'packed', budgetPerDayInr: 2000, diet: 'veg', interests: ['adventure', 'nature', 'cafés'] },
    notBefore: '07:00',
    memories: [],
    expect: { minFoodStops: 2 },
  },
  {
    id: 'rishikesh-friends-aarti',
    city: 'Rishikesh',
    dayOffset: 4,
    prefs: { group: 'friends', pace: 'balanced', budgetPerDayInr: 1500, diet: 'veg', interests: ['cafés', 'spiritual', 'nature'] },
    memories: [{ kind: 'love', text: 'Wants to see Ganga aarti every time', evidence: 'Varanasi trip' }],
    expect: { minFoodStops: 1, stopBetween: { from: '17:30', to: '19:00', label: 'evening aarti' } },
  },
  {
    id: 'rishikesh-vegan-yoga',
    city: 'Rishikesh',
    dayOffset: 6,
    prefs: { group: 'solo', pace: 'chill', budgetPerDayInr: 1800, diet: 'vegan', interests: ['yoga', 'wellness', 'nature'] },
    notBefore: '06:00',
    memories: [{ kind: 'fact', text: 'Vegan for 4 years, no dairy at all', evidence: 'You told me' }],
    expect: { minFoodStops: 1, mustNotMention: [/\blassi\b/i, /\bpaneer\b/i, /\bghee\b/i] },
  },
];
