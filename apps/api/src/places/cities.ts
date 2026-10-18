// Cities with a hand-checked area. bbox is [west, south, east, north].
// Any other city, anywhere in the world, is looked up automatically (see src/places/ensureCity.ts).
export const CITIES: Record<string, { name: string; country: string; bbox: [number, number, number, number] }> = {
  jaipur: { name: 'Jaipur', country: 'in', bbox: [75.65, 26.75, 76.0, 27.08] },
  udaipur: { name: 'Udaipur', country: 'in', bbox: [73.6, 24.5, 73.82, 24.68] },
  // North and South Goa: beaches, Panaji, Old Goa.
  goa: { name: 'Goa', country: 'in', bbox: [73.68, 14.89, 74.34, 15.8] },
  varanasi: { name: 'Varanasi', country: 'in', bbox: [82.88, 25.22, 83.08, 25.4] },
  // Rishikesh with Tapovan, Laxman Jhula and Swarg Ashram.
  rishikesh: { name: 'Rishikesh', country: 'in', bbox: [78.24, 30.04, 78.36, 30.15] },
};
