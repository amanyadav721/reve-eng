import type { Dish, Memory, Stop, TripSummary } from '@tagalong/shared';

// Stand-in data until the API serves real plans. Mirrors design/ui-direction.html.
// Coordinates are from OpenStreetMap (Nominatim).

export const traveler = { firstName: 'Aman', initial: 'A', points: 1240 };

export const today = { city: 'Jaipur', dayNumber: 2 };

export const jaipurDay2: Stop[] = [
  { id: 'amber', location: { lat: 26.98607, lng: 75.85008 }, name: 'Amber Fort', category: 'sight', icon: '🏰', startTime: '10:00', durationMin: 120, points: 60, status: 'done' },
  {
    id: 'kachori',
    location: { lat: 26.92424, lng: 75.82177 },
    name: 'Pyaaz kachori at Rawat',
    category: 'food',
    icon: '🥟',
    startTime: '13:00',
    durationMin: 30,
    costInr: 40,
    openUntil: '22:00',
    distanceKm: 1.2,
    hop: { mode: 'auto', minutes: 8 },
    reason: 'You loved the **mirchi vada in Jodhpur** last March. This is its Jaipur cousin. Go before 2, they sell out.',
    points: 25,
    status: 'now',
  },
  {
    id: 'hawa',
    location: { lat: 26.92393, lng: 75.82687 },
    name: 'Hawa Mahal',
    category: 'sight',
    icon: '🏯',
    startTime: '13:45',
    durationMin: 75,
    costInr: 200,
    distanceKm: 0.9,
    hop: { mode: 'walk', minutes: 12 },
    reason: "It's 36°C outside. You'll be in the shade here, and the **quiet top-floor windows** are the photo spot you like.",
    points: 40,
    status: 'upcoming',
  },
  {
    id: 'bazaar',
    location: { lat: 26.91552, lng: 75.82464 },
    name: 'Johari Bazaar',
    category: 'shopping',
    icon: '🛍️',
    startTime: '15:30',
    durationMin: 90,
    distanceKm: 2,
    hop: { mode: 'auto', minutes: 10, fareMinInr: 60, fareMaxInr: 80 },
    reason: 'Priya wanted block-print scarves. Start at **half the first price**; the shops near the Ganesh temple are fairest.',
    points: 30,
    status: 'upcoming',
  },
  {
    id: 'sunset',
    location: { lat: 26.94003, lng: 75.81653 },
    name: 'Sunset at Nahargarh',
    category: 'nature',
    icon: '🌇',
    startTime: '18:10',
    durationMin: 90,
    distanceKm: 9,
    hop: { mode: 'cab', minutes: 35, fareMinInr: 350, fareMaxInr: 450 },
    reason: 'Your favorite thing, every trip. I kept time for **the rooftop café** after, not the crowded fort wall.',
    points: 60,
    status: 'upcoming',
  },
];

export const jaipurDishes: Dish[] = [
  { id: 'd1', name: 'Pyaaz kachori', city: 'Jaipur', place: 'Rawat Misthan Bhandar', emoji: '🥟', points: 25, tasted: false },
  { id: 'd2', name: 'Dal baati churma', city: 'Jaipur', place: 'Chokhi Dhani', emoji: '🍲', points: 60, tasted: true },
  { id: 'd3', name: 'Ghewar', city: 'Jaipur', place: 'LMB, Johari Bazaar', emoji: '🍯', points: 40, tasted: true },
  { id: 'd4', name: 'Lassi', city: 'Jaipur', place: 'Lassiwala, MI Road', emoji: '🥛', points: 20, tasted: false },
];

export const learnedThisWeek: Memory = {
  id: 'm0',
  kind: 'skip',
  text: "You said the elephant ride at Amber Fort felt wrong. I won't suggest animal rides again, anywhere.",
  evidence: 'From our chat · Oct 16',
  source: 'chat',
  sensitive: false,
  createdAt: '2026-10-16',
};

export const aboutYou: Memory[] = [
  { id: 'm1', kind: 'fact', icon: '🥚', text: 'Vegetarian, eats eggs', evidence: 'You told me · Mar 2026', source: 'quiz', sensitive: false, createdAt: '2026-03-02' },
  { id: 'm2', kind: 'habit', icon: '🌶️', text: 'Medium spice, not more', evidence: 'You skipped laal maas twice', source: 'edits', sensitive: false, createdAt: '2026-03-10' },
  { id: 'm3', kind: 'habit', icon: '😴', text: 'Nothing before 8 AM', evidence: 'You snoozed 3 sunrise plans', source: 'edits', sensitive: false, createdAt: '2025-12-20' },
  { id: 'm4', kind: 'habit', icon: '🦶', text: 'Tired after about 4 stops', evidence: 'From your check-ins', source: 'checkins', sensitive: false, createdAt: '2026-03-12' },
  { id: 'm5', kind: 'fact', icon: '👛', text: 'About ₹1,500 a day', evidence: 'Your usual spend, excluding stay', source: 'checkins', sensitive: false, createdAt: '2026-03-14' },
];

export const loves = ['🌇 Sunsets', '☕ Rooftop cafés', '🧺 Old bazaars', '🥟 Street food', '📷 Quiet photo spots'];
export const skips = ['Malls', 'Long queues', 'Animal rides'];

export const companions: Memory[] = [
  { id: 'p1', kind: 'person', icon: 'P', text: 'Priya', evidence: 'Vegan · loves museums · gets carsick on hill roads', source: 'chat', sensitive: true, createdAt: '2026-03-01' },
];

export const trips: TripSummary[] = [
  { id: 't3', city: 'Jaipur', startDate: '2026-10-16', endDate: '2026-10-19', stamps: 4, status: 'active' },
  { id: 't2', city: 'Jodhpur', startDate: '2026-03-10', endDate: '2026-03-14', stamps: 12, status: 'past' },
  { id: 't1', city: 'Goa', startDate: '2025-12-20', endDate: '2025-12-24', stamps: 9, status: 'past' },
];
